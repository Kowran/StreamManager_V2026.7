import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RenewalRequest {
  purchase_id: string;
  product_id: string;
  product_name: string;
  product_price: number;
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
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
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const requestData: RenewalRequest = await req.json();
    const { purchase_id, product_id, product_name, product_price } = requestData;

    if (!purchase_id || !product_id || !product_price) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('user_purchases')
      .select('*, store_products(stock_quantity)')
      .eq('id', purchase_id)
      .eq('user_id', user.id)
      .single();

    if (purchaseError || !purchase) {
      return new Response(
        JSON.stringify({ success: false, error: 'Purchase not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const purchaseDate = new Date(purchase.purchase_date);
    const expiryDate = new Date(purchaseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntilExpiry > 7) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Renewal only allowed within 7 days of expiration',
          days_until_expiry: Math.round(daysUntilExpiry)
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: userCredit, error: creditError } = await supabaseAdmin
      .from('user_credits')
      .select('balance, total_spent')
      .eq('user_id', user.id)
      .single();

    if (creditError && creditError.code !== 'PGRST116') {
      return new Response(
        JSON.stringify({ success: false, error: 'Error checking user balance' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const currentBalance = userCredit?.balance || 0;
    const currentTotalSpent = userCredit?.total_spent || 0;

    if (currentBalance < product_price) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Insufficient balance',
          required: product_price,
          current: currentBalance,
          deficit: product_price - currentBalance
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('store_orders')
      .insert({
        user_id: user.id,
        product_id: product_id,
        quantity: 1,
        total_brl: product_price * 5.5,
        total_usdt: product_price,
        status: 'delivered',
        customer_email: user.email || '',
        customer_name: user.user_metadata?.full_name || user.email || 'Usuario'
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create renewal order',
          details: orderError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + 30);

    const renewedCredentials = {
      email: purchase.credentials?.email || '',
      password: purchase.credentials?.password || '',
      instructions: purchase.credentials?.instructions || 'Use estas credenciais para acessar sua conta.',
      product_name: product_name,
      purchase_price: product_price,
      purchase_date: new Date().toISOString(),
      expires_at: newExpiryDate.toISOString()
    };

    const { data: newPurchase, error: newPurchaseError } = await supabaseAdmin
      .from('user_purchases')
      .insert({
        user_id: user.id,
        order_id: order.id,
        product_id: product_id,
        product_name: product_name,
        purchase_price: product_price,
        credentials: renewedCredentials,
        purchase_date: new Date().toISOString(),
        expires_at: newExpiryDate.toISOString(),
        expired: false
      })
      .select()
      .single();

    if (newPurchaseError) {
      console.error('New purchase creation error:', newPurchaseError);
      await supabaseAdmin.from('store_orders').delete().eq('id', order.id);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create renewal purchase',
          details: newPurchaseError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const newBalance = currentBalance - product_price;
    const newTotalSpent = currentTotalSpent + product_price;

    const { error: creditDeductError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: user.id,
        type: 'purchase',
        amount: -product_price,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: `Renovação: ${product_name}`,
        reference_id: order.id,
        reference_type: 'renewal',
        metadata: {
          product_id: product_id,
          product_name: product_name,
          original_purchase_id: purchase_id,
          renewal_date: new Date().toISOString()
        }
      });

    if (creditDeductError) {
      console.error('Credit deduction error:', creditDeductError);
    }

    const { error: updateCreditError } = await supabaseAdmin
      .from('user_credits')
      .update({
        balance: newBalance,
        total_spent: newTotalSpent,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (updateCreditError) {
      console.error('Credit update error:', updateCreditError);
    }

    const { error: deliveryError } = await supabaseAdmin
      .from('store_deliveries')
      .insert({
        order_id: order.id,
        product_id: product_id,
        user_id: user.id,
        delivery_content: renewedCredentials,
        delivery_method: 'system',
        delivery_status: 'delivered'
      });

    if (deliveryError) {
      console.error('Delivery creation error:', deliveryError);
    }

    const { error: updateOldPurchaseError } = await supabaseAdmin
      .from('user_purchases')
      .update({
        expired: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', purchase_id);

    if (updateOldPurchaseError) {
      console.error('Old purchase update error:', updateOldPurchaseError);
    }

    console.log('Renewal completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Purchase renewed successfully',
        order_id: order.id,
        purchase_id: newPurchase.id,
        new_balance: newBalance,
        expiry_date: newExpiryDate.toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing renewal:', error);
    return new Response(
      JSON.stringify({
        success: false,
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