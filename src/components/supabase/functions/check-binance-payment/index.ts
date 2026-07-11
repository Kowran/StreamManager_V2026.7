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

    const { order_id } = await req.json();

    const { data: payment, error: paymentError } = await supabase
      .from('binance_payments')
      .select('*')
      .eq('order_id', order_id)
      .eq('user_id', user.id)
      .single();

    if (paymentError || !payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'completed') {
      return new Response(
        JSON.stringify({ status: 'completed' }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: config, error: configError } = await supabase
      .from('binance_config')
      .select('*')
      .single();

    if (configError || !config) {
      throw new Error('Binance configuration not found');
    }

    const apiKey = config.api_key;
    const apiSecret = config.api_secret;

    const timestamp = Date.now().toString();
    const nonce = generateNonce();

    const requestBody = {
      prepayId: order_id,
    };

    const bodyString = JSON.stringify(requestBody);
    const signature = generateSignature(timestamp, nonce, bodyString, apiSecret);

    const binanceResponse = await fetch('https://bpay.binanceapi.com/binancepay/openapi/v2/order/query', {
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

    if (result.status !== 'SUCCESS') {
      return new Response(
        JSON.stringify({ status: payment.status }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const orderStatus = result.data.status;
    let newStatus = payment.status;

    if (orderStatus === 'PAID') {
      newStatus = 'completed';
      
      await supabase
        .from('binance_payments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', payment.id);

      const { data: user_credits } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const paymentAmount = parseFloat(payment.amount_usd) || 0;
      const currentBalance = user_credits?.balance || 0;
      const newBalance = currentBalance + paymentAmount;

      await supabase.from('user_credits').upsert({
        user_id: user.id,
        balance: newBalance,
        total_recharged: (user_credits?.total_recharged || 0) + paymentAmount,
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
        metadata: { order_id: payment.order_id },
      });

    } else if (orderStatus === 'EXPIRED' || orderStatus === 'CANCELED' || orderStatus === 'ERROR') {
      newStatus = 'failed';
      await supabase
        .from('binance_payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', payment.id);
    }

    return new Response(
      JSON.stringify({ status: newStatus }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err: any) {
    console.error('Error checking Binance payment:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error', status: 'pending' }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});