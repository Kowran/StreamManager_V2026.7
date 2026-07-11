import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TRIPLEA_API_BASE = "https://api.triple-a.io";

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch(`${TRIPLEA_API_BASE}/api/v2/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Triple-A access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { amount, currency = "USD" } = await req.json();

    if (!amount || amount < 1) {
      throw new Error("Invalid amount");
    }

    // Get Triple-A configuration
    const { data: config, error: configError } = await supabase
      .from("triplea_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (configError || !config) {
      throw new Error("Triple-A payment gateway not configured");
    }

    const { client_id, client_secret, merchant_key, sandbox_mode } = config;

    // Get OAuth token
    const accessToken = await getAccessToken(client_id, client_secret);

    // Generate unique order ID
    const orderId = `triplea_${Date.now()}_${user.id.substring(0, 8)}`;

    // Callback URL for webhook
    const callbackUrl = `${supabaseUrl}/functions/v1/triplea-webhook`;
    const returnUrl = `${supabaseUrl.replace('.supabase.co', '')}/credits`;

    // Create hosted checkout payment
    const paymentPayload = {
      merchant_key,
      order_id: orderId,
      amount: amount.toString(),
      currency,
      notification_url: callbackUrl,
      success_url: returnUrl,
      cancel_url: returnUrl,
      customer_email: user.email,
    };

    const response = await fetch(`${TRIPLEA_API_BASE}/api/v2/payment/hosted`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Triple-A payment creation error:", result);
      throw new Error(result.message || "Failed to create payment");
    }

    // Store payment in database
    const { error: insertError } = await supabase
      .from("triplea_payments")
      .insert({
        user_id: user.id,
        amount,
        currency,
        external_id: result.payment_id || result.id,
        order_id: orderId,
        payment_url: result.hosted_url || result.url,
        status: "pending",
        access_token: accessToken,
      });

    if (insertError) {
      console.error("Failed to store Triple-A payment:", insertError);
      throw new Error("Failed to record payment");
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: result.hosted_url || result.url,
        order_id: orderId,
        payment_id: result.payment_id || result.id,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Triple-A payment creation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
