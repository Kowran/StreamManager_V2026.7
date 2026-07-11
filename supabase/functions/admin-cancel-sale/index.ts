import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface CancelSaleRequest {
  sale_id: string;
  order_id: string;
  cancellation_reason: string;
  return_to_stock: boolean;
  admin_id: string;
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

    // Verify admin authentication
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

    // Verify admin role
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

    const requestData: CancelSaleRequest = await req.json();
    const { sale_id, order_id, cancellation_reason, return_to_stock, admin_id } = requestData;

    // Validate input
    if (!sale_id || !order_id || !cancellation_reason.trim()) {
      return new Response(
        JSON.stringify({ error: 'Sale ID, order ID and cancellation reason are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get sale details
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('user_purchases')
      .select('*')
      .eq('id', sale_id)
      .single();

    if (saleError || !sale) {
      return new Response(
        JSON.stringify({ error: 'Sale not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get user profile separately
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', sale.user_id)
      .single();

    // Get order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('store_orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if order is already cancelled
    if (order.status === 'cancelled') {
      return new Response(
        JSON.stringify({ error: 'Order is already cancelled' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Start transaction process
    console.log(`Starting cancellation process for sale ${sale_id}, order ${order_id}`);

    // 1. Update order status to cancelled
    const { error: orderUpdateError } = await supabaseAdmin
      .from('store_orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id);

    if (orderUpdateError) {
      console.error('Error updating order status:', orderUpdateError);
      throw new Error('Failed to update order status');
    }

    console.log('Order status updated to cancelled');

    // 2. Get current user credit balance
    const { data: userCredit, error: creditError } = await supabaseAdmin
      .from('user_credits')
      .select('balance, total_spent')
      .eq('user_id', sale.user_id)
      .single();

    if (creditError && creditError.code !== 'PGRST116') {
      console.error('Error getting user credit:', creditError);
      throw new Error('Failed to get user credit balance');
    }

    const currentBalance = userCredit?.balance || 0;
    const currentTotalSpent = userCredit?.total_spent || 0;
    const refundAmount = sale.purchase_price;
    const newBalance = currentBalance + refundAmount;
    const newTotalSpent = Math.max(0, currentTotalSpent - refundAmount);

    // 3. Create refund transaction
    const { error: transactionError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: sale.user_id,
        type: 'refund',
        amount: refundAmount,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: `Reembolso: ${sale.product_name} - Cancelado pelo admin`,
        reference_id: order_id,
        reference_type: 'order_cancellation',
        metadata: {
          original_sale_id: sale_id,
          cancelled_by_admin: admin_id,
          cancellation_reason: cancellation_reason,
          original_purchase_date: sale.purchase_date,
          refund_processed_at: new Date().toISOString()
        }
      });

    if (transactionError) {
      console.error('Error creating refund transaction:', transactionError);
      throw new Error('Failed to create refund transaction');
    }

    console.log('Refund transaction created');

    // 4. Update user credit balance
    const { error: creditUpdateError } = await supabaseAdmin
      .from('user_credits')
      .upsert({
        user_id: sale.user_id,
        balance: newBalance,
        total_spent: newTotalSpent,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (creditUpdateError) {
      console.error('Error updating user credit:', creditUpdateError);
      throw new Error('Failed to update user credit balance');
    }

    console.log('User credit balance updated');

    // 5. Handle inventory based on return_to_stock option
    if (return_to_stock && sale.credentials?.email && sale.credentials?.password) {
      // Return account to stock
      const { error: inventoryError } = await supabaseAdmin
        .from('product_inventory')
        .insert({
          product_id: sale.product_id,
          email: sale.credentials.email,
          password: sale.credentials.password,
          instructions: sale.credentials.instructions || 'Use estas credenciais para acessar sua conta.',
          status: 'available'
        });

      if (inventoryError) {
        console.error('Error returning account to stock:', inventoryError);
        // Don't fail the entire operation, just log the error
        console.warn('Account could not be returned to stock, but cancellation will proceed');
      } else {
        console.log('Account returned to stock successfully');
      }
    } else {
      console.log('Account not returned to stock (admin choice or missing credentials)');
    }

    // 6. Log admin action
    const { error: logError } = await supabaseAdmin
      .from('admin_actions')
      .insert({
        admin_id: admin_id,
        action: 'cancel_sale',
        target_user_id: sale.user_id,
        details: {
          sale_id: sale_id,
          order_id: order_id,
          product_name: sale.product_name,
          refund_amount: refundAmount,
          cancellation_reason: cancellation_reason,
          return_to_stock: return_to_stock,
          customer_email: userProfile?.email || 'N/A',
          cancelled_at: new Date().toISOString(),
          original_purchase_date: sale.purchase_date
        }
      });

    if (logError) {
      console.error('Error logging admin action:', logError);
    }

    // 7. Create notification for customer
    await supabaseAdmin.rpc('create_notification', {
      p_user_id: sale.user_id,
      p_type: 'admin',
      p_title: '🔄 Venda Cancelada - Reembolso Processado',
      p_message: `Sua compra "${sale.product_name}" foi cancelada pelo administrador. Motivo: ${cancellation_reason}. O valor de $${refundAmount.toFixed(2)} foi reembolsado para sua conta.`,
      p_data: {
        sale_id: sale_id,
        order_id: order_id,
        product_name: sale.product_name,
        refund_amount: refundAmount,
        cancellation_reason: cancellation_reason,
        cancelled_by: 'admin',
        cancelled_at: new Date().toISOString(),
        new_balance: newBalance
      },
      p_priority: 'high',
      p_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });

    console.log('Customer notification created');

    // 8. Mark the purchase as expired/cancelled
    const { error: purchaseUpdateError } = await supabaseAdmin
      .from('user_purchases')
      .update({
        expired: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', sale_id);

    if (purchaseUpdateError) {
      console.error('Error updating purchase status:', purchaseUpdateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sale cancelled successfully',
        details: {
          sale_id: sale_id,
          order_id: order_id,
          refund_amount: refundAmount,
          new_user_balance: newBalance,
          account_returned_to_stock: return_to_stock,
          customer_notified: true
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error cancelling sale:', error);
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