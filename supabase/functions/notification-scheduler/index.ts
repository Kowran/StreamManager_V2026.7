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

    // This function should be called periodically (e.g., via cron job)
    // to check for expiring accounts and send notifications

    let totalNotifications = 0;

    // Check for expiring streaming accounts
    const { data: streamingNotifications, error: streamingError } = await supabaseAdmin
      .rpc('notify_streaming_account_expiry');

    if (streamingError) {
      console.error('Error checking streaming account expiry:', streamingError);
    } else {
      totalNotifications += streamingNotifications || 0;
      console.log(`Sent ${streamingNotifications || 0} streaming account expiry notifications`);
    }

    // Check for expiring accounts access
    const { data: accessNotifications, error: accessError } = await supabaseAdmin
      .rpc('notify_accounts_access_expiry');

    if (accessError) {
      console.error('Error checking accounts access expiry:', accessError);
    } else {
      totalNotifications += accessNotifications || 0;
      console.log(`Sent ${accessNotifications || 0} accounts access expiry notifications`);
    }

    // Clean up expired notifications
    const { data: cleanedUp, error: cleanupError } = await supabaseAdmin
      .rpc('cleanup_expired_notifications');

    if (cleanupError) {
      console.error('Error cleaning up notifications:', cleanupError);
    } else {
      console.log(`Cleaned up ${cleanedUp || 0} expired notifications`);
    }

    // Check for low credit balances (optional)
    await checkLowCreditBalances(supabaseAdmin);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification scheduler completed',
        notifications_sent: totalNotifications,
        expired_cleaned: cleanedUp || 0
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in notification scheduler:', error);
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

async function checkLowCreditBalances(supabase: any) {
  try {
    // Find users with low credit balances (less than $1)
    const { data: lowCreditUsers, error } = await supabase
      .from('user_credits')
      .select(`
        user_id,
        balance,
        profiles (
          email,
          full_name
        )
      `)
      .lt('balance', 1.0)
      .gt('balance', 0); // Only users who have used the system

    if (error) throw error;

    for (const user of lowCreditUsers || []) {
      // Check if we already sent a low credit notification in the last 7 days
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.user_id)
        .eq('type', 'credit_low')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (!existingNotification) {
        // Create low credit notification
        await supabase.rpc('create_notification', {
          p_user_id: user.user_id,
          p_type: 'credit_low',
          p_title: '💳 Saldo Baixo',
          p_message: `Seu saldo está baixo ($${user.balance.toFixed(2)}). Considere recarregar para continuar fazendo compras.`,
          p_data: {
            current_balance: user.balance,
            recommended_recharge: 20.00
          },
          p_priority: 'medium',
          p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });

        console.log(`Sent low credit notification to user ${user.user_id}`);
      }
    }
  } catch (error) {
    console.error('Error checking low credit balances:', error);
  }
}