import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface VerifyPaymentRequest {
  payment_id: string;
  payment_method: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const requestData: VerifyPaymentRequest = await req.json();
    const { payment_id, payment_method } = requestData;

    let payment = null;
    let tableName = '';

    // Get payment record based on method
    if (payment_method === 'cryptomus') {
      tableName = 'cryptomus_payments';
      const { data, error } = await supabaseAdmin
        .from('cryptomus_payments')
        .select('*')
        .eq('order_id', payment_id)
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        return new Response(
          JSON.stringify({ error: 'Payment not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      payment = data;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid payment method' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check current status
    if (payment.status === 'paid') {
      return new Response(
        JSON.stringify({
          success: true,
          paid: true,
          message: 'Payment already confirmed',
          transaction_id: payment.transaction_id,
          paid_at: payment.paid_at
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // For Cryptomus, query the API
    if (payment_method === 'cryptomus' && payment.uuid) {
      try {
        const paymentStatus = await queryCryptomusStatus(payment.uuid);
        
        if (paymentStatus.success && paymentStatus.status === 'paid') {
          // Update payment status
          const { error: updateError } = await supabaseAdmin
            .from('cryptomus_payments')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              webhook_data: {
                ...payment.webhook_data,
                manual_verification: true,
                verified_at: new Date().toISOString(),
                api_response: paymentStatus
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', payment.id);

          if (updateError) throw updateError;

          return new Response(
            JSON.stringify({
              success: true,
              paid: true,
              message: 'Payment confirmed'
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
      } catch (error) {
        console.error('Error querying Cryptomus status:', error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        paid: false,
        message: 'Payment not confirmed yet'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error verifying payment:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});


async function queryCryptomusStatus(uuid: string) {
  try {
    // Get Cryptomus configuration
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: configData } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'cryptomus_config')
      .single();

    if (!configData?.value) {
      throw new Error('Cryptomus config not found');
    }

    const config = configData.value;
    const queryData = { uuid };
    const body = JSON.stringify(queryData);
    const sign = await generateCryptomusSignature(body, config.api_key);

    const response = await fetch('https://api.cryptomus.com/v1/payment/info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'merchant': config.merchant_id,
        'sign': sign
      },
      body
    });

    const result = await response.json();
    
    if (result.state === 0 && result.result) {
      return {
        success: true,
        status: result.result.payment_status
      };
    }

    return { success: false, error: result.message };
  } catch (error) {
    console.error('Error querying Cryptomus:', error);
    return { success: false, error: error.message };
  }
}

async function generateSignature(payload: string, secret: string): Promise<string> {
}

async function generateCryptomusSignature(data: string, apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(apiKey);
  const messageData = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}