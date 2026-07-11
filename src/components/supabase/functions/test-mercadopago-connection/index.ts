import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the config from request body
    const requestData = await req.json();
    const config: MercadoPagoConfig = requestData.config;

    // Test connection to MercadoPago API
    const connectionResult = await testMercadoPagoConnection(config);

    return new Response(
      JSON.stringify(connectionResult),
      {
        status: connectionResult.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error testing MercadoPago connection:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function testMercadoPagoConnection(config: MercadoPagoConfig): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    // Test basic API connectivity by getting user info
    const userResponse = await fetch('https://api.mercadopago.com/users/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const userResult = await userResponse.json();

    if (!userResponse.ok) {
      throw new Error(userResult.message || `API call failed: ${userResponse.status}`);
    }

    // Test payment methods endpoint
    const paymentMethodsResponse = await fetch('https://api.mercadopago.com/v1/payment_methods', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const paymentMethods = await paymentMethodsResponse.json();

    if (!paymentMethodsResponse.ok) {
      throw new Error('Failed to fetch payment methods');
    }

    // Check if PIX is available
    const pixAvailable = paymentMethods.some((method: any) => method.id === 'pix');

    return {
      success: true,
      details: {
        user_id: userResult.id,
        email: userResult.email,
        country_id: userResult.country_id,
        site_id: userResult.site_id,
        test_mode: config.test_mode,
        pix_available: pixAvailable,
        payment_methods_count: paymentMethods.length,
        api_accessible: true
      }
    };

  } catch (error) {
    console.error('MercadoPago connection test failed:', error);
    
    let errorMessage = error.message || 'Unknown error';
    let errorDetails: any = {
      test_mode: config.test_mode,
      timestamp: new Date().toISOString()
    };

    // Provide specific error messages for common issues
    if (error.message.includes('Invalid token') || error.message.includes('401')) {
      errorMessage = 'Token de acesso inválido. Verifique se o Access Token está correto.';
      errorDetails.likely_causes = [
        'Access Token incorreto',
        'Token de teste usado em produção ou vice-versa',
        'Token expirado ou revogado'
      ];
    } else if (error.message.includes('403')) {
      errorMessage = 'Permissões insuficientes. Verifique as permissões do token.';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorMessage = 'Erro de conexão com o Mercado Pago. Verifique sua conexão.';
    }

    return {
      success: false,
      error: errorMessage,
      details: errorDetails
    };
  }
}

async function verifyWebhookSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    // MercadoPago webhook signature verification
    const parts = signature.split(',');
    const timestamp = parts.find(part => part.startsWith('ts='))?.split('=')[1];
    const sig = parts.find(part => part.startsWith('v1='))?.split('=')[1];

    if (!timestamp || !sig) {
      return false;
    }

    const payload = `${timestamp}.${body}`;
    
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