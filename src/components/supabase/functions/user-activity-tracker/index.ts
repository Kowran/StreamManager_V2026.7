import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ActivityRequest {
  action: 'login' | 'logout' | 'page_view' | 'action_performed';
  user_id?: string;
  details?: {
    page?: string;
    action_type?: string;
    ip_address?: string;
    user_agent?: string;
    [key: string]: any;
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestData: ActivityRequest = await req.json();
    const { action, user_id, details } = requestData;

    // Get user info from authorization header if not provided
    let userId = user_id;
    if (!userId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Track the activity
    switch (action) {
      case 'login':
        // Update last login and increment login count
        // First get current login count
        const { data: profile } = await supabase
          .from('profiles')
          .select('login_count')
          .eq('id', userId)
          .single();

        const currentCount = profile?.login_count || 0;

        // Update with incremented count
        const { error: loginError } = await supabase
          .from('profiles')
          .update({
            last_login_at: new Date().toISOString(),
            login_count: currentCount + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (loginError) {
          console.error('Error updating login info:', loginError);
        }

        // Log activity
        await logActivity(supabase, userId, 'login', {
          ip_address: getClientIP(req),
          user_agent: req.headers.get('User-Agent'),
          ...details
        });
        break;

      case 'logout':
        await logActivity(supabase, userId, 'logout', {
          ip_address: getClientIP(req),
          ...details
        });
        break;

      case 'page_view':
        await logActivity(supabase, userId, 'page_view', {
          page: details?.page,
          ip_address: getClientIP(req),
          user_agent: req.headers.get('User-Agent'),
          ...details
        });
        break;

      case 'action_performed':
        await logActivity(supabase, userId, 'action_performed', {
          action_type: details?.action_type,
          ip_address: getClientIP(req),
          ...details
        });
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action type' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Activity tracked successfully' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error tracking activity:', error);
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

async function logActivity(supabase: any, userId: string, action: string, details: any) {
  try {
    await supabase
      .from('user_activity_logs')
      .insert({
        user_id: userId,
        action,
        details,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

function getClientIP(req: Request): string {
  // Try to get real IP from various headers
  const forwarded = req.headers.get('X-Forwarded-For');
  const realIP = req.headers.get('X-Real-IP');
  const cfConnectingIP = req.headers.get('CF-Connecting-IP');
  
  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(',')[0].trim();
  
  return 'unknown';
}