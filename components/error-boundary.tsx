'use client';

import { Component, type ReactNode } from 'react';
import { clearAuthStorage } from '@/lib/auth-context';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error) {
    console.error('[CRASH] Unhandled error caught by ErrorBoundary:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#040507] px-6">
        <div className="w-full max-w-[420px] rounded-2xl border border-white/[0.08] bg-white/[0.025] p-8 text-center">
          <div className="text-[32px] mb-3">⚠️</div>
          <h1 className="text-[18px] font-extrabold text-zinc-100 mb-2">
            Something went wrong
          </h1>
          <p className="text-xs text-zinc-500 mb-1">
            The app crashed unexpectedly.
          </p>
          {this.state.message && (
            <p className="text-xs font-mono text-zinc-600 mb-5 px-3 py-2 rounded-[6px] bg-black/20 break-all">
              {this.state.message}
            </p>
          )}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-[10px] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black text-xs font-extrabold uppercase tracking-wider"
            >
              Reload page
            </button>
            <button
              onClick={async () => {
                await clearAuthStorage();
                window.location.replace('/login?reason=cleared');
              }}
              className="w-full py-2.5 rounded-[10px] border border-white/[0.08] text-zinc-400 text-xs font-semibold hover:text-zinc-200 hover:border-white/20 transition-colors"
            >
              Clear session &amp; go to login
            </button>
          </div>
        </div>
      </div>
    );
  }
}
