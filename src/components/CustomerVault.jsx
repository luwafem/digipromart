import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function CustomerVault({ userId }) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCredentials, setShowCredentials] = useState({});

  useEffect(() => {
    loadPurchases();
  }, [userId]);

  const loadPurchases = async () => {
    try {
      // Get orders for this customer
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(
            *,
            product:products(name, platform:platforms(name))
          )
        `)
        .eq('customer_id', userId)
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchases(orders || []);
    } catch (err) {
      console.error('Error loading purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleCredentials = (itemId) => {
    setShowCredentials(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading purchases...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">My Purchases</h2>

      {purchases.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No purchases yet</p>
          <p className="mt-2">Browse the marketplace to find digital products</p>
        </div>
      ) : (
        <div className="space-y-6">
          {purchases.map(order => (
            <div key={order.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">Order #{order.id.slice(0, 8)}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString('en-NG', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-semibold">₦{Number(order.total).toLocaleString()}</span>
                  <span className={`badge ml-2 ${order.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                    {order.status}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Purchased Items</h4>
                <div className="space-y-4">
                  {order.items?.map(item => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.product?.name}</p>
                        <p className="text-sm text-gray-500">{item.product?.platform?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">₦{Number(item.price_at_time).toLocaleString()}</p>
                        {item.inventory_item?.credentials && (
                          <button
                            onClick={() => toggleCredentials(item.inventory_item_id)}
                            className="text-sm text-indigo-600 hover:text-indigo-800 mt-1"
                          >
                            {showCredentials[item.inventory_item_id] ? 'Hide' : 'Show'} Credentials
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Show credentials when toggled */}
                {order.items?.map(item => showCredentials[item.inventory_item_id] && (
                  <div key={item.id} className="mt-3 bg-gray-50 rounded p-3 font-mono text-sm">
                    {item.inventory_item?.credentials?.username && (
                      <p><span className="text-gray-500">Username:</span> {item.inventory_item.credentials.username}</p>
                    )}
                    {item.inventory_item?.credentials?.password && (
                      <p><span className="text-gray-500">Password:</span> {item.inventory_item.credentials.password}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}