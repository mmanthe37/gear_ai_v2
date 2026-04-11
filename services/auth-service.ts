/**
 * Gear AI CoPilot - Authentication Service
 * 
 * Handles Supabase Auth (email/password) and syncs user profile to public.users
 */

import { supabase } from '../lib/supabase';
import { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { User, SignUpData, AuthCredentials } from '../types/user';

export function buildFallbackUser(authUser: SupabaseAuthUser): User {
  const now = new Date().toISOString();
  return {
    user_id: authUser.id,
    email: authUser.email || '',
    display_name: authUser.user_metadata?.display_name ?? undefined,
    tier: 'free',
    subscription_status: 'none',
    created_at: now,
    updated_at: now,
    last_login_at: now,
    preferences: {},
  };
}

async function ensureUserProfile(authUser: SupabaseAuthUser): Promise<User> {
  const { data: existingProfile, error: existingError } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to fetch user profile: ${existingError.message}`);
  }

  if (existingProfile) {
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('user_id', authUser.id);
    return existingProfile;
  }

  const fallback = buildFallbackUser(authUser);
  const { data: newProfile, error: createError } = await supabase
    .from('users')
    .insert({
      user_id: authUser.id,
      email: authUser.email || '',
      display_name: authUser.user_metadata?.display_name || null,
      tier: 'free',
      subscription_status: 'none',
      last_login_at: new Date().toISOString(),
      preferences: {},
    })
    .select()
    .single();

  if (createError) {
    console.error('[Auth] Failed to create profile:', createError.message);
    return fallback;
  }

  return newProfile || fallback;
}

/**
 * Sign up a new user with email and password
 */
export async function signUp(signUpData: SignUpData): Promise<{ user: User | null }> {
  const { email, password, display_name } = signUpData;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name } },
  });

  if (authError) throw new Error(authError.message);
  if (!authData.user) throw new Error('Sign up failed');
  const userProfile = await ensureUserProfile(authData.user);
  return { user: userProfile };
}

/**
 * Sign in an existing user with email and password
 */
export async function signIn(credentials: AuthCredentials): Promise<{ user: User | null }> {
  const { email, password } = credentials;

  console.log('[Auth] Attempting sign in for:', email);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('[Auth] signInWithPassword error:', error.message);
    throw new Error(error.message);
  }
  console.log('[Auth] Sign in successful, user:', data.user.id);

  const userProfile = await ensureUserProfile(data.user);
  return { user: userProfile };
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

/**
 * Get current Supabase session
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw new Error(error.message);
}

/**
 * Get user profile by Supabase user ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching user:', error);
    }
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser && authUser.id === userId) {
      return buildFallbackUser(authUser);
    }
    return null;
  }
  return data;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: { display_name?: string; avatar_url?: string }
): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update profile: ${error.message}`);
  return data;
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  userId: string,
  preferences: import('../types/user').UserPreferences
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ preferences, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to update preferences: ${error.message}`);
}

/**
 * Delete user account and all associated data (GDPR-compliant cascade)
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  // Cascade delete is handled by FK constraints on vehicles, chat_sessions, etc.
  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('user_id', userId);

  if (deleteError) throw new Error(`Failed to delete account: ${deleteError.message}`);

  // Sign out of Supabase Auth session
  await supabase.auth.signOut();
}
