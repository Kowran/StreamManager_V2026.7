import { createClient } from "npm:@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InfinitePayConfig {
  api_key: string;
  handle: string;
  test_mode: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Load InfinitePay config
    const { data: configData, error: configError } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "infinitepay_config")
      .maybeSingle();

    if (configError || !configData?.value) {
      return new Response(JSON.stringify({ error: "InfinitePay not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const config: InfinitePayConfig = configData.value;
    if (!config.api_key?.trim()) {
      return new Response(JSON.stringify({ error: "InfinitePay API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const amountUSD = Number(amount);
    const amountBRL = Math.round(amountUSD * 5.5 * 100); // cents

    const orderId = `inf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // Create payment record
    const { error: insertError } = await supabase
      .from("infinitepay_payments")
      .insert({
        user_id: user.id,
        order_id: orderId,
        amount_usd: amountUSD,
        amount_brl: amountUSD * 5.5,
        status: "pending",
        payment_method: "pix",
      });

    if (insertError) {
      console.error("Error creating payment record:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create payment record" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const baseUrl = "https://api.checkout.infinitepay.io";
    const webhookUrl = `${supabaseUrl}/functions/v1/infinitepay-webhook`;
    const redirectUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/create-infinitepay-payment`;

    const payload: any = {
      handle: config.handle || "checkout",
      redirect_url: `${req.headers.get("origin") || ""}/#credits?payment=success&order=${orderId}`,
      webhook_url: webhookUrl,
      order_nsu: orderId,
      items: [
        {
          title: `Recarga de creditos - $${amountUSD.toFixed(2)}`,
          unit_price: amountBRL,
          quantity: 1,
        },
      ],
    };

    const response = await fetch(`${baseUrl}/links`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let result: any;
    try { result = responseText ? JSON.parse(responseText) : {}; }
    catch { result = { raw: responseText }; }

    if (!response.ok) {
      console.error("InfinitePay link creation error:", result, "status:", response.status);
      const errorDesc = result.errors?.[0]?.description
        || result.message
        || result.error
        || (response.status === 401 ? "API key invalida ou sem permissao"
          : response.status === 400 ? "Dados da cobranca invalidos"
          : "Unknown error");

      await supabase
        .from("infinitepay_payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("order_id", orderId);

      return new Response(JSON.stringify({
        error: "Failed to create InfinitePay payment",
        details: errorDesc,
      }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const checkoutUrl = result.url || result.checkout_url || result.link;
    const invoiceSlug = result.slug || result.invoice_slug || result.id;

    await supabase
      .from("infinitepay_payments")
      .update({
        checkout_url: checkoutUrl,
        invoice_slug: invoiceSlug,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    return new Response(JSON.stringify({
      payment: {
        order_id: orderId,
        checkout_url: checkoutUrl,
        invoice_slug: invoiceSlug,
        status: "pending",
        amount_usd: amountUSD,
        amount_brl: amountUSD * 5.5,
      }
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in create-infinitepay-payment:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      details: error.message,
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
