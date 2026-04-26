import type { ReactNode } from 'react';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] font-[Manrope,ui-sans-serif,system-ui,sans-serif]" dir="rtl">
      {/* Header */}
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

      {/* Content */}
      <main className="max-w-[780px] mx-auto px-6 py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] px-6 py-6 text-center">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-[var(--text-faint)]">
          <Link href="/legal/disclaimer" className="hover:text-[var(--text-secondary)] transition-colors">כתב ויתור</Link>
          <Link href="/legal/terms"      className="hover:text-[var(--text-secondary)] transition-colors">תנאי שימוש</Link>
          <Link href="/legal/privacy"    className="hover:text-[var(--text-secondary)] transition-colors">מדיניות פרטיות</Link>
        </nav>
      </footer>
    </div>
  );
}
