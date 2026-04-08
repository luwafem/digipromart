/**
 * Transfer to Supplier Edge Function
 * Initiates payout to supplier after successful payment
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
    // Parse request body
    const { payout_id } = await req.json();

    if (!payout_id) {
      return new Response(
        JSON.stringify({ error: 'Missing payout_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get payout details
    const payoutResponse = await fetch(
      `${supabaseUrl}/rest/v1/payouts?id=eq.${payout_id}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );
    
    const payouts = await payoutResponse.json();
    
    if (!payouts || payouts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Payout not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payout = payouts[0];

    if (payout.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Payout already processed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get supplier details
    const supplierResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${payout.supplier_id}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );
    
    const suppliers = await supplierResponse.json();
    const supplier = suppliers?.[0];

    if (!supplier?.paystack_recipient_code) {
      // Update payout as failed
      await fetch(
        `${supabaseUrl}/rest/v1/payouts?id=eq.${payout_id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'failed',
            failure_reason: 'No recipient code found',
          }),
        }
      );

      return new Response(
        JSON.stringify({ error: 'Supplier has no recipient code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If Paystack not configured, simulate transfer
    if (!paystackSecret) {
      // Update payout as completed (demo mode)
      await fetch(
        `${supabaseUrl}/rest/v1/payouts?id=eq.${payout_id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'completed',
            paystack_transfer_code: 'DEMO-' + Date.now(),
          }),
        }
      );

      // Log event
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
            event_type: 'payout_completed',
            message: `Payout ${payout_id} completed (demo mode)`,
            payload: { payout_id, amount: payout.amount },
          }),
        }
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Payout completed (demo mode)',
          transfer_code: 'DEMO-' + Date.now(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initiate Paystack transfer
    const transferResponse = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(payout.amount * 100), // Convert to kobo
        recipient: supplier.paystack_recipient_code,
        reason: `Payout for order ${payout.order_id}`,
      }),
    });

    const transferData = await transferResponse.json();

    if (!transferData.status) {
      // Update payout as failed
      await fetch(
        `${supabaseUrl}/rest/v1/payouts?id=eq.${payout_id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'failed',
            failure_reason: transferData.message,
          }),
        }
      );

      return new Response(
        JSON.stringify({ error: transferData.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update payout with transfer code
    await fetch(
      `${supabaseUrl}/rest/v1/payouts?id=eq.${payout_id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'processing',
          paystack_transfer_code: transferData.data.transfer_code,
        }),
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        transfer_code: transferData.data.transfer_code,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing payout:', error);
    return new Response(
      JSON.stringify({ error: 'Payout processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});