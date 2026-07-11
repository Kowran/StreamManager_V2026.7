import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as crypto from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Não autorizado");
    }

    const { amount } = await req.json();

    if (!amount || amount < 1) {
      throw new Error("Valor inválido");
    }

    const { data: config } = await supabase
      .from("cryptomus_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (!config || !config.merchant_id || !config.api_secret) {
      throw new Error("Cryptomus não configurado");
    }

    const orderId = `crypto_${Date.now()}_${user.id.substring(0, 8)}`;

    const paymentData = {
      amount: amount.toString(),
      currency: "USD",
      order_id: orderId,
      url_return: `${supabaseUrl.replace('.supabase.co', '')}/credits`,
      url_callback: `${supabaseUrl}/functions/v1/cryptomus-webhook`,
    };

    const jsonData = JSON.stringify(paymentData);
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonData);
    const base64 = btoa(String.fromCharCode(...data));
    const signString = base64 + config.api_secret;
    const sign = crypto
      .createHash("md5")
      .update(signString)
      .digest("hex");

    const response = await fetch("https://api.cryptomus.com/v1/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "merchant": config.merchant_id,
        "sign": sign,
      },
      body: jsonData,
    });

    const result = await response.json();

    if (!response.ok || result.state !== 0) {
      throw new Error(result.message || "Erro ao criar pagamento");
    }

    await supabase.from("cryptomus_payments").insert({
      user_id: user.id,
      amount,
      currency: "USD",
      external_id: result.result.uuid,
      order_id: orderId,
      status: "pending",
    });

    return new Response(
      JSON.stringify({
        url: result.result.url,
        order_id: orderId,
        uuid: result.result.uuid,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
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