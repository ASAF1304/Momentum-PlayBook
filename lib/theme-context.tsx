'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type ThemePref = 'dark' | 'light' | 'system';
type EffectiveTheme = 'dark' | 'light';

interface ThemeCtx {
  theme: ThemePref;
  effectiveTheme: EffectiveTheme;
  setTheme: (t: ThemePref) => void;
  toggleTheme: () => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: 'system',
  effectiveTheme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

function resolveEffective(pref: ThemePref): EffectiveTheme {
  if (pref === 'dark')  return 'dark';
  if (pref === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyToDOM(eff: EffectiveTheme) {
  document.documentElement.setAttribute('data-theme', eff);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>('system');
  const [effectiveTheme, setEffective] = useState<EffectiveTheme>('dark');

  useEffect(() => {
    const stored = (localStorage.getItem('theme') ?? 'system') as ThemePref;
    const eff = resolveEffective(stored);
    setThemeState(stored);
    setEffective(eff);
    applyToDOM(eff);

    // Track system preference changes while on "system" setting
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      setThemeState(prev => {
        if (prev !== 'system') return prev;
        const newEff = mq.matches ? 'light' : 'dark';
        setEffective(newEff);
        applyToDOM(newEff);
        return prev;
      });
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setTheme = (t: ThemePref) => {
    localStorage.setItem('theme', t);
    const eff = resolveEffective(t);
    setThemeState(t);
    setEffective(eff);
    applyToDOM(eff);
  };

  const toggleTheme = () => {
    setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <Ctx.Provider value={{ theme, effectiveTheme, setTheme, toggleTheme }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
