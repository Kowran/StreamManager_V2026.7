import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

    // Mark expired purchases
    const { data: expiredCount, error: expiredError } = await supabaseAdmin
      .rpc('mark_expired_purchases');

    if (expiredError) {
      console.error('Error marking expired purchases:', expiredError);
      throw expiredError;
    }

    // Send expiry notifications for purchases expiring in 3 days
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const { data: expiringPurchases, error: expiringError } = await supabaseAdmin
      .from('user_purchases')
      .select(`
        id,
        user_id,
        product_name,
        expires_at,
        profiles!user_purchases_user_id_fkey (
          email,
          full_name
        )
      `)
      .eq('expired', false)
      .gte('expires_at', new Date().toISOString())
      .lte('expires_at', threeDaysFromNow.toISOString());

    if (expiringError) {
      console.error('Error fetching expiring purchases:', expiringError);
    }

    let notificationsSent = 0;

    // Send notifications for expiring purchases
    for (const purchase of expiringPurchases || []) {
      try {
        const expiryDate = new Date(purchase.expires_at);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        // Check if we already sent notification today for this purchase
        const today = new Date().toISOString().split('T')[0];
        const { data: existingNotification } = await supabaseAdmin
          .from('notifications')
          .select('id')
          .eq('user_id', purchase.user_id)
          .eq('type', 'order_status')
          .gte('created_at', `${today}T00:00:00.000Z`)
          .lte('created_at', `${today}T23:59:59.999Z`)
          .eq('data->>purchase_id', purchase.id)
          .maybeSingle();

        if (existingNotification) {
          continue; // Skip if already notified today
        }

        let title = '';
        let message = '';
        let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';

        if (daysUntilExpiry <= 1) {
          title = '🚨 Produto Expira Hoje!';
          message = `Seu produto "${purchase.product_name}" expira hoje! As credenciais podem parar de funcionar após a expiração.`;
          priority = 'urgent';
        } else if (daysUntilExpiry <= 3) {
          title = '⚠️ Produto Expira em Breve';
          message = `Seu produto "${purchase.product_name}" expira em ${daysUntilExpiry} dia${daysUntilExpiry !== 1 ? 's' : ''}. Considere renovar ou comprar uma nova conta.`;
          priority = 'high';
        }

        if (title && message) {
          await supabaseAdmin.rpc('create_notification', {
            p_user_id: purchase.user_id,
            p_type: 'order_status',
            p_title: title,
            p_message: message,
            p_data: {
              purchase_id: purchase.id,
              product_name: purchase.product_name,
              expires_at: purchase.expires_at,
              days_until_expiry: daysUntilExpiry,
              notification_type: 'purchase_expiry'
            },
            p_priority: priority,
            p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          });

          notificationsSent++;
        }
      } catch (error) {
        console.error(`Error processing expiring purchase ${purchase.id}:`, error);
      }
    }

    console.log(`Processed ${expiredCount || 0} expired purchases and sent ${notificationsSent} expiry notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Purchase expiry cleanup completed',
        expired_purchases: expiredCount || 0,
        notifications_sent: notificationsSent
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in purchase expiry cleanup:', error);
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