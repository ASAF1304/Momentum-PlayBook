// components/nav/app-nav.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen, Layers, LineChart, List, LogOut, Settings, TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
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

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <nav
      className="sticky top-0 z-40 bg-[#040507]/85 backdrop-blur-xl"
      style={{
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
          <div className="flex flex-col leading-none">
            <span className="text-[14px] font-extrabold tracking-tight">Momentum Playbook</span>
            <span className="text-[9px] text-zinc-600 tracking-[0.22em] uppercase font-semibold mt-0.5">
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
                  'relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold tracking-tight transition-colors',
                  active
                    ? 'text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {active && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-gradient-to-r from-[#22D3EE] to-[#10F088]"
                    style={{ boxShadow: '0 0 8px rgba(34,211,238,0.6)' }}
                  />
                )}
              </Link>
            );
          })}

          <Link
            href="/settings"
            className={cn(
              'p-1.5 rounded-md transition-colors ml-1',
              pathname === '/settings'
                ? 'text-[#22D3EE] bg-[#22D3EE]/10'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]',
            )}
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 rounded-md text-zinc-500 hover:text-[#FF3B5C] hover:bg-[#FF3B5C]/[0.06] transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
