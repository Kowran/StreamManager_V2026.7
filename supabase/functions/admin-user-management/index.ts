import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AdminUserRequest {
  action: 'ban' | 'unban' | 'delete' | 'reset_password' | 'update_role' | 'get_user_details' | 'update_permissions' | 'get_permissions';
  user_id: string;
  data?: any;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData: AdminUserRequest = await req.json();
    const { action, user_id, data } = requestData;

    switch (action) {
      case 'ban': {
        const { error: banError } = await supabaseAdmin
          .from('profiles')
          .update({
            banned: true,
            banned_at: new Date().toISOString(),
            banned_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', user_id);

        if (banError) throw banError;

        await supabaseAdmin.from('admin_actions').insert({
          admin_id: user.id,
          action: 'ban_user',
          target_user_id: user_id,
          details: { reason: data?.reason || 'No reason provided' }
        });

        return new Response(
          JSON.stringify({ success: true, message: 'User banned successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'unban': {
        const { error: unbanError } = await supabaseAdmin
          .from('profiles')
          .update({
            banned: false,
            banned_at: null,
            banned_by: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', user_id);

        if (unbanError) throw unbanError;

        await supabaseAdmin.from('admin_actions').insert({
          admin_id: user.id,
          action: 'unban_user',
          target_user_id: user_id,
          details: { reason: data?.reason || 'No reason provided' }
        });

        return new Response(
          JSON.stringify({ success: true, message: 'User unbanned successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
        if (deleteError) throw deleteError;

        await supabaseAdmin.from('admin_actions').insert({
          admin_id: user.id,
          action: 'delete_user',
          target_user_id: user_id,
          details: { reason: data?.reason || 'No reason provided', permanent: true }
        });

        return new Response(
          JSON.stringify({ success: true, message: 'User deleted successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reset_password': {
        const temporaryPassword = generateTemporaryPassword();

        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          { password: temporaryPassword }
        );
        if (passwordError) throw passwordError;

        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(user_id);

        await supabaseAdmin.from('admin_actions').insert({
          admin_id: user.id,
          action: 'reset_password',
          target_user_id: user_id,
          details: { temporary_password_set: true, user_email: userData.user?.email }
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Password reset successfully',
            temporary_password: temporaryPassword,
            user_email: userData.user?.email
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_user_details': {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
        const { data: userProfile } = await supabaseAdmin
          .from('profiles').select('*').eq('id', user_id).single();
        const { data: userCredits } = await supabaseAdmin
          .from('user_credits').select('*').eq('user_id', user_id).single();
        const { data: recentTransactions } = await supabaseAdmin
          .from('credit_transactions').select('*').eq('user_id', user_id)
          .order('created_at', { ascending: false }).limit(10);
        const { data: userOrders } = await supabaseAdmin
          .from('store_orders').select('*').eq('user_id', user_id)
          .order('created_at', { ascending: false }).limit(10);
        const { data: userAccounts } = await supabaseAdmin
          .from('streaming_accounts').select('*').eq('user_id', user_id)
          .order('created_at', { ascending: false });

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              auth_user: authUser.user,
              profile: userProfile,
              credits: userCredits,
              recent_transactions: recentTransactions,
              recent_orders: userOrders,
              accounts: userAccounts
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_role': {
        if (user_id === user.id) {
          return new Response(
            JSON.stringify({ error: 'Cannot change your own role' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const newRole = data?.role;
        if (!newRole || !['admin', 'customer', 'seller'].includes(newRole)) {
          return new Response(
            JSON.stringify({ error: 'Invalid role. Must be admin, customer, or seller' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: currentProfile } = await supabaseAdmin
          .from('profiles').select('role').eq('id', user_id).single();
        const previousRole = currentProfile?.role;

        const { error: roleError } = await supabaseAdmin
          .from('profiles')
          .update({ role: newRole, updated_at: new Date().toISOString() })
          .eq('id', user_id);

        if (roleError) throw roleError;

        // If demoting from admin, remove permissions record
        if (previousRole === 'admin' && newRole !== 'admin') {
          await supabaseAdmin
            .from('admin_permissions')
            .delete()
            .eq('admin_user_id', user_id);
        }

        await supabaseAdmin.from('admin_actions').insert({
          admin_id: user.id,
          action: 'update_role',
          target_user_id: user_id,
          details: { previous_role: previousRole, new_role: newRole }
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'User role updated successfully',
            previous_role: previousRole,
            new_role: newRole
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_permissions': {
        if (user_id === user.id) {
          return new Response(
            JSON.stringify({ error: 'Cannot change your own permissions' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const pages: string[] = data?.pages ?? [];
        const isSuperAdmin: boolean = data?.is_super_admin ?? false;

        const { error: upsertError } = await supabaseAdmin
          .from('admin_permissions')
          .upsert({
            admin_user_id: user_id,
            granted_by: user.id,
            pages,
            is_super_admin: isSuperAdmin,
            updated_at: new Date().toISOString()
          }, { onConflict: 'admin_user_id' });

        if (upsertError) throw upsertError;

        await supabaseAdmin.from('admin_actions').insert({
          admin_id: user.id,
          action: 'update_permissions',
          target_user_id: user_id,
          details: { pages, is_super_admin: isSuperAdmin }
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Permissions updated successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_permissions': {
        const { data: perms, error: permsError } = await supabaseAdmin
          .from('admin_permissions')
          .select('*')
          .eq('admin_user_id', user_id)
          .maybeSingle();

        if (permsError) throw permsError;

        return new Response(
          JSON.stringify({ success: true, data: perms }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Error in admin user management:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
  for (let i = 4; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
