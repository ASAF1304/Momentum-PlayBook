// lib/auth-context.tsx
//
// AuthProvider wraps the whole app. Exposes user, profile, loading, signOut,
// and refreshProfile via the useAuth() hook.

'use client';

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, type UserProfile } from './supabase-client';

// 5-minute in-memory profile cache — avoids re-fetching on every navigation
const profileCache = new Map<string, { profile: UserProfile; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

// Nukes all Supabase auth data from localStorage. Call when the session is
// corrupt or timed out so the user gets a clean slate on next login.
export async function clearAuthStorage() {
  // scope: 'local' invalidates only the current device's session, leaving
  // other active sessions (other devices/browsers) untouched.
  try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('sb-')) localStorage.removeItem(k);
    });
  } catch {}
  profileCache.clear();
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight   = useRef(false);
  const isResolved = useRef(false); // tracks whether auth has resolved (for timeout)

  const markResolved = useCallback(() => {
    isResolved.current = true;
    setLoading(false);
  }, []);

  const fetchProfile = useCallback(async (userId: string, force = false) => {
    if (!force) {
      const cached = profileCache.get(userId);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        setProfile(cached.profile);
        return;
      }
    }
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        console.error('[AUTH-FAIL] fetchProfile DB error:', error.message);
        return;
      }
      const p = (data as UserProfile) ?? null;
      if (p) profileCache.set(userId, { profile: p, ts: Date.now() });
      setProfile(p);
    } catch (err) {
      console.error('[AUTH-FAIL] fetchProfile threw:', err);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    // 10-second escape hatch — if auth hasn't resolved (loading is still true),
    // nuke the session and redirect to /login so the user is never permanently stuck.
    const timer = setTimeout(async () => {
      if (!isResolved.current) {
        console.error('[AUTH-FAIL] Auth timed out after 10s — clearing session and redirecting');
        await clearAuthStorage();
        window.location.replace('/login?reason=timeout');
      }
    }, 10_000);

    // getSession() reads from localStorage — no network call.
    // We call setLoading(false) immediately after learning the session state,
    // BEFORE awaiting fetchProfile — so a slow/hung DB call never blocks the UI.
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) console.error('[AUTH-FAIL] getSession() error:', error.message);
        const u = session?.user ?? null;
        setUser(u);
        markResolved(); // unblock UI immediately
        if (u) void fetchProfile(u.id); // fire-and-forget
      })
      .catch(err => {
        console.error('[AUTH-FAIL] getSession() threw:', err);
        markResolved(); // always unblock even on error
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        try {
          // TOKEN_REFRESHED fires frequently; no profile re-fetch needed
          if (event === 'TOKEN_REFRESHED') return;
          const u = session?.user ?? null;
          setUser(u);
          markResolved(); // unblock UI immediately
          if (u) {
            void fetchProfile(u.id); // fire-and-forget
          } else {
            setProfile(null);
            profileCache.clear();
          }
        } catch (err) {
          console.error('[AUTH-FAIL] onAuthStateChange threw:', err);
          markResolved();
        }
      },
    );

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [fetchProfile, markResolved]);

  const signOut = async () => {
    profileCache.clear();
    // scope: 'local' — sign out only this device, keep other devices' sessions active.
    try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id, true);
  }, [user, fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
