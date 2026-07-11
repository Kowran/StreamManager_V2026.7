import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface ClickTrackingRequest {
  affiliate_code: string;
  ip_address?: string;
  user_agent?: string;
  referrer?: string;
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

    const requestData: ClickTrackingRequest = await req.json();
    const { affiliate_code, ip_address, user_agent, referrer } = requestData;

    if (!affiliate_code) {
      return new Response(
        JSON.stringify({ error: 'Affiliate code is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Track the click
    const { data: result, error } = await supabaseAdmin
      .rpc('track_affiliate_click', { affiliate_code });

    if (error) {
      console.error('Error tracking click:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to track click' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Log the click for analytics
    if (result) {
      const { data: linkData } = await supabaseAdmin
        .from('affiliate_links')
        .select('user_id')
        .eq('code', affiliate_code)
        .single();

      if (linkData) {
        await supabaseAdmin
          .from('user_activity_logs')
          .insert({
            user_id: linkData.user_id,
            action: 'affiliate_click',
            details: {
              affiliate_code,
              ip_address: ip_address || req.headers.get('x-forwarded-for') || 'unknown',
              user_agent: user_agent || req.headers.get('user-agent'),
              referrer: referrer || req.headers.get('referer'),
              clicked_at: new Date().toISOString()
            }
          });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        valid: result,
        message: result ? 'Click tracked successfully' : 'Invalid or inactive affiliate code'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in affiliate click tracking:', error);
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