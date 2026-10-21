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
  /** Changes the name other players see. Returns an error message, or null on success. */
  updateUsername: (name: string) => Promise<string | null>;
  deleteAccount: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Supabase sends the player back here after OAuth / magic link. Query params, not the
// hash, carry the result (PKCE), so HashRouter routes are untouched.
const redirectTo = () => window.location.origin + window.location.pathname;

export const RETURN_KEY = 'wordchunk_return_to';

/**
 * Sign-in leaves the app (Google / an emailed link) and comes back to the start page, which would
 * lose a challenge link the player opened. Remember where they were; App sends them back.
 */
let nextReturn: string | null = null;

/** Lets a sign-in prompt say where the player should land afterwards (e.g. '#/play'), instead of the page they are on. */
export function setNextReturn(hash: string | null) {
  nextReturn = hash;
}

function rememberReturn() {
  try {
    const hash = nextReturn ?? window.location.hash;
    nextReturn = null;
    if (/^#\/(c\/|challenge|play)/.test(hash)) localStorage.setItem(RETURN_KEY, hash);
    else localStorage.removeItem(RETURN_KEY);
  } catch {
    // storage unavailable: they land on the menu instead
  }
}

function nameOf(user: User | null): string {
  if (!user) return 'Guest';
  const meta = user.user_metadata ?? {};
  return meta.full_name || meta.name || user.email?.split('@')[0] || 'Player';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(supabase !== null);
  const [profileName, setProfileName] = useState<string | null>(null);

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

  // The name opponents see lives on the profile, so it can be changed without touching the login.
  useEffect(() => {
    if (!supabase || !userId) {
      setProfileName(null);
      return;
    }
    let live = true;
    supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (live) setProfileName(data?.username?.trim() || null);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  const updateUsername = useCallback(
    async (name: string) => {
      if (!supabase || !userId) return 'Sign in first.';
      const clean = name.trim().replace(/\s+/g, ' ');
      if (clean.length < 2 || clean.length > 24) return 'Use 2 to 24 characters.';
      // upsert: an account that predates the profile trigger has no row yet
      const { error } = await supabase.from('profiles').upsert({ id: userId, username: clean });
      if (error) return error.message;
      setProfileName(clean);
      return null;
    },
    [userId],
  );

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return 'Sign-in is not configured.';
    rememberReturn();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo() },
    });
    return error?.message ?? null;
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    if (!supabase) return 'Sign-in is not configured.';
    rememberReturn();
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
      displayName: profileName || nameOf(user),
      signInWithGoogle,
      signInWithEmail,
      signOut,
      updateUsername,
      deleteAccount,
    }),
    [user, loading, profileName, signInWithGoogle, signInWithEmail, signOut, updateUsername, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
