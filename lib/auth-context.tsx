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
import { supabase, type UserProfile, type Subscription } from './supabase-client';

// 5-minute in-memory cache — avoids re-fetching on every navigation
const profileCache = new Map<string, { profile: UserProfile; ts: number }>();
const subCache     = new Map<string, { sub: Subscription | null; ts: number }>();
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
  subscription: Subscription | null;
  loading: boolean;
  profileLoading: boolean;
  subscriptionLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  subscription: null,
  loading: true,
  profileLoading: false,
  subscriptionLoading: false,
  signOut: async () => {},
  refreshProfile: async () => {},
  refreshSubscription: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,                setUser]                = useState<User | null>(null);
  const [profile,             setProfile]             = useState<UserProfile | null>(null);
  const [subscription,        setSubscription]        = useState<Subscription | null>(null);
  const [loading,             setLoading]             = useState(true);
  const [profileLoading,      setProfileLoading]      = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const inFlight    = useRef(false);
  const subInFlight = useRef(false);
  const isResolved  = useRef(false);

  const markResolved = useCallback(() => {
    isResolved.current = true;
    setLoading(false);
  }, []);

  const fetchSubscription = useCallback(async (userId: string, force = false) => {
    if (!force) {
      const cached = subCache.get(userId);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        setSubscription(cached.sub);
        return;
      }
    }
    if (subInFlight.current) return;
    subInFlight.current = true;
    setSubscriptionLoading(true);
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      const sub = (data as Subscription | null) ?? null;
      subCache.set(userId, { sub, ts: Date.now() });
      setSubscription(sub);
    } catch (err) {
      console.error('[AUTH-FAIL] fetchSubscription threw:', err);
    } finally {
      subInFlight.current = false;
      setSubscriptionLoading(false);
    }
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
    setProfileLoading(true);
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
      setProfileLoading(false);
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

    // getSession() reads from localStorage — no network call, so UI unblocks instantly.
    // A background getUser() call then verifies the JWT with the server; if tampered,
    // the user is signed out silently. This balances performance and security.
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) console.error('[AUTH-FAIL] getSession() error:', error.message);
        const u = session?.user ?? null;
        setUser(u);
        markResolved(); // unblock UI immediately
        if (u) {
          void fetchProfile(u.id);
          void fetchSubscription(u.id);
          // Background server-side verification — signs out if JWT is invalid/tampered
          void supabase.auth.getUser().then(({ error: userErr }) => {
            if (userErr) {
              console.warn('[AUTH] getUser() failed — signing out:', userErr.message);
              void supabase.auth.signOut();
            }
          });
        }
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
            void fetchProfile(u.id);
            void fetchSubscription(u.id);
          } else {
            setProfile(null);
            setSubscription(null);
            profileCache.clear();
            subCache.clear();
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
    subCache.clear();
    try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
    setUser(null);
    setProfile(null);
    setSubscription(null);
  };

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id, true);
  }, [user, fetchProfile]);

  const refreshSubscription = useCallback(async () => {
    if (user) await fetchSubscription(user.id, true);
  }, [user, fetchSubscription]);

  return (
    <AuthContext.Provider value={{
      user, profile, subscription, loading, profileLoading, subscriptionLoading,
      signOut, refreshProfile, refreshSubscription,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
