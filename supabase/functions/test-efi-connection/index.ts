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
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let config: EfiConfig;

    try {
      const requestData = await req.json();
      config = requestData.config;
    } catch {
      const { data: configData, error: configError } = await supabaseAdmin
        .from('system_config')
        .select('value')
        .eq('key', 'efi_config')
        .single();

      if (configError || !configData?.value) {
        return new Response(JSON.stringify({ error: 'EFI Bank configuration not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      config = configData.value;
    }

    const result = await testEfiConnection(config);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error testing EFI connection:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function testEfiConnection(config: EfiConfig): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    if (!config.client_id?.trim() || !config.client_secret?.trim()) {
      return {
        success: false,
        error: 'Client ID e Client Secret sao obrigatorios. Obtenha as credenciais no painel da EFI Bank.'
      };
    }

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
      let errorMessage = result.error_description || result.message || result.error || 'Erro desconhecido';

      if (response.status === 401 || response.status === 403) {
        errorMessage = 'Credenciais invalidas. Verifique o Client ID e Client Secret e se correspondem ao modo (sandbox/producao) selecionado.';
      }

      return {
        success: false,
        error: errorMessage,
        details: {
          status: response.status,
          test_mode: isSandbox,
          oauth_url: oauthUrl,
          raw_error: result,
        }
      };
    }

    if (!result.access_token) {
      return {
        success: false,
        error: 'Token de acesso nao retornado pela EFI Bank',
        details: { test_mode: isSandbox, raw_response: result }
      };
    }

    return {
      success: true,
      details: {
        oauth_url: oauthUrl,
        test_mode: isSandbox,
        is_production: !isSandbox,
        status: 'Conectado com sucesso',
        token_type: result.token_type || 'Bearer',
        expires_in: result.expires_in || 'N/A',
      }
    };

  } catch (error) {
    console.error('EFI connection test failed:', error);

    let errorMessage = error.message || 'Erro desconhecido';

    if (error.name === 'TypeError' && errorMessage.includes('fetch')) {
      errorMessage = 'Erro de conexao com a EFI Bank. Verifique sua conexao com a internet.';
    }

    return {
      success: false,
      error: errorMessage,
      details: {
        test_mode: config.test_mode,
        error_type: error.name || 'unknown',
        timestamp: new Date().toISOString()
      }
    };
  }
}
