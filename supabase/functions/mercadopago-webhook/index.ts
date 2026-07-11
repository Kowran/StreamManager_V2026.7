import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Signature, X-Request-Id",
};

interface WebhookPayload {
  id: number;
  live_mode: boolean;
  type: string;
  date_created: string;
  application_id: number;
  user_id: number;
  version: number;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

interface MercadoPagoConfig {
  access_token: string;
  public_key: string;
  webhook_secret: string;
  test_mode: boolean;
}

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

    // Get webhook signature for verification
    const signature = req.headers.get('X-Signature');
    const requestId = req.headers.get('X-Request-Id');

    // Get request body
    const body = await req.text();
    console.log('MercadoPago webhook received:', body);

    // Get MercadoPago configuration
    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'mercadopago_config')
      .single();

    if (configError || !configData?.value) {
      console.error('MercadoPago config not found');
      return new Response('Configuration error', { status: 500, headers: corsHeaders });
    }

    const config: MercadoPagoConfig = configData.value;

    // Verify webhook signature if secret is configured
    if (config.webhook_secret && signature) {
      const isValid = await verifyWebhookSignature(body, signature, config.webhook_secret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response('Invalid signature', { status: 401, headers: corsHeaders });
      }
    }

    let webhookData: WebhookPayload;
    try {
      webhookData = JSON.parse(body);
    } catch (parseError) {
      console.error('Invalid JSON in webhook body');
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }

    console.log('Webhook data:', webhookData);

    // Only process payment events
    if (webhookData.type !== 'payment') {
      console.log('Ignoring non-payment webhook:', webhookData.type);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const paymentId = webhookData.data.id;

    // Get payment details from MercadoPago API
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const paymentDetails = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error('Error fetching payment details:', paymentDetails);
      return new Response('Payment fetch failed', { status: 500, headers: corsHeaders });
    }

    console.log('Payment details:', paymentDetails);

    // Find our payment record by external_reference or payment_id
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('mercadopago_payments')
      .select('*') 
      .or(`payment_id.eq.${paymentId},external_reference.eq.${paymentDetails.external_reference}`)
      .single();

    if (paymentError || !payment) {
      console.error('Payment record not found for payment_id:', paymentId, 'external_reference:', paymentDetails.external_reference);
      return new Response('Payment not found', { status: 404, headers: corsHeaders });
    }

    // Update payment record with actual payment ID and status
    const updateData: any = {
      payment_id: paymentId.toString(),
      status: paymentDetails.status,
      status_detail: paymentDetails.status_detail,
      payment_method_id: paymentDetails.payment_method_id,
      webhook_data: {
        ...payment.webhook_data,
        webhook_received: true,
        webhook_data: webhookData,
        payment_details: paymentDetails,
        processed_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };

    // If payment is approved, set approval timestamp and process credit addition
    if (paymentDetails.status === 'approved') {
      updateData.approved_at = paymentDetails.date_approved 
        ? new Date(paymentDetails.date_approved).toISOString()
        : new Date().toISOString();

      // Process credit addition immediately
      await processCreditAddition(supabaseAdmin, payment, paymentDetails);
    }

    const { error: updateError } = await supabaseAdmin
      .from('mercadopago_payments')
      .update(updateData)
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating payment:', updateError);
      return new Response('Update failed', { status: 500, headers: corsHeaders });
    }

    console.log(`Payment ${paymentId} updated to status: ${paymentDetails.status}`);

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

async function processCreditAddition(supabase: any, payment: any, paymentDetails: any) {
  try {
    console.log('Processing credit addition for approved MercadoPago payment:', payment.id);

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
    const amountUSD = payment.amount_usd; // Amount in USD to credit
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
        description: `Recarga via Mercado Pago - $${amountUSD.toFixed(2)} (cobrado R$${payment.amount_brl.toFixed(2)})`,
        reference_id: payment.id,
        reference_type: 'mercadopago_payment',
        metadata: {
          payment_id: paymentDetails.id,
          payment_method: paymentDetails.payment_method_id,
          payment_type: paymentDetails.payment_type_id,
          currency: payment.currency,
          amount_brl: payment.amount_brl,
          amount_usd: amountUSD,
          transaction_amount: paymentDetails.transaction_amount,
          status: paymentDetails.status,
          approved_at: paymentDetails.date_approved
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
      p_message: `Sua recarga de $${amountUSD.toFixed(2)} via Mercado Pago foi confirmada! Valor cobrado: R$${payment.amount_brl.toFixed(2)}.`,
      p_data: {
        payment_id: paymentDetails.id,
        amount_usd: amountUSD,
        amount_brl: payment.amount_brl,
        payment_method: paymentDetails.payment_method_id,
        currency: payment.currency
      },
      p_priority: 'high',
      p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    console.log(`Successfully processed MercadoPago payment: ${paymentDetails.id}, credited $${amountUSD} to user ${payment.user_id}`);

  } catch (error) {
    console.error('Error processing credit addition:', error);
  }
}

async function verifyWebhookSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    // MercadoPago webhook signature verification
    // The signature format is: ts=timestamp,v1=signature
    const parts = signature.split(',');
    const timestamp = parts.find(part => part.startsWith('ts='))?.split('=')[1];
    const sig = parts.find(part => part.startsWith('v1='))?.split('=')[1];

    if (!timestamp || !sig) {
      return false;
    }

    // Create the payload to verify
    const payload = `${timestamp}.${body}`;
    
    // Generate expected signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return sig === expectedSignature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}