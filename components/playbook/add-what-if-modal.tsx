// components/playbook/add-what-if-modal.tsx
//
// Manual What-If trade entry — logs off-system trades for retrospective tracking.
// Always inserts with is_what_if: true and failed_gates: ['manual_entry'].

'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X, Zap } from 'lucide-react';
import { supabase, type SetupType, type Trade } from '@/lib/supabase-client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const SETUP_TYPES: SetupType[] = ['VCP', 'HTF', 'Cup & Handle', 'Gap-up', 'Flat Base', 'Confluence', 'Other'];

interface AddWhatIfModalProps {
  userId: string;
  onClose: () => void;
  onSaved: (trade: Trade) => void;
}

export function AddWhatIfModal({ userId, onClose, onSaved }: AddWhatIfModalProps) {
  const [mounted, setMounted] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const [ticker,     setTicker]     = useState('');
  const [entryDate,  setEntryDate]  = useState(todayIso());
  const [entryPrice, setEntryPrice] = useState('');
  const [shares,     setShares]     = useState('');
  const [stopPrice,  setStopPrice]  = useState('');
  const [exitPrice,  setExitPrice]  = useState('');
  const [exitDate,   setExitDate]   = useState('');
  const [setupType,  setSetupType]  = useState<SetupType | ''>('');
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const computed = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const sp = parseFloat(stopPrice);
    const sh = parseInt(shares, 10);
    if (!Number.isFinite(ep) || !Number.isFinite(sp) || !Number.isFinite(sh)) return null;
    if (sp >= ep) return null;
    const stopDistPct  = Math.abs(((sp - ep) / ep) * 100);
    const riskPerShare = ep - sp;
    const riskDollars  = riskPerShare * sh;
    return { stopDistPct, riskPerShare, riskDollars };
  }, [entryPrice, stopPrice, shares]);

  const exitComputed = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const xp = parseFloat(exitPrice);
    const sh = parseInt(shares, 10);
    if (!Number.isFinite(ep) || !Number.isFinite(xp) || !Number.isFinite(sh)) return null;
    const pnlDollars = (xp - ep) * sh;
    const pnlPct     = ((xp - ep) / ep) * 100;
    const riskDollars = computed?.riskDollars ?? null;
    const rMultiple   = riskDollars && riskDollars > 0 ? pnlDollars / riskDollars : null;
    const outcome: 'winner' | 'loser' | 'breakeven' =
      pnlDollars > 0.005 ? 'winner' : pnlDollars < -0.005 ? 'loser' : 'breakeven';
    return { pnlDollars, pnlPct, rMultiple, outcome };
  }, [entryPrice, exitPrice, shares, computed]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const ep = parseFloat(entryPrice);
    const sp = parseFloat(stopPrice);
    const sh = parseInt(shares, 10);
    const xp = exitPrice ? parseFloat(exitPrice) : null;

    if (!ticker.trim())                            { setError('Ticker is required.'); return; }
    if (!Number.isFinite(ep) || ep <= 0)           { setError('Enter a valid entry price.'); return; }
    if (!Number.isFinite(sp) || sp <= 0)           { setError('Enter a valid stop price.'); return; }
    if (sp >= ep)                                  { setError('Stop price must be below entry price.'); return; }
    if (!Number.isFinite(sh) || sh < 1)            { setError('Shares must be at least 1.'); return; }
    if (exitPrice && (!Number.isFinite(xp!) || xp! <= 0)) { setError('Enter a valid exit price.'); return; }

    setSaving(true);

    const hasExit  = xp !== null && exitComputed !== null;
    const isClosed = hasExit;

    const { data, error: dbError } = await supabase
      .from('trades')
      .insert({
        user_id:              userId,
        ticker:               ticker.toUpperCase().trim(),
        setup_type:           setupType || null,
        phase1_date:          new Date(entryDate).toISOString(),
        phase1_price:         ep,
        phase1_shares:        sh,
        initial_stop:         sp,
        current_stop:         sp,
        stop_distance_pct:    computed?.stopDistPct ?? 0,
        risk_dollars:         computed?.riskDollars ?? 0,
        trend_template_passed: false,
        status:               isClosed ? 'closed' : 'open',
        outcome:              isClosed ? exitComputed!.outcome : null,
        exit_price:           isClosed ? xp : null,
        exit_date:            isClosed ? (exitDate ? new Date(exitDate).toISOString() : new Date().toISOString()) : null,
        pnl_dollars:          isClosed ? exitComputed!.pnlDollars : null,
        pnl_pct:              isClosed ? exitComputed!.pnlPct : null,
        r_multiple:           isClosed ? (exitComputed!.rMultiple ?? null) : null,
        notes:                notes || null,
        is_what_if:           true,
        failed_gates:         ['manual_entry'],
        what_if_reason:       notes || null,
      })
      .select()
      .single();

    if (dbError) {
      setError(dbError.message);
      setSaving(false);
      return;
    }

    toast({
      title: `${ticker.toUpperCase()} logged as What-If`,
      body: isClosed
        ? `${exitComputed!.outcome} · ${exitComputed!.pnlDollars >= 0 ? '+' : ''}$${exitComputed!.pnlDollars.toFixed(0)} · not counted in system stats`
        : 'Open What-If trade logged for tracking only.',
      variant: 'warning',
      durationMs: 5000,
    });

    onSaved(data as Trade);
  };

  if (!mounted) return null;

  const inputCls = 'w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-amber-500 focus:ring-[2px] focus:ring-amber-500/20 transition text-[13px]';

  const modal = (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 backdrop-blur-sm"
      style={{ background: 'var(--modal-overlay)' }}
    >
      <div
        className="animate-modal-enter relative w-full max-w-[520px] rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-modal)] overflow-hidden max-h-[92vh] overflow-y-auto"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-amber-500 to-amber-400" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-[14px] font-extrabold tracking-tight text-[var(--text-primary)]">Log Off-System Trade</span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">Logged as What-If — not counted in system stats.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">

          {/* Ticker + Setup */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.14em] font-semibold text-amber-500">Ticker</label>
              <input
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="NVDA"
                className={cn(inputCls, 'font-mono text-[16px] font-bold uppercase focus:border-amber-500 focus:ring-amber-500/20')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">Setup Type</label>
              <select
                value={setupType}
                onChange={e => setSetupType(e.target.value as SetupType | '')}
                className={cn(inputCls, 'appearance-none')}
              >
                <option value="">— optional —</option>
                {SETUP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Entry Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">Entry Date</label>
            <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inputCls} />
          </div>

          {/* Entry / Shares / Stop */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[#22D3EE]">Entry $</label>
              <input inputMode="decimal" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} placeholder="0.00" className={cn(inputCls, 'font-mono')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">Shares</label>
              <input inputMode="numeric" value={shares} onChange={e => setShares(e.target.value)} placeholder="0" className={cn(inputCls, 'font-mono')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[#EF4444]">Stop $</label>
              <input inputMode="decimal" value={stopPrice} onChange={e => setStopPrice(e.target.value)} placeholder="0.00" className={cn(inputCls, 'font-mono text-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/15')} />
            </div>
          </div>

          {/* Risk preview */}
          {computed && (
            <div className="grid grid-cols-3 gap-2 p-3 rounded-[9px] border text-center bg-[#22D3EE]/[0.04] border-[#22D3EE]/20">
              <div>
                <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-0.5">Stop Dist</div>
                <div className="font-mono text-[14px] font-bold text-[#22D3EE]">{computed.stopDistPct.toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-0.5">Risk / Share</div>
                <div className="font-mono text-[14px] font-bold text-[var(--text-dim)]">${computed.riskPerShare.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-0.5">Total Risk</div>
                <div className="font-mono text-[14px] font-bold text-[#EF4444]">${computed.riskDollars.toFixed(0)}</div>
              </div>
            </div>
          )}

          {/* Optional exit */}
          <div>
            <div className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-muted)] mb-2">
              Exit (optional — fill to log as closed)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">Exit Price $</label>
                <input inputMode="decimal" value={exitPrice} onChange={e => setExitPrice(e.target.value)} placeholder="0.00" className={cn(inputCls, 'font-mono')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">Exit Date</label>
                <input type="date" value={exitDate} onChange={e => setExitDate(e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Exit preview */}
          {exitComputed && (
            <div className={cn(
              'grid grid-cols-3 gap-2 p-3 rounded-[9px] border text-center',
              exitComputed.pnlDollars >= 0
                ? 'bg-[#10F088]/[0.06] border-[#10F088]/20'
                : 'bg-[#EF4444]/[0.06] border-[#EF4444]/20',
            )}>
              <div>
                <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-0.5">Outcome</div>
                <div className={cn('font-mono text-[13px] font-bold capitalize',
                  exitComputed.outcome === 'winner' ? 'text-[#10F088]' :
                  exitComputed.outcome === 'loser'  ? 'text-[#EF4444]' : 'text-amber-400'
                )}>{exitComputed.outcome}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-0.5">P&L</div>
                <div className={cn('font-mono text-[13px] font-bold',
                  exitComputed.pnlDollars >= 0 ? 'text-[#10F088]' : 'text-[#EF4444]'
                )}>{exitComputed.pnlDollars >= 0 ? '+' : ''}${exitComputed.pnlDollars.toFixed(0)}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-0.5">R-Multiple</div>
                <div className={cn('font-mono text-[13px] font-bold',
                  (exitComputed.rMultiple ?? 0) >= 0 ? 'text-[#10F088]' : 'text-[#EF4444]'
                )}>
                  {exitComputed.rMultiple !== null
                    ? `${exitComputed.rMultiple >= 0 ? '+' : ''}${exitComputed.rMultiple.toFixed(2)}R`
                    : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
              Why / Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Why did you take this trade outside the system? What would you do differently?"
              rows={3}
              className={cn(inputCls, 'resize-none leading-relaxed')}
            />
          </div>

          {error && (
            <div className="px-3 py-2.5 rounded-[8px] bg-[#EF4444]/[0.06] border border-[#EF4444]/30 text-xs text-[#EF4444]">
              {error}
            </div>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-[10px] border border-[var(--border-strong)] text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(
                'flex-[2] py-3 rounded-[10px] text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2',
                saving
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed'
                  : 'bg-amber-500 text-black hover:bg-amber-400 hover:-translate-y-px',
              )}
            >
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : 'Log What-If Trade'}
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
