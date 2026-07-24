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

function sanitizeCpfCnpj(value: string): string {
  return value.replace(/\D/g, '').slice(0, 14);
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
    let jwtPayload: any;
    try {
      const b64 = jwtParts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
      const jsonStr = new TextDecoder().decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0)));
      jwtPayload = JSON.parse(jsonStr);
    } catch (decodeError) {
      console.error('JWT decode error:', decodeError);
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
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
    const isProdToken = config.access_token?.startsWith('$aact_prod_') || false;
    const useTestMode = config.test_mode && !isProdToken;
    const apiBase = useTestMode
      ? 'https://sandbox.asaas.com/v3'
      : 'https://api.asaas.com/v3';

    const orderId = `AS-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    const amountBRL = amount * 5.5;

    const firstName = payer?.first_name || '';
    const lastName = payer?.last_name || '';
    const customerName = (firstName && lastName)
      ? `${firstName} ${lastName}`
      : (firstName || userEmail?.split('@')[0] || 'Cliente');
    const customerEmail = payer?.email || userEmail;
    const cpfCnpj = sanitizeCpfCnpj(payer?.cpf || '');

    if (!cpfCnpj) {
      return new Response(JSON.stringify({
        error: 'CPF/CNPJ obrigatorio',
        message: 'Informe um CPF ou CNPJ para gerar a cobranca.'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let asaasCustomerId: string;

    // Search for an existing customer by cpfCnpj to avoid duplicate errors
    const searchResponse = await fetch(
      `${apiBase}/customers?cpfCnpj=${cpfCnpj}&limit=1`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (searchResponse.ok) {
      const searchText = await searchResponse.text();
      const searchResult = searchText ? JSON.parse(searchText) : {};
      const existing = searchResult.data?.[0];
      if (existing?.id) {
        asaasCustomerId = existing.id;
      }
    }

    // If no existing customer was found, create a new one
    if (!asaasCustomerId) {
      const customerResponse = await fetch(`${apiBase}/customers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: customerName,
          email: customerEmail,
          cpfCnpj: cpfCnpj,
          externalReference: orderId,
        }),
      });

      const customerText = await customerResponse.text();
      let customerResult: any;
      try { customerResult = customerText ? JSON.parse(customerText) : {}; }
      catch { customerResult = { raw: customerText }; }

      if (!customerResponse.ok) {
        console.error('Asaas customer creation error:', customerResult, 'status:', customerResponse.status);
        const errorDesc = customerResult.errors?.[0]?.description
          || customerResult.message
          || (customerResponse.status === 401 ? 'Token invalido ou sem permissao'
            : customerResponse.status === 400 ? 'Dados do cliente invalidos'
            : 'Unknown error');
        return new Response(JSON.stringify({
          error: 'Failed to create customer',
          details: errorDesc
        }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      asaasCustomerId = customerResult.id;
    }

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

    const paymentText = await paymentResponse.text();
    const paymentResult = paymentText ? JSON.parse(paymentText) : {};

    if (!paymentResponse.ok) {
      console.error('Asaas payment creation error:', paymentResult, 'status:', paymentResponse.status);
      const errorDesc = paymentResult.errors?.[0]?.description || paymentResult.message || (paymentResponse.status === 401 ? 'Token inválido ou sem permissão' : 'Unknown error');
      return new Response(JSON.stringify({
        error: 'Payment creation failed',
        details: errorDesc
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
        const qrText = await qrResponse.text();
        if (qrText) {
          const qrResult = JSON.parse(qrText);
          qrCode = qrResult.payload || null;
          qrCodeImage = qrResult.encodedImage || null;
        }
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
      error: error.message || 'Internal server error',
      details: error.message
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
