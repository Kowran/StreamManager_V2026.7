import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EfiConfig {
  client_id: string;
  client_secret: string;
  pix_key: string;
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

async function getEfiAccessToken(config: EfiConfig): Promise<string> {
  const isSandbox = config.test_mode !== false;
  const oauthUrl = isSandbox
    ? 'https://sandbox.api.efipay.com.br/v1/authorize'
    : 'https://api.efipay.com.br/v1/authorize';

  const basicAuth = btoa(`${config.client_id}:${config.client_secret}`);

  const response = await fetch(oauthUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error_description || result.message || 'Falha na autenticacao OAuth');
  }

  return result.access_token;
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
    console.log('EFI webhook received:', body);

    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'efi_config')
      .maybeSingle();

    if (configError || !configData?.value) {
      console.error('EFI config not found');
      return new Response('Configuration error', { status: 500, headers: corsHeaders });
    }

    const config: EfiConfig = configData.value;

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

    console.log('Webhook event:', webhookData.event || webhookData.type || 'unknown', webhookData);

    // EFI PIX webhook: pix webhook events come as { evento: 'pix_cob.recebida', data: {...} }
    // Or standard: { txid, status, ... }
    const txid = webhookData.txid || webhookData.data?.txid || webhookData.endToEndId;
    const chargeId = webhookData.id || webhookData.data?.id;

    let lookupId = txid || chargeId;

    if (!lookupId) {
      console.error('No txid or charge_id in webhook');
      return new Response('No reference found', { status: 400, headers: corsHeaders });
    }

    if (!config.client_id?.trim() || !config.client_secret?.trim()) {
      console.error('Credentials not configured, cannot verify payment');
      return new Response('Credentials not configured', { status: 500, headers: corsHeaders });
    }

    const accessToken = await getEfiAccessToken(config);
    const isSandbox = config.test_mode !== false;
    const apiBase = isSandbox
      ? 'https://sandbox.api.efipay.com.br'
      : 'https://api.efipay.com.br';

    let paymentDetails: any = null;
    let apiStatus = 'pending';
    let isPix = false;

    // Try PIX first
    if (txid) {
      const pixResponse = await fetch(`${apiBase}/v2/cob/${txid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (pixResponse.ok) {
        paymentDetails = await pixResponse.json();
        apiStatus = paymentDetails.status || 'pending';
        isPix = true;
      }
    }

    // Try boleto if PIX lookup failed
    if (!paymentDetails && chargeId) {
      const boletoResponse = await fetch(`${apiBase}/v1/charge/${chargeId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (boletoResponse.ok) {
        paymentDetails = await boletoResponse.json();
        apiStatus = paymentDetails.data?.status || paymentDetails.status || 'pending';
      }
    }

    if (!paymentDetails) {
      console.error('Could not fetch payment details from EFI API');
      return new Response('Payment fetch failed', { status: 500, headers: corsHeaders });
    }

    console.log('EFI payment status:', apiStatus);

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('efi_payments')
      .select('*')
      .or(`payment_id.eq.${lookupId},external_reference.eq.${lookupId}`)
      .maybeSingle();

    if (paymentError || !payment) {
      console.error('Payment record not found for:', lookupId);
      return new Response('Payment not found', { status: 404, headers: corsHeaders });
    }

    const approvedStatuses = ['CONCLUIDA', 'APPROVED', 'COMPLETED', 'paid', 'approved', 'completed', 'settled'];
    const isApproved = approvedStatuses.includes(apiStatus);

    const updateData: any = {
      status: apiStatus,
      status_detail: apiStatus,
      webhook_data: {
        ...payment.webhook_data,
        webhook_received: true,
        webhook_event: webhookData.evento || webhookData.event || webhookData.type || 'unknown',
        payment_details: paymentDetails,
        processed_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };

    if (isApproved) {
      updateData.approved_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from('efi_payments')
      .update(updateData)
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating payment:', updateError);
      return new Response('Update failed', { status: 500, headers: corsHeaders });
    }

    if (isApproved && !payment.credits_added) {
      await processCreditAddition(supabaseAdmin, payment, paymentDetails);
    }

    console.log(`EFI payment ${lookupId} updated to status: ${apiStatus}`);

    return new Response('OK', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('EFI webhook processing error:', error);
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
    console.log('Processing credit addition for approved EFI payment:', payment.id);

    const { data: existingTx } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('reference_id', payment.id)
      .eq('reference_type', 'efi_payment')
      .maybeSingle();

    if (existingTx) {
      console.log('Credits already added for payment:', payment.id);
      await supabase
        .from('efi_payments')
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
        description: `Recarga via EFI Bank - $${amountUSD.toFixed(2)} (cobrado R$${payment.amount_brl.toFixed(2)})`,
        reference_id: payment.id,
        reference_type: 'efi_payment',
        metadata: {
          payment_id: paymentDetails.txid || paymentDetails.data?.id,
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
      .from('efi_payments')
      .update({ credits_added: true, updated_at: new Date().toISOString() })
      .eq('id', payment.id);

    await supabase.rpc('create_notification', {
      p_user_id: payment.user_id,
      p_type: 'payment',
      p_title: 'Recarga Confirmada!',
      p_message: `Sua recarga de ${amountUSD.toFixed(2)} via EFI Bank foi confirmada! Valor cobrado: R$${payment.amount_brl.toFixed(2)}.`,
      p_data: {
        payment_id: paymentDetails.txid || paymentDetails.data?.id,
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

    console.log(`Successfully processed EFI payment, credited ${amountUSD} to user ${payment.user_id}`);

  } catch (error) {
    console.error('Error processing credit addition:', error);
  }
}
