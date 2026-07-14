import { createClient } from 'npm:@supabase/supabase-js@2.54.0';
import Stripe from 'npm:stripe@17.3.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface PaymentRequest {
  amount: number;
  original_amount?: number;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
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
    const { amount, original_amount, currency, description, metadata } = requestData;

    // Validate amount (in user currency, so limits scale accordingly)
    if (!amount || amount < 0.01 || amount > 1000000) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get Stripe configuration
    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'stripe_config')
      .maybeSingle();

    if (configError || !configData?.value || !configData.value.configured) {
      return new Response(
        JSON.stringify({ 
          error: 'Stripe not configured',
          message: 'Please configure Stripe in Admin Settings > Payments tab'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const config = configData.value;

    // Initialize Stripe
    const stripe = new Stripe(config.secret_key, {
      apiVersion: '2024-12-18.acacia'
    });

    // Generate unique order ID
    const orderId = `ST-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

    // Calculate the amount to credit (original USD amount without fees)
    const amountToCreditUSD = original_amount || amount;
    const totalChargedInCurrency = amount; // This includes fees, in user currency
    const stripeFeeInCurrency = totalChargedInCurrency - (amountToCreditUSD * (parseFloat(metadata?.exchange_rate || '1')));
    
    // Determine decimals: zero-decimal currencies (JPY, ARS, COP, CLP, etc.) don't use cents
    const zeroDecimalCurrencies = ['ars', 'cop', 'clp', 'jpy', 'krw', 'vnd', 'idr', 'pyg', 'ugx'];
    const isZeroDecimal = zeroDecimalCurrencies.includes(currency.toLowerCase());
    const amountInSmallestUnit = isZeroDecimal 
      ? Math.round(totalChargedInCurrency)
      : Math.round(totalChargedInCurrency * 100);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInSmallestUnit,
      currency: currency.toLowerCase(),
      description: description || `Recarga de créditos - ${amountToCreditUSD.toFixed(2)} USD`,
      metadata: {
        order_id: orderId,
        user_id: user.id,
        user_email: user.email || '',
        type: 'credit_recharge',
        original_amount_usd: amountToCreditUSD.toString(),
        charge_currency: currency.toUpperCase(),
        total_charged: totalChargedInCurrency.toString(),
        stripe_fee: stripeFeeInCurrency.toString(),
        ...metadata
      },
      payment_method_types: ['card'],
    });

    // Save payment record to database
    const { error: insertError } = await supabaseAdmin
      .from('stripe_payments')
      .insert({
        user_id: user.id,
        order_id: orderId,
        payment_intent_id: paymentIntent.id,
        amount_usd: amountToCreditUSD, // Store original USD amount (what user will receive as credits)
        currency: currency.toUpperCase(),
        status: 'pending',
        client_secret: paymentIntent.client_secret,
        description: description || `Recarga de créditos - ${amountToCreditUSD.toFixed(2)} USD`,
        metadata: paymentIntent.metadata,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        webhook_data: {
          payment_intent_id: paymentIntent.id,
          created_via: 'stripe_api',
          original_amount_usd: amountToCreditUSD,
          charge_currency: currency.toUpperCase(),
          total_charged: totalChargedInCurrency,
          stripe_fee: stripeFeeInCurrency,
          fees_included: true
        }
      });

    if (insertError) {
      console.error('Error saving payment:', insertError);
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
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        order_id: orderId,
        amount: amountToCreditUSD, // USD amount user will receive as credits
        total_charged: totalChargedInCurrency, // Total charged in user currency
        stripe_fee: stripeFeeInCurrency,
        currency: currency.toUpperCase(),
        amount_in_smallest_unit: amountInSmallestUnit,
        publishable_key: config.publishable_key
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error creating Stripe payment:', error);
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