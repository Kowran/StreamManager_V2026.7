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
      console.error('Error cleaning up expired notifications:', cleanupError);
    } else {
      console.log(`Cleaned up ${cleanedUp || 0} expired notifications`);
    }

    // Check for low credit balances
    await checkLowCreditBalances(supabaseAdmin);

    // Process Discord notification queue
    const discordSent = await processDiscordQueue(supabaseAdmin);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification scheduler completed',
        notifications_sent: totalNotifications,
        expired_cleaned: cleanedUp || 0,
        discord_sent: discordSent,
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
      .gt('balance', 0);

    if (error) throw error;

    for (const user of lowCreditUsers || []) {
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.user_id)
        .eq('type', 'credit_low')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (!existingNotification) {
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

async function processDiscordQueue(supabase: any): Promise<number> {
  let sent = 0;
  try {
    // Fetch pending queue items (max 50 per run)
    const { data: queueItems, error } = await supabase
      .from('discord_notification_queue')
      .select('id, notification_id, user_id, event_type, variables, attempts')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!queueItems || queueItems.length === 0) return 0;

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    for (const item of queueItems) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/discord-bot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            action: 'send_notification',
            user_id: item.user_id,
            event_type: item.event_type,
            variables: item.variables || {},
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            await supabase
              .from('discord_notification_queue')
              .update({ status: 'sent', processed_at: new Date().toISOString() })
              .eq('id', item.id);
            sent++;
          } else {
            // User has no Discord link or disabled this notification type — mark as skipped
            await supabase
              .from('discord_notification_queue')
              .update({
                status: 'skipped',
                error_message: result.message || result.error || 'Skipped',
                processed_at: new Date().toISOString()
              })
              .eq('id', item.id);
          }
        } else {
          // Increment attempts, keep pending if under 3
          const newAttempts = item.attempts + 1;
          await supabase
            .from('discord_notification_queue')
            .update({
              attempts: newAttempts,
              error_message: `HTTP ${response.status}`,
              status: newAttempts >= 3 ? 'failed' : 'pending'
            })
            .eq('id', item.id);
        }
      } catch (err) {
        const newAttempts = item.attempts + 1;
        await supabase
          .from('discord_notification_queue')
          .update({
            attempts: newAttempts,
            error_message: err.message,
            status: newAttempts >= 3 ? 'failed' : 'pending'
          })
          .eq('id', item.id);
      }
    }

    console.log(`Processed Discord queue: ${sent} sent out of ${queueItems.length} pending`);
  } catch (error) {
    console.error('Error processing Discord queue:', error);
  }
  return sent;
}
