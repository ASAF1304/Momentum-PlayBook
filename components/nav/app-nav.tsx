// components/nav/app-nav.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen, Brain, Layers, LineChart, List, LogOut, Menu, Moon,
  Settings, ShieldAlert, Sun, TrendingUp, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/',          label: 'Dashboard', icon: LineChart },
  { href: '/journal',   label: 'Journal',   icon: BookOpen  },
  { href: '/watchlist', label: 'Watchlist', icon: List      },
  { href: '/playbook',  label: 'Playbook',  icon: Layers    },
  { href: '/thoughts',  label: 'Thoughts',  icon: Brain     },
];

export function AppNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { signOut, profile } = useAuth();
  const { effectiveTheme, toggleTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Close on outside click
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [drawerOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const handleLogout = async () => {
    setDrawerOpen(false);
    await signOut();
    router.push('/login');
  };

  return (
    <>
      <nav
        className="sticky top-0 z-40 backdrop-blur-xl"
        style={{
          background: 'var(--nav-bg)',
          borderBottom: '1px solid transparent',
          borderImageSource: 'linear-gradient(90deg, rgba(34,211,238,0.18) 0%, rgba(16,240,136,0.10) 50%, transparent 100%)',
          borderImageSlice: 1,
        }}
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-[58px] flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-7 h-7 rounded-md bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center transition-transform duration-300 group-hover:[animation:logo-spin_0.6s_ease-in-out_both]">
              <TrendingUp className="w-3.5 h-3.5 text-black" strokeWidth={3.5} />
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-[14px] font-extrabold tracking-tight text-[var(--text-primary)]">Momentum Playbook</span>
              <span className="text-[9px] text-[var(--text-faint)] tracking-[0.22em] uppercase font-semibold mt-0.5">
                {profile?.display_name ?? 'Stage 2 only'}
              </span>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden sm:flex items-center gap-0.5">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold tracking-tight transition-colors',
                    active
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                  {active && (
                    <span
                      className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-gradient-to-r from-[#22D3EE] to-[#10F088]"
                      style={{ boxShadow: '0 0 8px rgba(34,211,238,0.6)' }}
                    />
                  )}
                </Link>
              );
            })}

            {profile?.is_admin && (
              <Link
                href="/admin/users"
                className={cn(
                  'p-1.5 rounded-md transition-colors ml-1',
                  pathname.startsWith('/admin')
                    ? 'text-[#FF9F0A] bg-[#FF9F0A]/10'
                    : 'text-[var(--text-muted)] hover:text-[#FF9F0A] hover:bg-[#FF9F0A]/10',
                )}
                aria-label="Admin Panel"
                title="Admin Panel"
              >
                <ShieldAlert className="w-4 h-4" />
              </Link>
            )}

            <Link
              href="/settings"
              className={cn(
                'p-1.5 rounded-md transition-colors ml-1',
                pathname === '/settings'
                  ? 'text-[#22D3EE] bg-[#22D3EE]/10'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-elevated)]',
              )}
              aria-label="הגדרות"
              title="הגדרות"
            >
              <Settings className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-elevated)] transition-all"
              aria-label="החלף ערכת נושא"
              title="החלף ערכת נושא"
            >
              <span className="relative block w-4 h-4">
                <Sun className={cn('absolute inset-0 w-4 h-4 transition-all duration-300', effectiveTheme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-75')} />
                <Moon className={cn('absolute inset-0 w-4 h-4 transition-all duration-300', effectiveTheme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75')} />
              </span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[#FF3B5C] hover:bg-[#FF3B5C]/[0.06] transition-colors"
              aria-label="התנתקות"
              title="התנתקות"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile: theme + hamburger */}
          <div className="flex sm:hidden items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-md text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-elevated)] transition-all"
              aria-label="Toggle theme"
            >
              <span className="relative block w-4 h-4">
                <Sun className={cn('absolute inset-0 w-4 h-4 transition-all duration-300', effectiveTheme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-75')} />
                <Moon className={cn('absolute inset-0 w-4 h-4 transition-all duration-300', effectiveTheme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75')} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

        </div>
      </nav>

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />

          {/* Drawer panel */}
          <div
            ref={drawerRef}
            className="absolute right-0 top-0 bottom-0 w-[min(280px,85vw)] flex flex-col"
            style={{
              background: 'var(--bg-surface)',
              borderLeft: '1px solid var(--border-subtle)',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
            }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 h-[58px] border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center">
                  <TrendingUp className="w-3 h-3 text-black" strokeWidth={3.5} />
                </div>
                <span className="text-[13px] font-extrabold text-[var(--text-primary)]">Menu</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nav links */}
            <div className="flex-1 overflow-y-auto py-3 px-3">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-[8px] text-[14px] font-semibold transition-colors mb-0.5',
                      active
                        ? 'text-[#22D3EE] bg-[#22D3EE]/[0.08]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {label}
                  </Link>
                );
              })}

              <div className="my-2 border-t border-[var(--border-subtle)]" />

              {profile?.is_admin && (
                <Link
                  href="/admin/users"
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-[8px] text-[14px] font-semibold transition-colors mb-0.5',
                    pathname.startsWith('/admin')
                      ? 'text-[#FF9F0A] bg-[#FF9F0A]/10'
                      : 'text-[var(--text-muted)] hover:text-[#FF9F0A] hover:bg-[#FF9F0A]/10',
                  )}
                >
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  Admin Panel
                </Link>
              )}

              <Link
                href="/settings"
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-[8px] text-[14px] font-semibold transition-colors mb-0.5',
                  pathname === '/settings'
                    ? 'text-[#22D3EE] bg-[#22D3EE]/[0.08]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
                )}
              >
                <Settings className="w-4 h-4 flex-shrink-0" />
                Settings
              </Link>
            </div>

            {/* Footer: username + logout */}
            <div className="border-t border-[var(--border-subtle)] px-4 py-4">
              {profile?.display_name && (
                <p className="text-[11px] text-[var(--text-faint)] font-mono mb-3 truncate">
                  {profile.display_name}
                </p>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[8px] text-[13px] font-semibold text-[var(--text-muted)] hover:text-[#FF3B5C] hover:bg-[#FF3B5C]/[0.06] transition-colors"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
