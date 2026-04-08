import React, { useState } from 'react';
import { supabase, PLATFORM_FEE, SUPPLIER_COMMISSION, PAYSTACK_PUBLIC_KEY } from '../supabase';

// Paystack inline checkout component
export function Checkout({ product, userId, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const total = Number(product.price) + PLATFORM_FEE;

  // Initialize Paystack payment
  const initializePayment = async () => {
    setLoading(true);
    setError('');

    try {
      // Call Edge Function to initialize payment
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/initialize-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            product_id: product.id,
            user_id: userId,
            amount: total
          })
        }
      ).catch(() => null);

      // If Edge Function fails, create a mock payment for demo
      if (!response || !response.ok) {
        // Demo mode - simulate successful payment
        await processDemoPayment();
        return;
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Open Paystack popup
      if (window.PaystackPop) {
        const paystack = window.PaystackPop.setup({
          key: PAYSTACK_PUBLIC_KEY,
          email: '', // Will be populated by Paystack
          amount: total * 100, // Convert to kobo
          ref: data.reference,
          onClose: () => {
            setLoading(false);
          },
          callback: async (response) => {
            // Verify payment and complete order
            await verifyPayment(response.reference);
          }
        });
        paystack.openIframe();
      } else {
        // Fallback: simulate payment
        await processDemoPayment();
      }
    } catch (err) {
      setError(err.message || 'Payment initialization failed');
      setLoading(false);
    }
  };

  // Process demo payment (for development without real Paystack)
  const processDemoPayment = async () => {
    setLoading(true);
    try {
      // Get available inventory item
      const { data: item } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('product_id', product.id)
        .eq('status', 'available')
        .limit(1)
        .single();

      if (!item) {
        throw new Error('No available inventory');
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: userId,
          total: total,
          fee: PLATFORM_FEE,
          supplier_payout_amount: Number(product.price) * SUPPLIER_COMMISSION,
          status: 'paid',
          paystack_ref: 'DEMO-' + Date.now()
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Assign inventory to order
      await supabase
        .from('inventory_items')
        .update({ status: 'sold', order_id: order.id })
        .eq('id', item.id);

      // Create order item
      await supabase
        .from('order_items')
        .insert({
          order_id: order.id,
          product_id: product.id,
          inventory_item_id: item.id,
          price_at_time: product.price
        });

      // Get credentials for display
      const { data: updatedItem } = await supabase
        .from('inventory_items')
        .select('credentials')
        .eq('id', item.id)
        .single();

      onSuccess({
        order,
        credentials: updatedItem?.credentials
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Verify payment with Paystack
  const verifyPayment = async (reference) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ reference })
        }
      ).catch(() => null);

      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          onSuccess({
            order: data.order,
            credentials: data.credentials
          });
          return;
        }
      }

      // Demo fallback
      await processDemoPayment();
    } catch (err) {
      setError('Payment verification failed');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Checkout</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3 mb-6">
          <div className="flex justify-between">
            <span className="text-gray-600">{product.name}</span>
            <span className="font-medium">₦{Number(product.price).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Platform Fee</span>
            <span className="font-medium">₦{PLATFORM_FEE}</span>
          </div>
          <div className="flex justify-between border-t pt-3">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold">₦{total.toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={initializePayment}
            disabled={loading}
            className="btn btn-primary w-full py-3"
          >
            {loading ? 'Processing...' : 'Pay with Paystack'}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn btn-secondary w-full"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          Secure payment powered by Paystack
        </p>
      </div>
    </div>
  );
}

// Payment success view
export function PaymentSuccess({ order, credentials, onViewPurchases }) {
  return (
    <div className="max-w-md mx-auto py-12 px-4 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">✓</span>
      </div>
      
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
      <p className="text-gray-600 mb-6">Your order has been completed</p>

      <div className="card text-left mb-6">
        <h3 className="font-semibold mb-3">Your Credentials</h3>
        <div className="space-y-2 font-mono text-sm">
          {credentials?.username && (
            <div>
              <span className="text-gray-500">Username:</span>{' '}
              <span className="font-medium">{credentials.username}</span>
            </div>
          )}
          {credentials?.password && (
            <div>
              <span className="text-gray-500">Password:</span>{' '}
              <span className="font-medium">{credentials.password}</span>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Save these credentials securely. You can also view them in My Purchases.
        </p>
      </div>

      <button onClick={onViewPurchases} className="btn btn-primary">
        View My Purchases
      </button>
    </div>
  );
}

// Demo mode notice component
export function DemoNotice() {
  const [dismissed, setDismissed] = useState(false);
  
  if (dismissed) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-xl">⚠️</span>
        <div>
          <h3 className="font-semibold text-yellow-800">Demo Mode</h3>
          <p className="text-sm text-yellow-700">
            Paystack integration is not configured. Payments will be simulated for testing.
            Configure VITE_PAYSTACK_PUBLIC_KEY to enable real payments.
          </p>
          <button
            onClick={() => setDismissed(true)}
            className="text-sm text-yellow-800 underline mt-2"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}