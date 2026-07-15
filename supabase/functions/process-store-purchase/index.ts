import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  enabled: boolean;
}

async function sendEmailViaEdgeFunction(
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
    } else {
      console.log(`Email sent: ${templateType} to user ${recipientId}`);
    }
  } catch (err) {
    console.error(`Failed to send ${templateType} email (non-fatal):`, err);
  }
}


interface PurchaseRequest {
  product_id: string;
  quantity: number;
  coupon_code?: string;
  recharge_data?: { email: string; password: string; extra_data?: string };
  use_cashback?: boolean;
  variation_id?: string;
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

    // Verify authentication using the user's token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
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

    const requestData: PurchaseRequest = await req.json();
    const { product_id, quantity, coupon_code, recharge_data, use_cashback, variation_id } = requestData;

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

    // Block self-purchase
    if (product.seller_id && product.seller_id === user.id) {
      return new Response(
        JSON.stringify({ error: 'Você não pode comprar seu próprio produto' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure product fields are always strings
    const productName = String(product.name || 'Produto');
    const productDescription = String(product.description || '');
    const isManualDelivery = product.manual_delivery === true;
    const isAccountRecharge = product.account_recharge === true;

    console.log('Processing purchase for product:', {
      id: product.id,
      name: productName,
      stock: product.stock_quantity,
      price: product.price_usdt,
      manual_delivery: isManualDelivery,
      account_recharge: isAccountRecharge,
      coupon_code: coupon_code || 'none'
    });

    // Validate recharge data for account recharge products
    if (isAccountRecharge) {
      if (!recharge_data || !recharge_data.email || !recharge_data.password) {
        return new Response(
          JSON.stringify({ error: 'Email e senha da conta sao obrigatorios para produtos de recarga' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Calculate base price (use promotional price if active)
    // If a variation is selected, use variation price instead
    let unitPrice: number;
    let variationRecord: any = null;

    if (variation_id) {
      const { data: variation, error: variationError } = await supabaseAdmin
        .from('store_product_variations')
        .select('*')
        .eq('id', variation_id)
        .eq('product_id', product_id)
        .eq('active', true)
        .single();

      if (variationError || !variation) {
        return new Response(
          JSON.stringify({ error: 'Variação não encontrada ou inativa' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      variationRecord = variation;
      unitPrice = Number(variation.price_usdt);
    } else {
      const hasPromo = product.promotion_active && product.promotional_price_usdt;
      unitPrice = hasPromo ? Number(product.promotional_price_usdt) : Number(product.price_usdt);
    }

    // Check stock only for non-manual, non-recharge delivery products
    // If a variation is selected, check variation inventory count instead of product stock
    if (!isManualDelivery && !isAccountRecharge) {
      let availableStock: number;
      if (variationRecord) {
        const { count } = await supabaseAdmin
          .from('product_inventory')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product_id)
          .eq('variation_id', variation_id)
          .eq('status', 'available');
        availableStock = count || 0;
      } else {
        const { count } = await supabaseAdmin
          .from('product_inventory')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product_id)
          .eq('status', 'available');
        availableStock = count || 0;
      }
      if (availableStock < quantity) {
        return new Response(
          JSON.stringify({
            error: 'Insufficient stock',
            available: availableStock,
            requested: quantity
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

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

      // Check product-specific coupon
      const { data: couponProducts } = await supabaseAdmin
        .from('coupon_products')
        .select('product_id')
        .eq('coupon_id', coupon.id);

      if (couponProducts && couponProducts.length > 0) {
        const isAllowed = couponProducts.some((cp: any) => cp.product_id === product_id);
        if (!isAllowed) {
          return new Response(
            JSON.stringify({ error: 'Este cupom nao e valido para este produto' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
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

    // Apply cashback if user opted in
    let cashbackUsed = 0;
    if (use_cashback) {
      const { data: smCredits } = await supabaseAdmin
        .from('user_sm_credits')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      const smBalance = smCredits?.balance || 0;
      if (smBalance > 0) {
        cashbackUsed = Math.min(smBalance, totalPrice);
        totalPrice = Math.max(0, Math.round((totalPrice - cashbackUsed) * 100) / 100);
        console.log('Cashback applied:', cashbackUsed, 'New total:', totalPrice);
      }
    }

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
    // Note: seller_id may or may not exist as a column on store_orders depending on
    // deployment state. We try with it first; if the column is missing, retry without.
    const baseOrder: Record<string, any> = {
      user_id: user.id,
      product_id: product_id,
      quantity: quantity,
      total_brl: totalPrice * 5.5,
      total_usdt: totalPrice,
      status: 'pending',
      customer_email: user.email || '',
      customer_name: user.user_metadata?.full_name || user.email || 'Usuario',
      coupon_id: couponId,
      discount_amount: discountAmount,
      cashback_used: cashbackUsed,
      recharge_data: isAccountRecharge ? recharge_data : null,
      variation_id: variation_id || null,
      variation_name: variationRecord?.name || null,
    };

    let order: any = null;
    let orderError: any = null;
    let orderCreated = false;

    if (product.seller_id) {
      const { data: dataWithSeller, error: errWithSeller } = await supabaseAdmin
        .from('store_orders')
        .insert({ ...baseOrder, seller_id: product.seller_id })
        .select()
        .single();
      if (!errWithSeller && dataWithSeller) {
        order = dataWithSeller;
        orderCreated = true;
      } else {
        orderError = errWithSeller;
      }
    }

    if (!orderCreated) {
      const { data: dataNoSeller, error: errNoSeller } = await supabaseAdmin
        .from('store_orders')
        .insert(baseOrder)
        .select()
        .single();
      order = dataNoSeller;
      orderError = errNoSeller;
      if (!errNoSeller && dataNoSeller) {
        orderCreated = true;
      }
    }

    if (!orderCreated || !order) {
      console.error('Order creation error:', orderError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create order',
          details: orderError?.message || 'Unknown error'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Order created:', order.id);

    let deliveryContent: any;

    // Determine variation name for display
    const variationName = variationRecord?.name || null;

    // For manual delivery products, skip inventory check
    if (isManualDelivery) {
      console.log('Manual delivery product - skipping inventory check');

      deliveryContent = {
        email: '',
        password: '',
        instructions: 'Este produto requer entrega manual. Nossa equipe entrara em contato em breve com as credenciais.',
        product_name: productName,
        variation_name: variationName,
        purchase_price: totalPrice,
        original_price: unitPrice * quantity,
        discount_amount: discountAmount,
        coupon_code: couponRecord?.code || null,
        purchase_date: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        manual_delivery: true
      };
    } else if (isAccountRecharge) {
      console.log('Account recharge product - saving user credentials');

      deliveryContent = {
        email: '',
        password: '',
        instructions: 'Recarga de conta em processamento. O administrador ira recarregar sua conta e confirmara a entrega em breve.',
        product_name: productName,
        variation_name: variationName,
        purchase_price: totalPrice,
        original_price: unitPrice * quantity,
        discount_amount: discountAmount,
        coupon_code: couponRecord?.code || null,
        purchase_date: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        account_recharge: true,
        recharge_data: recharge_data
      };
    } else {
      // Get available inventory for automatic delivery - fetch 'quantity' items
      // If a variation is selected, filter inventory by variation_id
      let inventoryQuery = supabaseAdmin
        .from('product_inventory')
        .select('*')
        .eq('product_id', product_id)
        .eq('status', 'available')
        .order('created_at', { ascending: true })
        .limit(quantity);

      if (variation_id) {
        inventoryQuery = inventoryQuery.eq('variation_id', variation_id);
      }

      const { data: inventory, error: inventoryError } = await inventoryQuery;

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

      if (!inventory || inventory.length < quantity) {
        console.log('Insufficient inventory:', { available: inventory?.length || 0, requested: quantity });
        // Rollback order
        await supabaseAdmin.from('store_orders').delete().eq('id', order.id);
        return new Response(
          JSON.stringify({
            error: 'Insufficient inventory available',
            available: inventory?.length || 0,
            requested: quantity
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log(`Inventory found: ${inventory.length} items for delivery (requested: ${quantity})`);

      // Mark all fetched inventory items as sold
      const inventoryIds = inventory.map((item: any) => item.id);
      const { error: updateInventoryError } = await supabaseAdmin
        .from('product_inventory')
        .update({
          status: 'sold',
          updated_at: new Date().toISOString()
        })
        .in('id', inventoryIds);

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

      console.log(`${inventory.length} inventory items marked as sold`);

      // Build accounts array for multi-account purchases
      const accounts = inventory.map((item: any, index: number) => ({
        index,
        email: String(item.email || ''),
        password: String(item.password || ''),
        instructions: String(item.instructions || ''),
      }));

      if (quantity === 1) {
        // Single item - use legacy format for backward compatibility
        const inventoryItem = inventory[0];
        deliveryContent = {
          email: String(inventoryItem.email || ''),
          password: String(inventoryItem.password || ''),
          instructions: String(inventoryItem.instructions || 'Use estas credenciais para acessar sua conta.'),
          product_name: productName,
          variation_name: variationName,
          purchase_price: totalPrice,
          original_price: unitPrice * quantity,
          discount_amount: discountAmount,
          coupon_code: couponRecord?.code || null,
          purchase_date: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };
      } else {
        // Multiple items - include accounts array
        deliveryContent = {
          email: '',
          password: '',
          instructions: '',
          accounts: accounts,
          product_name: productName,
          variation_name: variationName,
          purchase_price: totalPrice,
          original_price: unitPrice * quantity,
          discount_amount: discountAmount,
          coupon_code: couponRecord?.code || null,
          purchase_date: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          quantity: quantity
        };
      }

      console.log(`Delivery credentials prepared for ${quantity} item(s)`);
    }

    // Create delivery record
    const { error: deliveryError } = await supabaseAdmin
      .from('store_deliveries')
      .insert({
        order_id: order.id,
        product_id: product_id,
        user_id: user.id,
        delivery_content: deliveryContent,
        delivery_method: (isManualDelivery || isAccountRecharge) ? 'manual' : 'system',
        delivery_status: (isManualDelivery || isAccountRecharge) ? 'pending' : 'delivered'
      });

    if (deliveryError) {
      console.error('Delivery creation error:', deliveryError);
      // Rollback inventory update only for automatic delivery
      if (!isManualDelivery && !isAccountRecharge && deliveryContent.email) {
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
      console.warn('Credit transaction log failed:', creditDeductError.message);
    }

    // Actually deduct the balance from user_credits
    const { error: balanceUpdateError } = await supabaseAdmin
      .from('user_credits')
      .update({ 
        balance: newBalance, 
        total_spent: newTotalSpent,
        updated_at: new Date().toISOString() 
      })
      .eq('user_id', user.id);

    if (balanceUpdateError) {
      console.warn('Balance update failed:', balanceUpdateError.message);
    }

    // Deduct used cashback from user_sm_credits
    if (cashbackUsed > 0) {
      const { data: smCreditsForDeduct } = await supabaseAdmin
        .from('user_sm_credits')
        .select('balance, total_spent')
        .eq('user_id', user.id)
        .maybeSingle();
      const smCurrentBalance = smCreditsForDeduct?.balance || 0;
      const smCurrentSpent = smCreditsForDeduct?.total_spent || 0;
      const smNewBalance = Math.max(0, smCurrentBalance - cashbackUsed);

      await supabaseAdmin
        .from('user_sm_credits')
        .upsert({
          user_id: user.id,
          balance: smNewBalance,
          total_earned: smCreditsForDeduct?.total_earned || 0,
          total_spent: smCurrentSpent + cashbackUsed,
          updated_at: new Date().toISOString(),
        });

      await supabaseAdmin
        .from('sm_credit_transactions')
        .insert({
          user_id: user.id,
          type: 'store_purchase',
          amount: -cashbackUsed,
          balance_before: smCurrentBalance,
          balance_after: smNewBalance,
          description: `Cashback usado em compra: ${productName}`,
          reference_id: order.id,
          reference_type: 'store_order',
        });
    }

    // Update order status to 'paid' to trigger manual delivery chat creation
    const { error: updateOrderError } = await supabaseAdmin
      .from('store_orders')
      .update({
        status: (isManualDelivery || isAccountRecharge) ? 'paid' : 'delivered',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateOrderError) {
      console.error('Order update error:', updateOrderError);
    }

    // Note: variation stock is now derived from product_inventory count, not stock_quantity field

    console.log('Purchase completed successfully. Status:', (isManualDelivery || isAccountRecharge) ? 'paid (will trigger chat)' : 'delivered');

    // Update user and seller levels
    try {
      await supabaseAdmin.rpc('update_user_level', { target_user: user.id });
      if (product.seller_id) {
        await supabaseAdmin.rpc('update_seller_level', { target_seller: product.seller_id });
      }
    } catch (levelErr) {
      console.error('Level update error (non-fatal):', levelErr);
    }

    // Send sale notification email to the seller (non-fatal)
    if (product.seller_id) {
      const buyerName = user.user_metadata?.full_name || user.email || 'Cliente';
      await sendEmailViaEdgeFunction('sale_notification', product.seller_id, {
        product_name: productName,
        quantity: String(quantity),
        total_price: totalPrice.toFixed(2),
        buyer_name: buyerName,
        order_id: order.id,
      });
    }

    // Send purchase confirmation email to the buyer (non-fatal)
    await sendEmailViaEdgeFunction('purchase_confirmed', user.id, {
      user_name: user.user_metadata?.full_name || user.email || 'Cliente',
      product_name: productName,
      quantity: String(quantity),
      total_price: totalPrice.toFixed(2),
      order_id: order.id,
    });

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
