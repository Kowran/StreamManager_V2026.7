import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateSignature(timestamp: string, nonce: string, body: string, secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const payload = `${timestamp}\n${nonce}\n${body}\n`;
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-512' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function queryBinance(body: Record<string, string>, apiKey: string, apiSecret: string) {
  const timestamp = Date.now().toString();
  const nonce = generateNonce();
  const bodyString = JSON.stringify(body);
  const signature = await generateSignature(timestamp, nonce, bodyString, apiSecret);

  const res = await fetch('https://bpay.binanceapi.com/binancepay/openapi/v2/order/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'BinancePay-Timestamp': timestamp,
      'BinancePay-Nonce': nonce,
      'BinancePay-Certificate-SN': apiKey,
      'BinancePay-Signature': signature,
    },
    body: bodyString,
  });
  return res.json();
}

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

    // order_id = internal prepayId or GEO fallback ID stored in DB
    // user_order_id = Order ID typed by the user from the Binance app
    const { order_id, user_order_id } = await req.json();

    let payment = null;
    let paymentError = null;

    // First try by stored order_id
    const { data: p1, error: e1 } = await supabase
      .from('binance_payments')
      .select('*')
      .eq('order_id', order_id)
      .eq('user_id', user.id)
      .maybeSingle();
    payment = p1;
    paymentError = e1;

    // If not found and user typed an ID, try finding by that ID directly
    if ((!payment || paymentError) && user_order_id) {
      const trimmed = user_order_id.trim();
      const { data: p2, error: e2 } = await supabase
        .from('binance_payments')
        .select('*')
        .eq('order_id', trimmed)
        .eq('user_id', user.id)
        .maybeSingle();
      if (p2) {
        payment = p2;
        paymentError = null;
      }
    }

    if (paymentError || !payment) throw new Error('Payment not found');

    if (payment.status === 'completed') {
      return new Response(JSON.stringify({ status: 'completed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: config, error: configError } = await supabase
      .from('binance_config')
      .select('*')
      .maybeSingle();

    if (configError || !config) throw new Error('Binance configuration not found');

    const { api_key: apiKey, api_secret: apiSecret } = config;

    // Try querying by our stored prepayId first (skip for geo-blocked GEO* orders)
    const isGeoOrder = order_id?.startsWith('GEO');
    let result = isGeoOrder
      ? { status: 'FAIL', data: { status: 'UNKNOWN' } }
      : await queryBinance({ prepayId: order_id }, apiKey, apiSecret);
    console.log('Query by prepayId result:', JSON.stringify(result));

    // If user typed a different ID, try it as prepayId and then as merchantTradeNo
    const trimmedUserOrderId = (user_order_id || '').trim();
    if (trimmedUserOrderId && trimmedUserOrderId !== order_id && result.data?.status !== 'PAID') {
      const byUserPrepay = await queryBinance({ prepayId: trimmedUserOrderId }, apiKey, apiSecret);
      console.log('Query by user prepayId result:', JSON.stringify(byUserPrepay));
      if (byUserPrepay.status === 'SUCCESS' && byUserPrepay.data?.status === 'PAID') {
        result = byUserPrepay;
      } else {
        const merchantTradeNo = payment.webhook_data?.merchant_trade_no || trimmedUserOrderId;
        const byMerchant = await queryBinance({ merchantTradeNo }, apiKey, apiSecret);
        console.log('Query by merchantTradeNo result:', JSON.stringify(byMerchant));
        if (byMerchant.status === 'SUCCESS' && byMerchant.data?.status === 'PAID') {
          result = byMerchant;
        }
      }
    }

    if (result.status !== 'SUCCESS') {
      return new Response(JSON.stringify({ status: payment.status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orderStatus = result.data?.status;
    let newStatus = payment.status;

    if (orderStatus === 'PAID') {
      newStatus = 'completed';

      await supabase
        .from('binance_payments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', payment.id);

      const { data: userCredits } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const paymentAmount = parseFloat(payment.amount_usd) || 0;
      const currentBalance = userCredits?.balance || 0;
      const newBalance = currentBalance + paymentAmount;

      await supabase.from('user_credits').upsert({
        user_id: user.id,
        balance: newBalance,
        total_recharged: (userCredits?.total_recharged || 0) + paymentAmount,
      });

      await supabase.from('credit_transactions').insert({
        user_id: user.id,
        type: 'recharge',
        amount: paymentAmount,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: `Recarga via Binance Pay - Order ${order_id}`,
        reference_type: 'binance_payment',
        reference_id: payment.id,
        metadata: { order_id, user_order_id: trimmedUserOrderId || null },
      });

    } else if (['EXPIRED', 'CANCELED', 'ERROR'].includes(orderStatus)) {
      newStatus = 'failed';
      await supabase
        .from('binance_payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', payment.id);
    }

    return new Response(JSON.stringify({ status: newStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Error checking Binance payment:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error', status: 'pending' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
