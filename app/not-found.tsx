import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4 font-[Manrope,ui-sans-serif,system-ui,sans-serif]">
      <div className="text-center max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-black" strokeWidth={3.5} />
          </div>
          <span className="text-[15px] font-extrabold tracking-tight text-[var(--text-primary)]">
            Momentum Playbook
          </span>
        </div>

        <p className="text-[64px] font-extrabold tracking-tighter text-[var(--text-primary)] leading-none mb-2">
          404
        </p>
        <p className="text-[15px] font-semibold text-[var(--text-secondary)] mb-1">
          Page not found
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-8">
          This page doesn&apos;t exist or was moved.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black text-xs font-extrabold uppercase tracking-wider hover:brightness-110 transition-all"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
