/**
 * Create Paystack Recipient Edge Function
 * Creates a transfer recipient for supplier payouts
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
    const { user_id, bank_code, account_number, bank_name } = await req.json();

    if (!user_id || !bank_code || !account_number || !bank_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If Paystack is not configured, simulate a recipient code
    if (!paystackSecret) {
      const mockRecipientCode = 'RCP_' + Date.now() + '_simulated';
      
      // Update profile with recipient code
      await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${user_id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paystack_recipient_code: mockRecipientCode,
            bank_name: bank_name,
            account_number: account_number,
            bank_code: bank_code,
          }),
        }
      );

      return new Response(
        JSON.stringify({
          success: true,
          recipient_code: mockRecipientCode,
          message: 'Recipient created (demo mode)',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create recipient with Paystack
    const paystackResponse = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'bank',
        name: 'Supplier Payout',
        account_number: account_number,
        bank_code: bank_code,
        currency: 'NGN',
      }),
    });

    const recipientData = await paystackResponse.json();

    if (!recipientData.status) {
      return new Response(
        JSON.stringify({ error: recipientData.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update profile with recipient code
    await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${user_id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paystack_recipient_code: recipientData.data.recipient_code,
          bank_name: bank_name,
          account_number: account_number,
          bank_code: bank_code,
        }),
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        recipient_code: recipientData.data.recipient_code,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating recipient:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create recipient' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});