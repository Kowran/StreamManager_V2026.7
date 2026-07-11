import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface AnalyticsRequest {
  user_id?: string;
  date_range?: {
    start: string;
    end: string;
  };
  metrics?: string[];
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

    const requestData: AnalyticsRequest = await req.json();

    // Get comprehensive user analytics
    const analytics = await getUserAnalytics(supabaseAdmin, requestData);

    return new Response(
      JSON.stringify({
        success: true,
        data: analytics
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in user analytics:', error);
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

async function getUserAnalytics(supabase: any, request: AnalyticsRequest) {
  const { user_id, date_range } = request;
  
  // Base date range (last 30 days if not specified)
  const endDate = date_range?.end || new Date().toISOString();
  const startDate = date_range?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let userFilter = {};
  if (user_id) {
    userFilter = { user_id };
  }

  // Get user registration stats
  const { data: userRegistrations } = await supabase
    .from('profiles')
    .select('created_at, role')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at');

  // Get transaction analytics
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('*')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at');

  // Get order analytics
  const { data: orders } = await supabase
    .from('store_orders')
    .select('*')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at');

  // Get user activity (accounts created, profiles managed)
  const { data: accountsActivity } = await supabase
    .from('streaming_accounts')
    .select('user_id, created_at')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Calculate metrics
  const totalUsers = userRegistrations?.length || 0;
  const adminUsers = userRegistrations?.filter(u => u.role === 'admin').length || 0;
  const customerUsers = userRegistrations?.filter(u => u.role === 'customer').length || 0;

  const totalRevenue = transactions
    ?.filter(t => t.type === 'recharge')
    .reduce((sum, t) => sum + t.amount, 0) || 0;

  const totalSpent = transactions
    ?.filter(t => t.type === 'purchase')
    .reduce((sum, t) => sum + t.amount, 0) || 0;

  const totalOrders = orders?.length || 0;
  const completedOrders = orders?.filter(o => o.status === 'delivered').length || 0;

  // User engagement metrics
  const activeUsers = new Set(
    [
      ...(transactions?.map(t => t.user_id) || []),
      ...(orders?.map(o => o.user_id) || []),
      ...(accountsActivity?.map(a => a.user_id) || [])
    ]
  ).size;

  // Daily breakdown
  const dailyStats = generateDailyStats(userRegistrations, transactions, orders, startDate, endDate);

  return {
    overview: {
      total_users: totalUsers,
      admin_users: adminUsers,
      customer_users: customerUsers,
      active_users: activeUsers,
      total_revenue: totalRevenue,
      total_spent: totalSpent,
      total_orders: totalOrders,
      completed_orders: completedOrders,
      conversion_rate: totalUsers > 0 ? (activeUsers / totalUsers * 100).toFixed(2) : 0
    },
    daily_stats: dailyStats,
    user_registrations: userRegistrations,
    recent_transactions: transactions?.slice(-10) || [],
    recent_orders: orders?.slice(-10) || []
  };
}

function generateDailyStats(registrations: any[], transactions: any[], orders: any[], startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dailyStats = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    
    const dayRegistrations = registrations?.filter(r => 
      r.created_at.startsWith(dateStr)
    ).length || 0;

    const dayTransactions = transactions?.filter(t => 
      t.created_at.startsWith(dateStr)
    ).length || 0;

    const dayOrders = orders?.filter(o => 
      o.created_at.startsWith(dateStr)
    ).length || 0;

    const dayRevenue = transactions
      ?.filter(t => t.created_at.startsWith(dateStr) && t.type === 'recharge')
      .reduce((sum, t) => sum + t.amount, 0) || 0;

    dailyStats.push({
      date: dateStr,
      registrations: dayRegistrations,
      transactions: dayTransactions,
      orders: dayOrders,
      revenue: dayRevenue
    });
  }

  return dailyStats;
}