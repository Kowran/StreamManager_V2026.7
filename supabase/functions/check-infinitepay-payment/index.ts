import { createClient } from "npm:@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const { order_id } = body;

    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: payment, error: paymentError } = await supabase
      .from("infinitepay_payments")
      .select("*")
      .eq("order_id", order_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (payment.status === "approved") {
      return new Response(JSON.stringify({
        success: true,
        payment: { status: "approved", order_id: payment.order_id }
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Load config to check status via API
    const { data: configData } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "infinitepay_config")
      .maybeSingle();

    if (configData?.value?.api_key && payment.invoice_slug) {
      const checkResponse = await fetch("https://api.checkout.infinitepay.io/payment_check", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${configData.value.api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_nsu: payment.order_id,
          invoice_slug: payment.invoice_slug,
        }),
      });

      if (checkResponse.ok) {
        const checkText = await checkResponse.text();
        let checkResult: any;
        try { checkResult = checkText ? JSON.parse(checkText) : {}; }
        catch { checkResult = {}; }

        const isPaid = checkResult.paid_amount > 0
          || checkResult.status === "paid"
          || checkResult.status === "approved"
          || checkResult.status === "captured";

        if (isPaid) {
          await processCreditAddition(supabase, payment, checkResult);

          return new Response(JSON.stringify({
            success: true,
            payment: {
              status: "approved",
              order_id: payment.order_id,
              transaction_nsu: checkResult.transaction_nsu,
            }
          }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }
    }

    return new Response(JSON.stringify({
      success: false,
      payment: {
        status: payment.status,
        order_id: payment.order_id,
        checkout_url: payment.checkout_url,
      }
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in check-infinitepay-payment:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      details: error.message,
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

async function processCreditAddition(supabase: any, payment: any, paymentDetails: any) {
  try {
    const { data: existingTx } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("reference_id", payment.id)
      .eq("reference_type", "infinitepay_payment")
      .maybeSingle();

    if (existingTx) {
      await supabase
        .from("infinitepay_payments")
        .update({ credits_added: true, status: "approved", updated_at: new Date().toISOString() })
        .eq("id", payment.id);
      return;
    }

    const { data: userCredit } = await supabase
      .from("user_credits")
      .select("balance, total_recharged")
      .eq("user_id", payment.user_id)
      .maybeSingle();

    const currentBalance = userCredit?.balance || 0;
    const currentTotalRecharged = userCredit?.total_recharged || 0;
    const amountUSD = Number(payment.amount_usd);
    const newBalance = currentBalance + amountUSD;
    const newTotalRecharged = currentTotalRecharged + amountUSD;

    const { error: txError } = await supabase
      .from("credit_transactions")
      .insert({
        user_id: payment.user_id,
        type: "recharge",
        amount: amountUSD,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: `Recarga via InfinitePay - $${amountUSD.toFixed(2)} (cobrado R$${Number(payment.amount_brl).toFixed(2)})`,
        reference_id: payment.id,
        reference_type: "infinitepay_payment",
        metadata: {
          payment_id: payment.id,
          order_id: payment.order_id,
          amount_brl: payment.amount_brl,
          amount_usd: amountUSD,
          transaction_nsu: paymentDetails.transaction_nsu,
        }
      });

    if (txError) {
      console.error("Error creating transaction:", txError);
      return;
    }

    const { error: creditError } = await supabase
      .from("user_credits")
      .upsert({
        user_id: payment.user_id,
        balance: newBalance,
        total_recharged: newTotalRecharged,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (creditError) {
      console.error("Error updating user credit:", creditError);
      return;
    }

    await supabase
      .from("infinitepay_payments")
      .update({
        credits_added: true,
        status: "approved",
        transaction_nsu: paymentDetails.transaction_nsu,
        updated_at: new Date().toISOString()
      })
      .eq("id", payment.id);

    await supabase.rpc("create_notification", {
      p_user_id: payment.user_id,
      p_type: "payment",
      p_title: "Recarga Confirmada!",
      p_message: `Sua recarga de $${amountUSD.toFixed(2)} via InfinitePay foi confirmada!`,
      p_data: {
        payment_id: payment.id,
        amount_usd: amountUSD,
        amount_brl: payment.amount_brl,
      },
      p_priority: "high",
      p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    console.log(`Successfully processed InfinitePay payment: ${payment.order_id}, credited $${amountUSD}`);
  } catch (error) {
    console.error("Error processing credit addition:", error);
  }
}
