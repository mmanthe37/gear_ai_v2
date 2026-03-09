/**
 * Gear AI CoPilot - Supabase Client Configuration
 * 
 * Initializes Supabase client for database operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

/**
 * In-memory promise-chain lock that replaces Navigator LockManager.
 *
 * The default Supabase auth client uses `navigator.locks` on web for
 * cross-tab token synchronization. This causes deadlocks when
 * `onAuthStateChange` fires during `getSession()` because both
 * compete for the same exclusive lock, producing the error:
 *   "Acquiring an exclusive Navigator LockManager lock … timed out"
 *
 * This simple serialization lock avoids `navigator.locks` entirely
 * while still preventing concurrent auth operations from racing.
 */
const _lockChains: Record<string, Promise<unknown>> = {};

function webSafeLock<R>(name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  const chain = (_lockChains[name] ?? Promise.resolve())
    .catch(() => {})
    .then(fn);
  _lockChains[name] = chain;
  return chain;
}

// Create Supabase client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: AsyncStorage,
    lock: webSafeLock,
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
