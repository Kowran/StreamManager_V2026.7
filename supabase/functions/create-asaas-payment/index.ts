import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PaymentRequest {
  amount: number;
  payment_method: 'pix' | 'boleto';
  payer?: {
    email: string;
    first_name?: string;
    last_name?: string;
    cpf?: string;
  };
}

interface AsaasConfig {
  access_token: string;
  test_mode: boolean;
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const jwtParts = token.split('.');
    if (jwtParts.length !== 3) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const jwtPayload = JSON.parse(atob(jwtParts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const userId = jwtPayload.sub;
    const userEmail = jwtPayload.email;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const requestData: PaymentRequest = await req.json();
    const { amount, payment_method, payer } = requestData;

    if (!amount || amount < 0.01 || amount > 1000) {
      return new Response(JSON.stringify({ error: 'Amount must be between $0.01 and $1000' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'asaas_config')
      .maybeSingle();

    if (configError || !configData?.value || !configData.value.configured) {
      return new Response(JSON.stringify({
        error: 'Asaas not configured',
        message: 'Please configure Asaas in Admin Settings > Payments tab'
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const config: AsaasConfig = configData.value;
    const apiBase = config.test_mode
      ? 'https://sandbox.asaas.com/v3'
      : 'https://api.asaas.com/v3';

    const orderId = `AS-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    const amountBRL = amount * 5.5;

    const customerName = payer?.first_name || userEmail?.split('@')[0] || 'Cliente';
    const customerEmail = payer?.email || userEmail;

    let asaasCustomerId: string;

    const customerResponse = await fetch(`${apiBase}/customers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: customerName,
        email: customerEmail,
        externalReference: orderId,
      }),
    });

    const customerResult = await customerResponse.json();

    if (!customerResponse.ok) {
      console.error('Asaas customer creation error:', customerResult);
      return new Response(JSON.stringify({
        error: 'Failed to create customer',
        details: customerResult.errors?.[0]?.description || 'Unknown error'
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    asaasCustomerId = customerResult.id;

    const billingType = payment_method === 'pix' ? 'PIX' : 'BOLETO';

    const paymentResponse = await fetch(`${apiBase}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: billingType,
        value: amountBRL,
        dueDate: new Date(Date.now() + 30 * 60 * 1000).toISOString().split('T')[0],
        description: `Recarga de creditos - $${amount.toFixed(2)}`,
        externalReference: orderId,
      }),
    });

    const paymentResult = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error('Asaas payment creation error:', paymentResult);
      return new Response(JSON.stringify({
        error: 'Payment creation failed',
        details: paymentResult.errors?.[0]?.description || 'Unknown error'
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let qrCode = null;
    let qrCodeImage = null;
    let invoiceUrl = paymentResult.invoiceUrl || null;

    if (payment_method === 'pix' && paymentResult.id) {
      const qrResponse = await fetch(`${apiBase}/payments/${paymentResult.id}/pixQrCode`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (qrResponse.ok) {
        const qrResult = await qrResponse.json();
        qrCode = qrResult.payload || null;
        qrCodeImage = qrResult.encodedImage || null;
      }
    }

    const { error: insertError } = await supabaseAdmin
      .from('asaas_payments')
      .insert({
        user_id: userId,
        payment_id: paymentResult.id,
        order_id: orderId,
        amount_brl: amountBRL,
        amount_usd: amount,
        currency: 'BRL',
        billing_type: billingType,
        status: paymentResult.status || 'PENDING',
        status_detail: paymentResult.status,
        external_reference: orderId,
        qr_code: qrCode,
        qr_code_image: qrCodeImage,
        invoice_url: invoiceUrl,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        webhook_data: {
          payment_response: paymentResult,
          created_via: 'asaas_api',
        }
      });

    if (insertError) {
      console.error('Error saving Asaas payment:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to save payment record' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      payment: {
        id: paymentResult.id,
        status: paymentResult.status,
        external_reference: orderId,
        qr_code: qrCode,
        qr_code_base64: qrCodeImage,
        invoice_url: invoiceUrl,
        billing_type: billingType,
      }
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating Asaas payment:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
