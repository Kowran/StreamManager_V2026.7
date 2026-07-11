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

    const { provider_id, fetch_only, services: servicesToImport } = await req.json();

    if (!provider_id) {
      throw new Error('Provider ID is required');
    }

    const { data: provider, error: providerError } = await supabase
      .from('smm_providers')
      .select('*')
      .eq('id', provider_id)
      .maybeSingle();

    if (providerError || !provider) {
      throw new Error('Provider not found');
    }

    const apiUrl = new URL(provider.api_url);
    apiUrl.searchParams.set('key', provider.api_key);
    apiUrl.searchParams.set('action', 'services');

    const response = await fetch(apiUrl.toString());
    const services = await response.json();

    if (!Array.isArray(services)) {
      throw new Error('Invalid response from provider');
    }

    if (fetch_only) {
      return new Response(
        JSON.stringify({
          success: true,
          services: services
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    let imported = 0;
    let updated = 0;

    const servicesToProcess = servicesToImport || services;

    for (const service of servicesToProcess) {
      const price = parseFloat(service.rate) * provider.rate_multiplier;

      const serviceData = {
        provider_id: provider.id,
        provider_service_id: service.service.toString(),
        name: service.name,
        description: service.name,
        category: service.category || 'Others',
        price_per_1000: price,
        min_order: parseInt(service.min) || 100,
        max_order: parseInt(service.max) || 100000,
        active: true,
        average_time: service.average_time || 'Not specified',
        quality: 'medium',
        dripfeed: service.dripfeed === '1' || service.dripfeed === true,
        refill: service.refill === '1' || service.refill === true,
        cancel: service.cancel === '1' || service.cancel === true
      };

      const { data: existing } = await supabase
        .from('smm_services')
        .select('id')
        .eq('provider_id', provider.id)
        .eq('provider_service_id', service.service.toString())
        .maybeSingle();

      if (existing) {
        await supabase
          .from('smm_services')
          .update(serviceData)
          .eq('id', existing.id);
        updated++;
      } else {
        const { error: insertError } = await supabase
          .from('smm_services')
          .insert(serviceData);

        if (!insertError) {
          imported++;
        }
      }
    }

    await supabase
      .from('smm_providers')
      .update({
        last_sync: new Date().toISOString(),
        total_services: services.length
      })
      .eq('id', provider_id);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        updated,
        total: servicesToProcess.length
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error importing services:', error);
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