import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

// Main Admin Panel component
export function AdminPanel() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Get total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get total orders
      const { data: orders } = await supabase
        .from('orders')
        .select('total, fee');

      // Get total products
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Get pending payouts
      const { count: pendingPayouts } = await supabase
        .from('payouts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total), 0) || 0;
      const totalFees = orders?.reduce((sum, o) => sum + Number(o.fee), 0) || 0;

      setStats({
        totalUsers,
        totalOrders: orders?.length || 0,
        totalRevenue,
        totalFees,
        totalProducts,
        pendingPayouts
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'products', label: 'Products', icon: '📦' },
    { id: 'orders', label: 'Orders', icon: '🛒' },
    { id: 'payouts', label: 'Payouts', icon: '💰' },
    { id: 'logs', label: 'Logs', icon: '📝' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Admin Panel</h2>

      {/* Section Tabs */}
      <div className="flex overflow-x-auto gap-2 mb-6 pb-2">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              activeSection === section.id 
                ? 'bg-indigo-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {section.icon} {section.label}
          </button>
        ))}
      </div>

      {/* Section Content */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <>
          {activeSection === 'dashboard' && <DashboardSection stats={stats} />}
          {activeSection === 'users' && <UsersSection />}
          {activeSection === 'products' && <ProductsSection />}
          {activeSection === 'orders' && <OrdersSection />}
          {activeSection === 'payouts' && <PayoutsSection />}
          {activeSection === 'logs' && <LogsSection />}
          {activeSection === 'settings' && <SettingsSection onUpdate={loadStats} />}
        </>
      )}
    </div>
  );
}

// Dashboard Section
function DashboardSection({ stats }) {
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    loadRecentOrders();
  }, []);

  const loadRecentOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        customer:profiles(email)
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    setRecentOrders(data || []);
  };

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: '👥' },
    { label: 'Total Orders', value: stats.totalOrders, icon: '🛒' },
    { label: 'Total Revenue', value: `₦${(stats.totalRevenue || 0).toLocaleString()}`, icon: '💰' },
    { label: 'Platform Fees', value: `₦${(stats.totalFees || 0).toLocaleString()}`, icon: '📈' },
    { label: 'Active Products', value: stats.totalProducts, icon: '📦' },
    { label: 'Pending Payouts', value: stats.pendingPayouts, icon: '⏳' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="card text-center">
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-2xl font-bold">{card.value}</div>
            <div className="text-sm text-gray-500">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4">Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Fee</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(order => (
                <tr key={order.id}>
                  <td className="font-mono text-sm">{order.id.slice(0, 8)}</td>
                  <td className="text-sm">{order.customer?.email}</td>
                  <td>₦{Number(order.total).toLocaleString()}</td>
                  <td>₦{Number(order.fee).toLocaleString()}</td>
                  <td>
                    <span className={`badge ${
                      order.status === 'paid' ? 'badge-success' : 
                      order.status === 'pending' ? 'badge-warning' : 'badge-error'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="text-sm">{new Date(order.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Users Section
function UsersSection() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };

  const updateUserRole = async (userId, newRole) => {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    loadUsers();
  };

  const toggleUserActive = async (userId, isActive) => {
    await supabase.from('profiles').update({ is_active: !isActive }).eq('id', userId);
    loadUsers();
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <input
          type="text"
          className="input max-w-xs"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Display Name</th>
              <th>Role</th>
              <th>Verified</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id}>
                <td className="text-sm">{user.email}</td>
                <td>{user.display_name}</td>
                <td>
                  <select
                    value={user.role}
                    onChange={(e) => updateUserRole(user.id, e.target.value)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="customer">Customer</option>
                    <option value="supplier">Supplier</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>
                  <span className={`badge ${user.email_verified ? 'badge-success' : 'badge-warning'}`}>
                    {user.email_verified ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${user.is_active ? 'badge-success' : 'badge-error'}`}>
                    {user.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => toggleUserActive(user.id, user.is_active)}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    {user.is_active ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Products Section
function ProductsSection() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select(`
        *,
        platform:platforms(name),
        supplier:profiles(display_name, email)
      `)
      .order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  const togglePublish = async (productId, currentStatus) => {
    await supabase
      .from('products')
      .update({ is_published: !currentStatus })
      .eq('id', productId);
    loadProducts();
  };

  const deleteProduct = async (productId) => {
    if (!confirm('Delete this product?')) return;
    await supabase.from('products').delete().eq('id', productId);
    loadProducts();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Platform</th>
            <th>Supplier</th>
            <th>Price</th>
            <th>Published</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => (
            <tr key={product.id}>
              <td className="max-w-xs truncate">{product.name}</td>
              <td>{product.platform?.name}</td>
              <td className="text-sm">{product.supplier?.email}</td>
              <td>₦{Number(product.price).toLocaleString()}</td>
              <td>
                <span className={`badge ${product.is_published ? 'badge-success' : 'badge-warning'}`}>
                  {product.is_published ? 'Published' : 'Draft'}
                </span>
              </td>
              <td>
                <button
                  onClick={() => togglePublish(product.id, product.is_published)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 mr-3"
                >
                  {product.is_published ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => deleteProduct(product.id)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Orders Section
function OrdersSection() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    let query = supabase
      .from('orders')
      .select(`
        *,
        customer:profiles(email, display_name),
        items:order_items(
          *,
          product:products(name)
        )
      `)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;
    setOrders(data || []);
    setLoading(false);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    loadOrders();
  };

  const filteredOrders = orders.filter(o => {
    if (search) {
      const searchLower = search.toLowerCase();
      return o.id.toLowerCase().includes(searchLower) ||
             o.customer?.email?.toLowerCase().includes(searchLower);
    }
    return true;
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <input
          type="text"
          className="input max-w-xs"
          placeholder="Search by order ID or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input max-w-xs"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); loadOrders(); }}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => (
              <tr key={order.id}>
                <td className="font-mono text-sm">{order.id.slice(0, 8)}</td>
                <td className="text-sm">{order.customer?.email}</td>
                <td className="text-sm">
                  {order.items?.map(i => i.product?.name).join(', ')}
                </td>
                <td>₦{Number(order.total).toLocaleString()}</td>
                <td>
                  <select
                    value={order.status}
                    onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </td>
                <td className="text-sm">{new Date(order.created_at).toLocaleDateString()}</td>
                <td>
                  <button
                    onClick={() => window.location.hash = `view-order-${order.id}`}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Payouts Section
function PayoutsSection() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    const { data } = await supabase
      .from('payouts')
      .select(`
        *,
        supplier:profiles(email, display_name),
        order:orders(id)
      `)
      .order('created_at', { ascending: false });
    setPayouts(data || []);
    setLoading(false);
  };

  const retryPayout = async (payoutId) => {
    // In production, this would call an Edge Function to retry the Paystack transfer
    alert('Retry functionality requires Paystack integration');
  };

  const exportCSV = () => {
    const csv = payouts.map(p => ({
      ID: p.id,
      Supplier: p.supplier?.email,
      Amount: p.amount,
      Status: p.status,
      'Transfer Code': p.paystack_transfer_code,
      Date: p.created_at
    }));
    
    const headers = Object.keys(csv[0] || {}).join(',');
    const rows = csv.map(r => Object.values(r).join(','));
    const csvContent = [headers, ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payouts.csv';
    a.click();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={exportCSV} className="btn btn-secondary">
          Export CSV
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Payout ID</th>
              <th>Supplier</th>
              <th>Order</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Transfer Code</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map(payout => (
              <tr key={payout.id}>
                <td className="font-mono text-sm">{payout.id.slice(0, 8)}</td>
                <td className="text-sm">{payout.supplier?.email}</td>
                <td className="font-mono text-sm">{payout.order?.id?.slice(0, 8)}</td>
                <td>₦{Number(payout.amount).toLocaleString()}</td>
                <td>
                  <span className={`badge ${
                    payout.status === 'completed' ? 'badge-success' :
                    payout.status === 'failed' ? 'badge-error' : 'badge-warning'
                  }`}>
                    {payout.status}
                  </span>
                </td>
                <td className="font-mono text-xs">{payout.paystack_transfer_code || '-'}</td>
                <td className="text-sm">{new Date(payout.created_at).toLocaleDateString()}</td>
                <td>
                  {payout.status === 'failed' && (
                    <button
                      onClick={() => retryPayout(payout.id)}
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Logs Section
function LogsSection() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const { data } = await supabase
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setLogs(data || []);
    setLoading(false);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Event Type</th>
            <th>Message</th>
            <th>Payload</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td className="text-sm whitespace-nowrap">
                {new Date(log.created_at).toLocaleString()}
              </td>
              <td>
                <span className="badge badge-info">{log.event_type}</span>
              </td>
              <td className="text-sm max-w-xs truncate">{log.message}</td>
              <td className="text-xs font-mono max-w-xs truncate">
                {JSON.stringify(log.payload || {})}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Settings Section
function SettingsSection({ onUpdate }) {
  const [settings, setSettings] = useState({
    platform_fee: '500',
    commission_rate: '0.2',
    site_name: 'DigiPromart'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase.from('settings').select('key, value');
    const settingsObj = {};
    data?.forEach(s => { settingsObj[s.key] = s.value; });
    setSettings(prev => ({ ...prev, ...settingsObj }));
    setLoading(false);
  };

  const saveSetting = async (key, value) => {
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value }, { onConflict: 'key' });
    
    if (!error) {
      setSettings(prev => ({ ...prev, [key]: value }));
      setSuccess('Settings saved!');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-md">
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      <div className="card space-y-4">
        <div>
          <label className="label">Site Name</label>
          <input
            type="text"
            className="input"
            value={settings.site_name}
            onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
          />
          <button
            onClick={() => saveSetting('site_name', settings.site_name)}
            className="btn btn-secondary btn-sm mt-2"
          >
            Save
          </button>
        </div>

        <div>
          <label className="label">Platform Fee (₦)</label>
          <input
            type="number"
            className="input"
            value={settings.platform_fee}
            onChange={(e) => setSettings({ ...settings, platform_fee: e.target.value })}
          />
          <button
            onClick={() => saveSetting('platform_fee', settings.platform_fee)}
            className="btn btn-secondary btn-sm mt-2"
          >
            Save
          </button>
        </div>

        <div>
          <label className="label">Commission Rate (supplier gets this fraction)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="1"
            className="input"
            value={settings.commission_rate}
            onChange={(e) => setSettings({ ...settings, commission_rate: e.target.value })}
          />
          <p className="text-sm text-gray-500 mt-1">
            Current: Supplier receives {(parseFloat(settings.commission_rate) * 100).toFixed(0)}%
          </p>
          <button
            onClick={() => saveSetting('commission_rate', settings.commission_rate)}
            className="btn btn-secondary btn-sm mt-2"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}