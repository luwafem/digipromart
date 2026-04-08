import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase - must be set in .env file
// For Parcel, use VITE_ prefix which becomes import.meta.env.VITE_*
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || window.ENV?.SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || window.ENV?.SUPABASE_ANON_KEY || '';

// Validate URL before creating client
if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  console.error('Invalid Supabase URL. Please set VITE_SUPABASE_URL in your .env file');
}

// Create client only if valid URL provided
export const supabase = supabaseUrl && supabaseUrl.startsWith('http') 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Paystack public key
export const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_demo';

// Platform settings
export const PLATFORM_FEE = 500; // ₦500 fixed fee
export const SUPPLIER_COMMISSION = 0.8; // 80% to supplier

// Helper to check if user is authenticated
export async function getCurrentUser() {
  if (!supabase) return null;
  
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