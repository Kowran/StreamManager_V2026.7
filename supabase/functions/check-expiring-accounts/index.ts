import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface ExpiringAccount {
  id: string;
  user_id: string;
  email: string;
  expiry_date: string;
  streaming_services?: {
    name: string;
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

    // Calculate date ranges for expiring accounts
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get accounts expiring in the next 7 days
    const { data: expiringAccounts, error: accountsError } = await supabaseAdmin
      .from('streaming_accounts')
      .select(`
        id,
        user_id,
        email,
        expiry_date,
        streaming_services (name)
      `)
      .eq('status', 'active')
      .gte('expiry_date', now.toISOString().split('T')[0])
      .lte('expiry_date', sevenDaysFromNow.toISOString().split('T')[0])
      .not('user_id', 'is', null);

    if (accountsError) {
      console.error('Error fetching expiring accounts:', accountsError);
      throw accountsError;
    }

    console.log(`Found ${expiringAccounts?.length || 0} expiring accounts`);

    if (!expiringAccounts || expiringAccounts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No expiring accounts found',
          processed: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let notificationsSent = 0;

    // Process each expiring account
    for (const account of expiringAccounts) {
      try {
        // Fetch user profile data separately
        const { data: userProfile } = await supabaseAdmin
          .from('profiles')
          .select('email, full_name')
          .eq('id', account.user_id)
          .single();

        const expiryDate = new Date(account.expiry_date);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Check if we should send notification based on days remaining
        let shouldNotify = false;
        let notificationType = '';
        
        if (daysUntilExpiry <= 1) {
          notificationType = 'expires_today';
          shouldNotify = true;
        } else if (daysUntilExpiry <= 3) {
          notificationType = 'expires_in_3_days';
          shouldNotify = true;
        } else if (daysUntilExpiry <= 7) {
          notificationType = 'expires_in_7_days';
          shouldNotify = true;
        }

        if (!shouldNotify) continue;

        // Check if we already sent this type of notification for this account today
        const today = now.toISOString().split('T')[0];
        const { data: existingNotification } = await supabaseAdmin
          .from('user_activity_logs')
          .select('id')
          .eq('user_id', account.user_id)
          .eq('action', 'account_expiry_notification')
          .gte('created_at', `${today}T00:00:00.000Z`)
          .lte('created_at', `${today}T23:59:59.999Z`)
          .eq('details->>account_id', account.id)
          .eq('details->>notification_type', notificationType)
          .maybeSingle();

        if (existingNotification) {
          console.log(`Notification already sent today for account ${account.id}, type ${notificationType}`);
          continue;
        }

        // Create notification message
        const serviceName = account.streaming_services?.name || 'Serviço de Streaming';
        const userName = userProfile?.full_name || userProfile?.email?.split('@')[0] || 'Usuário';
        
        let title = '';
        let message = '';
        
        if (daysUntilExpiry <= 1) {
          title = '🚨 Conta Expira Hoje!';
          message = `Sua conta ${serviceName} (${account.email}) expira hoje! Renove agora para não perder o acesso.`;
        } else if (daysUntilExpiry <= 3) {
          title = '⚠️ Conta Expira em Breve';
          message = `Sua conta ${serviceName} (${account.email}) expira em ${daysUntilExpiry} dia${daysUntilExpiry > 1 ? 's' : ''}. Considere renovar em breve.`;
        } else if (daysUntilExpiry <= 7) {
          title = '📅 Lembrete de Expiração';
          message = `Sua conta ${serviceName} (${account.email}) expira em ${daysUntilExpiry} dias. Planeje a renovação.`;
        }

        // Create notification for the user
        const { error: notifError } = await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: account.user_id,
            type: 'account_expiry',
            title: title,
            message: message,
            data: {
              account_id: account.id,
              service_name: serviceName,
              account_email: account.email,
              expiry_date: account.expiry_date,
              days_until_expiry: daysUntilExpiry
            },
            priority: daysUntilExpiry <= 1 ? 'urgent' : daysUntilExpiry <= 3 ? 'high' : 'medium',
            read: false
          });

        // Log the notification activity
        const { error: logError } = await supabaseAdmin
          .from('user_activity_logs')
          .insert({
            user_id: account.user_id,
            action: 'account_expiry_notification',
            details: {
              account_id: account.id,
              service_name: serviceName,
              account_email: account.email,
              expiry_date: account.expiry_date,
              days_until_expiry: daysUntilExpiry,
              notification_type: notificationType,
              title: title,
              message: message,
              sent_at: new Date().toISOString()
            }
          });

        if (logError || notifError) {
          console.error('Error logging/creating notification:', logError || notifError);
        } else {
          notificationsSent++;
          console.log(`Notification created for user ${account.user_id}, account ${account.id}`);
        }

      } catch (error) {
        console.error(`Error processing account ${account.id}:`, error);
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${expiringAccounts.length} expiring accounts`,
        notifications_sent: notificationsSent,
        accounts_checked: expiringAccounts.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in check-expiring-accounts:', error);
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