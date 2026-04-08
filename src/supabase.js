import { createClient } from '@supabase/supabase-js';

// These will be replaced with actual values from environment variables
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Paystack public key - replace with your actual key
export const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || 'YOUR_PAYSTACK_PUBLIC_KEY';

// Platform settings
export const PLATFORM_FEE = 500; // ₦500 fixed fee
export const SUPPLIER_COMMISSION = 0.8; // 80% to supplier

// Helper to check if user is authenticated
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
    
  return profile;
}

// Helper to get user role
export function getUserRole(profile) {
  return profile?.role || 'customer';
}