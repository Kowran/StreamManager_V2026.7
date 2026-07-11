import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface PaymentCheckRequest {
  order_id: string;
}

interface PayPalConfig {
  client_id: string;
  client_secret: string;
  webhook_id?: string;
  environment: 'sandbox' | 'production';
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

    const requestData: PaymentCheckRequest = await req.json();
    const { order_id } = requestData;

    // Get payment from our database first
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('paypal_payments')
      .select('*')
      .eq('order_id', order_id)
      .eq('user_id', user.id)
      .single();

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Payment not found' 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // If already completed in our database, return success
    if (payment.status === 'COMPLETED') {
      return new Response(
        JSON.stringify({
          success: true,
          payment: {
            id: payment.paypal_order_id,
            status: 'COMPLETED',
            completed_at: payment.completed_at
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get PayPal configuration
    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'paypal_config')
      .single();

    if (configError || !configData?.value) {
      // Return local status if config not available
      return new Response(
        JSON.stringify({
          success: true,
          payment: {
            id: payment.paypal_order_id,
            status: payment.status,
            completed_at: payment.completed_at
          },
          source: 'local_database'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const config: PayPalConfig = configData.value;

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken(config);
    if (!accessToken) {
      // Return local status if can't get access token
      return new Response(
        JSON.stringify({
          success: true,
          payment: {
            id: payment.paypal_order_id,
            status: payment.status,
            completed_at: payment.completed_at
          },
          source: 'local_database'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Query PayPal API for current status
    const baseUrl = config.environment === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    const paypalResponse = await fetch(`${baseUrl}/v2/checkout/orders/${payment.paypal_order_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!paypalResponse.ok) {
      // Return current local status when API is not accessible
      return new Response(
        JSON.stringify({
          success: true,
          payment: {
            id: payment.paypal_order_id,
            status: payment.status,
            completed_at: payment.completed_at
          },
          source: 'local_database'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const paypalResult = await paypalResponse.json();

    // Update our payment record with latest status
    const { error: updateError } = await supabaseAdmin
      .from('paypal_payments')
      .update({
        status: paypalResult.status,
        completed_at: paypalResult.status === 'COMPLETED' ? new Date().toISOString() : null,
        webhook_data: {
          ...payment.webhook_data,
          last_check: new Date().toISOString(),
          paypal_response: paypalResult
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating PayPal payment:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment: {
          id: paypalResult.id,
          status: paypalResult.status,
          completed_at: paypalResult.status === 'COMPLETED' ? new Date().toISOString() : null
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error checking PayPal payment:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to check payment status',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function getPayPalAccessToken(config: PayPalConfig): Promise<string | null> {
  try {
    const baseUrl = config.environment === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    const credentials = btoa(`${config.client_id}:${config.client_secret}`);

    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('PayPal token error:', result);
      return null;
    }

    return result.access_token;
  } catch (error) {
    console.error('Error getting PayPal access token:', error);
    return null;
  }
}