import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface AffiliateSignupRequest {
  user_id: string;
  affiliate_code: string;
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

    const requestData: AffiliateSignupRequest = await req.json();
    const { user_id, affiliate_code } = requestData;

    if (!user_id || !affiliate_code) {
      return new Response(
        JSON.stringify({ error: 'User ID and affiliate code are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create affiliate referral relationship
    const { data: result, error } = await supabaseAdmin
      .rpc('create_affiliate_referral', {
        p_affiliate_code: affiliate_code,
        p_referred_user_id: user_id
      });

    if (error) {
      console.error('Error creating affiliate referral:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create referral relationship' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        referral_created: result,
        message: 'Affiliate referral created successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing affiliate signup:', error);
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