import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AdminUserRequest {
  action: 'ban' | 'unban' | 'delete' | 'reset_password' | 'update_role' | 'get_user_details' | 'update_permissions' | 'get_permissions' | 'freeze_balance' | 'unfreeze_balance' | 'update_name' | 'cancel_order' | 'review_appeal';
  user_id: string;
  data?: any;
}

async function sendEmailNotification(
  templateType: string,
  recipientId: string,
  variables: Record<string, string | number>
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        template_type: templateType,
        recipient_id: recipientId,
        variables,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error(`send-email failed for ${templateType}: ${errText}`);
    }
  } catch (err) {
    console.error(`Failed to send ${templateType} email (non-fatal):`, err);
  }
}

async function logAdminAction(
  supabaseAdmin: any,
  adminId: string,
  targetUserId: string | null,
  action: string,
  details: Record<string, any>
): Promise<void> {
  try {
    await supabaseAdmin.from('user_management_logs').insert({
      admin_id: adminId,
      target_user_id: targetUserId,
      action,
      details,
    });
  } catch (err) {
    console.error('Failed to log admin action (non-fatal):', err);
  }
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
        const reason = data?.reason || 'No reason provided';
        const { error: banError } = await supabaseAdmin
          .from('profiles')
          .update({
            banned: true,
            banned_at: new Date().toISOString(),
            banned_by: user.id,
            ban_reason: reason,
            updated_at: new Date().toISOString()
          })
          .eq('id', user_id);

        if (banError) throw banError;

        await logAdminAction(supabaseAdmin, user.id, user_id, 'ban', { reason });

        const { data: bannedUserProfile } = await supabaseAdmin
          .from('profiles')
          .select('name, full_name')
          .eq('id', user_id)
          .maybeSingle();

        await sendEmailNotification('user_banned', user_id, {
          user_name: bannedUserProfile?.name || bannedUserProfile?.full_name || 'User',
          ban_reason: reason,
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
            ban_reason: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', user_id);

        if (unbanError) throw unbanError;

        await logAdminAction(supabaseAdmin, user.id, user_id, 'unban', { reason: data?.reason || 'No reason provided' });

        return new Response(
          JSON.stringify({ success: true, message: 'User unbanned successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
        if (deleteError) throw deleteError;

        await logAdminAction(supabaseAdmin, user.id, user_id, 'delete', { reason: data?.reason || 'No reason provided', permanent: true });

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

        await logAdminAction(supabaseAdmin, user.id, user_id, 'reset_password', { temporary_password_set: true, user_email: userData.user?.email });

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
          .from('user_credits').select('*').eq('user_id', user_id).maybeSingle();
        const { data: recentTransactions } = await supabaseAdmin
          .from('credit_transactions').select('*').eq('user_id', user_id)
          .order('created_at', { ascending: false }).limit(10);
        const { data: userOrders } = await supabaseAdmin
          .from('store_orders').select('*, store_products(name)').eq('user_id', user_id)
          .order('created_at', { ascending: false }).limit(20);
        const { data: userAccounts } = await supabaseAdmin
          .from('streaming_accounts').select('*').eq('user_id', user_id)
          .order('created_at', { ascending: false });
        const { data: userAppeals } = await supabaseAdmin
          .from('ban_appeals').select('*').eq('user_id', user_id)
          .order('created_at', { ascending: false }).limit(10);
        const { data: managementLogs } = await supabaseAdmin
          .from('user_management_logs').select('*, admin:profiles!user_management_logs_admin_id_fkey(full_name, email)')
          .eq('target_user_id', user_id)
          .order('created_at', { ascending: false }).limit(20);

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              auth_user: authUser.user,
              profile: userProfile,
              credits: userCredits,
              recent_transactions: recentTransactions,
              recent_orders: userOrders,
              accounts: userAccounts,
              appeals: userAppeals,
              management_logs: managementLogs
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

        if (previousRole === 'admin' && newRole !== 'admin') {
          await supabaseAdmin
            .from('admin_permissions')
            .delete()
            .eq('admin_user_id', user_id);
        }

        await logAdminAction(supabaseAdmin, user.id, user_id, 'update_role', { previous_role: previousRole, new_role: newRole });

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

        await logAdminAction(supabaseAdmin, user.id, user_id, 'update_permissions', { pages, is_super_admin: isSuperAdmin });

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

      case 'freeze_balance': {
        const reason = data?.reason || 'No reason provided';
        const { error: freezeError } = await supabaseAdmin
          .from('profiles')
          .update({
            balance_frozen: true,
            balance_frozen_at: new Date().toISOString(),
            balance_frozen_by: user.id,
            balance_frozen_reason: reason,
            updated_at: new Date().toISOString()
          })
          .eq('id', user_id);

        if (freezeError) throw freezeError;

        await supabaseAdmin
          .from('user_credits')
          .update({ frozen: true, updated_at: new Date().toISOString() })
          .eq('user_id', user_id);

        await logAdminAction(supabaseAdmin, user.id, user_id, 'freeze_balance', { reason });

        return new Response(
          JSON.stringify({ success: true, message: 'Balance frozen successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'unfreeze_balance': {
        const { error: unfreezeError } = await supabaseAdmin
          .from('profiles')
          .update({
            balance_frozen: false,
            balance_frozen_at: null,
            balance_frozen_by: null,
            balance_frozen_reason: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', user_id);

        if (unfreezeError) throw unfreezeError;

        await supabaseAdmin
          .from('user_credits')
          .update({ frozen: false, updated_at: new Date().toISOString() })
          .eq('user_id', user_id);

        await logAdminAction(supabaseAdmin, user.id, user_id, 'unfreeze_balance', { reason: data?.reason || 'No reason provided' });

        return new Response(
          JSON.stringify({ success: true, message: 'Balance unfrozen successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_name': {
        const newName = data?.name;
        if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
          return new Response(
            JSON.stringify({ error: 'Valid name required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: currentProfile } = await supabaseAdmin
          .from('profiles').select('full_name').eq('id', user_id).single();
        const previousName = currentProfile?.full_name;

        const { error: nameError } = await supabaseAdmin
          .from('profiles')
          .update({ full_name: newName.trim(), updated_at: new Date().toISOString() })
          .eq('id', user_id);

        if (nameError) throw nameError;

        await logAdminAction(supabaseAdmin, user.id, user_id, 'update_name', { previous_name: previousName, new_name: newName.trim() });

        return new Response(
          JSON.stringify({ success: true, message: 'Name updated successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cancel_order': {
        const orderId = data?.order_id;
        const reason = data?.reason || 'Cancelled by admin';
        if (!orderId) {
          return new Response(
            JSON.stringify({ error: 'order_id required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: order } = await supabaseAdmin
          .from('store_orders')
          .select('id, user_id, status, total_usdt')
          .eq('id', orderId)
          .maybeSingle();

        if (!order) {
          return new Response(
            JSON.stringify({ error: 'Order not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: cancelError } = await supabaseAdmin
          .from('store_orders')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancelled_by: user.id,
            cancellation_reason: reason,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);

        if (cancelError) throw cancelError;

        // Refund the user's credit balance
        if (order.total_usdt && Number(order.total_usdt) > 0) {
          const { data: credits } = await supabaseAdmin
            .from('user_credits')
            .select('balance, total_spent')
            .eq('user_id', order.user_id)
            .maybeSingle();

          if (credits && !credits.frozen) {
            const newBalance = Number(credits.balance) + Number(order.total_usdt);
            const newTotalSpent = Math.max(0, Number(credits.total_spent) - Number(order.total_usdt));
            await supabaseAdmin
              .from('user_credits')
              .update({ balance: newBalance, total_spent: newTotalSpent, updated_at: new Date().toISOString() })
              .eq('user_id', order.user_id);

            await supabaseAdmin.from('credit_transactions').insert({
              user_id: order.user_id,
              amount: Number(order.total_usdt),
              type: 'refund',
              description: `Reembolso - Pedido ${orderId.slice(0, 8)} cancelado pelo admin`
            });
          }
        }

        await logAdminAction(supabaseAdmin, user.id, order.user_id, 'cancel_order', { order_id: orderId, reason, refunded: Number(order.total_usdt) || 0 });

        return new Response(
          JSON.stringify({ success: true, message: 'Order cancelled and refunded successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'review_appeal': {
        const appealId = data?.appeal_id;
        const decision = data?.decision; // 'approved' | 'rejected'
        const adminResponse = data?.admin_response || '';

        if (!appealId || !decision || !['approved', 'rejected'].includes(decision)) {
          return new Response(
            JSON.stringify({ error: 'Valid appeal_id and decision (approved/rejected) required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: appeal } = await supabaseAdmin
          .from('ban_appeals')
          .select('id, user_id, status')
          .eq('id', appealId)
          .maybeSingle();

        if (!appeal) {
          return new Response(
            JSON.stringify({ error: 'Appeal not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: appealError } = await supabaseAdmin
          .from('ban_appeals')
          .update({
            status: decision,
            admin_id: user.id,
            admin_response: adminResponse,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', appealId);

        if (appealError) throw appealError;

        // If approved, unban the user
        if (decision === 'approved') {
          await supabaseAdmin
            .from('profiles')
            .update({
              banned: false,
              banned_at: null,
              banned_by: null,
              ban_reason: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', appeal.user_id);

          await logAdminAction(supabaseAdmin, user.id, appeal.user_id, 'unban', { reason: `Appeal approved: ${adminResponse}`, appeal_id: appealId });
        }

        await logAdminAction(supabaseAdmin, user.id, appeal.user_id, 'review_appeal', { appeal_id: appealId, decision, admin_response: adminResponse });

        return new Response(
          JSON.stringify({ success: true, message: `Appeal ${decision} successfully` }),
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
