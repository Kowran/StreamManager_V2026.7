import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as crypto from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function sendEmailNotification(
  templateType: string,
  recipientId: string,
  variables: Record<string, string | number>
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        template_type: templateType,
        recipient_id: recipientId,
        variables,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error(`send-email failed for ${templateType}: ${errText}`);
    }
  } catch (err) {
    console.error(`Failed to send ${templateType} email (non-fatal):`, err);
  }
}

async function creditUser(supabase: any, payment: any) {
  if (payment.status === "completed") return;

  await supabase
    .from("cryptomus_payments")
    .update({ status: "completed", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", payment.id);

  const { data: credit } = await supabase
    .from("user_credits")
    .select("*")
    .eq("user_id", payment.user_id)
    .maybeSingle();

  const paymentAmount = parseFloat(payment.amount_usd) || 0;
  const currentBalance = credit?.balance || 0;
  const newBalance = currentBalance + paymentAmount;

  await supabase.from("user_credits").upsert({
    user_id: payment.user_id,
    balance: newBalance,
    total_recharged: (credit?.total_recharged || 0) + paymentAmount,
  });

  await supabase.from("credit_transactions").insert({
    user_id: payment.user_id,
    type: "recharge",
    amount: paymentAmount,
    balance_before: currentBalance,
    balance_after: newBalance,
    description: `Recarga via Cryptomus - ${payment.currency}`,
    reference_type: "cryptomus_payment",
    reference_id: payment.id,
    metadata: { order_id: payment.order_id, uuid: payment.uuid },
  });

  await sendEmailNotification('recharge_deposit', payment.user_id, {
    user_name: 'Cliente',
    amount: paymentAmount.toFixed(2),
    new_balance: newBalance.toFixed(2),
  });
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

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Não autorizado");
    }

    const { order_id } = await req.json();

    const { data: payment } = await supabase
      .from("cryptomus_payments")
      .select("*")
      .eq("user_id", user.id)
      .eq("order_id", order_id)
      .maybeSingle();

    if (!payment) {
      return new Response(
        JSON.stringify({ status: "not_found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payment.status === "completed") {
      return new Response(
        JSON.stringify({ status: "paid" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: config } = await supabase
      .from("cryptomus_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (!config) {
      return new Response(
        JSON.stringify({ status: payment.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = {
      uuid: payment.uuid,
      order_id: payment.order_id,
    };

    const jsonData = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(jsonData);
    const base64 = btoa(String.fromCharCode(...dataBytes));
    const sign = crypto
      .createHash("md5")
      .update(base64 + config.api_secret)
      .digest("hex");

    const response = await fetch("https://api.cryptomus.com/v1/payment/info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "merchant": config.merchant_id,
        "sign": sign,
      },
      body: jsonData,
    });

    const result = await response.json();

    if (result.state === 0 && result.result) {
      const paymentStatus = result.result.status;

      if (paymentStatus === "paid" || paymentStatus === "paid_over") {
        await creditUser(supabase, payment);
        return new Response(
          JSON.stringify({ status: "paid" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (paymentStatus === "cancel" || paymentStatus === "wrong_amount" || paymentStatus === "expired") {
        await supabase
          .from("cryptomus_payments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", payment.id);

        return new Response(
          JSON.stringify({ status: "failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ status: "pending" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error checking Cryptomus payment:", error);
    return new Response(
      JSON.stringify({ error: error.message, status: "pending" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
