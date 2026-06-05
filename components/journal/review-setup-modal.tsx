'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ClipboardCheck, X } from 'lucide-react';
import { supabase, type Trade } from '@/lib/supabase-client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const CONDITIONS = [
  'Price above 150-MA and 200-MA',
  '150-MA above 200-MA',
  '200-MA trending up for at least 1 month',
  '50-MA above 150-MA and 200-MA',
  'Price above 50-MA',
  'Price at least 25% above 52-week low',
  'Price within 25% of 52-week high',
  'Relative Strength rank 70+',
] as const;

function deriveStatus(checks: boolean[]): 'system' | 'partial' | 'non_system' {
  const passed = checks.filter(Boolean).length;
  if (passed === CONDITIONS.length) return 'system';
  if (passed > 0) return 'partial';
  return 'non_system';
}

interface Props {
  trade: Trade;
  onClose: () => void;
  onSaved: (updated: Trade) => void;
}

export function ReviewSetupModal({ trade, onClose, onSaved }: Props) {
  const [checks, setChecks] = useState<boolean[]>(
    trade.trend_checks ?? Array(CONDITIONS.length).fill(false),
  );
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const toggle = (i: number) =>
    setChecks(prev => prev.map((v, idx) => (idx === i ? !v : v)));

  const passed = checks.filter(Boolean).length;
  const status = deriveStatus(checks);

  const statusCfg = {
    system:     { label: 'System Trade',   cls: 'text-[#10F088] bg-[#10F088]/10 border-[#10F088]/30' },
    partial:    { label: 'Partial System', cls: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
    non_system: { label: 'Non-System',     cls: 'text-[#FF3B5C] bg-[#FF3B5C]/10 border-[#FF3B5C]/30' },
  } satisfies Record<string, { label: string; cls: string }>;

  const handleSave = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from('trades')
      .update({ system_status: status, trend_checks: checks })
      .eq('id', trade.id)
      .select()
      .single();

    setSaving(false);
    if (error) { toast({ title: error.message, variant: 'error' }); return; }
    toast({ title: `${trade.ticker} tagged as ${statusCfg[status].label}`, variant: 'success' });
    onSaved(data as Trade);
    onClose();
  };

  if (!mounted) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[1000] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-[420px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-modal)] shadow-2xl flex flex-col gap-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#22D3EE]/10 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4 text-[#22D3EE]" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-[15px] font-extrabold tracking-tight text-[var(--text-primary)]">
                Review Setup — <span className="font-mono">{trade.ticker}</span>
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">Minervini Trend Template (8 conditions)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conditions */}
        <div className="px-5 py-4 flex flex-col gap-2">
          {CONDITIONS.map((cond, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className={cn(
                'flex items-center gap-3 w-full rounded-xl px-3.5 py-2.5 border text-left transition-all',
                checks[i]
                  ? 'border-[#10F088]/40 bg-[#10F088]/8 text-[var(--text-primary)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
              )}
            >
              <div className={cn(
                'w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-all',
                checks[i]
                  ? 'bg-[#10F088] border-[#10F088]'
                  : 'border-[var(--border-strong)] bg-transparent',
              )}>
                {checks[i] && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
              </div>
              <span className="text-[12px] font-medium leading-tight">{cond}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-extrabold uppercase tracking-wider',
            statusCfg[status].cls,
          )}>
            {status === 'system'  && '✅'}
            {status === 'partial' && '🟡'}
            {status === 'non_system' && '❌'}
            <span className="ml-0.5">{statusCfg[status].label}</span>
            <span className="opacity-60 font-normal">({passed}/{CONDITIONS.length})</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[9px] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-4 py-2 rounded-[9px] bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-extrabold uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
