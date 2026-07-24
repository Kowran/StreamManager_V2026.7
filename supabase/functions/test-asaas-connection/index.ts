import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    let config: AsaasConfig;

    try {
      const requestData = await req.json();
      config = requestData.config;
    } catch {
      const { data: configData, error: configError } = await supabaseAdmin
        .from('system_config')
        .select('value')
        .eq('key', 'asaas_config')
        .single();

      if (configError || !configData?.value) {
        return new Response(JSON.stringify({ error: 'Asaas configuration not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      config = configData.value;
    }

    const result = await testAsaasConnection(config);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error testing Asaas connection:', error);
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

async function testAsaasConnection(config: AsaasConfig): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    if (!config.access_token?.trim()) {
      return {
        success: false,
        error: 'Access Token é obrigatório. Configure o token no painel do Asaas.'
      };
    }

    const isProdToken = config.access_token.startsWith('$aact_prod_') || false;
    const isSandboxToken = config.access_token.startsWith('$aact_sand_') || false;
    // Auto-detect API URL from token type when possible; fall back to test_mode flag
    const useTestMode = isSandboxToken || (!isProdToken && config.test_mode !== false);
    const apiBase = useTestMode
      ? 'https://sandbox.asaas.com/v3'
      : 'https://api.asaas.com/v3';

    const response = await fetch(`${apiBase}/customers?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await safeJsonParse(response);

    if (!response.ok) {
      const errorDesc = result.errors?.[0]?.description || result.message || 'Erro desconhecido';
      let errorMessage = errorDesc;

      if (response.status === 401 || response.status === 403) {
        errorMessage = 'Access Token inválido ou sem permissão. Verifique se o token está correto e se corresponde ao modo (sandbox/produção) selecionado.';
      } else if (response.status === 404) {
        errorMessage = 'Endpoint não encontrado. Verifique se a API do Asaas está disponível.';
      }

      return {
        success: false,
        error: errorMessage,
        details: {
          status: response.status,
          test_mode: useTestMode,
          api_base: apiBase,
          raw_error: result,
        }
      };
    }

    const customerCount = result.totalCount || result.data?.length || 0;

    return {
      success: true,
      details: {
        api_base: apiBase,
        test_mode: useTestMode,
        is_production_token: isProdToken,
        customers_found: customerCount,
        status: 'Conectado com sucesso',
      }
    };

  } catch (error) {
    console.error('Asaas connection test failed:', error);

    let errorMessage = error.message || 'Erro desconhecido';

    if (error.name === 'TypeError' && errorMessage.includes('fetch')) {
      errorMessage = 'Erro de conexão com o Asaas. Verifique sua conexão com a internet.';
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
