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

interface PagBankConfig {
  api_token: string;
  test_mode: boolean;
}

function sanitizeCpfCnpj(value: string): string {
  return value.replace(/\D/g, '').slice(0, 14);
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
    } catch {
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
      .eq('key', 'pagbank_config')
      .maybeSingle();

    if (configError || !configData?.value || !configData.value.configured) {
      return new Response(JSON.stringify({
        error: 'PagBank not configured',
        message: 'Please configure PagBank in Admin Settings > Payments tab'
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const config: PagBankConfig = configData.value;

    if (!config.api_token?.trim()) {
      return new Response(JSON.stringify({
        error: 'PagBank API token not configured',
        message: 'Configure o token da API do PagBank nas configuracoes'
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const orderId = `PB-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    const amountBRL = Math.round(amount * 5.5 * 100) / 100;

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

    const isSandbox = config.test_mode !== false;
    const apiBase = isSandbox
      ? 'https://sandbox.api.pagseguro.com'
      : 'https://api.pagseguro.com';

    const expirationDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const paymentBody: any = {
      reference_id: orderId,
      customer: {
        name: customerName,
        email: customerEmail,
        tax_id: cpfCnpj,
      },
      items: [
        {
          reference_id: 'credits',
          name: `Recarga de creditos - $${amount.toFixed(2)}`,
          quantity: 1,
          amount: {
            value: Math.round(amountBRL * 100),
            currency: 'BRL',
          },
        },
      ],
      notification_urls: [
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/pagbank-webhook`
      ],
    };

    if (payment_method === 'pix') {
      paymentBody.qr_codes = [{
        expiration_date: expirationDate,
      }];
    } else {
      paymentBody.charges = [{
        reference_id: orderId,
        amount: {
          value: Math.round(amountBRL * 100),
          currency: 'BRL',
        },
        payment_method: {
          type: 'BOLETO',
          boleto: {
            due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            instruction_lines: {
              line_1: 'Pagamento de creditos',
              line_2: `Pedido ${orderId}`,
            },
          },
        },
      }];
    }

    const paymentResponse = await fetch(`${apiBase}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.api_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentBody),
    });

    const paymentText = await paymentResponse.text();
    let paymentResult: any;
    try { paymentResult = paymentText ? JSON.parse(paymentText) : {}; }
    catch { paymentResult = { raw: paymentText }; }

    if (!paymentResponse.ok) {
      console.error('PagBank payment creation error:', paymentResult, 'status:', paymentResponse.status);
      const errorDesc = paymentResult.error_message
        || paymentResult.message
        || paymentResult.error_description
        || (paymentResponse.status === 401 ? 'Token de API invalido'
          : paymentResponse.status === 400 ? 'Dados do pagamento invalidos'
          : 'Erro desconhecido');
      return new Response(JSON.stringify({
        error: 'Payment creation failed',
        details: errorDesc,
        status: paymentResponse.status,
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let qrCode = null;
    let qrCodeImage = null;
    let invoiceUrl = paymentResult.checkout_url || null;
    const paymentId = paymentResult.id || orderId;

    if (payment_method === 'pix' && paymentResult.qr_codes?.[0]) {
      const qr = paymentResult.qr_codes[0];
      qrCode = qr.text || qr.payload || null;
      qrCodeImage = qr.links?.find((l: any) => l.rel === 'image' || l.media === 'image/png')?.href || null;
    }

    if (payment_method === 'boleto' && paymentResult.charges?.[0]?.payment_method?.boleto) {
      const boleto = paymentResult.charges[0].payment_method.boleto;
      invoiceUrl = boleto.links?.find((l: any) => l.rel === 'pdf' || l.media === 'application/pdf')?.href
        || invoiceUrl;
    }

    const { error: insertError } = await supabaseAdmin
      .from('pagbank_payments')
      .insert({
        user_id: userId,
        payment_id: paymentId,
        order_id: orderId,
        amount_brl: amountBRL,
        amount_usd: amount,
        currency: 'BRL',
        billing_type: payment_method === 'pix' ? 'PIX' : 'BOLETO',
        status: paymentResult.status || 'pending',
        status_detail: paymentResult.status || 'pending',
        external_reference: orderId,
        qr_code: qrCode,
        qr_code_image: qrCodeImage,
        invoice_url: invoiceUrl,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        webhook_data: {
          payment_response: paymentResult,
          created_via: 'pagbank_api',
        }
      });

    if (insertError) {
      console.error('Error saving PagBank payment:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to save payment record' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      payment: {
        id: paymentId,
        status: paymentResult.status || 'pending',
        external_reference: orderId,
        qr_code: qrCode,
        qr_code_base64: qrCodeImage,
        invoice_url: invoiceUrl,
        billing_type: payment_method === 'pix' ? 'PIX' : 'BOLETO',
      }
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating PagBank payment:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error',
      details: error.message
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
