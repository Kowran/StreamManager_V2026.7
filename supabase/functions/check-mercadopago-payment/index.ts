import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface PaymentCheckRequest {
  order_id: string;
}

interface MercadoPagoConfig {
  access_token: string;
  public_key: string;
  webhook_secret: string;
  test_mode: boolean;
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

    // Get MercadoPago configuration
    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'mercadopago_config')
      .single();

    if (configError || !configData?.value) {
      return new Response(
        JSON.stringify({ error: 'MercadoPago configuration not found' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const config: MercadoPagoConfig = configData.value;

    // Get payment from our database first
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('mercadopago_payments')
      .select('*')
      .eq('order_id', order_id)
      .eq('user_id', user.id)
      .single();

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Payment not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // If already approved in our database, return success
    if (payment.status === 'approved') {
      return new Response(
        JSON.stringify({
          success: true,
          payment: {
            id: payment.payment_id,
            status: 'approved',
            date_approved: payment.approved_at
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Query MercadoPago API for current status
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${payment.payment_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    let mpResult;
    try {
      mpResult = await mpResponse.json();
    } catch (parseError) {
      console.warn('Failed to parse MercadoPago API response as JSON:', parseError);
      
      // Return current local status when API response is not valid JSON
      return new Response(
        JSON.stringify({
          success: true,
          payment: {
            id: payment.payment_id,
            status: payment.status,
            status_detail: payment.status_detail,
            date_approved: payment.approved_at
          },
          source: 'local_database',
          note: 'Payment status from local database due to API response parsing error'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!mpResponse.ok) {
     // Handle API access errors gracefully
     console.warn('MercadoPago API access error:', {
       status: mpResponse.status,
       error: mpResult
     });
     
     // Return current local status when API is not accessible
     return new Response(
       JSON.stringify({
         success: true,
         payment: {
           id: payment.payment_id,
           status: payment.status,
           status_detail: payment.status_detail,
           date_approved: payment.approved_at
         },
         source: 'local_database',
         note: 'Payment status from local database due to API access limitations'
       }),
       {
         status: 200,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       }
     );
    }

    // Update our payment record with latest status
    const { error: updateError } = await supabaseAdmin
      .from('mercadopago_payments')
      .update({
        status: mpResult.status,
        status_detail: mpResult.status_detail,
        approved_at: mpResult.date_approved ? new Date(mpResult.date_approved).toISOString() : null,
        webhook_data: {
          ...payment.webhook_data,
          last_check: new Date().toISOString(),
          mp_response: mpResult
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating payment:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment: {
          id: mpResult.id,
          status: mpResult.status,
          status_detail: mpResult.status_detail,
          date_approved: mpResult.date_approved
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error checking MercadoPago payment:', error);
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