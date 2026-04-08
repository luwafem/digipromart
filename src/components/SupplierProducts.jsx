import React, { useState, useEffect } from 'react';
import { supabase, PLATFORM_FEE } from '../supabase';

// Product list for suppliers
export function SupplierProducts({ userId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, [userId]);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          platform:platforms(name),
          inventory:inventory_items(count)
        `)
        .eq('supplier_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to get inventory count
      const transformed = data.map(p => ({
        ...p,
        inventory_count: p.inventory?.reduce((sum, item) => sum + (item.status === 'available' ? 1 : 0), 0) || 0
      }));
      
      setProducts(transformed);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      
      if (error) throw error;
      setProducts(products.filter(p => p.id !== productId));
    } catch (err) {
      alert('Error deleting product: ' + err.message);
    }
  };

  const togglePublish = async (product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_published: !product.is_published })
        .eq('id', product.id);
      
      if (error) throw error;
      loadProducts();
    } catch (err) {
      alert('Error updating product: ' + err.message);
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">My Products</h2>
        <button
          onClick={() => window.location.hash = 'new-product'}
          className="btn btn-primary"
        >
          + Add New Product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No products yet</p>
          <p className="mt-2">Create your first product to start selling!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => (
            <div key={product.id} className="card">
              {product.image_url && (
                <img 
                  src={product.image_url} 
                  alt={product.name}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              )}
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold">{product.name}</h3>
                <span className={`badge ${product.is_published ? 'badge-success' : 'badge-warning'}`}>
                  {product.is_published ? 'Published' : 'Draft'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{product.platform?.name}</p>
              <p className="text-sm text-gray-500 mb-2">{product.description?.substring(0, 100)}...</p>
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold">₦{Number(product.price).toLocaleString()}</span>
                <span className="text-gray-500">{product.inventory_count} available</span>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => togglePublish(product)}
                  className="btn btn-secondary text-sm flex-1"
                >
                  {product.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  onClick={() => window.location.hash = `edit-product-${product.id}`}
                  className="btn btn-secondary text-sm flex-1"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="btn btn-danger text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Create/Edit product form
export function ProductForm({ productId, userId, onSave, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [platforms, setPlatforms] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    platform_id: '',
    attributes: {},
    image_url: ''
  });

  useEffect(() => {
    loadPlatforms();
    if (productId) loadProduct();
  }, [productId]);

  const loadPlatforms = async () => {
    const { data } = await supabase.from('platforms').select('*').order('name');
    setPlatforms(data || []);
  };

  const loadProduct = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();
    
    if (data) {
      setFormData({
        name: data.name || '',
        description: data.description || '',
        price: data.price || '',
        platform_id: data.platform_id || '',
        attributes: data.attributes || {},
        image_url: data.image_url || ''
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const productData = {
        supplier_id: userId,
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        platform_id: formData.platform_id,
        attributes: formData.attributes,
        image_url: formData.image_url
      };

      let result;
      if (productId) {
        result = await supabase
          .from('products')
          .update(productData)
          .eq('id', productId);
      } else {
        result = await supabase
          .from('products')
          .insert(productData);
      }

      if (result.error) throw result.error;
      onSave();
    } catch (err) {
      alert('Error saving product: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {productId ? 'Edit Product' : 'Create New Product'}
      </h2>

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label className="label">Product Name</label>
          <input
            type="text"
            className="input"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            required
            placeholder="e.g., Premium Instagram Account"
          />
        </div>

        <div>
          <label className="label">Platform</label>
          <select
            className="input"
            value={formData.platform_id}
            onChange={(e) => setFormData({...formData, platform_id: e.target.value})}
            required
          >
            <option value="">Select platform</option>
            {platforms.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className="input"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="Describe your product..."
          />
        </div>

        <div>
          <label className="label">Price (₦)</label>
          <input
            type="number"
            className="input"
            value={formData.price}
            onChange={(e) => setFormData({...formData, price: e.target.value})}
            required
            min="1"
            placeholder="0.00"
          />
          <p className="text-sm text-gray-500 mt-1">
            You will receive 80% of this price (₦{formData.price ? (formData.price * 0.8).toFixed(2) : '0.00'}) per sale
          </p>
        </div>

        <div>
          <label className="label">Image URL</label>
          <input
            type="url"
            className="input"
            value={formData.image_url}
            onChange={(e) => setFormData({...formData, image_url: e.target.value})}
            placeholder="https://example.com/image.jpg"
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary flex-1"
          >
            {loading ? 'Saving...' : 'Save Product'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// Inventory management
export function InventoryManager({ productId, productName }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ username: '', password: '', image_url: '' });

  useEffect(() => {
    loadItems();
  }, [productId]);

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error loading inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('inventory_items')
        .insert({
          product_id: productId,
          credentials: {
            username: newItem.username,
            password: newItem.password
          },
          image_url: newItem.image_url,
          status: 'available'
        });

      if (error) throw error;
      setNewItem({ username: '', password: '', image_url: '' });
      setShowAddForm(false);
      loadItems();
    } catch (err) {
      alert('Error adding item: ' + err.message);
    }
  };

  const handleDelete = async (itemId) => {
    if (!confirm('Delete this inventory item?')) return;
    
    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', itemId);
      
      if (error) throw error;
      setItems(items.filter(i => i.id !== itemId));
    } catch (err) {
      alert('Error deleting item: ' + err.message);
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventory: {productName}</h2>
          <p className="text-gray-600">{items.filter(i => i.status === 'available').length} available</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-primary"
        >
          {showAddForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddItem} className="card mb-6">
          <h3 className="font-semibold mb-4">Add New Inventory Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Username / Email</label>
              <input
                type="text"
                className="input"
                value={newItem.username}
                onChange={(e) => setNewItem({...newItem, username: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={newItem.password}
                onChange={(e) => setNewItem({...newItem, password: e.target.value})}
                required
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="label">Image URL (optional)</label>
            <input
              type="url"
              className="input"
              value={newItem.image_url}
              onChange={(e) => setNewItem({...newItem, image_url: e.target.value})}
            />
          </div>
          <button type="submit" className="btn btn-primary mt-4">
            Add to Inventory
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No inventory items yet. Add your first item!
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Credentials</th>
                <th>Status</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td className="font-mono text-sm">
                    {item.credentials?.username || 'N/A'}
                  </td>
                  <td>
                    <span className={`badge ${item.status === 'available' ? 'badge-success' : 'badge-error'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>{new Date(item.created_at).toLocaleDateString()}</td>
                  <td>
                    {item.status === 'available' && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}