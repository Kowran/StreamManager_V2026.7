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

    const { user_id, amount } = await req.json();

    if (user.id !== user_id) throw new Error('User ID mismatch');
    if (!amount || amount <= 0) throw new Error('Invalid amount');

    const { data: config, error: configError } = await supabase
      .from('binance_config')
      .select('binance_id, is_active')
      .maybeSingle();

    if (configError || !config || !config.is_active) {
      throw new Error('Binance Pay is not configured or not active');
    }

    const orderAmount = parseFloat(amount.toFixed(2));

    // Generate a unique reference for this pending deposit (no Binance API call,
    // no order creation, no fees). The user sends a P2P transfer to the merchant
    // Binance ID and then provides the transaction ID for verification.
    const refId = crypto.randomUUID();

    const { error: insertError } = await supabase.from('binance_payments').insert({
      user_id,
      order_id: refId,
      amount_usd: orderAmount,
      status: 'pending',
      payment_url: '',
      webhook_data: {
        currency: 'USDT',
        binance_id: config.binance_id,
      },
    });

    if (insertError) {
      console.error('Error inserting payment record:', insertError);
      throw new Error('Failed to save payment record');
    }

    return new Response(
      JSON.stringify({
        order_id: refId,
        binance_id: config.binance_id,
        amount: orderAmount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error creating Binance payment:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
