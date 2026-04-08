-- DigiPromart Database Schema
-- Multi-Vendor Digital Goods Marketplace

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Settings table for platform configuration
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (key, value) VALUES 
  ('platform_fee', '500'),
  ('commission_rate', '0.2'),
  ('site_name', 'DigiPromart');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'customer' CHECK (role IN ('customer', 'supplier', 'admin')),
  email_verified BOOLEAN DEFAULT FALSE,
  display_name VARCHAR(255),
  paystack_recipient_code VARCHAR(255),
  bank_name VARCHAR(255),
  account_number VARCHAR(20),
  bank_code VARCHAR(10),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Platforms table (e.g., Instagram, Twitter, WhatsApp)
CREATE TABLE platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default platforms
INSERT INTO platforms (name) VALUES 
  ('Instagram'), ('Twitter'), ('WhatsApp'), ('Facebook'), 
  ('TikTok'), ('Telegram'), ('LinkedIn'), ('Bank Account'), 
  ('Phone Number'), ('API Service'), ('Other');

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES platforms(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(12, 2) NOT NULL,
  attributes JSONB DEFAULT '{}',
  image_url TEXT,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory items (individual sellable items for a product)
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  credentials JSONB DEFAULT '{}',
  image_url TEXT,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'sold')),
  order_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES profiles(id),
  total DECIMAL(12, 2) NOT NULL,
  fee DECIMAL(12, 2) NOT NULL,
  supplier_payout_amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  paystack_ref VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  price_at_time DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payouts table
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES profiles(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  paystack_transfer_code VARCHAR(255),
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Logs table for tracking events
CREATE TABLE logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  message TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_platform ON products(platform_id);
CREATE INDEX idx_products_published ON products(is_published);
CREATE INDEX idx_inventory_product ON inventory_items(product_id);
CREATE INDEX idx_inventory_status ON inventory_items(status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_payouts_supplier ON payouts(supplier_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_logs_event_type ON logs(event_type);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Platforms - everyone can read
CREATE POLICY "Anyone can view platforms" ON platforms FOR SELECT USING (true);

-- Profiles policies
CREATE POLICY "Users can read all profiles" ON profiles FOR SELECT USING (true);

-- Customers can read their own profile
CREATE POLICY "Customers can update own profile" ON profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Suppliers can update their own profile
CREATE POLICY "Suppliers can update own profile" ON profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "Admins can update profiles" ON profiles FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Products policies
-- Anyone can view published products
CREATE POLICY "Anyone can view published products" ON products FOR SELECT 
  USING (is_published = true);

-- Suppliers can manage their own products
CREATE POLICY "Suppliers can manage own products" ON products FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND id = supplier_id AND role = 'supplier')
  );

-- Admins can manage all products
CREATE POLICY "Admins can manage all products" ON products FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Inventory items policies
-- Suppliers can manage their own inventory
CREATE POLICY "Suppliers can manage own inventory" ON inventory_items FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM products 
      WHERE id = product_id 
      AND supplier_id = auth.uid()
    )
  );

-- Anyone can view inventory for published products (for stock display)
CREATE POLICY "Anyone can view inventory count" ON inventory_items FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id AND p.is_published = true
    )
  );

-- Order policies
-- Customers can view their own orders
CREATE POLICY "Customers can view own orders" ON orders FOR SELECT 
  USING (customer_id = auth.uid());

-- Suppliers can view orders containing their products
CREATE POLICY "Suppliers can view relevant orders" ON orders FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = orders.id AND p.supplier_id = auth.uid()
    )
  );

-- Admins can view all orders
CREATE POLICY "Admins can view all orders" ON orders FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Order items policies
-- Customers can view their own order items
CREATE POLICY "Customers can view own order items" ON order_items FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

-- Suppliers can view order items for their products
CREATE POLICY "Suppliers can view relevant order items" ON order_items FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id AND p.supplier_id = auth.uid()
    )
  );

-- Admins can view all order items
CREATE POLICY "Admins can view all order items" ON order_items FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Payouts policies
-- Suppliers can view their own payouts
CREATE POLICY "Suppliers can view own payouts" ON payouts FOR SELECT 
  USING (supplier_id = auth.uid());

-- Admins can view all payouts
CREATE POLICY "Admins can view all payouts" ON payouts FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Settings policies
CREATE POLICY "Anyone can view settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Admins can update settings" ON settings FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Logs - only admins can view
CREATE POLICY "Admins can view logs" ON logs FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, email_verified, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.user_metadata->>'role', 'customer'),
    NEW.email_confirmed_at IS NOT NULL,
    COALESCE(NEW.user_metadata->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to get inventory count for a product
CREATE OR REPLACE FUNCTION get_inventory_count(product_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  count_val INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_val
  FROM inventory_items
  WHERE product_id = product_uuid AND status = 'available';
  RETURN count_val;
END;
$$ LANGUAGE plpgsql;