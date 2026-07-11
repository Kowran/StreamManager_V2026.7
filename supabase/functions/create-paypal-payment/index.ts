import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface PaymentRequest {
  amount: number;
  total_charged: number;
  paypal_fee: number;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
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

    const requestData: PaymentRequest = await req.json();
    const { amount, total_charged, paypal_fee, currency, description, metadata } = requestData;

    // Validate amount
    if (!amount || amount < 0.01 || amount > 10000) {
      return new Response(
        JSON.stringify({ error: 'Amount must be between $0.01 and $10,000' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get PayPal configuration
    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'paypal_config')
      .maybeSingle();

    if (configError || !configData?.value) {
      return new Response(
        JSON.stringify({ 
          error: 'PayPal not configured',
          message: 'Please configure PayPal in Admin Settings > Payments tab'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const config: PayPalConfig = configData.value;

    // Generate unique order ID
    const orderId = `PP-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken(config);
    if (!accessToken) {
      throw new Error('Failed to get PayPal access token');
    }

    // Create PayPal order with correct structure
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: orderId,
          amount: {
            currency_code: 'USD',
            value: total_charged.toFixed(2)
          },
          description: description || `StreamManager Credits - $${amount.toFixed(2)} (+ fee $${paypal_fee.toFixed(2)})`,
          custom_id: orderId,
          invoice_id: orderId
        }
      ],
      application_context: {
        brand_name: 'StreamManager',
        landing_page: 'BILLING',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: `${req.headers.get('origin') || 'https://localhost:5173'}/credits?payment=success&order_id=${orderId}`,
        cancel_url: `${req.headers.get('origin') || 'https://localhost:5173'}/credits?payment=cancelled&order_id=${orderId}`
      }
    };

    const baseUrl = config.environment === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': orderId
      },
      body: JSON.stringify(orderData)
    });

    const orderResult = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error('PayPal API error:', orderResult);
      
      // Handle specific PayPal errors
      if (orderResult.name === 'UNPROCESSABLE_ENTITY') {
        return new Response(
          JSON.stringify({ 
            error: 'PayPal payment could not be processed',
            message: 'Please try again or use a different payment method.',
            details: orderResult.name
          }),
          {
            status: 422,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      throw new Error(orderResult.message || 'Failed to create PayPal order');
    }

    // Get approval URL
    const approvalUrl = orderResult.links?.find((link: any) => link.rel === 'approve')?.href;
    if (!approvalUrl) {
      throw new Error('No approval URL received from PayPal');
    }

    // Save payment record to database
    const { error: insertError } = await supabaseAdmin
      .from('paypal_payments')
      .insert({
        user_id: user.id,
        order_id: orderId,
        paypal_order_id: orderResult.id,
        amount_usd: amount, // Créditos que o usuário receberá
        total_charged: total_charged, // Valor total cobrado incluindo taxas
        paypal_fee: paypal_fee, // Taxa do PayPal
        currency: 'USD', // Sempre USD
        status: 'CREATED',
        approval_url: approvalUrl,
        description: description || `Credit recharge - $${amount.toFixed(2)} (+ fee $${paypal_fee.toFixed(2)})`,
        metadata: {
          ...metadata,
          paypal_order_id: orderResult.id,
          original_amount: amount,
          paypal_fee: paypal_fee,
          total_charged: total_charged
        },
        expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        webhook_data: {
          order_response: orderResult,
          created_via: 'paypal_api_v2',
          fee_structure: {
            fixed_fee: 0.40,
            percentage_fee: 10.0,
            total_fee: paypal_fee
          }
        }
      });

    if (insertError) {
      console.error('Error saving PayPal payment:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save payment record' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: orderId,
        paypal_order_id: orderResult.id,
        approval_url: approvalUrl,
        amount: amount,
        total_charged: total_charged,
        paypal_fee: paypal_fee,
        currency: 'USD',
        expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error creating PayPal payment:', error);
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
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: 'grant_type=client_credentials'
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('PayPal token error:', result);
      throw new Error(result.error_description || result.error || 'Failed to get access token');
    }

    return result.access_token;
  } catch (error) {
    console.error('Error getting PayPal access token:', error);
    throw error;
  }
}