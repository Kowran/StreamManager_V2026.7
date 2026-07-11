import { createClient } from 'npm:@supabase/supabase-js@2';
import * as crypto from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateSignature(timestamp: string, nonce: string, body: string, secretKey: string): string {
  const payload = timestamp + '\n' + nonce + '\n' + body + '\n';
  return crypto.createHmac('sha512', secretKey).update(payload).digest('hex').toUpperCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    const { user_id, amount } = await req.json();

    if (user.id !== user_id) {
      throw new Error('User ID mismatch');
    }

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }

    const { data: config, error: configError } = await supabase
      .from('binance_config')
      .select('*')
      .maybeSingle();

    if (configError || !config || !config.is_active) {
      throw new Error('Binance Pay is not configured or not active');
    }

    const merchantId = config.merchant_id;
    const apiKey = config.api_key;
    const apiSecret = config.api_secret;

    const timestamp = Date.now().toString();
    const nonce = generateNonce();
    const sanitizedUserId = user_id.replace(/-/g, '').substring(0, 8);
    const timestampShort = Date.now().toString().substring(3);
    const merchantTradeNo = `BNB${sanitizedUserId}${timestampShort}`;

    console.log('Generated merchantTradeNo:', merchantTradeNo);
    console.log('merchantTradeNo length:', merchantTradeNo.length);

    const requestBody = {
      env: {
        terminalType: 'WEB'
      },
      merchantTradeNo: merchantTradeNo,
      orderAmount: parseFloat(amount.toFixed(2)),
      currency: 'USDT',
      goods: {
        goodsType: '01',
        goodsCategory: 'Z000',
        referenceGoodsId: 'CREDITS',
        goodsName: `Store Credits $${amount}`,
        goodsDetail: `Purchase of $${amount} in store credits`
      }
    };

    const bodyString = JSON.stringify(requestBody);
    const signature = generateSignature(timestamp, nonce, bodyString, apiSecret);

    console.log('Request to Binance API');
    console.log('Timestamp:', timestamp);
    console.log('Nonce:', nonce);
    console.log('Body:', bodyString);

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

    console.log('Binance response status:', binanceResponse.status);
    console.log('Binance response:', JSON.stringify(result, null, 2));

    if (result.status !== 'SUCCESS' || !result.data) {
      console.error('Binance API Error:', result);
      const errorMsg = result.errorMessage || 'Failed to create Binance payment';

      if (errorMsg.includes('geo') || errorMsg.includes('region') || errorMsg.includes('location') || result.code === '000002') {
        throw new Error('Failed to create Binance payment - geo restriction detected');
      }

      throw new Error(`${errorMsg}`);
    }

    const prepayId = result.data.prepayId;
    const universalUrl = result.data.universalUrl;
    const qrcodeLink = result.data.qrcodeLink;

    if (!prepayId || !universalUrl) {
      throw new Error('Invalid response from Binance API');
    }

    const { error: insertError } = await supabase
      .from('binance_payments')
      .insert({
        user_id,
        order_id: prepayId,
        amount_usd: parseFloat(amount.toFixed(2)),
        status: 'pending',
        payment_url: universalUrl,
        webhook_data: {
          merchant_trade_no: merchantTradeNo,
          prepay_id: prepayId,
          currency: 'USDT'
        }
      });

    if (insertError) {
      console.error('Error inserting payment record:', insertError);
      throw new Error('Failed to save payment record');
    }

    return new Response(
      JSON.stringify({
        payment_url: universalUrl,
        order_id: prepayId,
        qr_image_url: qrcodeLink,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err: any) {
    console.error('Error creating Binance payment:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
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