import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PagBankConfig {
  api_token: string;
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

    let config: PagBankConfig;

    try {
      const requestData = await req.json();
      config = requestData.config;
    } catch {
      const { data: configData, error: configError } = await supabaseAdmin
        .from('system_config')
        .select('value')
        .eq('key', 'pagbank_config')
        .single();

      if (configError || !configData?.value) {
        return new Response(JSON.stringify({ error: 'PagBank configuration not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      config = configData.value;
    }

    const result = await testPagBankConnection(config);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error testing PagBank connection:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function safeJsonParse(response: Response): Promise<any> {
  const text = await response.text();
  if (!text || text.trim() === '') {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function testPagBankConnection(config: PagBankConfig): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    if (!config.api_token?.trim()) {
      return {
        success: false,
        error: 'Token da API e obrigatorio. Obtenha o token no painel do PagBank.'
      };
    }

    const isSandbox = config.test_mode !== false;
    const apiBase = isSandbox
      ? 'https://sandbox.api.pagseguro.com'
      : 'https://api.pagseguro.com';

    // Test by listing orders (GET /orders with limit=1) - validates the token
    const response = await fetch(`${apiBase}/orders?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.api_token}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await safeJsonParse(response);

    if (!response.ok) {
      const errorDesc = result.error_message
        || result.message
        || result.error_description
        || result.error
        || 'Erro desconhecido';

      let errorMessage = errorDesc;

      if (response.status === 401 || response.status === 403) {
        errorMessage = 'Token de API invalido ou sem permissao. Verifique se o token esta correto e corresponde ao modo (sandbox/producao) selecionado.';
      }

      return {
        success: false,
        error: errorMessage,
        details: {
          status: response.status,
          test_mode: isSandbox,
          api_base: apiBase,
          raw_error: result,
        }
      };
    }

    return {
      success: true,
      details: {
        api_base: apiBase,
        test_mode: isSandbox,
        is_production: !isSandbox,
        status: 'Conectado com sucesso',
      }
    };

  } catch (error) {
    console.error('PagBank connection test failed:', error);

    let errorMessage = error.message || 'Erro desconhecido';

    if (error.name === 'TypeError' && errorMessage.includes('fetch')) {
      errorMessage = 'Erro de conexao com o PagBank. Verifique sua conexao com a internet.';
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
