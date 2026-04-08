import React, { useState, useEffect, createContext, useContext } from 'react';
import { supabase, getUserRole, getCurrentUser, PAYSTACK_PUBLIC_KEY } from './supabase';

// Components
import { SignUp, Login, LogoutButton } from './components/Auth';
import { Profile } from './components/Profile';
import { SupplierProducts, ProductForm, InventoryManager } from './components/SupplierProducts';
import { Storefront, ProductDetail } from './components/Storefront';
import { Checkout, PaymentSuccess, DemoNotice } from './components/Checkout';
import { CustomerVault } from './components/CustomerVault';
import { AdminPanel } from './components/AdminPanel';

// Auth context
const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

// Main App component
export default function App() {
  // View state (no React Router - pure client-side view switching)
  const [currentView, setCurrentView] = useState('home'); // home, login, signup, profile, storefront, purchases, supplier-products, supplier-new-product, supplier-edit-product, supplier-inventory, admin, payment-success
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Product detail state
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Checkout state
  const [checkoutProduct, setCheckoutProduct] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);
  
  // Editing states
  const [editingProductId, setEditingProductId] = useState(null);
  const [inventoryProductId, setInventoryProductId] = useState(null);
  const [inventoryProductName, setInventoryProductName] = useState('');

  // Hash-based navigation (for deep linking in production)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'login') setCurrentView('login');
      else if (hash === 'signup') setCurrentView('signup');
      else if (hash === 'profile') setCurrentView('profile');
      else if (hash === 'purchases') setCurrentView('purchases');
      else if (hash === 'supplier-products') setCurrentView('supplier-products');
      else if (hash === 'new-product') setCurrentView('supplier-new-product');
      else if (hash === 'admin') setCurrentView('admin');
      else if (hash.startsWith('edit-product-')) {
        setEditingProductId(hash.replace('edit-product-', ''));
        setCurrentView('supplier-edit-product');
      }
      else if (hash.startsWith('inventory-')) {
        const parts = hash.replace('inventory-', '').split('-');
        setInventoryProductId(parts[0]);
        setInventoryProductName(parts.slice(1).join(' '));
        setCurrentView('supplier-inventory');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        checkAuth();
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    try {
      const profileData = await getCurrentUser();
      if (profileData) {
        setUser(profileData.id);
        setProfile(profileData);
        
        // Redirect to appropriate view based on role
        const role = getUserRole(profileData);
        if (currentView === 'home' || currentView === 'login' || currentView === 'signup') {
          if (role === 'admin') {
            setCurrentView('admin');
          } else if (role === 'supplier') {
            setCurrentView('supplier-products');
          } else {
            setCurrentView('storefront');
          }
        }
      }
    } catch (err) {
      console.error('Auth check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = async () => {
    const profileData = await getCurrentUser();
    setProfile(profileData);
    const role = getUserRole(profileData);
    
    if (role === 'admin') {
      setCurrentView('admin');
    } else if (role === 'supplier') {
      setCurrentView('supplier-products');
    } else {
      setCurrentView('storefront');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setProfile(null);
    setCurrentView('login');
  };

  const handleBuyNow = (product) => {
    if (!user) {
      setCurrentView('login');
      return;
    }
    setCheckoutProduct(product);
  };

  const handlePaymentSuccess = (result) => {
    setPaymentResult(result);
    setCheckoutProduct(null);
    setCurrentView('payment-success');
  };

  const handleProfileUpdate = (updatedProfile) => {
    setProfile(updatedProfile);
  };

  // If still loading, show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // If not logged in, show auth views
  if (!user && currentView !== 'home') {
    return (
      <div>
        {currentView === 'login' && (
          <Login 
            onSwitchToSignUp={() => setCurrentView('signup')} 
            onAuthSuccess={handleAuthSuccess}
          />
        )}
        {currentView === 'signup' && (
          <SignUp 
            onSwitchToLogin={() => setCurrentView('login')} 
            onAuthSuccess={handleAuthSuccess}
          />
        )}
        {currentView === 'home' && (
          <div>
            <Header 
              user={user} 
              profile={profile} 
              onNavigate={setCurrentView} 
              onLogout={handleLogout}
              currentView={currentView}
            />
            <Storefront onBuyNow={handleBuyNow} />
          </div>
        )}
      </div>
    );
  }

  // Render main app with header
  return (
    <div>
      <Header 
        user={user} 
        profile={profile} 
        onNavigate={setCurrentView} 
        onLogout={handleLogout}
        currentView={currentView}
      />
      
      {/* Demo Notice (show to everyone initially) */}
      {user && currentView !== 'payment-success' && <DemoNotice />}

      {/* Main Content */}
      {currentView === 'home' && <Storefront onBuyNow={handleBuyNow} />}
      {currentView === 'storefront' && <Storefront onBuyNow={handleBuyNow} />}
      {currentView === 'purchases' && <CustomerVault userId={user} />}
      {currentView === 'profile' && <Profile profile={profile} onProfileUpdate={handleProfileUpdate} />}
      
      {/* Supplier Views */}
      {currentView === 'supplier-products' && <SupplierProducts userId={user} />}
      {currentView === 'supplier-new-product' && (
        <ProductForm 
          userId={user} 
          onSave={() => setCurrentView('supplier-products')} 
          onCancel={() => setCurrentView('supplier-products')}
        />
      )}
      {currentView === 'supplier-edit-product' && (
        <ProductForm 
          productId={editingProductId}
          userId={user} 
          onSave={() => { setEditingProductId(null); setCurrentView('supplier-products'); }} 
          onCancel={() => { setEditingProductId(null); setCurrentView('supplier-products'); }}
        />
      )}
      {currentView === 'supplier-inventory' && (
        <InventoryManager 
          productId={inventoryProductId} 
          productName={inventoryProductName}
        />
      )}
      
      {/* Admin View */}
      {currentView === 'admin' && <AdminPanel />}
      
      {/* Payment Success View */}
      {currentView === 'payment-success' && paymentResult && (
        <PaymentSuccess 
          order={paymentResult.order} 
          credentials={paymentResult.credentials}
          onViewPurchases={() => setCurrentView('purchases')}
        />
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetail 
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onBuyNow={() => { setSelectedProduct(null); handleBuyNow(selectedProduct); }}
        />
      )}

      {/* Checkout Modal */}
      {checkoutProduct && (
        <Checkout 
          product={checkoutProduct} 
          userId={user}
          onSuccess={handlePaymentSuccess}
          onCancel={() => setCheckoutProduct(null)}
        />
      )}
    </div>
  );
}

// Consistent Header Component
function Header({ user, profile, onNavigate, onLogout, currentView }) {
  const role = getUserRole(profile);
  
  return (
    <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button 
            onClick={() => onNavigate(role === 'admin' ? 'admin' : role === 'supplier' ? 'supplier-products' : 'storefront')}
            className="text-xl font-bold text-indigo-600 hover:text-indigo-700"
          >
            DigiPromart
          </button>

          {/* Navigation Links */}
          <nav className="flex items-center gap-4">
            {role === 'customer' && (
              <>
                <NavLink active={currentView === 'storefront'} onClick={() => onNavigate('storefront')}>
                  Browse
                </NavLink>
                <NavLink active={currentView === 'purchases'} onClick={() => onNavigate('purchases')}>
                  My Purchases
                </NavLink>
              </>
            )}
            
            {role === 'supplier' && (
              <>
                <NavLink active={currentView === 'supplier-products'} onClick={() => onNavigate('supplier-products')}>
                  My Products
                </NavLink>
              </>
            )}
            
            {role === 'admin' && (
              <>
                <NavLink active={currentView === 'admin'} onClick={() => onNavigate('admin')}>
                  Admin Panel
                </NavLink>
              </>
            )}

            {/* Profile & Logout (for logged in users) */}
            {user && (
              <>
                <NavLink active={currentView === 'profile'} onClick={() => onNavigate('profile')}>
                  Profile
                </NavLink>
                <LogoutButton onLogout={onLogout} />
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

// Navigation Link Component
function NavLink({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active 
          ? 'bg-indigo-50 text-indigo-700' 
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}