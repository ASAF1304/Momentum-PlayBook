// components/dashboard/add-position-modal.tsx
//
// Manual trade entry — lets the user backfill a historical position.
// Validates stop distance against the user's max_stop_distance_pct.
// Rendered via React portal so it escapes any parent stacking context.

'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, TrendingUp, X } from 'lucide-react';
import { supabase, type SetupType, type Trade } from '@/lib/supabase-client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const SETUP_TYPES: SetupType[] = ['VCP', 'HTF', 'Cup & Handle', 'Gap-up', 'Flat Base', 'Confluence', 'Other'];

interface AddPositionModalProps {
  userId: string;
  maxStopDistancePct: number;
  onClose: () => void;
  onSaved: (trade: Trade) => void;
}

export function AddPositionModal({
  userId, maxStopDistancePct, onClose, onSaved,
}: AddPositionModalProps) {
  const [mounted, setMounted] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const [ticker,    setTicker]    = useState('');
  const [entryDate, setEntryDate] = useState(todayIso());
  const [entryPrice, setEntryPrice] = useState('');
  const [shares,    setShares]    = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [setupType, setSetupType] = useState<SetupType | ''>('');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Live validation + computed risk
  const computed = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const sp = parseFloat(stopPrice);
    const sh = parseInt(shares, 10);
    if (!Number.isFinite(ep) || !Number.isFinite(sp) || !Number.isFinite(sh)) return null;
    if (sp >= ep) return null;
    const stopDistPct = Math.abs(((sp - ep) / ep) * 100);
    const riskPerShare = ep - sp;
    const riskDollars = riskPerShare * sh;
    return { stopDistPct, riskPerShare, riskDollars };
  }, [entryPrice, stopPrice, shares]);

  const stopTooWide = computed !== null && computed.stopDistPct > maxStopDistancePct;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const ep = parseFloat(entryPrice);
    const sp = parseFloat(stopPrice);
    const sh = parseInt(shares, 10);

    if (!ticker.trim()) { setError('Ticker is required.'); return; }
    if (!Number.isFinite(ep) || ep <= 0) { setError('Enter a valid entry price.'); return; }
    if (!Number.isFinite(sp) || sp <= 0) { setError('Enter a valid stop price.'); return; }
    if (sp >= ep) { setError('Stop price must be below entry price.'); return; }
    if (!Number.isFinite(sh) || sh < 1) { setError('Shares must be at least 1.'); return; }
    if (stopTooWide) {
      setError(`Stop distance ${computed!.stopDistPct.toFixed(2)}% exceeds your ${maxStopDistancePct}% cap.`);
      return;
    }

    setSaving(true);

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10_000);

    try {
      const { data, error: dbError } = await supabase
        .from('trades')
        .insert({
          user_id: userId,
          ticker: ticker.toUpperCase().trim(),
          setup_type: setupType || null,
          phase1_date: new Date(entryDate).toISOString(),
          phase1_price: ep,
          phase1_shares: sh,
          initial_stop: sp,
          current_stop: sp,
          stop_distance_pct: computed!.stopDistPct,
          risk_dollars: computed!.riskDollars,
          trend_template_passed: false,
          status: 'open',
        })
        .abortSignal(controller.signal)
        .select()
        .single();

      if (dbError) {
        setError(dbError.message);
        return;
      }

      toast({
        title: `${ticker.toUpperCase()} logged`,
        body: `${sh} sh @ $${ep.toFixed(2)} · stop $${sp.toFixed(2)} · risk $${computed!.riskDollars.toFixed(0)}`,
        variant: 'success',
        durationMs: 4000,
      });

      onSaved(data as Trade);
    } catch (err) {
      const isTimeout = (err as Error).name === 'AbortError';
      setError(isTimeout ? 'Request timed out — check your connection and try again.' : (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      clearTimeout(tid);
      setSaving(false);
    }
  };

  if (!mounted) return null;

  const inputCls = 'w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[#22D3EE] focus:ring-[2px] focus:ring-[#22D3EE]/20 transition';

  const modal = (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 backdrop-blur-sm"
      style={{ background: 'var(--modal-overlay)' }}
    >
      <div
        className="animate-modal-enter relative w-full max-w-[500px] rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-modal)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#22D3EE] to-[#10F088]" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <TrendingUp className="w-4 h-4 text-[#22D3EE]" />
              <span className="text-[14px] font-extrabold tracking-tight text-[var(--text-primary)]">Add Position Manually</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">Backfill a trade without running the validator.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">

          {/* Ticker + setup type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#22D3EE]">
                Ticker
              </label>
              <input
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="NVDA"
                className={cn(inputCls, 'font-mono text-[16px] font-bold uppercase focus:border-[#22D3EE] focus:ring-[#22D3EE]/20')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
                Setup Type
              </label>
              <select
                value={setupType}
                onChange={e => setSetupType(e.target.value as SetupType | '')}
                className={cn(inputCls, 'text-[13px] appearance-none')}
              >
                <option value="">— optional —</option>
                {SETUP_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Entry date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
              Entry Date
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              className={cn(inputCls, 'text-[13px]')}
            />
          </div>

          {/* Entry price + shares + stop */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#22D3EE]">
                Entry $
              </label>
              <input
                inputMode="decimal"
                value={entryPrice}
                onChange={e => setEntryPrice(e.target.value)}
                placeholder="0.00"
                className={cn(inputCls, 'font-mono text-[14px]')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
                Shares
              </label>
              <input
                inputMode="numeric"
                value={shares}
                onChange={e => setShares(e.target.value)}
                placeholder="0"
                className={cn(inputCls, 'font-mono text-[14px]')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#EF4444]">
                Stop $
              </label>
              <input
                inputMode="decimal"
                value={stopPrice}
                onChange={e => setStopPrice(e.target.value)}
                placeholder="0.00"
                className={cn(inputCls, 'font-mono text-[14px] text-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/15')}
              />
            </div>
          </div>

          {/* Live risk preview */}
          {computed && (
            <div className={cn(
              'grid grid-cols-3 gap-2 p-3 rounded-[9px] border text-center',
              stopTooWide
                ? 'bg-[#EF4444]/[0.06] border-[#EF4444]/30'
                : 'bg-[#22D3EE]/[0.04] border-[#22D3EE]/20',
            )}>
              <div>
                <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-0.5">Stop Dist</div>
                <div className={cn('font-mono text-[14px] font-bold', stopTooWide ? 'text-[#EF4444]' : 'text-[#22D3EE]')}>
                  {computed.stopDistPct.toFixed(2)}%
                  {stopTooWide && ` > ${maxStopDistancePct}%`}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-0.5">Risk / Share</div>
                <div className="font-mono text-[14px] font-bold text-[var(--text-dim)]">
                  ${computed.riskPerShare.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-0.5">Total Risk</div>
                <div className="font-mono text-[14px] font-bold text-[#EF4444]">
                  ${computed.riskDollars.toFixed(0)}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="px-3 py-2.5 rounded-[8px] bg-[#EF4444]/[0.06] border border-[#EF4444]/30 text-[12px] text-[#EF4444]">
              {error}
            </div>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-[10px] border border-[var(--border-strong)] text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || stopTooWide}
              className={cn(
                'flex-[2] py-3 rounded-[10px] text-[12px] font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2',
                saving || stopTooWide
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed'
                  : 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 hover:-translate-y-px shadow-[var(--shadow-card)]',
              )}
            >
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : 'Log Position'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
