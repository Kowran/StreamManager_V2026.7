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

    const { order_id } = await req.json();

    if (!order_id) {
      throw new Error('Order ID is required');
    }

    const { data: order, error: orderError } = await supabase
      .from('smm_orders')
      .select('*, service:smm_services(*, provider:smm_providers(*))')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    const service = order.service as any;
    const provider = service?.provider as any;

    if (!service || !provider) {
      throw new Error('Service or provider not found');
    }

    const apiUrl = new URL(provider.api_url);
    apiUrl.searchParams.set('key', provider.api_key);
    apiUrl.searchParams.set('action', 'add');
    apiUrl.searchParams.set('service', service.provider_service_id);
    apiUrl.searchParams.set('link', order.link);
    apiUrl.searchParams.set('quantity', order.quantity.toString());

    if (order.dripfeed && order.dripfeed_runs && order.dripfeed_interval) {
      apiUrl.searchParams.set('runs', order.dripfeed_runs.toString());
      apiUrl.searchParams.set('interval', order.dripfeed_interval.toString());
    }

    const response = await fetch(apiUrl.toString());
    const data = await response.json();

    if (data.error) {
      await supabase
        .from('smm_orders')
        .update({
          status: 'failed',
          provider_response: data,
          updated_at: new Date().toISOString()
        })
        .eq('id', order_id);

      throw new Error(data.error);
    }

    await supabase
      .from('smm_orders')
      .update({
        provider_order_id: data.order?.toString() || null,
        status: 'processing',
        provider_response: data,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id);

    return new Response(
      JSON.stringify({
        success: true,
        provider_order_id: data.order,
        order_id: order_id
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing SMM order:', error);
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
