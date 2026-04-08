/**
 * Initialize Payment Edge Function
 * Creates a payment reference and returns it for Paystack checkout
 */

Deno.serve(async (req) => {
  // Set up CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { product_id, user_id, amount } = await req.json();

    if (!product_id || !user_id || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    // Get product details
    const productResponse = await fetch(
      `${supabaseUrl}/rest/v1/products?id=eq.${product_id}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );
    
    const products = await productResponse.json();
    
    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const product = products[0];
    
    // Check inventory availability
    const inventoryResponse = await fetch(
      `${supabaseUrl}/rest/v1/inventory_items?product_id=eq.${product_id}&status=eq.available&select=id&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );
    
    const inventory = await inventoryResponse.json();
    
    if (!inventory || inventory.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Product out of stock' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique reference
    const reference = 'DPM-' + Date.now() + '-' + Math.random().toString(36).substring(7).toUpperCase();
    
    // In production, you'd store this in a temporary table or cache
    // For now, we'll return the reference and handle the payment in the webhook
    
    return new Response(
      JSON.stringify({
        success: true,
        reference,
        amount,
        product_name: product.name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error initializing payment:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to initialize payment' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});