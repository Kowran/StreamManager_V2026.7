import { createClient } from "npm:@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PUBLIC_FIELDS = "id, full_name, seller_slug, username, avatar_url, cover_url, bio, theme_color, profile_badge, role, created_at, seller_level, seller_xp, user_level, user_xp, last_seen_at, login_count, last_login_at";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const seller_ids = body?.seller_ids;
    const seller_slug = body?.seller_slug;
    const admin_only = body?.admin_only === true;

    // Admin-only mode: return first admin profile
    if (admin_only) {
      const { data, error } = await supabase
        .from("profiles")
        .select(PUBLIC_FIELDS)
        .eq("role", "admin")
        .limit(1);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Slug lookup mode: return single seller by slug
    if (seller_slug) {
      const { data, error } = await supabase
        .from("profiles")
        .select(PUBLIC_FIELDS)
        .eq("seller_slug", seller_slug)
        .maybeSingle();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data ? [data] : []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch lookup by IDs
    if (!Array.isArray(seller_ids) || seller_ids.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(PUBLIC_FIELDS)
      .in("id", seller_ids);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data || []), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
