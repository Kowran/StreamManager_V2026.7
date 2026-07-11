import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { provider_id } = await req.json();

    if (!provider_id) {
      throw new Error('Provider ID is required');
    }

    const { data: provider, error: providerError } = await supabase
      .from('smm_providers')
      .select('*')
      .eq('id', provider_id)
      .single();

    if (providerError || !provider) {
      throw new Error('Provider not found');
    }

    const apiUrl = new URL(provider.api_url);
    apiUrl.searchParams.set('key', provider.api_key);
    apiUrl.searchParams.set('action', 'balance');

    const response = await fetch(apiUrl.toString());
    const data = await response.json();

    if (data.error) {
      await supabase
        .from('smm_providers')
        .update({ status: 'error' })
        .eq('id', provider_id);

      throw new Error(data.error);
    }

    await supabase
      .from('smm_providers')
      .update({
        status: 'active',
        balance: parseFloat(data.balance) || 0,
        currency: data.currency || 'USD'
      })
      .eq('id', provider_id);

    return new Response(
      JSON.stringify({
        success: true,
        balance: data.balance,
        currency: data.currency || 'USD'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error testing provider:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});