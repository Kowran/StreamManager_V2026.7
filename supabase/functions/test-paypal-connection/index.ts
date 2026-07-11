import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface PayPalConfig {
  client_id: string;
  client_secret: string;
  webhook_id?: string;
  environment: 'sandbox' | 'production';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get the config from request body
    const requestData = await req.json();
    const config: PayPalConfig = requestData.config || requestData;

    // Test connection to PayPal API
    const connectionResult = await testPayPalConnection(config);

    return new Response(
      JSON.stringify(connectionResult),
      {
        status: connectionResult.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error testing PayPal connection:', error);
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

async function testPayPalConnection(config: PayPalConfig): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    // Test credentials by getting access token
    const accessToken = await getPayPalAccessToken(config);
    if (!accessToken) {
      throw new Error('Failed to get access token - check your credentials');
    }

    // Test API access
    const baseUrl = config.environment === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    // Test with a simple API call
    const testResponse = await fetch(`${baseUrl}/v1/identity/oauth2/userinfo?schema=paypalv1.1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const testResult = await testResponse.json();
    
    if (!testResponse.ok) {
      throw new Error(testResult.error || 'API test failed');
    }

    return {
      success: true,
      details: {
        access_token_obtained: true,
        api_accessible: true,
        environment: config.environment,
        user_info: testResult,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('PayPal connection test failed:', error);
    
    let errorMessage = error.message || 'Unknown error';
    let errorDetails: any = {
      environment: config.environment,
      timestamp: new Date().toISOString()
    };

    // Provide specific error messages for common issues
    if (error.message.includes('Invalid client') || error.message.includes('401')) {
      errorMessage = 'Credenciais inválidas. Verifique se o Client ID e Secret estão corretos.';
      errorDetails.likely_causes = [
        'Client ID ou Secret incorretos',
        'Credenciais de sandbox usadas em produção ou vice-versa',
        'Aplicação desabilitada no PayPal'
      ];
    } else if (error.message.includes('403')) {
      errorMessage = 'Permissões insuficientes. Verifique as permissões da aplicação PayPal.';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorMessage = 'Erro de conexão com o PayPal. Verifique sua conexão com a internet.';
    }

    return {
      success: false,
      error: errorMessage,
      details: errorDetails
    };
  }
}

async function getPayPalAccessToken(config: PayPalConfig): Promise<string | null> {
  try {
    const baseUrl = config.environment === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    const credentials = btoa(`${config.client_id}:${config.client_secret}`);

    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('PayPal token error:', result);
      throw new Error(result.error_description || result.error || 'Failed to get access token');
    }

    return result.access_token;
  } catch (error) {
    console.error('Error getting PayPal access token:', error);
    throw error;
  }
}