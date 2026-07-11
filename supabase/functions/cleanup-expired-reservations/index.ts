import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

    // Clean up expired reservations in both inventory systems
    let totalCleaned = 0;

    // Clean up regular product inventory
    const { data: regularCleanup, error: regularError } = await supabaseAdmin
      .rpc('cleanup_expired_reservations');

    if (regularError) {
      console.error('Error cleaning regular inventory:', regularError);
    } else {
      totalCleaned += regularCleanup || 0;
    }

    // Clean up seller product inventory
    const { data: sellerInventory, error: sellerError } = await supabaseAdmin
      .from('seller_product_inventory')
      .update({
        status: 'available',
        reserved_until: null,
        updated_at: new Date().toISOString()
      })
      .eq('status', 'reserved')
      .lt('reserved_until', new Date().toISOString())
      .select('id');

    if (sellerError) {
      console.error('Error cleaning seller inventory:', sellerError);
    } else {
      totalCleaned += sellerInventory?.length || 0;
    }

    // Clean up product stock lines
    const { data: stockLines, error: stockError } = await supabaseAdmin
      .from('product_stock_lines')
      .update({
        status: 'available',
        reserved_until: null,
        updated_at: new Date().toISOString()
      })
      .eq('status', 'reserved')
      .lt('reserved_until', new Date().toISOString())
      .select('id');

    if (stockError) {
      console.error('Error cleaning stock lines:', stockError);
    } else {
      totalCleaned += stockLines?.length || 0;
    }

    console.log(`Cleaned up ${totalCleaned} expired reservations`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cleanup completed successfully',
        items_cleaned: totalCleaned
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in cleanup function:', error);
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