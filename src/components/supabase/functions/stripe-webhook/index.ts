import { createClient } from 'npm:@supabase/supabase-js@2.54.0';
import Stripe from 'npm:stripe@17.3.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Stripe-Signature",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Stripe configuration
    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'stripe_config')
      .single();

    if (configError || !configData?.value) {
      console.error('Stripe config not found');
      return new Response('Configuration error', { status: 500, headers: corsHeaders });
    }

    const config = configData.value;

    // Initialize Stripe
    const stripe = new Stripe(config.secret_key, {
      apiVersion: '2024-12-18.acacia'
    });

    // Get webhook signature
    const signature = req.headers.get('Stripe-Signature');
    if (!signature) {
      console.error('No Stripe signature provided');
      return new Response('No signature', { status: 400, headers: corsHeaders });
    }

    // Get request body
    const body = await req.text();
    console.log('Stripe webhook received');

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, config.webhook_secret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response('Invalid signature', { status: 401, headers: corsHeaders });
    }

    console.log('Webhook event type:', event.type);

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(supabaseAdmin, event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(supabaseAdmin, event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.canceled':
        await handlePaymentCanceled(supabaseAdmin, event.data.object as Stripe.PaymentIntent);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Webhook processing failed',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function handlePaymentSucceeded(supabase: any, paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('Processing successful payment:', paymentIntent.id);

    // Find the payment record
    const { data: payment, error: paymentError } = await supabase
      .from('stripe_payments')
      .select('*')
      .eq('payment_intent_id', paymentIntent.id)
      .single();

    if (paymentError || !payment) {
      console.error('Payment record not found:', paymentIntent.id);
      return;
    }

    // Get the original amount and fees from metadata
    const originalAmount = parseFloat(paymentIntent.metadata.original_amount_usd || payment.amount_usd);
    const totalCharged = parseFloat(paymentIntent.metadata.total_charged_usd || payment.amount_usd);
    const stripeFee = parseFloat(paymentIntent.metadata.stripe_fee || '0');

    // Update payment status
    const { error: updateError } = await supabase
      .from('stripe_payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_charge_id: paymentIntent.latest_charge,
        webhook_data: {
          ...payment.webhook_data,
          payment_intent: paymentIntent,
          webhook_received: true,
          processed_at: new Date().toISOString(),
          original_amount_usd: originalAmount,
          total_charged_usd: totalCharged,
          stripe_fee: stripeFee,
          amount_charged_cents: paymentIntent.amount,
          amount_received_cents: paymentIntent.amount_received
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating payment:', updateError);
      return;
    }

    // Add credits to user account (only the original amount, not including fees)
    const amountUSD = originalAmount; // Only credit the original amount, not the fees
    
    // Get current user credit balance
    const { data: userCredit, error: creditError } = await supabase
      .from('user_credits')
      .select('balance, total_recharged')
      .eq('user_id', payment.user_id)
      .single();

    if (creditError && creditError.code !== 'PGRST116') {
      console.error('Error getting user credit:', creditError);
      return;
    }

    const currentBalance = userCredit?.balance || 0;
    const currentTotalRecharged = userCredit?.total_recharged || 0;
    const newBalance = currentBalance + amountUSD;
    const newTotalRecharged = currentTotalRecharged + amountUSD;

    // Create credit transaction
    const { error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: payment.user_id,
        type: 'recharge',
        amount: amountUSD,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: `Recarga via Stripe - $${amountUSD.toFixed(2)} (cobrado $${totalCharged.toFixed(2)} com taxas)`,
        reference_id: payment.id,
        reference_type: 'stripe_payment',
        metadata: {
          payment_intent_id: paymentIntent.id,
          stripe_charge_id: paymentIntent.latest_charge,
          payment_method: 'stripe',
          currency: payment.currency,
          original_amount: originalAmount,
          total_charged: totalCharged,
          stripe_fee: stripeFee,
          fees_excluded_from_balance: true
        }
      });

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      return;
    }

    // Update or create user credit record
    const { error: creditUpdateError } = await supabase
      .from('user_credits')
      .upsert({
        user_id: payment.user_id,
        balance: newBalance,
        total_recharged: newTotalRecharged,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (creditUpdateError) {
      console.error('Error updating user credit:', creditUpdateError);
      return;
    }

    // Create success notification
    await supabase.rpc('create_notification', {
      p_user_id: payment.user_id,
      p_type: 'payment',
      p_title: '💳 Recarga Confirmada!',
      p_message: `Sua recarga de $${amountUSD.toFixed(2)} via Stripe foi confirmada! Total cobrado: $${totalCharged.toFixed(2)} (inclui taxas de $${stripeFee.toFixed(2)}).`,
      p_data: {
        payment_intent_id: paymentIntent.id,
        amount: amountUSD,
        total_charged: totalCharged,
        stripe_fee: stripeFee,
        currency: payment.currency,
        payment_method: 'stripe'
      },
      p_priority: 'high',
      p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    console.log(`Successfully processed Stripe payment: ${paymentIntent.id}, charged $${totalCharged} (fee: $${stripeFee}), credited $${amountUSD} to user ${payment.user_id}`);

  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

async function handlePaymentFailed(supabase: any, paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('Processing failed payment:', paymentIntent.id);

    // Update payment status
    const { error: updateError } = await supabase
      .from('stripe_payments')
      .update({
        status: 'failed',
        webhook_data: {
          payment_intent: paymentIntent,
          webhook_received: true,
          processed_at: new Date().toISOString(),
          failure_reason: paymentIntent.last_payment_error?.message
        },
        updated_at: new Date().toISOString()
      })
      .eq('payment_intent_id', paymentIntent.id);

    if (updateError) {
      console.error('Error updating failed payment:', updateError);
      return;
    }

    // Get payment record to notify user
    const { data: payment } = await supabase
      .from('stripe_payments')
      .select('user_id, amount_usd')
      .eq('payment_intent_id', paymentIntent.id)
      .single();

    if (payment) {
      // Create failure notification
      await supabase.rpc('create_notification', {
        p_user_id: payment.user_id,
        p_type: 'payment',
        p_title: '❌ Pagamento Falhou',
        p_message: `Seu pagamento de $${payment.amount_usd.toFixed(2)} via Stripe falhou. Tente novamente ou use outro método de pagamento.`,
        p_data: {
          payment_intent_id: paymentIntent.id,
          amount: payment.amount_usd,
          failure_reason: paymentIntent.last_payment_error?.message,
          payment_method: 'stripe'
        },
        p_priority: 'high',
        p_expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    console.log(`Processed failed Stripe payment: ${paymentIntent.id}`);

  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

async function handlePaymentCanceled(supabase: any, paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('Processing canceled payment:', paymentIntent.id);

    // Update payment status
    const { error: updateError } = await supabase
      .from('stripe_payments')
      .update({
        status: 'cancelled',
        webhook_data: {
          payment_intent: paymentIntent,
          webhook_received: true,
          processed_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('payment_intent_id', paymentIntent.id);

    if (updateError) {
      console.error('Error updating canceled payment:', updateError);
    }

    console.log(`Processed canceled Stripe payment: ${paymentIntent.id}`);

  } catch (error) {
    console.error('Error handling payment cancellation:', error);
  }
}