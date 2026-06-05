import type { ReactNode } from 'react';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

const LEGAL_LINKS = [
  { href: '/terms',         label: 'Terms of Service' },
  { href: '/privacy',       label: 'Privacy Policy' },
  { href: '/cookies',       label: 'Cookie Policy' },
  { href: '/accessibility', label: 'Accessibility' },
];

export default function LegalEnLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="border-b border-[var(--border-subtle)] px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-black" strokeWidth={3.5} />
          </div>
          <span className="text-[14px] font-extrabold tracking-tight text-[var(--text-primary)]">
            Momentum Playbook
          </span>
        </Link>
      </header>

      <main className="max-w-[780px] mx-auto px-6 py-12">
        {children}
      </main>

      <footer className="border-t border-[var(--border-subtle)] px-6 py-6 text-center">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-[var(--text-faint)]">
          {LEGAL_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-[var(--text-secondary)] transition-colors">
              {label}
            </Link>
          ))}
          <Link href="/pricing"  className="hover:text-[var(--text-secondary)] transition-colors">Pricing</Link>
          <Link href="/contact"  className="hover:text-[var(--text-secondary)] transition-colors">Contact</Link>
        </nav>
      </footer>
    </div>
  );
}
