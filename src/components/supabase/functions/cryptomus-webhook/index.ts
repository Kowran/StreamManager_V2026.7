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

    const bodyText = await req.text();
    const sign = req.headers.get("sign");

    const { data: config } = await supabase
      .from("cryptomus_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (!config) {
      throw new Error("Configuração não encontrada");
    }

    const expectedSign = crypto
      .createHash("md5")
      .update(Buffer.from(bodyText).toString("base64") + config.api_secret)
      .digest("hex");

    if (sign !== expectedSign) {
      throw new Error("Assinatura inválida");
    }

    const data = JSON.parse(bodyText);

    const { data: payment } = await supabase
      .from("cryptomus_payments")
      .select("*")
      .eq("external_id", data.uuid)
      .maybeSingle();

    if (!payment) {
      throw new Error("Pagamento não encontrado");
    }

    if (data.status === "paid" || data.status === "paid_over") {
      await supabase
        .from("cryptomus_payments")
        .update({ status: "completed" })
        .eq("id", payment.id);

      const { data: credit } = await supabase
        .from("user_credits")
        .select("*")
        .eq("user_id", payment.user_id)
        .maybeSingle();

      const currentBalance = credit?.balance || 0;
      const newBalance = currentBalance + payment.amount;

      await supabase.from("user_credits").upsert({
        user_id: payment.user_id,
        balance: newBalance,
        total_recharged: (credit?.total_recharged || 0) + payment.amount,
      });

      await supabase.from("credit_transactions").insert({
        user_id: payment.user_id,
        type: "recharge",
        amount: payment.amount,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: `Recarga via Cryptomus - ${payment.currency}`,
        reference_type: "cryptomus_payment",
        reference_id: payment.id,
        metadata: { order_id: payment.order_id },
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Webhook error:", error);
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