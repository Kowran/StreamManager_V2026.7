import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid authentication');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      throw new Error('Admin access required');
    }

    const { data: config, error: configError } = await supabase
      .from('binance_config')
      .select('api_key, api_secret, binance_id, merchant_id, is_active')
      .maybeSingle();

    if (configError || !config) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Configuração da Binance não encontrada. Salve as credenciais primeiro.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!config.api_key || !config.api_secret) {
      return new Response(JSON.stringify({
        success: false,
        message: 'API Key e API Secret não estão configurados.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Test by querying the Pay Trade History endpoint with a minimal request
    const timestamp = Date.now();
    const recvWindow = 10000;
    const queryString = `timestamp=${timestamp}&recvWindow=${recvWindow}&limit=1`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(config.api_secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
    const signature = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    const url = `https://api.binance.com/sapi/v1/pay/transactions?${queryString}&signature=${signature}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { 'X-MBX-APIKEY': config.api_key },
      });
    } catch (fetchErr: any) {
      return new Response(JSON.stringify({
        success: false,
        message: `Erro de rede ao conectar com a Binance: ${fetchErr.message}`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const rawText = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return new Response(JSON.stringify({
        success: false,
        message: `Resposta inválida da Binance (HTTP ${res.status}): ${rawText.slice(0, 200)}`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (res.status >= 400 || (parsed.code && parsed.code !== '000000')) {
      const errMsg = parsed.msg || parsed.message || `HTTP ${res.status}`;
      const code = parsed.code || res.status;
      let hint = '';
      if (code === -2008) {
        hint = ' A API Key não é reconhecida pela Binance. Verifique se a API Key está correta e foi criada na conta certa.';
      } else if (code === -1022 || code === -2015) {
        hint = ' A API Key não tem permissão para acessar este recurso. Verifique se a chave tem "Binance Pay" habilitado e se o IP do servidor está autorizado.';
      } else if (code === -1003) {
        hint = ' Limite de requisições excedido. Aguarde um momento e tente novamente.';
      } else if (code === -1021) {
        hint = ' Diferença de timestamp. O relógio do servidor pode estar dessincronizado.';
      }
      return new Response(JSON.stringify({
        success: false,
        message: `Binance API: ${errMsg} (código ${code}).${hint}`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const txCount = parsed.data?.length || 0;
    return new Response(JSON.stringify({
      success: true,
      message: `Conexão bem-sucedida! A Binance respondeu com ${txCount} transação(ões) recente(s).`,
      binance_id: config.binance_id,
      merchant_id: config.merchant_id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('Error testing Binance connection:', err);
    return new Response(JSON.stringify({
      success: false,
      message: err.message || 'Internal server error',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
