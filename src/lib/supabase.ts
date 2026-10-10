import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Null when the env vars are missing, in which case the app runs guest-only
 * (localStorage) and no sign-in UI is shown.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          // PKCE returns `?code=` in the query string. The default implicit flow returns
          // `#access_token=` in the hash, which collides with HashRouter's routes.
          flowType: 'pkce',
        },
      })
    : null;

export const authEnabled = supabase !== null;
