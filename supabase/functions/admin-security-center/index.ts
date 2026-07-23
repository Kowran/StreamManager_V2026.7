import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function verifyAdmin(req: Request): Promise<{ is_admin: boolean; user_id: string | null; email: string | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { is_admin: false, user_id: null, email: null };

  const token = authHeader.replace("Bearer ", "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { is_admin: false, user_id: null, email: null };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .maybeSingle();

  return {
    is_admin: profile?.role === "admin",
    user_id: user.id,
    email: profile?.email || user.email || null,
  };
}

async function getTableSecurityOverview() {
  // Get all tables with RLS status and policy counts
  const { data, error } = await adminClient.rpc("get_security_overview");
  if (error) throw error;
  return data;
}

async function getPolicyDetails(tableName?: string) {
  let query = adminClient
    .from("pg_policies")
    .select("*")
    .eq("schemaname", "public");

  // pg_policies is a view, use direct SQL via rpc
  const { data, error } = await adminClient.rpc("get_all_policies", {
    p_table: tableName || null,
  });
  if (error) throw error;
  return data;
}

async function getVulnerablePolicies() {
  const { data, error } = await adminClient.rpc("get_vulnerable_policies");
  if (error) throw error;
  return data;
}

async function getAuditLogs(limit: number, offset: number, severity?: string) {
  let query = adminClient
    .from("security_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (severity && severity !== "all") {
    query = query.eq("severity", severity);
  }

  const { data, error } = await query;
  if (error) throw error;

  const { count } = await adminClient
    .from("security_audit_logs")
    .select("*", { count: "exact", head: true });

  return { logs: data, total: count || 0 };
}

async function logSecurityEvent(body: any, actor: { user_id: string | null; email: string | null }) {
  const { error } = await adminClient.from("security_audit_logs").insert({
    actor_id: actor.user_id,
    actor_email: actor.email,
    event_type: body.event_type || "admin_action",
    severity: body.severity || "info",
    affected_table: body.affected_table || null,
    message: body.message || "",
    metadata: body.metadata || {},
    ip_address: body.ip_address || null,
  });
  if (error) throw error;
  return { success: true };
}

async function runSecurityScan() {
  const overview = await getTableSecurityOverview();
  const vulnerable = await getVulnerablePolicies();

  const issues: any[] = [];

  // Check for tables without RLS
  for (const table of overview) {
    if (!table.rls_enabled) {
      issues.push({
        severity: "critical",
        table: table.tablename,
        issue: "RLS is disabled on this table",
        recommendation: "Enable RLS immediately: ALTER TABLE " + table.tablename + " ENABLE ROW LEVEL SECURITY;",
      });
    }

    // Check for tables with no policies
    if (table.rls_enabled && table.policy_count === 0) {
      issues.push({
        severity: "critical",
        table: table.tablename,
        issue: "RLS is enabled but no policies exist — table is completely inaccessible",
        recommendation: "Add appropriate policies for this table",
      });
    }

    // Check for tables missing CRUD policies
    if (table.rls_enabled && table.policy_count > 0) {
      if (table.select_policies === 0) {
        issues.push({
          severity: "warning",
          table: table.tablename,
          issue: "No SELECT policy — reads will return 0 rows",
          recommendation: "Add a SELECT policy",
        });
      }
    }
  }

  // Check for vulnerable policies (USING(true) or WITH CHECK(true) on non-public tables)
  for (const policy of vulnerable) {
    const isPublicRead = policy.qual === "true" && policy.cmd === "SELECT";
    const isPublicWrite = policy.with_check === "true" && policy.cmd !== "SELECT";

    if (isPublicWrite) {
      issues.push({
        severity: "critical",
        table: policy.tablename,
        policy: policy.policyname,
        issue: `Policy "${policy.policyname}" allows anyone to ${policy.cmd} — WITH CHECK(true)`,
        recommendation: "Add proper ownership checks to this policy",
      });
    } else if (isPublicRead) {
      // Public reads are sometimes intentional, flag as info
      issues.push({
        severity: "info",
        table: policy.tablename,
        policy: policy.policyname,
        issue: `Policy "${policy.policyname}" allows public SELECT (USING(true))`,
        recommendation: "Verify this is intentional for public content",
      });
    }
  }

  // Log the scan
  await adminClient.from("security_audit_logs").insert({
    actor_id: null,
    event_type: "security_scan",
    severity: issues.filter(i => i.severity === "critical").length > 0 ? "critical" : issues.filter(i => i.severity === "warning").length > 0 ? "warning" : "info",
    message: `Security scan completed: ${issues.filter(i => i.severity === "critical").length} critical, ${issues.filter(i => i.severity === "warning").length} warnings, ${issues.filter(i => i.severity === "info").length} info`,
    metadata: { issues_count: issues.length, critical: issues.filter(i => i.severity === "critical").length, warnings: issues.filter(i => i.severity === "warning").length },
  });

  return {
    scanned_at: new Date().toISOString(),
    total_tables: overview.length,
    total_issues: issues.length,
    critical_count: issues.filter(i => i.severity === "critical").length,
    warning_count: issues.filter(i => i.severity === "warning").length,
    info_count: issues.filter(i => i.severity === "info").length,
    issues,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const admin = await verifyAdmin(req);
    if (!admin.is_admin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "overview";
    const method = req.method;

    // GET endpoints
    if (method === "GET") {
      switch (action) {
        case "overview": {
          const data = await getTableSecurityOverview();
          return new Response(JSON.stringify({ data }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        case "policies": {
          const table = url.searchParams.get("table") || undefined;
          const data = await getPolicyDetails(table);
          return new Response(JSON.stringify({ data }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        case "vulnerable": {
          const data = await getVulnerablePolicies();
          return new Response(JSON.stringify({ data }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        case "logs": {
          const limit = parseInt(url.searchParams.get("limit") || "50");
          const offset = parseInt(url.searchParams.get("offset") || "0");
          const severity = url.searchParams.get("severity") || "all";
          const data = await getAuditLogs(limit, offset, severity);
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        case "scan": {
          const data = await runSecurityScan();
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        default:
          return new Response(JSON.stringify({ error: "Unknown action" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
      }
    }

    // POST endpoints
    if (method === "POST") {
      const body = await req.json();
      switch (action) {
        case "log": {
          const data = await logSecurityEvent(body, admin);
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        case "scan": {
          const data = await runSecurityScan();
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        default:
          return new Response(JSON.stringify({ error: "Unknown action" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
      }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
