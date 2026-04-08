/**
 * Verify Payment & Webhook Edge Function
 * Handles Paystack webhook events and completes orders
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');

  try {
    // Get the request body
    const body = await req.json();
    
    // Check if this is a Paystack webhook or a verification request
    const event = body.event || body.type;
    
    if (event === 'charge.success' || body.reference) {
      // This is a payment verification or webhook
      const reference = body.reference || body.data?.reference;
      
      if (!reference) {
        return new Response(
          JSON.stringify({ error: 'No reference provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // In production, verify the payment with Paystack
      // For demo mode, we'll skip verification
      if (paystackSecret && body.event !== 'demo') {
        try {
          const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
              'Authorization': `Bearer ${paystackSecret}`,
            },
          });
          
          const verifyData = await verifyResponse.json();
          
          if (!verifyData.status || verifyData.data.status !== 'success') {
            return new Response(
              JSON.stringify({ error: 'Payment verification failed' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (e) {
          console.error('Paystack verification error:', e);
        }
      }

      // Extract metadata from the reference or body
      const metadata = body.data?.metadata || body.metadata || {};
      const productId = metadata.product_id;
      const userId = metadata.user_id;
      const amount = body.data?.amount || body.amount;

      if (!productId || !userId) {
        // For demo, try to extract from the event
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Payment event received',
            reference 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get product details
      const productResponse = await fetch(
        `${supabaseUrl}/rest/v1/products?id=eq.${productId}&select=*`,
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
      const platformFee = 500; // Or fetch from settings
      const supplierCommission = 0.8;
      const total = (amount / 100) || (Number(product.price) + platformFee);
      const supplierPayout = Number(product.price) * supplierCommission;

      // Get an available inventory item
      const inventoryResponse = await fetch(
        `${supabaseUrl}/rest/v1/inventory_items?product_id=eq.${productId}&status=eq.available&select=*&limit=1`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );
      
      const inventoryItems = await inventoryResponse.json();
      
      if (!inventoryItems || inventoryItems.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No inventory available' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const inventoryItem = inventoryItems[0];

      // Create the order
      const orderData = {
        customer_id: userId,
        total: total,
        fee: platformFee,
        supplier_payout_amount: supplierPayout,
        status: 'paid',
        paystack_ref: reference,
      };

      const createOrderResponse = await fetch(
        `${supabaseUrl}/rest/v1/orders`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(orderData),
        }
      );

      const orders = await createOrderResponse.json();
      const order = Array.isArray(orders) ? orders[0] : orders;

      if (!order) {
        return new Response(
          JSON.stringify({ error: 'Failed to create order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update inventory item status
      await fetch(
        `${supabaseUrl}/rest/v1/inventory_items?id=eq.${inventoryItem.id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'sold',
            order_id: order.id
          }),
        }
      );

      // Create order item
      await fetch(
        `${supabaseUrl}/rest/v1/order_items`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            order_id: order.id,
            product_id: productId,
            inventory_item_id: inventoryItem.id,
            price_at_time: product.price,
          }),
        }
      );

      // Get supplier details for payout
      const supplierResponse = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${product.supplier_id}&select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );
      
      const suppliers = await supplierResponse.json();
      const supplier = suppliers?.[0];

      // Create payout record
      if (supplier?.paystack_recipient_code) {
        // Initiate Paystack transfer (in production)
        // For now, just create the payout record
        await fetch(
          `${supabaseUrl}/rest/v1/payouts`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              supplier_id: product.supplier_id,
              order_id: order.id,
              amount: supplierPayout,
              status: 'pending',
            }),
          }
        );
      }

      // Log the event
      await fetch(
        `${supabaseUrl}/rest/v1/logs`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_type: 'payment_success',
            message: `Payment successful for order ${order.id}`,
            payload: { reference, order_id: order.id, product_id: productId },
          }),
        }
      );

      return new Response(
        JSON.stringify({
          success: true,
          order,
          credentials: inventoryItem.credentials,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle other events
    return new Response(
      JSON.stringify({ received: true, event }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing payment:', error);
    
    // Log error
    try {
      await fetch(
        `${supabaseUrl}/rest/v1/logs`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_type: 'payment_error',
            message: error.message,
            payload: { error: error.toString() },
          }),
        }
      );
    } catch (e) {}

    return new Response(
      JSON.stringify({ error: 'Payment processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});