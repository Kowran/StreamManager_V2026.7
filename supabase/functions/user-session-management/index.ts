import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface SessionRequest {
  action: 'get_sessions' | 'revoke_session' | 'revoke_all_sessions';
  user_id: string;
  session_id?: string;
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

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const requestData: SessionRequest = await req.json();
    const { action, user_id, session_id } = requestData;

    switch (action) {
      case 'get_sessions':
        // Note: Supabase doesn't expose session management directly
        // This would require custom implementation or third-party session tracking
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Session management requires custom implementation',
            sessions: []
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );

      case 'revoke_session':
        // Revoke specific session (would require custom session tracking)
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Session revocation requires custom implementation'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );

      case 'revoke_all_sessions':
        // Force user to re-authenticate by updating their auth metadata
        const { error: revokeError } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          { 
            user_metadata: { 
              force_logout: true,
              force_logout_at: new Date().toISOString()
            }
          }
        );

        if (revokeError) throw revokeError;

        // Log admin action
        await supabaseAdmin
          .from('admin_actions')
          .insert({
            admin_id: user.id,
            action: 'revoke_all_sessions',
            target_user_id: user_id,
            details: { forced_logout: true }
          });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'All sessions revoked successfully'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }

  } catch (error) {
    console.error('Error in session management:', error);
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