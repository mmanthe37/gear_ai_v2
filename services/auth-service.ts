/**
 * Gear AI CoPilot - Authentication Service
 * 
 * Handles Supabase Auth (email/password) and syncs user profile to public.users
 */

import { supabase } from '../lib/supabase';
import { User, SignUpData, AuthCredentials } from '../types/user';

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

  // Create user profile in public.users
  const { data: userProfile, error: profileError } = await supabase
    .from('users')
    .insert({
      user_id: authData.user.id,
      email: authData.user.email || '',
      display_name: display_name || null,
      tier: 'free',
      subscription_status: 'none',
      last_login_at: new Date().toISOString(),
      preferences: {},
    })
    .select()
    .single();

  if (profileError) {
    console.error('Error creating user profile:', profileError);
  }

  return { user: userProfile || null };
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

  // Fetch or auto-create user profile (handles accounts created before the DB trigger existed)
  let { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', data.user.id)
    .single();

  if (!userProfile) {
    console.log('[Auth] No profile found, creating one for:', data.user.id);
    const { data: newProfile, error: createError } = await supabase
      .from('users')
      .insert({
        user_id: data.user.id,
        email: data.user.email || '',
        display_name: data.user.user_metadata?.display_name || null,
        tier: 'free',
        subscription_status: 'none',
        last_login_at: new Date().toISOString(),
        preferences: {},
      })
      .select()
      .single();
    if (createError) {
      console.error('[Auth] Failed to create profile:', createError.message);
    } else {
      userProfile = newProfile;
    }
  } else {
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('user_id', data.user.id);
  }

  return { user: userProfile || null };
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
    console.error('Error fetching user:', error);
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
