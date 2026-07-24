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

    const bodyText = await req.text();
    let body: any;
    try { body = bodyText ? JSON.parse(bodyText) : {}; }
    catch { body = {}; }

    console.log("InfinitePay webhook received:", JSON.stringify(body));

    const orderNsu = body.order_nsu || body.order_id;
    const invoiceSlug = body.invoice_slug || body.slug;
    const paidAmount = Number(body.paid_amount || body.amount || 0);
    const captureMethod = body.capture_method || body.payment_method;
    const transactionNsu = body.transaction_nsu;

    if (!orderNsu) {
      return new Response(JSON.stringify({ error: "No order_nsu in webhook" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: payment, error: paymentError } = await supabase
      .from("infinitepay_payments")
      .select("*")
      .eq("order_id", orderNsu)
      .maybeSingle();

    if (paymentError || !payment) {
      console.error("Payment not found for order:", orderNsu);
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const isPaid = paidAmount > 0
      || body.status === "paid"
      || body.status === "approved"
      || body.status === "captured"
      || captureMethod === "pix"
      || captureMethod === "credit_card";

    if (isPaid && payment.status !== "approved") {
      await processCreditAddition(supabase, payment, {
        invoice_slug: invoiceSlug,
        transaction_nsu: transactionNsu,
        paid_amount: paidAmount,
        capture_method: captureMethod,
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in infinitepay-webhook:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
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

    console.log(`Successfully processed InfinitePay webhook for: ${payment.order_id}, credited $${amountUSD}`);
  } catch (error) {
    console.error("Error processing credit addition:", error);
  }
}
