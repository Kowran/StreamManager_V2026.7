import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExpiredPurchase {
  id: string;
  user_id: string;
  product_id: string;
  purchase_date: string;
  expiry_date: string;
  products?: {
    name: string;
    price: number;
    duration_days: number;
  };
  profiles?: {
    email: string;
    full_name?: string;
  };
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

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get purchases that expired in the last 24 hours
    const { data: expiredPurchases, error: purchasesError } = await supabaseAdmin
      .from('purchases')
      .select(`
        id,
        user_id,
        product_id,
        purchase_date,
        expiry_date,
        products (name, price, duration_days)
      `)
      .eq('status', 'active')
      .gte('expiry_date', yesterday.toISOString().split('T')[0])
      .lt('expiry_date', now.toISOString().split('T')[0])
      .not('user_id', 'is', null);

    if (purchasesError) {
      console.error('Error fetching expired purchases:', purchasesError);
      throw purchasesError;
    }

    console.log(`Found ${expiredPurchases?.length || 0} expired purchases`);

    if (!expiredPurchases || expiredPurchases.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No expired purchases found',
          processed: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let renewalPromptsSent = 0;

    // Process each expired purchase
    for (const purchase of expiredPurchases) {
      try {
        // Fetch user profile data
        const { data: userProfile } = await supabaseAdmin
          .from('profiles')
          .select('email, full_name')
          .eq('id', purchase.user_id)
          .single();

        // Check if we already sent a renewal prompt for this purchase
        const { data: existingNotification } = await supabaseAdmin
          .from('notifications')
          .select('id')
          .eq('user_id', purchase.user_id)
          .eq('type', 'renewal_prompt')
          .eq('data->>purchase_id', purchase.id)
          .maybeSingle();

        if (existingNotification) {
          console.log(`Renewal prompt already sent for purchase ${purchase.id}`);
          continue;
        }

        const productName = purchase.products?.name || 'Produto';
        const productPrice = purchase.products?.price || 0;
        const durationDays = purchase.products?.duration_days || 30;
        const userName = userProfile?.full_name || userProfile?.email?.split('@')[0] || 'Usuário';
        
        const title = '🔄 Renovar Compra Vencida?';
        const message = `Sua compra de "${productName}" expirou. Deseja renovar por mais ${durationDays} dias por $${productPrice.toFixed(2)}?`;

        // Create renewal prompt notification
        const { error: notifError } = await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: purchase.user_id,
            type: 'renewal_prompt',
            title: title,
            message: message,
            data: {
              purchase_id: purchase.id,
              product_id: purchase.product_id,
              product_name: productName,
              product_price: productPrice,
              duration_days: durationDays,
              expired_date: purchase.expiry_date,
              can_renew: true
            },
            priority: 'high',
            read: false
          });

        // Log the renewal prompt activity
        const { error: logError } = await supabaseAdmin
          .from('user_activity_logs')
          .insert({
            user_id: purchase.user_id,
            action: 'renewal_prompt_sent',
            details: {
              purchase_id: purchase.id,
              product_id: purchase.product_id,
              product_name: productName,
              expired_date: purchase.expiry_date,
              title: title,
              message: message,
              sent_at: new Date().toISOString()
            }
          });

        if (logError || notifError) {
          console.error('Error creating renewal prompt:', logError || notifError);
        } else {
          renewalPromptsSent++;
          console.log(`Renewal prompt sent for purchase ${purchase.id}`);
        }

      } catch (error) {
        console.error(`Error processing purchase ${purchase.id}:`, error);
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${expiredPurchases.length} expired purchases`,
        renewal_prompts_sent: renewalPromptsSent,
        purchases_checked: expiredPurchases.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in check-expired-purchases:', error);
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