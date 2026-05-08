'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error('[APP ERROR]', error); }, [error]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4 font-[Manrope,ui-sans-serif,system-ui,sans-serif]">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-xl bg-[#FF3B5C]/10 border border-[#FF3B5C]/20 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-5 h-5 text-[#FF3B5C]" />
        </div>
        <p className="text-[17px] font-extrabold tracking-tight text-[var(--text-primary)] mb-1">
          Something went wrong
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-6">
          {error.message || 'An unexpected error occurred. Please try again.'}
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
