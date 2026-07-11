import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface PurchaseRequest {
  product_id: string;
  quantity: number;
  coupon_code?: string;
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

    // Verify authentication
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

    const requestData: PurchaseRequest = await req.json();
    const { product_id, quantity, coupon_code } = requestData;

    // Validate input
    if (!product_id || !quantity || quantity < 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid product or quantity' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get product details
    const { data: product, error: productError } = await supabaseAdmin
      .from('store_products')
      .select('*')
      .eq('id', product_id)
      .eq('active', true)
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ error: 'Product not found or inactive' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Ensure product fields are always strings
    const productName = String(product.name || 'Produto');
    const productDescription = String(product.description || '');
    const isManualDelivery = product.manual_delivery === true;

    console.log('Processing purchase for product:', {
      id: product.id,
      name: productName,
      stock: product.stock_quantity,
      price: product.price_usdt,
      manual_delivery: isManualDelivery,
      coupon_code: coupon_code || 'none'
    });

    // Check stock only for non-manual delivery products
    if (!isManualDelivery && product.stock_quantity < quantity) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient stock',
          available: product.stock_quantity,
          requested: quantity
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Calculate base price (use promotional price if active)
    const hasPromo = product.promotion_active && product.promotional_price_usdt;
    const unitPrice = hasPromo ? Number(product.promotional_price_usdt) : Number(product.price_usdt);
    let totalPrice = unitPrice * quantity;

    // ============================================
    // COUPON VALIDATION & DISCOUNT CALCULATION
    // ============================================
    let couponId: string | null = null;
    let discountAmount = 0;
    let couponRecord: any = null;

    if (coupon_code && coupon_code.trim()) {
      const code = coupon_code.trim().toUpperCase();

      const { data: coupon, error: couponError } = await supabaseAdmin
        .from('discount_coupons')
        .select('*')
        .eq('code', code)
        .single();

      if (couponError || !coupon) {
        return new Response(
          JSON.stringify({ error: 'Cupom invalido ou nao encontrado' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Check if coupon is active
      if (!coupon.active) {
        return new Response(
          JSON.stringify({ error: 'Este cupom esta inativo' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Check start date
      if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
        return new Response(
          JSON.stringify({ error: 'Este cupom ainda nao esta disponivel' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Check expiry date
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Este cupom expirou' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Check max total uses
      if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
        return new Response(
          JSON.stringify({ error: 'Este cupom atingiu o limite maximo de usos' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Check minimum order amount
      if (coupon.min_order_amount && totalPrice < Number(coupon.min_order_amount)) {
        return new Response(
          JSON.stringify({
            error: `Pedido minimo de $${Number(coupon.min_order_amount).toFixed(2)} para usar este cupom`,
            required: Number(coupon.min_order_amount),
            current: totalPrice
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Check max uses per user
      const { count: userUsageCount, error: usageError } = await supabaseAdmin
        .from('coupon_usages')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
        .eq('user_id', user.id);

      if (usageError) {
        console.error('Error checking coupon usage:', usageError);
        return new Response(
          JSON.stringify({ error: 'Erro ao validar cupom' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      if ((userUsageCount || 0) >= coupon.max_uses_per_user) {
        return new Response(
          JSON.stringify({ error: 'Voce ja usou este cupom o maximo de vezes permitido' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Calculate discount
      if (coupon.discount_type === 'percentage') {
        discountAmount = totalPrice * (Number(coupon.discount_value) / 100);
      } else {
        // fixed amount
        discountAmount = Math.min(Number(coupon.discount_value), totalPrice);
      }

      // Round to 2 decimal places
      discountAmount = Math.round(discountAmount * 100) / 100;

      if (discountAmount <= 0) {
        return new Response(
          JSON.stringify({ error: 'Desconto do cupom e zero ou invalido' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      totalPrice = Math.max(0, totalPrice - discountAmount);
      totalPrice = Math.round(totalPrice * 100) / 100;
      couponId = coupon.id;
      couponRecord = coupon;

      console.log('Coupon applied:', {
        code: coupon.code,
        type: coupon.discount_type,
        value: coupon.discount_value,
        discountAmount,
        newTotal: totalPrice
      });
    }

    // Get user credit balance
    const { data: userCredit, error: creditError } = await supabaseAdmin
      .from('user_credits')
      .select('balance, total_spent')
      .eq('user_id', user.id)
      .single();

    if (creditError && creditError.code !== 'PGRST116') {
      console.error('Error checking user balance:', creditError);
      return new Response(
        JSON.stringify({ error: 'Error checking user balance' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const currentBalance = userCredit?.balance || 0;
    const currentTotalSpent = userCredit?.total_spent || 0;

    // Check if user has sufficient balance
    if (currentBalance < totalPrice) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient balance',
          required: totalPrice,
          current: currentBalance,
          deficit: totalPrice - currentBalance
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Start transaction by creating order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('store_orders')
      .insert({
        user_id: user.id,
        product_id: product_id,
        quantity: quantity,
        total_brl: totalPrice * 5.5,
        total_usdt: totalPrice,
        status: 'pending',
        customer_email: user.email || '',
        customer_name: user.user_metadata?.full_name || user.email || 'Usuario',
        coupon_id: couponId,
        discount_amount: discountAmount
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create order',
          details: orderError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Order created:', order.id);

    let deliveryContent: any;

    // For manual delivery products, skip inventory check
    if (isManualDelivery) {
      console.log('Manual delivery product - skipping inventory check');

      deliveryContent = {
        email: '',
        password: '',
        instructions: 'Este produto requer entrega manual. Nossa equipe entrara em contato em breve com as credenciais.',
        product_name: productName,
        purchase_price: totalPrice,
        original_price: unitPrice * quantity,
        discount_amount: discountAmount,
        coupon_code: couponRecord?.code || null,
        purchase_date: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        manual_delivery: true
      };
    } else {
      // Get available inventory for automatic delivery
      const { data: inventory, error: inventoryError } = await supabaseAdmin
        .from('product_inventory')
        .select('*')
        .eq('product_id', product_id)
        .eq('status', 'available')
        .order('created_at', { ascending: true })
        .limit(1);

      if (inventoryError) {
        console.error('Inventory error:', inventoryError);
        // Rollback order
        await supabaseAdmin.from('store_orders').delete().eq('id', order.id);
        return new Response(
          JSON.stringify({
            error: 'Failed to retrieve inventory',
            details: inventoryError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      if (!inventory || inventory.length < 1) {
        console.log('No inventory available:', { available: inventory?.length || 0, requested: 1 });
        // Rollback order
        await supabaseAdmin.from('store_orders').delete().eq('id', order.id);
        return new Response(
          JSON.stringify({
            error: 'Insufficient inventory available',
            available: inventory?.length || 0,
            requested: 1
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('Inventory found: 1 item for delivery');

      // Mark the single inventory item as sold
      const inventoryItem = inventory[0];
      const { error: updateInventoryError } = await supabaseAdmin
        .from('product_inventory')
        .update({
          status: 'sold',
          updated_at: new Date().toISOString()
        })
        .eq('id', inventoryItem.id);

      if (updateInventoryError) {
        console.error('Inventory update error:', updateInventoryError);
        // Rollback order
        await supabaseAdmin.from('store_orders').delete().eq('id', order.id);
        return new Response(
          JSON.stringify({
            error: 'Failed to update inventory',
            details: updateInventoryError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('Single inventory item marked as sold');

      // Prepare delivery content for single item - ensure all fields are strings
      deliveryContent = {
        email: String(inventoryItem.email || ''),
        password: String(inventoryItem.password || ''),
        instructions: String(inventoryItem.instructions || 'Use estas credenciais para acessar sua conta.'),
        product_name: productName,
        purchase_price: totalPrice,
        original_price: unitPrice * quantity,
        discount_amount: discountAmount,
        coupon_code: couponRecord?.code || null,
        purchase_date: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      console.log('Delivery credentials prepared for single item');
    }

    // Create delivery record
    const { error: deliveryError } = await supabaseAdmin
      .from('store_deliveries')
      .insert({
        order_id: order.id,
        product_id: product_id,
        user_id: user.id,
        delivery_content: deliveryContent,
        delivery_method: isManualDelivery ? 'manual' : 'system',
        delivery_status: isManualDelivery ? 'pending' : 'delivered'
      });

    if (deliveryError) {
      console.error('Delivery creation error:', deliveryError);
      // Rollback inventory update only for automatic delivery
      if (!isManualDelivery && deliveryContent.email) {
        await supabaseAdmin
          .from('product_inventory')
          .update({ status: 'available' })
          .eq('email', deliveryContent.email);
      }
      // Rollback order
      await supabaseAdmin.from('store_orders').delete().eq('id', order.id);
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create delivery',
          details: deliveryError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Delivery created successfully');

    // ============================================
    // RECORD COUPON USAGE
    // ============================================
    if (couponId && couponRecord) {
      const { error: usageInsertError } = await supabaseAdmin
        .from('coupon_usages')
        .insert({
          coupon_id: couponId,
          user_id: user.id,
          order_id: order.id,
          discount_amount: discountAmount
        });

      if (usageInsertError) {
        console.error('Coupon usage recording error:', usageInsertError);
        // Don't fail the purchase, just log
      } else {
        // Increment used_count
        const { error: incrementError } = await supabaseAdmin
          .from('discount_coupons')
          .update({
            used_count: (couponRecord.used_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', couponId);

        if (incrementError) {
          console.error('Coupon increment error:', incrementError);
        }
      }
    }

    // Deduct credits from user account
    const newBalance = currentBalance - totalPrice;
    const newTotalSpent = currentTotalSpent + totalPrice;

    const { error: creditDeductError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: user.id,
        type: 'purchase',
        amount: -totalPrice,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: `Compra: ${productName}${couponRecord ? ` (Cupom: ${couponRecord.code})` : ''}`,
        reference_id: order.id,
        reference_type: 'store_order',
        metadata: {
          product_id: product_id,
          product_name: productName,
          quantity: quantity,
          unit_price: unitPrice,
          discount_amount: discountAmount,
          coupon_code: couponRecord?.code || null
        }
      });

    if (creditDeductError) {
      console.error('Credit deduction error:', creditDeductError);
      console.warn('Purchase completed but credit transaction failed:', creditDeductError.message);
    }

    // Update order status to 'paid' to trigger manual delivery chat creation
    const { error: updateOrderError } = await supabaseAdmin
      .from('store_orders')
      .update({
        status: isManualDelivery ? 'paid' : 'delivered',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateOrderError) {
      console.error('Order update error:', updateOrderError);
    }

    console.log('Purchase completed successfully. Status:', isManualDelivery ? 'paid (will trigger chat)' : 'delivered');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Purchase completed successfully',
        order_id: order.id,
        product_name: productName,
        new_balance: newBalance,
        original_price: unitPrice * quantity,
        discount_amount: discountAmount,
        final_price: totalPrice,
        coupon_code: couponRecord?.code || null,
        credentials: deliveryContent
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing purchase:', error);
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
