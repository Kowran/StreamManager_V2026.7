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

    const { data: order, error: orderError } = await supabase
      .from('smm_orders')
      .select('*, service:smm_services(*, provider:smm_providers(*))')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    if (!order.provider_order_id) {
      throw new Error('No provider order ID found');
    }

    const service = order.service as any;
    const provider = service?.provider as any;

    if (!service || !provider) {
      throw new Error('Service or provider not found');
    }

    const apiUrl = new URL(provider.api_url);
    apiUrl.searchParams.set('key', provider.api_key);
    apiUrl.searchParams.set('action', 'status');
    apiUrl.searchParams.set('order', order.provider_order_id);

    const response = await fetch(apiUrl.toString());
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    const updateData: any = {
      provider_response: data,
      updated_at: new Date().toISOString()
    };

    if (data.status) {
      updateData.status = data.status;
    }

    if (data.start_count !== undefined) {
      updateData.start_count = parseInt(data.start_count);
    }

    if (data.remains !== undefined) {
      updateData.remains = parseInt(data.remains);
    }

    if (data.status === 'Completed' || data.status === 'completed') {
      updateData.status = 'completed';
      updateData.completed_at = new Date().toISOString();
    } else if (data.status === 'Partial' || data.status === 'partial') {
      updateData.status = 'partial';
    } else if (data.status === 'In progress' || data.status === 'in_progress' || data.status === 'Processing') {
      updateData.status = 'in_progress';
    } else if (data.status === 'Pending' || data.status === 'pending') {
      updateData.status = 'pending';
    } else if (data.status === 'Canceled' || data.status === 'canceled' || data.status === 'Cancelled') {
      updateData.status = 'cancelled';
    }

    await supabase
      .from('smm_orders')
      .update(updateData)
      .eq('id', order_id);

    return new Response(
      JSON.stringify({
        success: true,
        status: updateData.status,
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
    console.error('Error syncing SMM order status:', error);
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
