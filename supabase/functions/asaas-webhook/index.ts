import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AsaasWebhookPayload {
  event: string;
  payment: {
    id: string;
  };
}

interface AsaasConfig {
  access_token: string;
  test_mode: boolean;
  webhook_token: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.text();
    console.log('Asaas webhook received:', body);

    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'asaas_config')
      .maybeSingle();

    if (configError || !configData?.value) {
      console.error('Asaas config not found');
      return new Response('Configuration error', { status: 500, headers: corsHeaders });
    }

    const config: AsaasConfig = configData.value;

    if (config.webhook_token) {
      const url = new URL(req.url);
      const tokenParam = url.searchParams.get('token');
      if (tokenParam !== config.webhook_token) {
        console.error('Invalid webhook token');
        return new Response('Invalid token', { status: 401, headers: corsHeaders });
      }
    }

    let webhookData: AsaasWebhookPayload;
    try {
      webhookData = JSON.parse(body);
    } catch (parseError) {
      console.error('Invalid JSON in webhook body');
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }

    console.log('Webhook event:', webhookData.event);

    const paymentEvents = [
      'PAYMENT_RECEIVED',
      'PAYMENT_CONFIRMED',
      'PAYMENT_CREATED',
      'PAYMENT_UPDATED',
      'PAYMENT_OVERDUE',
      'PAYMENT_REFUNDED',
    ];

    if (!paymentEvents.includes(webhookData.event)) {
      console.log('Ignoring non-payment webhook:', webhookData.event);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const paymentId = webhookData.payment.id;
    const apiBase = config.test_mode
      ? 'https://sandbox.asaas.com/v3'
      : 'https://api.asaas.com/v3';

    const paymentResponse = await fetch(`${apiBase}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const paymentDetails = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error('Error fetching Asaas payment details:', paymentDetails);
      return new Response('Payment fetch failed', { status: 500, headers: corsHeaders });
    }

    console.log('Asaas payment details:', paymentDetails.status);

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('asaas_payments')
      .select('*')
      .or(`payment_id.eq.${paymentId},external_reference.eq.${paymentDetails.externalReference}`)
      .maybeSingle();

    if (paymentError || !payment) {
      console.error('Payment record not found for payment_id:', paymentId);
      return new Response('Payment not found', { status: 404, headers: corsHeaders });
    }

    const approvedStatuses = ['CONFIRMED', 'RECEIVED'];
    const isApproved = approvedStatuses.includes(paymentDetails.status);

    const updateData: any = {
      payment_id: paymentId,
      status: paymentDetails.status,
      status_detail: paymentDetails.status,
      webhook_data: {
        ...payment.webhook_data,
        webhook_received: true,
        webhook_event: webhookData.event,
        payment_details: paymentDetails,
        processed_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };

    if (isApproved) {
      updateData.approved_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from('asaas_payments')
      .update(updateData)
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating payment:', updateError);
      return new Response('Update failed', { status: 500, headers: corsHeaders });
    }

    if (isApproved && !payment.credits_added) {
      await processCreditAddition(supabaseAdmin, payment, paymentDetails);
    }

    console.log(`Asaas payment ${paymentId} updated to status: ${paymentDetails.status}`);

    return new Response('OK', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Asaas webhook processing error:', error);
    return new Response(JSON.stringify({
      error: 'Webhook processing failed',
      details: error.message
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processCreditAddition(supabase: any, payment: any, paymentDetails: any) {
  try {
    console.log('Processing credit addition for approved Asaas payment:', payment.id);

    const { data: existingTx } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('reference_id', payment.id)
      .eq('reference_type', 'asaas_payment')
      .maybeSingle();

    if (existingTx) {
      console.log('Credits already added for payment:', payment.id);
      await supabase
        .from('asaas_payments')
        .update({ credits_added: true, updated_at: new Date().toISOString() })
        .eq('id', payment.id);
      return;
    }

    const { data: userCredit, error: creditError } = await supabase
      .from('user_credits')
      .select('balance, total_recharged')
      .eq('user_id', payment.user_id)
      .maybeSingle();

    if (creditError && creditError.code !== 'PGRST116') {
      console.error('Error getting user credit:', creditError);
      return;
    }

    const currentBalance = userCredit?.balance || 0;
    const currentTotalRecharged = userCredit?.total_recharged || 0;
    const amountUSD = payment.amount_usd;
    const newBalance = currentBalance + amountUSD;
    const newTotalRecharged = currentTotalRecharged + amountUSD;

    const { error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: payment.user_id,
        type: 'recharge',
        amount: amountUSD,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: `Recarga via Asaas - $${amountUSD.toFixed(2)} (cobrado R$${payment.amount_brl.toFixed(2)})`,
        reference_id: payment.id,
        reference_type: 'asaas_payment',
        metadata: {
          payment_id: paymentDetails.id,
          billing_type: payment.billing_type,
          currency: payment.currency,
          amount_brl: payment.amount_brl,
          amount_usd: amountUSD,
          status: paymentDetails.status,
        }
      });

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      return;
    }

    const { error: creditUpdateError } = await supabase
      .from('user_credits')
      .upsert({
        user_id: payment.user_id,
        balance: newBalance,
        total_recharged: newTotalRecharged,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (creditUpdateError) {
      console.error('Error updating user credit:', creditUpdateError);
      return;
    }

    await supabase
      .from('asaas_payments')
      .update({ credits_added: true, updated_at: new Date().toISOString() })
      .eq('id', payment.id);

    await supabase.rpc('create_notification', {
      p_user_id: payment.user_id,
      p_type: 'payment',
      p_title: 'Recarga Confirmada!',
      p_message: `Sua recarga de $${amountUSD.toFixed(2)} via Asaas foi confirmada! Valor cobrado: R$${payment.amount_brl.toFixed(2)}.`,
      p_data: {
        payment_id: paymentDetails.id,
        amount_usd: amountUSD,
        amount_brl: payment.amount_brl,
        billing_type: payment.billing_type,
        currency: payment.currency
      },
      p_priority: 'high',
      p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    console.log(`Successfully processed Asaas payment: ${paymentDetails.id}, credited $${amountUSD} to user ${payment.user_id}`);

  } catch (error) {
    console.error('Error processing credit addition:', error);
  }
}
