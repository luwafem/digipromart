import React, { useState, useEffect } from 'react';
import { supabase, PLATFORM_FEE } from '../supabase';

export function Storefront({ onBuyNow }) {
  const [products, setProducts] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    platform_id: '',
    search: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load platforms
      const { data: platformsData } = await supabase
        .from('platforms')
        .select('*')
        .order('name');
      setPlatforms(platformsData || []);

      // Load products with inventory count
      const { data: productsData, error } = await supabase
        .from('products')
        .select(`
          *,
          platform:platforms(name),
          supplier:profiles(display_name)
        `)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get inventory counts for each product
      const productsWithInventory = await Promise.all(
        (productsData || []).map(async (product) => {
          const { count } = await supabase
            .from('inventory_items')
            .select('*', { count: 'exact', head: true })
            .eq('product_id', product.id)
            .eq('status', 'available');
          
          return { ...product, inventory_count: count || 0 };
        })
      );

      setProducts(productsWithInventory);
    } catch (err) {
      console.error('Error loading storefront:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    if (filters.platform_id && product.platform_id !== filters.platform_id) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return product.name.toLowerCase().includes(search) || 
             product.description?.toLowerCase().includes(search);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Digital Marketplace</h1>
        
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            className="input md:w-64"
            placeholder="Search products..."
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
          />
          <select
            className="input md:w-48"
            value={filters.platform_id}
            onChange={(e) => setFilters({...filters, platform_id: e.target.value})}
          >
            <option value="">All Platforms</option>
            {platforms.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No products found</p>
          <p className="mt-2">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onBuyNow={() => onBuyNow(product)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, onBuyNow }) {
  const total = Number(product.price) + PLATFORM_FEE;
  const hasInventory = product.inventory_count > 0;

  return (
    <div className="card hover:shadow-md transition-shadow">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-48 object-cover rounded-lg mb-4"
        />
      ) : (
        <div className="w-full h-48 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
          <span className="text-4xl">📦</span>
        </div>
      )}
      
      <div className="space-y-2">
        <div className="flex justify-between items-start">
          <h3 className="font-semibold text-gray-900 line-clamp-2">{product.name}</h3>
        </div>
        
        <p className="text-sm text-gray-600">
          <span className="badge badge-info">{product.platform?.name}</span>
        </p>

        {product.description && (
          <p className="text-sm text-gray-500 line-clamp-2">{product.description}</p>
        )}

        <div className="flex justify-between items-center pt-2">
          <div>
            <span className="text-lg font-bold text-gray-900">₦{Number(product.price).toLocaleString()}</span>
            <span className="text-xs text-gray-500 ml-1">+ ₦{PLATFORM_FEE} fee</span>
          </div>
          <span className={`text-sm ${hasInventory ? 'text-green-600' : 'text-red-500'}`}>
            {hasInventory ? `${product.inventory_count} available` : 'Out of stock'}
          </span>
        </div>

        <button
          onClick={onBuyNow}
          disabled={!hasInventory}
          className={`btn w-full mt-2 ${hasInventory ? 'btn-primary' : 'btn-secondary'}`}
        >
          {hasInventory ? 'Buy Now' : 'Out of Stock'}
        </button>
      </div>
    </div>
  );
}

// Product detail modal
export function ProductDetail({ product, onClose, onBuyNow }) {
  if (!product) return null;

  const total = Number(product.price) + PLATFORM_FEE;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>

          {product.image_url && (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-64 object-cover rounded-lg mb-6"
            />
          )}

          <div className="flex items-center gap-2 mb-2">
            <span className="badge badge-info">{product.platform?.name}</span>
            {product.inventory_count > 0 ? (
              <span className="badge badge-success">{product.inventory_count} available</span>
            ) : (
              <span className="badge badge-error">Out of stock</span>
            )}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h2>
          
          <p className="text-gray-600 mb-4">{product.description}</p>

          {/* Show attributes */}
          {product.attributes && Object.keys(product.attributes).length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-2">Specifications</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(product.attributes).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="text-gray-500">{key}:</span>{' '}
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-2xl font-bold">₦{Number(product.price).toLocaleString()}</span>
                <span className="text-gray-500 ml-2">product</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-semibold">₦{PLATFORM_FEE}</span>
                <span className="text-gray-500 ml-1">platform fee</span>
              </div>
            </div>
            <div className="text-xl font-bold text-right border-t pt-2">
              Total: ₦{total.toLocaleString()}
            </div>
          </div>

          <button
            onClick={() => onBuyNow(product)}
            disabled={product.inventory_count <= 0}
            className={`btn w-full mt-4 ${product.inventory_count > 0 ? 'btn-primary' : 'btn-secondary'}`}
          >
            {product.inventory_count > 0 ? `Buy Now - ₦${total.toLocaleString()}` : 'Out of Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}