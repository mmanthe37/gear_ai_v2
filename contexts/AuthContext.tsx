/**
 * Gear AI CoPilot - Authentication Context
 * 
 * Manages global authentication state using Supabase Auth.
 * Also tracks backend availability so the UI can gate on it.
 */

import React, { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, AuthCredentials, SignUpData } from '../types/user';
import * as authService from '../services/auth-service';
import type { BackendIssue } from '../components/BackendStatus';

type BackendStatus = 'checking' | 'ok' | BackendIssue;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  backendStatus: BackendStatus;
  retryConnection: () => void;
  signIn: (credentials: AuthCredentials) => Promise<void>;
  signUp: (signUpData: SignUpData) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

/** Returns true when the error looks like a network / DNS failure. */
function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('abort') ||
    msg.includes('timeout') ||
    msg.includes('failed to fetch') ||
    msg.includes('could not resolve')
  );
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>(
    isSupabaseConfigured ? 'checking' : 'misconfigured',
  );

  const resolveUserFromSession = useCallback(async (authUser: SupabaseUser): Promise<User> => {
    try {
      const profile = await authService.getUserById(authUser.id);
      return profile || authService.buildFallbackUser(authUser);
    } catch (profileError) {
      console.error('[Auth] Failed to resolve user profile:', profileError);
      return authService.buildFallbackUser(authUser);
    }
  }, []);

  const bootstrap = useCallback(() => {
    if (!isSupabaseConfigured) {
      setBackendStatus('misconfigured');
      setLoading(false);
      return () => {};
    }

    setBackendStatus('checking');
    setLoading(true);

    // Safety timeout — never let the app hang on the loading screen
    const safetyTimeout = setTimeout(() => {
      console.warn('[Auth] Safety timeout reached — forcing loading to false');
      setBackendStatus((prev) => (prev === 'checking' ? 'unreachable' : prev));
      setLoading(false);
    }, 10_000);

    // Get initial session with full error handling
    supabase.auth.getSession()
      .then(async ({ data: { session: s } }) => {
        setBackendStatus('ok');
        setSession(s);
        if (s?.user) {
          const profile = await resolveUserFromSession(s.user);
          setUser(profile);
        } else {
          setUser(null);
        }
      })
      .catch((error) => {
        console.error('[Auth] getSession failed:', error);
        setBackendStatus(isNetworkError(error) ? 'unreachable' : 'ok');
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        clearTimeout(safetyTimeout);
        setLoading(false);
      });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        if (s?.user) {
          const profile = await resolveUserFromSession(s.user);
          setUser(profile);
        } else {
          setUser(null);
        }
        setBackendStatus('ok');
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [resolveUserFromSession]);

  useEffect(() => {
    return bootstrap();
  }, [bootstrap]);

  const retryConnection = useCallback(() => {
    bootstrap();
  }, [bootstrap]);

  const handleSignIn = async (credentials: AuthCredentials) => {
    try {
      setLoading(true);
      const { user: profile } = await authService.signIn(credentials);
      setUser(profile);
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (signUpData: SignUpData) => {
    try {
      setLoading(true);
      const { user: profile } = await authService.signUp(signUpData);
      setUser(profile);
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await authService.signOut();
      setSession(null);
      setUser(null);
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    backendStatus,
    retryConnection,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
