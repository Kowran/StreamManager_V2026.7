import { createClient } from 'npm:@supabase/supabase-js@2.54.0';
import Stripe from 'npm:stripe@17.3.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { payment_intent_id } = await req.json();
    if (!payment_intent_id) {
      return new Response(
        JSON.stringify({ error: 'payment_intent_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Stripe configuration
    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'stripe_config')
      .maybeSingle();

    if (configError || !configData?.value) {
      return new Response(
        JSON.stringify({ error: 'Stripe configuration not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = configData.value;
    const stripe = new Stripe(config.secret_key, {
      apiVersion: '2024-12-18.acacia'
    });

    // Retrieve the payment intent from Stripe to confirm status
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (paymentIntent.status !== 'succeeded') {
      return new Response(
        JSON.stringify({
          success: false,
          status: paymentIntent.status,
          message: `Payment status is ${paymentIntent.status}, not succeeded`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the payment record in our database
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('stripe_payments')
      .select('*')
      .eq('payment_intent_id', payment_intent_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Payment record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If already processed (status === 'paid'), return success without duplicating
    if (payment.status === 'paid') {
      return new Response(
        JSON.stringify({
          success: true,
          already_processed: true,
          amount_credited: parseFloat(payment.amount_usd),
          message: 'Payment already confirmed and credits already added'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the original amount and fees from metadata
    const originalAmountUSD = parseFloat(paymentIntent.metadata.original_amount_usd || payment.amount_usd);
    const chargeCurrency = paymentIntent.metadata.charge_currency || payment.currency || 'USD';
    const totalChargedInCurrency = parseFloat(paymentIntent.metadata.total_charged || '0');
    const stripeFeeInCurrency = parseFloat(paymentIntent.metadata.stripe_fee || '0');
    const exchangeRate = parseFloat(paymentIntent.metadata.exchange_rate || '1');
    const totalChargedUSD = exchangeRate > 0 ? totalChargedInCurrency / exchangeRate : originalAmountUSD;
    const stripeFeeUSD = exchangeRate > 0 ? stripeFeeInCurrency / exchangeRate : 0;

    // Update payment status to paid
    const { error: updateError } = await supabaseAdmin
      .from('stripe_payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_charge_id: paymentIntent.latest_charge,
        webhook_data: {
          ...payment.webhook_data,
          payment_intent: paymentIntent,
          confirmed_via: 'frontend_confirmation',
          processed_at: new Date().toISOString(),
          original_amount_usd: originalAmountUSD,
          charge_currency: chargeCurrency,
          total_charged: totalChargedInCurrency,
          total_charged_usd: totalChargedUSD,
          stripe_fee: stripeFeeInCurrency,
          stripe_fee_usd: stripeFeeUSD,
          amount_charged_cents: paymentIntent.amount,
          amount_received_cents: paymentIntent.amount_received
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating payment:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update payment status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current user credit balance
    const { data: userCredit, error: creditError } = await supabaseAdmin
      .from('user_credits')
      .select('balance, total_recharged')
      .eq('user_id', payment.user_id)
      .maybeSingle();

    if (creditError && creditError.code !== 'PGRST116') {
      console.error('Error getting user credit:', creditError);
      return new Response(
        JSON.stringify({ error: 'Failed to get user credit balance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentBalance = parseFloat(userCredit?.balance || 0);
    const currentTotalRecharged = parseFloat(userCredit?.total_recharged || 0);
    const newBalance = currentBalance + originalAmountUSD;
    const newTotalRecharged = currentTotalRecharged + originalAmountUSD;

    // Create credit transaction
    const { error: transactionError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: payment.user_id,
        type: 'recharge',
        amount: originalAmountUSD,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: `Recarga via Stripe - $${originalAmountUSD.toFixed(2)} (cobrado ${chargeCurrency} ${totalChargedInCurrency.toFixed(2)} com taxas)`,
        reference_id: payment.id,
        reference_type: 'stripe_payment',
        metadata: {
          payment_intent_id: paymentIntent.id,
          stripe_charge_id: paymentIntent.latest_charge,
          payment_method: 'stripe',
          currency: chargeCurrency,
          original_amount_usd: originalAmountUSD,
          total_charged: totalChargedInCurrency,
          total_charged_usd: totalChargedUSD,
          stripe_fee: stripeFeeInCurrency,
          stripe_fee_usd: stripeFeeUSD,
          fees_excluded_from_balance: true,
          confirmed_via: 'frontend_confirmation'
        }
      });

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create credit transaction' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update or create user credit record
    const { error: creditUpdateError } = await supabaseAdmin
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
      return new Response(
        JSON.stringify({ error: 'Failed to update user credit balance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create success notification
    await supabaseAdmin.rpc('create_notification', {
      p_user_id: payment.user_id,
      p_type: 'payment',
      p_title: 'Recarga Confirmada!',
      p_message: `Sua recarga de $${originalAmountUSD.toFixed(2)} via Stripe foi confirmada! Total cobrado: ${chargeCurrency} ${totalChargedInCurrency.toFixed(2)} (inclui taxas de ${chargeCurrency} ${stripeFeeInCurrency.toFixed(2)}). Saldo adicionado: $${originalAmountUSD.toFixed(2)}.`,
      p_data: {
        payment_intent_id: paymentIntent.id,
        amount: originalAmountUSD,
        charge_currency: chargeCurrency,
        total_charged: totalChargedInCurrency,
        total_charged_usd: totalChargedUSD,
        stripe_fee: stripeFeeInCurrency,
        stripe_fee_usd: stripeFeeUSD,
        currency: chargeCurrency,
        payment_method: 'stripe',
        new_balance: newBalance
      },
      p_priority: 'high',
      p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    console.log(`Successfully confirmed Stripe payment via frontend: ${paymentIntent.id}, credited $${originalAmountUSD} to user ${payment.user_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        amount_credited: originalAmountUSD,
        new_balance: newBalance,
        charge_currency: chargeCurrency,
        total_charged: totalChargedInCurrency,
        message: `Payment confirmed! $${originalAmountUSD.toFixed(2)} added to your balance.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error confirming Stripe payment:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
