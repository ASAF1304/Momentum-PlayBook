// components/nav/app-nav.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen, Layers, LineChart, List, LogOut, Moon, Settings, ShieldAlert, Sun, TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/',          label: 'Dashboard', icon: LineChart },
  { href: '/journal',   label: 'Journal',   icon: BookOpen  },
  { href: '/watchlist', label: 'Watchlist', icon: List      },
  { href: '/playbook',  label: 'Playbook',  icon: Layers    },
];

export function AppNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { signOut, profile } = useAuth();
  const { effectiveTheme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <nav
      className="sticky top-0 z-40 backdrop-blur-xl"
      style={{
        background: 'var(--nav-bg)',
        borderBottom: '1px solid transparent',
        borderImageSource: 'linear-gradient(90deg, rgba(34,211,238,0.18) 0%, rgba(16,240,136,0.10) 50%, transparent 100%)',
        borderImageSlice: 1,
      }}
    >
      <div className="max-w-[1400px] mx-auto px-6 h-[58px] flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="relative w-7 h-7 rounded-md bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center transition-transform duration-300 group-hover:[animation:logo-spin_0.6s_ease-in-out_both]"
          >
            <TrendingUp className="w-3.5 h-3.5 text-black" strokeWidth={3.5} />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-[14px] font-extrabold tracking-tight text-[var(--text-primary)]">Momentum Playbook</span>
            <span className="text-[9px] text-[var(--text-faint)] tracking-[0.22em] uppercase font-semibold mt-0.5">
              {profile?.display_name ?? 'Stage 2 only'}
            </span>
          </div>
        </Link>

        {/* Links + actions */}
        <div className="flex items-center gap-0.5">
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
                <span className="hidden sm:inline">{label}</span>
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
              aria-label="Admin"
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
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-elevated)] transition-all"
            aria-label={effectiveTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="relative block w-4 h-4">
              <Sun
                className={cn(
                  'absolute inset-0 w-4 h-4 transition-all duration-300',
                  effectiveTheme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-75',
                )}
              />
              <Moon
                className={cn(
                  'absolute inset-0 w-4 h-4 transition-all duration-300',
                  effectiveTheme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75',
                )}
              />
            </span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[#FF3B5C] hover:bg-[#FF3B5C]/[0.06] transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
