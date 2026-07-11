import { createClient } from 'npm:@supabase/supabase-js@2.54.0';
import Stripe from 'npm:stripe@17.3.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface StripeConfig {
  publishable_key: string;
  secret_key: string;
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

    // Verify admin access
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

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the config from request body or from database
    let config: StripeConfig;
    
    try {
      const requestData = await req.json();
      config = requestData.config;
    } catch {
      // If no config in request, get from database
      const { data: configData, error: configError } = await supabaseAdmin
        .from('system_config')
        .select('value')
        .eq('key', 'stripe_config')
        .single();

      if (configError || !configData?.value) {
        return new Response(
          JSON.stringify({ error: 'Stripe configuration not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      config = configData.value;
    }

    // Test connection to Stripe API
    const connectionResult = await testStripeConnection(config);

    return new Response(
      JSON.stringify(connectionResult),
      {
        status: connectionResult.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error testing Stripe connection:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
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

async function testStripeConnection(config: StripeConfig): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    // Initialize Stripe with the provided config
    const stripe = new Stripe(config.secret_key, {
      apiVersion: '2024-12-18.acacia'
    });

    // Test basic API connectivity by retrieving account info
    const account = await stripe.accounts.retrieve();

    // Test creating a small payment intent (won't be charged)
    const testPaymentIntent = await stripe.paymentIntents.create({
      amount: 100, // $1.00 in cents
      currency: 'usd',
      description: 'Test payment intent - StreamManager',
      metadata: {
        test: 'true',
        created_by: 'streammanager_test'
      }
    });

    // Cancel the test payment intent immediately
    await stripe.paymentIntents.cancel(testPaymentIntent.id);

    return {
      success: true,
      details: {
        account_id: account.id,
        account_country: account.country,
        account_email: account.email,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        test_mode: config.test_mode,
        test_payment_intent_created: true,
        test_payment_intent_canceled: true
      }
    };

  } catch (error) {
    console.error('Stripe connection test failed:', error);
    
    let errorMessage = error.message || 'Unknown error';
    let errorDetails: any = {
      test_mode: config.test_mode,
      error_type: error.type || 'unknown',
      timestamp: new Date().toISOString()
    };

    // Provide specific error messages for common issues
    if (error.type === 'StripeAuthenticationError') {
      errorMessage = 'Chave da API inválida. Verifique se a Secret Key está correta.';
      errorDetails.likely_causes = [
        'Secret Key incorreta',
        'Chave de teste usada em produção ou vice-versa',
        'Chave expirada ou revogada'
      ];
    } else if (error.type === 'StripePermissionError') {
      errorMessage = 'Permissões insuficientes. Verifique as permissões da chave da API.';
    } else if (error.type === 'StripeConnectionError') {
      errorMessage = 'Erro de conexão com o Stripe. Verifique sua conexão com a internet.';
    }

    return {
      success: false,
      error: errorMessage,
      details: errorDetails
    };
  }
}