import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PagBankConfig {
  api_token: string;
  test_mode: boolean;
  webhook_token: string;
}

async function sendEmailNotification(
  templateType: string,
  recipientId: string,
  variables: Record<string, string | number>
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        template_type: templateType,
        recipient_id: recipientId,
        variables,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error(`send-email failed for ${templateType}: ${errText}`);
    }
  } catch (err) {
    console.error(`Failed to send ${templateType} email (non-fatal):`, err);
  }
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
    console.log('PagBank webhook received:', body);

    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'pagbank_config')
      .maybeSingle();

    if (configError || !configData?.value) {
      console.error('PagBank config not found');
      return new Response('Configuration error', { status: 500, headers: corsHeaders });
    }

    const config: PagBankConfig = configData.value;

    if (config.webhook_token) {
      const url = new URL(req.url);
      const tokenParam = url.searchParams.get('token');
      if (tokenParam !== config.webhook_token) {
        console.error('Invalid webhook token');
        return new Response('Invalid token', { status: 401, headers: corsHeaders });
      }
    }

    let webhookData: any;
    try {
      webhookData = JSON.parse(body);
    } catch {
      console.error('Invalid JSON in webhook body');
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }

    console.log('Webhook event:', webhookData.event || webhookData.type || 'unknown');

    const orderId = webhookData.reference_id || webhookData.order?.reference_id || webhookData.reference;
    const paymentId = webhookData.id || webhookData.order?.id || webhookData.payment?.id;

    if (!paymentId && !orderId) {
      console.error('No payment_id or reference_id in webhook');
      return new Response('No reference found', { status: 400, headers: corsHeaders });
    }

    let lookupId = paymentId;
    if (!lookupId && orderId) {
      const { data: existingPayment } = await supabaseAdmin
        .from('pagbank_payments')
        .select('payment_id')
        .eq('order_id', orderId)
        .maybeSingle();
      lookupId = existingPayment?.payment_id;
    }

    if (!lookupId) {
      console.error('Could not determine payment ID for lookup');
      return new Response('Payment not found', { status: 404, headers: corsHeaders });
    }

    if (!config.api_token?.trim()) {
      console.error('API token not configured, cannot verify payment');
      return new Response('API token not configured', { status: 500, headers: corsHeaders });
    }

    const isSandbox = config.test_mode !== false;
    const apiBase = isSandbox
      ? 'https://sandbox.api.pagseguro.com'
      : 'https://api.pagseguro.com';

    const paymentResponse = await fetch(`${apiBase}/orders/${lookupId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.api_token}`,
        'Content-Type': 'application/json',
      },
    });

    const paymentDetails = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error('Error fetching PagBank payment details:', paymentDetails);
      return new Response('Payment fetch failed', { status: 500, headers: corsHeaders });
    }

    console.log('PagBank payment status:', paymentDetails.status);

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('pagbank_payments')
      .select('*')
      .or(`payment_id.eq.${lookupId},external_reference.eq.${paymentDetails.reference_id || orderId}`)
      .maybeSingle();

    if (paymentError || !payment) {
      console.error('Payment record not found for payment_id:', lookupId);
      return new Response('Payment not found', { status: 404, headers: corsHeaders });
    }

    const approvedStatuses = ['PAID', 'APPROVED', 'COMPLETED', 'paid', 'approved', 'completed'];
    const apiStatus = paymentDetails.status || paymentDetails.charges?.[0]?.status || 'pending';
    const isApproved = approvedStatuses.includes(apiStatus);

    const updateData: any = {
      payment_id: lookupId,
      status: apiStatus,
      status_detail: apiStatus,
      webhook_data: {
        ...payment.webhook_data,
        webhook_received: true,
        webhook_event: webhookData.event || webhookData.type || 'unknown',
        payment_details: paymentDetails,
        processed_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };

    if (isApproved) {
      updateData.approved_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from('pagbank_payments')
      .update(updateData)
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating payment:', updateError);
      return new Response('Update failed', { status: 500, headers: corsHeaders });
    }

    if (isApproved && !payment.credits_added) {
      await processCreditAddition(supabaseAdmin, payment, paymentDetails);
    }

    console.log(`PagBank payment ${lookupId} updated to status: ${apiStatus}`);

    return new Response('OK', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('PagBank webhook processing error:', error);
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
    console.log('Processing credit addition for approved PagBank payment:', payment.id);

    const { data: existingTx } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('reference_id', payment.id)
      .eq('reference_type', 'pagbank_payment')
      .maybeSingle();

    if (existingTx) {
      console.log('Credits already added for payment:', payment.id);
      await supabase
        .from('pagbank_payments')
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
        description: `Recarga via PagBank - $${amountUSD.toFixed(2)} (cobrado R$${payment.amount_brl.toFixed(2)})`,
        reference_id: payment.id,
        reference_type: 'pagbank_payment',
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
      .from('pagbank_payments')
      .update({ credits_added: true, updated_at: new Date().toISOString() })
      .eq('id', payment.id);

    await supabase.rpc('create_notification', {
      p_user_id: payment.user_id,
      p_type: 'payment',
      p_title: 'Recarga Confirmada!',
      p_message: `Sua recarga de ${amountUSD.toFixed(2)} via PagBank foi confirmada! Valor cobrado: R$${payment.amount_brl.toFixed(2)}.`,
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

    await sendEmailNotification('recharge_deposit', payment.user_id, {
      user_name: 'Cliente',
      amount: amountUSD.toFixed(2),
      new_balance: newBalance.toFixed(2),
    });

    console.log(`Successfully processed PagBank payment: ${paymentDetails.id}, credited ${amountUSD} to user ${payment.user_id}`);

  } catch (error) {
    console.error('Error processing credit addition:', error);
  }
}
