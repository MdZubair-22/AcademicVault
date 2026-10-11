import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { localSupabase, setLocalAuthUser } from './localSupabase';

// AcademicVault storage architecture:
// - Supabase Auth is ALWAYS used for signup/login/session/password reset.
// - All academic/profile/application data and files use the local adapter by default.
// - Set VITE_DATA_MODE=supabase only when the full cloud data mode is intentionally enabled.
const mode = (import.meta.env.VITE_DATA_MODE || 'local').toLowerCase();
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const hasAuthConfig = !!url && !!key && !url.includes('your_supabase_project_url') && !key.includes('your_supabase_anon_key');
const cloud = hasAuthConfig ? createClient(url!, key!) : null;

function syncUser(user: any | null) {
  setLocalAuthUser(user);
  return user;
}

// In local mode, expose Supabase Auth but route every non-auth operation locally.
const auth = {
  async getUser() {
    if (!cloud) return { data: { user: null }, error: { message: 'Add your Supabase URL and publishable key to .env for authentication.' } };
    const result = await cloud.auth.getUser();
    syncUser(result.data.user);
    return result;
  },

  async getSession() {
    if (!cloud) return { data: { session: null }, error: { message: 'Add your Supabase URL and publishable key to .env for authentication.' } };
    const result = await cloud.auth.getSession();
    syncUser(result.data.session?.user ?? null);
    return result;
  },

  onAuthStateChange(callback: any) {
    if (!cloud) {
      callback('SIGNED_OUT', null);
      return { data: { subscription: { unsubscribe() {} } } };
    }
    const result = cloud.auth.onAuthStateChange((event, session) => {
      syncUser(session?.user ?? null);
      callback(event, session);
    });
    return result;
  },

  async signUp(args: any) {
    if (!cloud) return { data: { user: null, session: null }, error: { message: 'Supabase authentication is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.' } };
    const result = await cloud.auth.signUp(args);
    syncUser(result.data.user);
    return result;
  },

  async signInWithPassword(args: any) {
    if (!cloud) return { data: { user: null, session: null }, error: { message: 'Supabase authentication is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.' } };
    const result = await cloud.auth.signInWithPassword(args);
    syncUser(result.data.user);
    return result;
  },

  async signOut() {
    if (!cloud) { syncUser(null); return { error: null }; }
    const result = await cloud.auth.signOut();
    syncUser(null);
    return result;
  },

  async resetPasswordForEmail(email: string, options?: any) {
    if (!cloud) return { error: { message: 'Supabase authentication is not configured.' } };
    return cloud.auth.resetPasswordForEmail(email, options);
  },

  async updateUser(attributes: any) {
    if (!cloud) return { data: { user: null }, error: { message: 'Supabase authentication is not configured.' } };
    const result = await cloud.auth.updateUser(attributes);
    syncUser(result.data.user);
    return result;
  },
};

export const supabase: any = {
  auth,
  // Local mode: database-like queries are backed by localStorage/IndexedDB.
  // Feedback is intentionally routed to Supabase when configured so user reports are not lost in local-only mode.
  from: (table: string) => {
    const useCloud = (mode === 'supabase' || table === 'feedback') && !!cloud;
    return useCloud ? cloud.from(table) : localSupabase.from(table);
  },
  storage: {
    from: (bucket: string) => mode === 'supabase' && cloud ? cloud.storage.from(bucket) : localSupabase.storage.from(bucket),
  },
  rpc: (name: string, args?: any) => mode === 'supabase' && cloud ? cloud.rpc(name, args) : localSupabase.rpc(name, args),
};

export const DATA_MODE = mode === 'supabase' && cloud ? 'supabase' : 'local';
export const AUTH_MODE = cloud ? 'supabase' : 'unconfigured';
