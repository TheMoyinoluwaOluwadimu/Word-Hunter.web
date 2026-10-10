import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { clearLocalData, notifyLocalDataChanged } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { syncOnSignIn } from '../lib/sync';

interface AuthContextValue {
  /** False when Supabase isn't configured: the app is guest-only and shows no sign-in UI. */
  enabled: boolean;
  user: User | null;
  /** True until the first session check finishes. */
  loading: boolean;
  displayName: string;
  /** Returns an error message, or null on success. */
  signInWithGoogle: () => Promise<string | null>;
  signInWithEmail: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Supabase sends the player back here after OAuth / magic link. Query params, not the
// hash, carry the result (PKCE), so HashRouter routes are untouched.
const redirectTo = () => window.location.origin + window.location.pathname;

function nameOf(user: User | null): string {
  if (!user) return 'Guest';
  const meta = user.user_metadata ?? {};
  return meta.full_name || meta.name || user.email?.split('@')[0] || 'Player';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(supabase !== null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Merge guest progress into the account once per sign-in. Keyed on the id (not the
  // user object) so token refreshes don't re-run it.
  const userId = user?.id;
  useEffect(() => {
    if (userId) void syncOnSignIn(userId);
  }, [userId]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return 'Sign-in is not configured.';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo() },
    });
    return error?.message ?? null;
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    if (!supabase) return 'Sign-in is not configured.';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    // Progress lives in the account now. Wipe it here so the next person on this
    // device (or the next account) doesn't inherit it.
    clearLocalData();
    notifyLocalDataChanged();
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!supabase) return 'Sign-in is not configured.';
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return error.message;
    await signOut();
    return null;
  }, [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      enabled: supabase !== null,
      user,
      loading,
      displayName: nameOf(user),
      signInWithGoogle,
      signInWithEmail,
      signOut,
      deleteAccount,
    }),
    [user, loading, signInWithGoogle, signInWithEmail, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
