// components/journal/pre-trade-gate.tsx
//
// Pillar 1 (Method Enforcement): a soft gate that prompts the trader to run the
// Validator BEFORE opening Add Trade. Persists a record of the last validator
// session per ticker in localStorage so we can show recency.
//
// We deliberately do NOT hard-block here — Asaf wants traders to be able to
// import broker trades and log historical positions. The gate is a friction
// step that nudges system behavior.

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ShieldCheck, X,
} from 'lucide-react';

const VALIDATOR_SESSIONS_KEY = 'mp_validator_sessions_v1';
const FRESH_MINUTES = 60;

interface ValidatorSession {
  ticker: string;
  at: number;       // timestamp ms
  passed: boolean;  // trend template passed
}

type Sessions = Record<string, ValidatorSession>;

function readSessions(): Sessions {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(VALIDATOR_SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as Sessions) : {};
  } catch {
    return {};
  }
}

export function recordValidatorSession(ticker: string, passed: boolean): void {
  if (typeof window === 'undefined') return;
  const upper = ticker.trim().toUpperCase();
  if (!upper) return;
  try {
    const cur = readSessions();
    cur[upper] = { ticker: upper, at: Date.now(), passed };
    localStorage.setItem(VALIDATOR_SESSIONS_KEY, JSON.stringify(cur));
  } catch { /* ignore quota */ }
}

interface PreTradeGateProps {
  onProceed: () => void;
  onClose:   () => void;
}

export function PreTradeGate({ onProceed, onClose }: PreTradeGateProps) {
  const [sessions, setSessions] = useState<Sessions>({});

  useEffect(() => { setSessions(readSessions()); }, []);

  const recent = useMemo(() => {
    const cutoff = Date.now() - FRESH_MINUTES * 60_000;
    return Object.values(sessions)
      .filter(s => s.at >= cutoff)
      .sort((a, b) => b.at - a.at)
      .slice(0, 3);
  }, [sessions]);

  const hasRecent = recent.length > 0;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[var(--modal-overlay)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] rounded-[16px] border border-[var(--border-strong)] bg-[var(--bg-modal)] overflow-hidden animate-modal-enter"
        style={{ boxShadow: 'var(--shadow-modal)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="h-[3px] w-full"
          style={{ background: hasRecent ? 'linear-gradient(to right, #22D3EE, #10F088)' : 'linear-gradient(to right, #F59E0B, #FF3B5C)' }}
        />

        <div className="p-7">
          <div className="flex items-start gap-4 mb-5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border"
              style={{
                background:  hasRecent ? '#10F08814' : '#F59E0B14',
                borderColor: hasRecent ? '#10F08840' : '#F59E0B40',
              }}
            >
              {hasRecent
                ? <ShieldCheck className="w-6 h-6 text-[#10F088]" strokeWidth={2} />
                : <AlertTriangle className="w-6 h-6 text-[#F59E0B]" strokeWidth={2} />}
            </div>

            <div className="flex-1">
              <div
                className="text-[10px] uppercase tracking-[0.2em] font-extrabold mb-1"
                style={{ color: hasRecent ? '#10F088' : '#F59E0B' }}
              >
                Pre-trade check
              </div>
              <h2 className="text-[19px] font-extrabold tracking-tight text-[var(--text-primary)] leading-tight">
                Have you validated this setup?
              </h2>
              <p className="text-[12.5px] text-[var(--text-muted)] mt-1.5 leading-snug">
                Minervini: never enter a trade without confirming the Trend Template.
                Validator takes 30 seconds and catches losers before they happen.
              </p>
            </div>
          </div>

          {hasRecent ? (
            <div className="rounded-[10px] border border-[#10F088]/25 bg-[#10F088]/[0.04] px-3 py-3 mb-5">
              <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#10F088] mb-2">
                Recently validated
              </div>
              <ul className="space-y-1.5">
                {recent.map(s => (
                  <li key={s.ticker} className="flex items-center justify-between text-[12.5px] font-mono">
                    <span className="flex items-center gap-2">
                      {s.passed
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-[#10F088]" />
                        : <X className="w-3.5 h-3.5 text-[#FF3B5C]" />}
                      <span className="font-extrabold text-[var(--text-primary)]">{s.ticker}</span>
                      <span className={s.passed ? 'text-[#10F088]' : 'text-[#FF3B5C]'}>
                        {s.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </span>
                    <span className="text-[var(--text-faint)]">{minutesAgo(s.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-[10px] border border-[#F59E0B]/25 bg-[#F59E0B]/[0.05] px-3 py-3 mb-5 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
              <div className="text-[12px] text-[var(--text-secondary)] leading-snug">
                No validator session in the last hour. Trades you log without validation
                will be flagged <span className="font-bold text-[#F59E0B]">Non-System</span>{' '}
                and excluded from your edge stats.
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <Link
              href="/"
              onClick={onClose}
              className="w-full py-3 rounded-[10px] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black text-xs font-extrabold uppercase tracking-wider hover:brightness-110 hover:-translate-y-px transition-all flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(34,211,238,0.25)]"
            >
              Open Validator
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              type="button"
              onClick={onProceed}
              className="w-full py-2.5 rounded-[10px] border border-[var(--border-subtle)] text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all"
            >
              {hasRecent ? 'I’ve already validated · Continue' : 'Skip & log as non-system'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function minutesAgo(at: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - at) / 60_000));
  if (diff < 1) return 'just now';
  if (diff === 1) return '1 min ago';
  if (diff < 60) return `${diff} min ago`;
  const hours = Math.floor(diff / 60);
  return hours === 1 ? '1 hr ago' : `${hours} hrs ago`;
}
