/**
 * Gear AI CoPilot - Supabase Client Configuration
 * 
 * Initializes Supabase client for database operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// EXPO_PUBLIC_* vars are the only ones reliably inlined by Expo's Metro bundler.
// app.config.js extra values are a fallback for older builds.
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  Constants.expoConfig?.extra?.supabaseUrl ||
  '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] MISSING config — URL:', supabaseUrl || '(empty)', '| Key:', supabaseAnonKey ? supabaseAnonKey.slice(0, 20) + '...' : '(empty)');
} else {
  console.log('[Supabase] OK — URL:', supabaseUrl, '| Key starts with:', supabaseAnonKey.slice(0, 10) + '...');
}

// Create Supabase client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    // Fail fast — don't hang on network issues
    fetch: (url, options) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
      return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timeout));
    },
  },
});

export default supabase;
