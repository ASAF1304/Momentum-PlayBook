// components/journal/add-trade-modal.tsx
//
// Direct trade entry for the Journal.
// User inputs: total position size ($), entry price ($), stop loss ($).
// System auto-calculates: shares, dollar risk, % risk of position, % risk of portfolio.

'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Plus, UploadCloud, X } from 'lucide-react';
import { supabase, type SetupType, type Trade } from '@/lib/supabase-client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const SETUP_TYPES: SetupType[] = [
  'VCP', 'HTF', 'Cup & Handle', 'Gap-up', 'Flat Base', 'Confluence', 'Other',
];

interface AddTradeModalProps {
  userId: string;
  portfolioSize: number;
  onClose: () => void;
  onSaved: (trade: Trade) => void;
}

export function AddTradeModal({
  userId, portfolioSize, onClose, onSaved,
}: AddTradeModalProps) {
  const [mounted, setMounted] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Form fields ──────────────────────────────────────────────────────────
  const [ticker,       setTicker]       = useState('');
  const [setupType,    setSetupType]    = useState<SetupType | ''>('');
  const [entryDate,    setEntryDate]    = useState(todayIso());
  const [positionSize, setPositionSize] = useState('');   // Total $ to invest
  const [entryPrice,   setEntryPrice]   = useState('');   // $ per share
  const [stopPrice,    setStopPrice]    = useState('');   // Stop loss $ per share
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // ── Chart image ──────────────────────────────────────────────────────────
  const [chartFile,     setChartFile]     = useState<File | null>(null);
  const [chartPreview,  setChartPreview]  = useState<string | null>(null);
  const [isDragging,    setIsDragging]    = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Revoke Object URL when preview changes or on unmount
  useEffect(() => {
    return () => { if (chartPreview) URL.revokeObjectURL(chartPreview); };
  }, [chartPreview]);

  async function checkImageMagicBytes(file: File): Promise<boolean> {
    const buf   = await file.slice(0, 12).arrayBuffer();
    const b     = new Uint8Array(buf);
    const isPng  = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
    const isJpeg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
    const isWebp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
                   b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
    return isPng || isJpeg || isWebp;
  }

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const validBytes = await checkImageMagicBytes(file);
    if (!validBytes) {
      setError('Invalid image file. Only PNG, JPEG, and WEBP are accepted.');
      return;
    }
    if (chartPreview) URL.revokeObjectURL(chartPreview);
    setChartFile(file);
    setChartPreview(URL.createObjectURL(file));
    setScreenshotUrl(null);

    setUploading(true);
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: storageErr } = await supabase.storage
        .from('journal-images')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (storageErr) {
        setError(`Chart upload failed: ${storageErr.message}`);
        return;
      }
      const { data: urlData } = supabase.storage.from('journal-images').getPublicUrl(path);
      setScreenshotUrl(urlData.publicUrl);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFileSelect(file);
  };

  // ── Live calculations ─────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const pos = parseFloat(positionSize);
    const ep  = parseFloat(entryPrice);
    const sp  = parseFloat(stopPrice);

    if (!Number.isFinite(pos) || pos <= 0) return null;
    if (!Number.isFinite(ep)  || ep  <= 0) return null;

    const shares = Math.floor(pos / ep);
    if (shares < 1) return null;

    const actualInvested = shares * ep;
    const unused         = pos - actualInvested;

    const stopOk = Number.isFinite(sp) && sp > 0 && sp < ep;

    if (!stopOk) {
      return { shares, actualInvested, unused, stopReady: false as const };
    }

    const dollarLoss      = (ep - sp) * shares;
    const lossOfPosition  = ((ep - sp) / ep) * 100;
    const lossOfPortfolio = (dollarLoss / portfolioSize) * 100;
    const stopDistPct     = Math.abs(((sp - ep) / ep) * 100);

    return {
      shares, actualInvested, unused, stopReady: true as const,
      dollarLoss, lossOfPosition, lossOfPortfolio, stopDistPct,
    };
  }, [positionSize, entryPrice, stopPrice, portfolioSize]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const ep = parseFloat(entryPrice);
    const sp = parseFloat(stopPrice);

    if (!ticker.trim())  { setError('Ticker is required.'); return; }
    if (!calc)           { setError('Enter a valid position size and entry price.'); return; }
    if (!calc.stopReady) { setError('Stop price must be a valid value below entry price.'); return; }

    if (chartFile && uploading) {
      setError('Chart is still uploading — wait a moment then try again.');
      return;
    }

    setSaving(true);

    const { data, error: dbError } = await supabase
      .from('trades')
      .insert({
        user_id:               userId,
        ticker:                ticker.toUpperCase().trim(),
        setup_type:            setupType || null,
        phase1_date:           new Date(entryDate).toISOString(),
        phase1_price:          ep,
        phase1_shares:         calc.shares,
        initial_stop:          sp,
        current_stop:          sp,
        stop_distance_pct:     calc.stopDistPct,
        risk_dollars:          calc.dollarLoss,
        trend_template_passed: false,
        status:                'open',
        screenshot_url:        screenshotUrl,
      })
      .select()
      .single();

    if (dbError) {
      setError(dbError.message);
      setSaving(false);
      return;
    }

    toast({
      title:      `${ticker.toUpperCase()} logged`,
      body:       `${calc.shares} sh @ $${ep.toFixed(2)} · stop $${sp.toFixed(2)} · risk $${calc.dollarLoss.toFixed(0)}`,
      variant:    'success',
      durationMs: 4000,
    });

    onSaved(data as Trade);
  };

  if (!mounted) return null;

  const modal = (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6"
      style={{
        background: 'rgba(4,5,7,0.88)',
        backdropFilter: 'blur(20px) saturate(130%)',
        WebkitBackdropFilter: 'blur(20px) saturate(130%)',
      }}
    >
      <div className="animate-modal-enter relative w-full max-w-[520px] rounded-2xl border border-white/[0.08] bg-[#07090f] shadow-[0_32px_80px_rgba(0,0,0,0.75)] overflow-hidden flex flex-col max-h-full">

        {/* Top accent line */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#22D3EE] to-[#10F088] z-10" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-white/[0.06] flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center">
                <Plus className="w-3.5 h-3.5 text-black" strokeWidth={3} />
              </div>
              <span className="text-[15px] font-extrabold tracking-tight">New Trade</span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Enter your position size — shares &amp; risk are auto-calculated.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors ml-4 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">

            {/* ── Trade Info ─────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ticker" accent="cyan">
                <input
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="e.g. AAPL"
                  className={inputCls('cyan') + ' font-extrabold text-[16px] uppercase tracking-wide'}
                />
              </FormField>
              <FormField label="Setup Type">
                <select
                  value={setupType}
                  onChange={e => setSetupType(e.target.value as SetupType | '')}
                  className={inputCls('neutral')}
                >
                  <option value="">— optional —</option>
                  {SETUP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
            </div>

            <FormField label="Entry Date">
              <input
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                className={cn(inputCls('neutral'), '[color-scheme:dark]')}
              />
            </FormField>

            {/* ── Chart Screenshot ─────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.14em] font-semibold text-zinc-400">
                Chart Screenshot
                <span className="ml-1 normal-case tracking-normal font-normal text-zinc-600">· optional</span>
              </label>

              {chartPreview ? (
                <div className="relative rounded-[10px] overflow-hidden border border-white/[0.08] bg-black/30"
                  style={{ aspectRatio: '16/7' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={chartPreview}
                    alt="Chart screenshot preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => { setChartFile(null); if (chartPreview) URL.revokeObjectURL(chartPreview); setChartPreview(null); setScreenshotUrl(null); }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-black/90 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {uploading && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-black/80 text-[9px] font-mono text-[#22D3EE]">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Uploading…
                    </div>
                  )}
                  {!uploading && screenshotUrl && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-[#10F088]/20 text-[9px] font-mono text-[#10F088]">
                      <Check className="w-2.5 h-2.5" />
                      Uploaded
                    </div>
                  )}
                  {!uploading && !screenshotUrl && (
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[9px] font-mono text-zinc-400 truncate max-w-[60%]">
                      {chartFile?.name}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'relative cursor-pointer rounded-[10px] border-2 border-dashed px-4 py-5 flex flex-col items-center justify-center gap-2 transition-all select-none',
                    isDragging
                      ? 'border-[#22D3EE]/60 bg-[#22D3EE]/[0.07]'
                      : 'border-white/[0.08] bg-black/20 hover:border-white/20 hover:bg-black/25',
                  )}
                >
                  <UploadCloud className={cn('w-5 h-5 transition-colors', isDragging ? 'text-[#22D3EE]' : 'text-zinc-600')} />
                  <div className="text-center">
                    <p className="text-xs text-zinc-500">
                      Drop chart or{' '}
                      <span className="text-[#22D3EE] font-semibold">click to upload</span>
                    </p>
                    <p className="text-xs text-zinc-700 mt-0.5">PNG · JPG · WebP</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={e => { const f = e.target.files?.[0]; if (f) void handleFileSelect(f); }}
                  />
                </div>
              )}
            </div>

            {/* ── Position Engine ──────────────────────────────── */}
            <div className="rounded-[12px] border border-[#22D3EE]/20 bg-[#22D3EE]/[0.025] p-4 flex flex-col gap-3">
              <SectionLabel color="cyan" label="Position Engine" />

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Total Position Size" accent="cyan">
                  <DollarInput
                    value={positionSize}
                    onChange={setPositionSize}
                    placeholder="5,000.00"
                    accent="cyan"
                  />
                </FormField>
                <FormField label="Entry Price" accent="cyan">
                  <DollarInput
                    value={entryPrice}
                    onChange={setEntryPrice}
                    placeholder="0.00"
                    accent="cyan"
                  />
                </FormField>
              </div>

              {/* Shares output */}
              <div className="flex items-center justify-between px-4 py-3 rounded-[10px] bg-[#040507] border border-[#22D3EE]/20">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.16em] font-bold text-zinc-600 mb-0.5">
                    Shares — auto-calculated
                  </p>
                  {calc && (
                    <p className="text-xs font-mono text-zinc-600">
                      ${calc.actualInvested.toLocaleString('en-US', { maximumFractionDigits: 2 })} actual
                      {calc.unused > 0.005 && (
                        <span className="text-zinc-700"> · ${calc.unused.toFixed(2)} unused</span>
                      )}
                    </p>
                  )}
                </div>
                <span
                  className="font-mono text-[32px] font-extrabold tracking-tight text-[#22D3EE]"
                  style={{ textShadow: '0 0 24px rgba(34,211,238,0.4)' }}
                >
                  {calc ? calc.shares.toLocaleString() : '—'}
                </span>
              </div>
            </div>

            {/* ── Risk Engine ──────────────────────────────────── */}
            <div className="rounded-[12px] border border-[#FF3B5C]/20 bg-[#FF3B5C]/[0.025] p-4 flex flex-col gap-3">
              <SectionLabel color="red" label="Risk Engine" />

              <FormField label="Stop Loss Price" accent="red">
                <DollarInput
                  value={stopPrice}
                  onChange={setStopPrice}
                  placeholder="0.00"
                  accent="red"
                />
              </FormField>

              {/* Risk metrics */}
              {calc?.stopReady ? (
                <div className="grid grid-cols-3 gap-2">
                  <RiskTile
                    label="Max Loss"
                    value={`−$${calc.dollarLoss.toFixed(0)}`}
                    glow
                  />
                  <RiskTile
                    label="% of Position"
                    value={`−${calc.lossOfPosition.toFixed(2)}%`}
                  />
                  <RiskTile
                    label="% of Portfolio"
                    value={`−${calc.lossOfPortfolio.toFixed(2)}%`}
                    sub={`$${(portfolioSize / 1000).toFixed(0)}k acct`}
                  />
                </div>
              ) : (
                <p className="text-xs text-zinc-600 px-1">
                  Enter a stop price below entry price to see risk metrics.
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="px-3 py-2.5 rounded-[9px] bg-[#FF3B5C]/[0.06] border border-[#FF3B5C]/30 text-xs text-[#FF3B5C] flex items-center gap-2">
                <X className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-[10px] border border-white/[0.08] text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 hover:border-white/20 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className={cn(
                  'flex-[2] py-3 rounded-[10px] text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2',
                  saving || uploading
                    ? 'bg-white/[0.04] text-zinc-600 cursor-not-allowed'
                    : 'bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_24px_rgba(34,211,238,0.3)] hover:brightness-110 hover:-translate-y-px',
                )}
              >
                {uploading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Uploading chart…</>
                  : saving
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
                  : 'Log Trade'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ color, label }: { color: 'cyan' | 'red'; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        color === 'cyan' ? 'bg-[#22D3EE]' : 'bg-[#FF3B5C]',
      )} />
      <span className={cn(
        'text-xs uppercase tracking-[0.16em] font-bold',
        color === 'cyan' ? 'text-[#22D3EE]' : 'text-[#FF3B5C]',
      )}>
        {label}
      </span>
    </div>
  );
}

function FormField({
  label, accent, children,
}: { label: string; accent?: 'cyan' | 'red'; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn(
        'text-xs uppercase tracking-[0.14em] font-semibold',
        accent === 'cyan' ? 'text-[#22D3EE]' :
        accent === 'red'  ? 'text-[#FF3B5C]' : 'text-zinc-400',
      )}>
        {label}
      </label>
      {children}
    </div>
  );
}

function DollarInput({
  value, onChange, placeholder, accent = 'neutral',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  accent?: 'cyan' | 'red' | 'neutral';
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-[14px] pointer-events-none">
        $
      </span>
      <input
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputCls(accent), 'pl-7')}
      />
    </div>
  );
}

function RiskTile({
  label, value, sub, glow,
}: { label: string; value: string; sub?: string; glow?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-3 rounded-[9px] border border-[#FF3B5C]/20 bg-[#FF3B5C]/[0.04] text-center gap-0.5">
      <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-zinc-600">
        {label}
      </span>
      <span
        className={cn('font-mono text-[14px] font-extrabold text-[#FF3B5C]')}
        style={glow ? { textShadow: '0 0 16px rgba(255,59,92,0.5)' } : undefined}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[8px] text-zinc-700 font-mono mt-0.5">{sub}</span>
      )}
    </div>
  );
}

function inputCls(accent: 'cyan' | 'red' | 'neutral' = 'neutral') {
  const ring =
    accent === 'cyan' ? 'focus:border-[#22D3EE] focus:ring-[#22D3EE]/15' :
    accent === 'red'  ? 'focus:border-[#FF3B5C] focus:ring-[#FF3B5C]/15' :
    'focus:border-white/30 focus:ring-white/10';
  return cn(
    'w-full bg-black/40 border border-white/[0.07] rounded-[8px] px-3 py-2.5',
    'font-mono text-[14px] text-zinc-100 placeholder:text-zinc-700',
    'focus:outline-none focus:ring-[3px] transition-all',
    ring,
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
