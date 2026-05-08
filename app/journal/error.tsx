'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { AppNav } from '@/components/nav/app-nav';

export default function JournalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error('[JOURNAL ERROR]', error); }, [error]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <AppNav />
      <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <div className="w-12 h-12 rounded-xl bg-[#FF3B5C]/10 border border-[#FF3B5C]/20 flex items-center justify-center mb-4">
          <AlertTriangle className="w-5 h-5 text-[#FF3B5C]" />
        </div>
        <p className="text-[17px] font-extrabold tracking-tight text-[var(--text-primary)] mb-1">
          Failed to load Journal
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-6 max-w-[260px]">
          {error.message || 'An error occurred while loading your trades.'}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] border border-[var(--border-strong)] text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      </div>
    </div>
  );
}
