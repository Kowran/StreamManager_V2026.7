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

interface EfiConfig {
  client_id: string;
  client_secret: string;
  pix_key: string;
  test_mode: boolean;
}

function sanitizeCpfCnpj(value: string): string {
  return value.replace(/\D/g, '').slice(0, 14);
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

  const text = await response.text();
  let result: any;
  try { result = text ? JSON.parse(text) : {}; } catch { result = { raw: text }; }

  if (!response.ok) {
    console.error('EFI OAuth error:', result, 'status:', response.status);
    const errorDesc = result.error_description || result.message || result.error || 'Falha na autenticacao OAuth';
    throw new Error(errorDesc);
  }

  if (!result.access_token) {
    throw new Error('Token de acesso nao retornado pela EFI Bank');
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
      .eq('key', 'efi_config')
      .maybeSingle();

    if (configError || !configData?.value || !configData.value.configured) {
      return new Response(JSON.stringify({
        error: 'EFI Bank not configured',
        message: 'Configure a EFI Bank em Configuracoes Admin - Pagamentos'
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const config: EfiConfig = configData.value;

    if (!config.client_id?.trim() || !config.client_secret?.trim() || !config.pix_key?.trim()) {
      return new Response(JSON.stringify({
        error: 'EFI Bank credentials not configured',
        message: 'Configure Client ID, Client Secret e Chave PIX nas configuracoes'
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const orderId = `EFI-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    const amountBRL = Math.round(amount * 5.5 * 100) / 100;
    const amountBRLStr = amountBRL.toFixed(2);

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

    const accessToken = await getEfiAccessToken(config);
    const isSandbox = config.test_mode !== false;
    const apiBase = isSandbox
      ? 'https://sandbox.api.efipay.com.br'
      : 'https://api.efipay.com.br';

    if (payment_method === 'pix') {
      // Create immediate PIX charge
      const txid = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 35);

      const cobBody: any = {
        calendario: {
          expiracao: 1800,
        },
        valor: {
          original: amountBRLStr,
        },
        chave: config.pix_key,
        solicitacaoPagador: `Recarga de creditos - $${amount.toFixed(2)}`,
        devedor: {
          nome: customerName,
          cpf: cpfCnpj.length === 11 ? cpfCnpj : undefined,
          cnpj: cpfCnpj.length === 14 ? cpfCnpj : undefined,
        },
      };

      // Remove undefined fields
      if (cobBody.devedor.cpf === undefined) delete cobBody.devedor.cpf;
      if (cobBody.devedor.cnpj === undefined) delete cobBody.devedor.cnpj;

      const cobResponse = await fetch(`${apiBase}/v2/cob/${txid}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cobBody),
      });

      const cobText = await cobResponse.text();
      let cobResult: any;
      try { cobResult = cobText ? JSON.parse(cobText) : {}; } catch { cobResult = { raw: cobText }; }

      if (!cobResponse.ok) {
        console.error('EFI cob error:', cobResult, 'status:', cobResponse.status);
        const errorDesc = cobResult.error_description || cobResult.message || cobResult.error || 'Erro ao criar cobranca PIX';
        return new Response(JSON.stringify({
          error: 'Payment creation failed',
          details: errorDesc,
          status: cobResponse.status,
        }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get QR code image
      let qrCodeBase64: string | null = null;
      const locId = cobResult.loc?.id;
      if (locId) {
        const qrResponse = await fetch(`${apiBase}/v2/loc/${locId}/qrcode`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (qrResponse.ok) {
          const qrResult = await qrResponse.json();
          qrCodeBase64 = qrResult.imagem_qrcode || null;
        }
      }

      const paymentId = cobResult.txid || txid;
      const qrCode = cobResult.pixCopiaECola || null;

      const { error: insertError } = await supabaseAdmin
        .from('efi_payments')
        .insert({
          user_id: userId,
          payment_id: paymentId,
          order_id: orderId,
          amount_brl: amountBRL,
          amount_usd: amount,
          currency: 'BRL',
          billing_type: 'PIX',
          status: cobResult.status || 'ATIVA',
          status_detail: cobResult.status || 'ATIVA',
          external_reference: orderId,
          qr_code: qrCode,
          qr_code_base64: qrCodeBase64,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          webhook_data: {
            cob_response: cobResult,
            created_via: 'efi_api',
          }
        });

      if (insertError) {
        console.error('Error saving EFI payment:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to save payment record' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        payment: {
          id: paymentId,
          status: 'pending',
          external_reference: orderId,
          qr_code: qrCode,
          qr_code_base64: qrCodeBase64,
          billing_type: 'PIX',
        }
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      // Boleto - EFI Bank one-step boleto
      const boletoBody: any = {
        payment: {
          banking_billet: {
            expire_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            customer: {
              name: customerName,
              email: customerEmail,
              document: cpfCnpj,
            },
            message: `Recarga de creditos - $${amount.toFixed(2)}`,
          }
        },
        items: [
          {
            name: `Recarga de creditos - $${amount.toFixed(2)}`,
            value: Math.round(amountBRL * 100),
            amount: 1,
          }
        ]
      };

      const boletoResponse = await fetch(`${apiBase}/v1/charge/one-step`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(boletoBody),
      });

      const boletoText = await boletoResponse.text();
      let boletoResult: any;
      try { boletoResult = boletoText ? JSON.parse(boletoText) : {}; } catch { boletoResult = { raw: boletoText }; }

      if (!boletoResponse.ok) {
        console.error('EFI boleto error:', boletoResult, 'status:', boletoResponse.status);
        const errorDesc = boletoResult.error_description || boletoResult.message || boletoResult.error || 'Erro ao criar boleto';
        return new Response(JSON.stringify({
          error: 'Payment creation failed',
          details: errorDesc,
          status: boletoResponse.status,
        }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const chargeId = String(boletoResult.data?.charge_id || boletoResult.data?.id || orderId);
      const boletoPdfUrl = boletoResult.data?.pdf?.charge || boletoResult.data?.link || null;

      const { error: insertError } = await supabaseAdmin
        .from('efi_payments')
        .insert({
          user_id: userId,
          payment_id: chargeId,
          order_id: orderId,
          amount_brl: amountBRL,
          amount_usd: amount,
          currency: 'BRL',
          billing_type: 'BOLETO',
          status: 'waiting',
          status_detail: 'Aguardando pagamento',
          external_reference: orderId,
          invoice_url: boletoPdfUrl,
          expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          webhook_data: {
            boleto_response: boletoResult,
            created_via: 'efi_api',
          }
        });

      if (insertError) {
        console.error('Error saving EFI payment:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to save payment record' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        payment: {
          id: chargeId,
          status: 'waiting',
          external_reference: orderId,
          invoice_url: boletoPdfUrl,
          billing_type: 'BOLETO',
        }
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Error creating EFI payment:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error',
      details: error.message
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
