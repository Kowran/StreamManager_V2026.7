import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface PaymentRequest {
  amount: number;
  payment_method: 'pix' | 'card';
  payer?: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
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

    const requestData: PaymentRequest = await req.json();
    const { amount, payment_method, payer } = requestData;

    // Validate amount
    if (!amount || amount < 0.01 || amount > 1000) {
      return new Response(
        JSON.stringify({ error: 'Amount must be between $0.01 and $1000' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get MercadoPago configuration
    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'mercadopago_config')
      .maybeSingle();

    if (configError || !configData?.value || !configData.value.configured) {
      return new Response(
        JSON.stringify({ 
          error: 'MercadoPago not configured',
          message: 'Please configure MercadoPago in Admin Settings > Payments tab'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const config: MercadoPagoConfig = configData.value;

    // Generate unique order ID
    const orderId = `MP-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

    // Convert USD to BRL (using 5.5 rate)
    const amountBRL = amount * 5.5;

    // Create preference for checkout redirect
    const preferenceData = {
      items: [
        {
          id: 'credit_recharge',
          title: `Recarga de Créditos StreamManager - $${amount.toFixed(2)}`,
          description: `Recarga de $${amount.toFixed(2)} em créditos para sua conta`,
          quantity: 1,
          unit_price: amountBRL,
          currency_id: 'BRL'
        }
      ],
      external_reference: orderId,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      back_urls: {
        success: `${req.headers.get('origin') || 'https://localhost:5173'}/credits?payment=success&order_id=${orderId}`,
        failure: `${req.headers.get('origin') || 'https://localhost:5173'}/credits?payment=failed&order_id=${orderId}`,
        pending: `${req.headers.get('origin') || 'https://localhost:5173'}/credits?payment=pending&order_id=${orderId}`
      },
      auto_return: 'approved',
      payer: {
        email: payer?.email || user.email,
        name: payer?.first_name || user.email?.split('@')[0] || 'Usuario'
      },
      payment_methods: {
        excluded_payment_types: [],
        excluded_payment_methods: [],
        installments: 12,
        default_installments: 1
      },
      statement_descriptor: 'StreamManager',
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
    };

    // Call MercadoPago API to create preference or payment
    const apiUrl = payment_method === 'pix' 
      ? 'https://api.mercadopago.com/v1/payments'
      : 'https://api.mercadopago.com/checkout/preferences';
    
    const requestBody = payment_method === 'pix' ? {
      transaction_amount: amountBRL,
      description: `Recarga de créditos StreamManager - $${amount.toFixed(2)}`,
      payment_method_id: 'pix',
      external_reference: orderId,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      payer: {
        email: payer?.email || user.email,
        first_name: payer?.first_name || user.email?.split('@')[0] || 'Usuario'
      }
    } : preferenceData;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': orderId
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('MercadoPago API error:', result);
      return new Response(
        JSON.stringify({ 
          error: 'Payment creation failed',
          details: result.message || result.cause?.[0]?.description || 'Unknown error'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (payment_method === 'pix') {
      // Save PIX payment record
      const { error: insertError } = await supabaseAdmin
        .from('mercadopago_payments')
        .insert({
          user_id: user.id,
          payment_id: result.id.toString(),
          order_id: orderId,
          amount_brl: amountBRL,
          amount_usd: amount,
          currency: 'BRL',
          payment_method: payment_method,
          payment_method_id: result.payment_method_id,
          status: result.status,
          status_detail: result.status_detail,
          external_reference: orderId,
          qr_code: result.point_of_interaction?.transaction_data?.qr_code,
          qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64,
          ticket_url: result.point_of_interaction?.transaction_data?.ticket_url,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          webhook_data: {
            payment_response: result,
            created_via: 'mercadopago_pix_api'
          }
        });

      if (insertError) {
        console.error('Error saving PIX payment:', insertError);
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
          payment: {
            id: result.id,
            status: result.status,
            payment_method_id: result.payment_method_id,
            payment_type_id: result.payment_type_id,
            transaction_amount: result.transaction_amount,
            currency_id: result.currency_id,
            date_created: result.date_created,
            external_reference: orderId,
            qr_code: result.point_of_interaction?.transaction_data?.qr_code,
            qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64,
            ticket_url: result.point_of_interaction?.transaction_data?.ticket_url
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else {
      // For card payments, save preference record and return checkout URL
      const { error: insertError } = await supabaseAdmin
        .from('mercadopago_payments')
        .insert({
          user_id: user.id,
          payment_id: result.id,
          order_id: orderId,
          amount_brl: amountBRL,
          amount_usd: amount,
          currency: 'BRL',
          payment_method: payment_method,
          status: 'pending',
          external_reference: orderId,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          webhook_data: {
            preference_response: result,
            created_via: 'mercadopago_preference_api',
            checkout_url: result.init_point
          }
        });

      if (insertError) {
        console.error('Error saving card payment preference:', insertError);
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
          payment_id: result.id,
          checkout_url: result.init_point,
          sandbox_init_point: result.sandbox_init_point,
          external_reference: orderId,
          amount_brl: amountBRL,
          amount_usd: amount
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('Error creating MercadoPago payment:', error);
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