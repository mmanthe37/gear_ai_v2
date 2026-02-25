/**
 * Gear AI CoPilot - Supabase Client Configuration
 * 
 * Initializes Supabase client for database operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Supabase configuration — accepts both plain and NEXT_PUBLIC_ prefixed names
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  Constants.expoConfig?.extra?.supabaseUrl ||
  '';
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  '';

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase configuration incomplete.\n' +
    'Please ensure .env.local contains SUPABASE_URL and SUPABASE_ANON_KEY.'
  );
}

// Create Supabase client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default supabase;
