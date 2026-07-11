import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log("Triple-A webhook received:", JSON.stringify(payload));

    // Triple-A sends: payment_id, order_id, status, cryptocurrency, confirmed_at
    const { order_id, payment_id, status } = payload;

    if (!order_id) {
      throw new Error("Missing order_id in webhook payload");
    }

    // Find the payment record
    const { data: payment, error: fetchError } = await supabase
      .from("triplea_payments")
      .select("*")
      .eq("order_id", order_id)
      .maybeSingle();

    if (fetchError || !payment) {
      console.error("Payment not found for order_id:", order_id);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map Triple-A status to internal status
    // Triple-A statuses: paid, underpaid, overpaid, expired, cancelled, pending
    const isPaid = status === "paid" || status === "overpaid";

    // Update payment status
    const { error: updateError } = await supabase
      .from("triplea_payments")
      .update({
        status: isPaid ? "completed" : status,
        external_id: payment_id || payment.external_id,
        confirmed_at: isPaid ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", order_id);

    if (updateError) {
      console.error("Failed to update payment status:", updateError);
    }

    // Credit user if payment is confirmed
    if (isPaid && payment.status !== "completed") {
      const amount = parseFloat(payment.amount);

      // Get or create user credit record
      const { data: credits, error: creditsError } = await supabase
        .from("user_credits")
        .select("*")
        .eq("user_id", payment.user_id)
        .maybeSingle();

      if (creditsError && creditsError.code !== "PGRST116") {
        console.error("Error fetching credits:", creditsError);
      }

      if (!credits) {
        await supabase.from("user_credits").insert({
          user_id: payment.user_id,
          balance: amount,
          total_recharged: amount,
          total_spent: 0,
        });
      } else {
        await supabase
          .from("user_credits")
          .update({
            balance: credits.balance + amount,
            total_recharged: credits.total_recharged + amount,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", payment.user_id);
      }

      // Record transaction
      await supabase.from("credit_transactions").insert({
        user_id: payment.user_id,
        amount,
        type: "recharge",
        description: `Triple-A crypto payment - ${order_id}`,
        reference_id: order_id,
      });

      // Record payment
      await supabase.from("user_payments").insert({
        user_id: payment.user_id,
        amount,
        payment_method: "triplea",
        status: "completed",
        external_id: payment_id || payment.external_id,
        order_id,
      });

      console.log(`Successfully credited ${amount} to user ${payment.user_id}`);
    }

    // Respond with 200 to acknowledge receipt
    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Triple-A webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
