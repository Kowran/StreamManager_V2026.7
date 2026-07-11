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
  const keyData = encoder.encode(secretKey);
  const payload = `${timestamp}\n${nonce}\n${body}\n`;

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
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

    const { user_id, amount } = await req.json();

    if (user.id !== user_id) throw new Error('User ID mismatch');
    if (!amount || amount <= 0) throw new Error('Invalid amount');

    const { data: config, error: configError } = await supabase
      .from('binance_config')
      .select('*')
      .maybeSingle();

    if (configError || !config || !config.is_active) {
      throw new Error('Binance Pay is not configured or not active');
    }

    const apiKey = config.api_key;
    const apiSecret = config.api_secret;

    const timestamp = Date.now().toString();
    const nonce = generateNonce();

    // merchantTradeNo: max 32 chars, alphanumeric only
    const sanitizedUserId = user_id.replace(/-/g, '').substring(0, 8);
    const tsShort = timestamp.slice(-13); // last 13 digits of ms timestamp
    const merchantTradeNo = `BNB${sanitizedUserId}${tsShort}`.substring(0, 32);

    const orderAmount = parseFloat(amount.toFixed(2));

    const requestBody = {
      env: { terminalType: 'WEB' },
      merchantTradeNo,
      orderAmount,
      currency: 'USDT',
      goods: {
        goodsType: '01',
        goodsCategory: 'Z000',
        referenceGoodsId: 'CREDITS',
        goodsName: `Credits $${orderAmount}`,
        goodsDetail: `Store credits $${orderAmount}`,
      },
    };

    const bodyString = JSON.stringify(requestBody);
    const signature = await generateSignature(timestamp, nonce, bodyString, apiSecret);

    console.log('merchantTradeNo:', merchantTradeNo, 'len:', merchantTradeNo.length);
    console.log('bodyString:', bodyString);

    const binanceResponse = await fetch('https://bpay.binanceapi.com/binancepay/openapi/v2/order', {
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

    const result = await binanceResponse.json();
    console.log('Binance HTTP status:', binanceResponse.status);
    console.log('Binance response:', JSON.stringify(result));

    if (result.status !== 'SUCCESS' || !result.data) {
      const code = result.code || '';
      const msg = result.errorMessage || result.message || 'Failed to create Binance payment';
      console.error('Binance API error - code:', code, 'msg:', msg);

      // Geo-block detection
      const isGeoBlock =
        msg.toLowerCase().includes('geo') ||
        msg.toLowerCase().includes('region') ||
        msg.toLowerCase().includes('location') ||
        msg.toLowerCase().includes('country') ||
        msg.toLowerCase().includes('restricted') ||
        code === '000002';

      if (isGeoBlock) {
        const fallbackOrderId = `GEO${sanitizedUserId}${tsShort}`;
        await supabase.from('binance_payments').insert({
          user_id,
          order_id: fallbackOrderId,
          amount_usd: orderAmount,
          status: 'pending',
          payment_url: '',
          webhook_data: {
            merchant_trade_no: merchantTradeNo,
            geo_blocked: true,
            currency: 'USDT',
          },
        });

        return new Response(
          JSON.stringify({
            geo_blocked: true,
            order_id: fallbackOrderId,
            qr_image_url: '',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(msg);
    }

    const { prepayId, universalUrl, qrcodeLink } = result.data;
    if (!prepayId || !universalUrl) throw new Error('Invalid response from Binance API');

    const { error: insertError } = await supabase.from('binance_payments').insert({
      user_id,
      order_id: prepayId,
      amount_usd: orderAmount,
      status: 'pending',
      payment_url: universalUrl,
      webhook_data: {
        merchant_trade_no: merchantTradeNo,
        prepay_id: prepayId,
        currency: 'USDT',
      },
    });

    if (insertError) {
      console.error('Error inserting payment record:', insertError);
      throw new Error('Failed to save payment record');
    }

    return new Response(
      JSON.stringify({ payment_url: universalUrl, order_id: prepayId, qr_image_url: qrcodeLink }),
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
