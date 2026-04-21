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
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);

  const fetchProfile = useCallback(async (userId: string, force = false) => {
    // Serve from cache if fresh
    if (!force) {
      const cached = profileCache.get(userId);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        setProfile(cached.profile);
        return;
      }
    }
    // Prevent concurrent duplicate fetches
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      console.time('[AUTH] fetchProfile (user_profiles select)');
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      console.timeEnd('[AUTH] fetchProfile (user_profiles select)');
      const p = (data as UserProfile) ?? null;
      if (p) profileCache.set(userId, { profile: p, ts: Date.now() });
      setProfile(p);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    // getSession() reads the JWT from localStorage — no network round-trip (~0ms).
    // Middleware already validates the token server-side on every request, so
    // an extra client-side getUser() call is redundant and slow (~779ms).
    console.time('[AUTH] getSession() initial');
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.timeEnd('[AUTH] getSession() initial');
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        await fetchProfile(u.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // TOKEN_REFRESHED fires frequently and doesn't require a profile re-fetch
        if (event === 'TOKEN_REFRESHED') return;
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          await fetchProfile(u.id);
        } else {
          setProfile(null);
          profileCache.clear();
        }
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = async () => {
    profileCache.clear();
    await supabase.auth.signOut();
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
