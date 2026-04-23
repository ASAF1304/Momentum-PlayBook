// components/journal/import-excel-modal.tsx
//
// Drag-and-drop Excel/CSV import for broker trade history.
// Supports Meitav Trade (Hebrew), IBI, Interactive Brokers, eToro, generic CSV.

'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, ChevronUp,
  FileSpreadsheet, Loader2, Upload, X,
} from 'lucide-react';
import { supabase, type Trade } from '@/lib/supabase-client';
import { parseFile, type BrokerFormat, type ImportedTrade } from '@/lib/broker-parser';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

interface ManualMapping {
  ticker:   string;
  action:   string;
  quantity: string;
  price:    string;
  date:     string;
}

interface ImportExcelModalProps {
  userId:      string;
  onClose:     () => void;
  onImported:  (count: number) => void;
}

// ── Broker label map ──────────────────────────────────────────────────────────

const BROKER_LABELS: Record<BrokerFormat, string> = {
  meitav:  'Meitav Trade',
  ibi:     'IBI',
  ibkr:    'Interactive Brokers',
  etoro:   'eToro',
  generic: 'Generic CSV',
};

// ── Main component ────────────────────────────────────────────────────────────

export function ImportExcelModal({ userId, onClose, onImported }: ImportExcelModalProps) {
  const [mounted,         setMounted]        = useState(false);
  const [step,            setStep]           = useState<Step>('upload');
  const [isDragging,      setIsDragging]     = useState(false);
  const [parsing,         setParsing]        = useState(false);
  const [parseError,      setParseError]     = useState<string | null>(null);
  const [detectedFormat,  setDetectedFormat] = useState<BrokerFormat | null>(null);
  const [rawHeaders,      setRawHeaders]     = useState<string[]>([]);
  const [manualMapping,   setManualMapping]  = useState<ManualMapping>({ ticker: '', action: '', quantity: '', price: '', date: '' });
  const [trades,          setTrades]         = useState<ImportedTrade[]>([]);
  const [skippedRows,     setSkippedRows]    = useState(0);
  const [selectedIds,     setSelectedIds]    = useState<Set<string>>(new Set());
  const [importing,       setImporting]      = useState(false);
  const [importProgress,  setImportProgress] = useState(0);
  const [expandedId,      setExpandedId]     = useState<string | null>(null);
  const fileRef           = useRef<HTMLInputElement>(null);
  const backdropRef       = useRef<HTMLDivElement>(null);
  const pendingFile       = useRef<File | null>(null);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ── File handling ─────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setParseError(null);

    if (file.size > 5 * 1024 * 1024) {
      setParseError('File too large (max 5 MB). Try splitting into multiple files.');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      setParseError('Invalid file type. Please upload a .xlsx, .xls, or .csv file.');
      return;
    }

    setParsing(true);
    try {
      const result = await parseFile(file);

      if (result.format === 'generic' && result.transactions.length === 0) {
        // Need manual mapping — store headers and move to mapping step
        setRawHeaders(result.transactions.length === 0 ? [] : Object.keys(result.transactions[0] ?? {}));
        pendingFile.current = file;

        // Re-parse just to get headers
        const XLSX = await import('xlsx');
        const buf  = await file.arrayBuffer();
        const wb   = XLSX.read(new Uint8Array(buf), { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        if (rows.length > 0) setRawHeaders(Object.keys(rows[0]));
        setDetectedFormat('generic');
        setStep('mapping');
        return;
      }

      if (result.trades.length === 0) {
        setParseError('No trades detected in file. Check the format or make sure the file contains buy/sell transactions.');
        return;
      }

      await finishParse(result.format, result.trades, result.skippedRows);
    } catch (err) {
      setParseError(`Could not read file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setParsing(false);
    }
  }, []);

  const finishParse = useCallback(async (
    format:   BrokerFormat,
    incoming: ImportedTrade[],
    skipped:  number,
  ) => {
    setDetectedFormat(format);
    setSkippedRows(skipped);

    // Duplicate check — load existing trades for matching tickers
    const tickers = [...new Set(incoming.map(t => t.ticker))];
    const { data: existing } = await supabase
      .from('trades')
      .select('ticker, phase1_date, phase1_price, phase1_shares')
      .in('ticker', tickers);

    const withDupFlags = incoming.map(t => {
      const dup = (existing ?? []).some(e => {
        if (e.ticker !== t.ticker) return false;
        const daysDiff = Math.abs(
          new Date(e.phase1_date).getTime() - new Date(t.phase1_date).getTime(),
        ) / 86_400_000;
        const priceDiff = Math.abs(e.phase1_price - t.phase1_price) / e.phase1_price;
        return daysDiff <= 1 && priceDiff <= 0.005 && e.phase1_shares === t.phase1_shares;
      });
      return { ...t, isDuplicate: dup };
    });

    const notDups = new Set(withDupFlags.filter(t => !t.isDuplicate).map(t => t._importId));
    setTrades(withDupFlags);
    setSelectedIds(notDups);
    setStep('preview');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  // ── Manual mapping submit ─────────────────────────────────────────────────

  const handleManualMapping = useCallback(async () => {
    if (!pendingFile.current) return;
    const { manualMapToTransactions } = await import('@/lib/broker-parser-manual');
    setParsing(true);
    try {
      const result = await manualMapToTransactions(pendingFile.current, manualMapping);
      if (result.trades.length === 0) {
        setParseError('No trades could be built with this mapping. Check column selection.');
        setStep('upload');
        return;
      }
      await finishParse('generic', result.trades, result.skippedRows);
    } catch (err) {
      setParseError(`Mapping failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStep('upload');
    } finally {
      setParsing(false);
    }
  }, [manualMapping, finishParse]);

  // ── Selection ─────────────────────────────────────────────────────────────

  const toggleAll = () => {
    const nonDups = trades.filter(t => !t.isDuplicate).map(t => t._importId);
    if (selectedIds.size === nonDups.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(nonDups));
    }
  };

  const toggleOne = (id: string, isDup: boolean) => {
    if (isDup) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    const toImport = trades.filter(t => selectedIds.has(t._importId));
    if (toImport.length === 0) return;

    setImporting(true);
    setStep('importing');
    setImportProgress(0);

    let succeeded = 0;
    const brokerLabel = BROKER_LABELS[detectedFormat ?? 'generic'];
    const importedNote = `Imported from ${brokerLabel} on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    for (let i = 0; i < toImport.length; i++) {
      const t = toImport[i];

      // Build DB row — strip client-only fields
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _importId, isDuplicate, hasWarning, warningMsg, ...rest } = t;

      const row: Omit<Trade, 'id' | 'created_at'> & { user_id: string } = {
        user_id:              userId,
        ticker:               rest.ticker,
        setup_type:           null,
        phase1_date:          rest.phase1_date,
        phase1_price:         rest.phase1_price,
        phase1_shares:        rest.phase1_shares,
        phase2_date:          null,
        phase2_price:         null,
        phase2_shares:        null,
        initial_stop:         rest.initial_stop,
        current_stop:         rest.current_stop,
        stop_distance_pct:    rest.stop_distance_pct,
        risk_dollars:         rest.risk_dollars,
        rs_rating:            null,
        trend_template_passed: false,
        exit_date:            rest.exit_date,
        exit_price:           rest.exit_price,
        status:               rest.status,
        outcome:              rest.outcome ?? null,
        pnl_dollars:          rest.pnl_dollars,
        pnl_pct:              rest.pnl_pct,
        r_multiple:           rest.r_multiple,
        notes:                importedNote,
        lesson_learned:       null,
        screenshot_url:       null,
        partials:             rest.partials,
        current_shares:       rest.current_shares,
        is_what_if:           true,
        failed_gates:         ['imported_from_broker'],
        what_if_reason:       `Imported from ${brokerLabel}`,
      };

      const { error } = await supabase.from('trades').insert(row);
      if (!error) succeeded++;
      setImportProgress(Math.round(((i + 1) / toImport.length) * 100));
    }

    setImporting(false);
    setStep('done');

    if (succeeded > 0) {
      toast({
        title:   `Imported ${succeeded} trade${succeeded !== 1 ? 's' : ''}`,
        body:    `From ${brokerLabel}. They're marked non-system — you can edit each one.`,
        variant: 'success',
        durationMs: 5000,
      });
      onImported(succeeded);
    } else {
      toast({ title: 'Import failed', body: 'All inserts were rejected. Check Supabase RLS.', variant: 'error' });
    }
  }, [trades, selectedIds, detectedFormat, userId, onImported]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!mounted) return null;

  const selectedCount = selectedIds.size;
  const nonDupCount   = trades.filter(t => !t.isDuplicate).length;

  const modal = (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6"
      style={{
        background: 'var(--modal-overlay)',
        backdropFilter: 'blur(20px) saturate(130%)',
        WebkitBackdropFilter: 'blur(20px) saturate(130%)',
      }}
    >
      <div
        className="animate-modal-enter relative w-full max-w-[720px] rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-modal)] overflow-hidden flex flex-col max-h-[90vh]"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        {/* Gradient accent bar */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#10F088] to-[#22D3EE] z-10" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border-subtle)] flex-shrink-0">
          <div>
            <div className="flex items-center gap-2.5 mb-0.5">
              <FileSpreadsheet className="w-4 h-4 text-[#10F088]" />
              <h2 className="text-[17px] font-extrabold tracking-tight">Import from Broker</h2>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Upload your Excel or CSV export — trades are matched into open/closed positions automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-elevated)] transition-colors ml-3 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {/* ── Upload step ───────────────────────────────────────────── */}
          {(step === 'upload' || parsing) && (
            <div className="p-6 flex flex-col gap-4">
              {/* Supported brokers note */}
              <div className="flex gap-2 flex-wrap">
                {Object.entries(BROKER_LABELS).map(([k, v]) => (
                  <span key={k} className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                    {v}
                  </span>
                ))}
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e  => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'cursor-pointer rounded-[14px] border-2 border-dashed p-10 flex flex-col items-center justify-center gap-3 transition-all select-none',
                  isDragging
                    ? 'border-[#10F088]/60 bg-[#10F088]/[0.06]'
                    : 'border-[var(--border-strong)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]',
                )}
              >
                {parsing ? (
                  <>
                    <Loader2 className="w-8 h-8 text-[#10F088] animate-spin" />
                    <p className="text-[13px] font-semibold text-[var(--text-secondary)]">Parsing file…</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-[#10F088]/10 flex items-center justify-center">
                      <Upload className={cn('w-6 h-6 transition-colors', isDragging ? 'text-[#10F088]' : 'text-[var(--text-muted)]')} />
                    </div>
                    <div className="text-center">
                      <p className="text-[14px] font-semibold text-[var(--text-secondary)]">
                        Drop your broker export here
                      </p>
                      <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                        or <span className="text-[#10F088] font-semibold">click to browse</span> — .xlsx, .xls, .csv
                      </p>
                    </div>
                    <p className="text-[10px] text-[var(--text-faint)]">Max 5 MB</p>
                  </>
                )}
              </div>

              {/* Error */}
              {parseError && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-[10px] bg-[#FF3B5C]/[0.07] border border-[#FF3B5C]/25">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#FF3B5C] flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-[#FF3B5C]">{parseError}</p>
                </div>
              )}

              {/* Non-system note */}
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-[10px] bg-amber-400/[0.07] border border-amber-400/20">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-400/90 leading-relaxed">
                  Imported trades can&apos;t be validated retroactively against Minervini&apos;s Trend Template.
                  They&apos;ll be marked <strong>Non-System</strong> in your Playbook.
                  You can manually mark them as system trades later if you remember they qualified.
                </p>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              />
            </div>
          )}

          {/* ── Manual mapping step ───────────────────────────────────── */}
          {step === 'mapping' && !parsing && (
            <div className="p-6 flex flex-col gap-5">
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-[10px] bg-[#22D3EE]/[0.07] border border-[#22D3EE]/20">
                <AlertTriangle className="w-3.5 h-3.5 text-[#22D3EE] flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#22D3EE]/90 leading-relaxed">
                  Could not auto-detect your broker format. Select which column maps to each field below.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(['ticker', 'action', 'quantity', 'price', 'date'] as const).map(field => (
                  <div key={field} className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)] capitalize">
                      {field} column
                    </label>
                    <select
                      value={manualMapping[field]}
                      onChange={e => setManualMapping(prev => ({ ...prev, [field]: e.target.value }))}
                      className="bg-[var(--bg-input)] border border-[var(--border-dim)] rounded-[8px] px-3 py-2.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[#10F088] focus:ring-[3px] focus:ring-[#10F088]/15 transition appearance-none"
                    >
                      <option value="">— select column —</option>
                      {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={() => setStep('upload')}
                  className="flex-1 py-2.5 rounded-[10px] border border-[var(--border-strong)] text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-dim)] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => void handleManualMapping()}
                  disabled={Object.values(manualMapping).some(v => !v)}
                  className={cn(
                    'flex-[2] py-2.5 rounded-[10px] text-[12px] font-extrabold uppercase tracking-wider transition-all',
                    Object.values(manualMapping).some(v => !v)
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed'
                      : 'bg-gradient-to-br from-[#10F088] to-[#22D3EE] text-black hover:brightness-110',
                  )}
                >
                  Confirm Mapping
                </button>
              </div>
            </div>
          )}

          {/* ── Preview step ──────────────────────────────────────────── */}
          {step === 'preview' && (
            <div className="flex flex-col">
              {/* Summary bar */}
              <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3 text-[12px]">
                  <span className="font-semibold text-[var(--text-secondary)]">
                    Detected: <span className="text-[#10F088] font-bold">{BROKER_LABELS[detectedFormat ?? 'generic']}</span>
                  </span>
                  <span className="text-[var(--text-faint)]">·</span>
                  <span className="text-[var(--text-muted)]">{trades.length} trade{trades.length !== 1 ? 's' : ''}</span>
                  {skippedRows > 0 && (
                    <>
                      <span className="text-[var(--text-faint)]">·</span>
                      <span className="text-amber-400 text-[11px]">
                        <AlertTriangle className="inline w-3 h-3 mr-0.5" />
                        {skippedRows} rows skipped
                      </span>
                    </>
                  )}
                </div>
                <button
                  onClick={toggleAll}
                  className="text-[11px] font-semibold text-[#22D3EE] hover:underline whitespace-nowrap"
                >
                  {selectedIds.size === nonDupCount ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {/* Trade list */}
              <div className="divide-y divide-[var(--divider)]">
                {trades.map(trade => (
                  <PreviewRow
                    key={trade._importId}
                    trade={trade}
                    selected={selectedIds.has(trade._importId)}
                    expanded={expandedId === trade._importId}
                    onToggle={() => toggleOne(trade._importId, trade.isDuplicate)}
                    onExpand={() => setExpandedId(expandedId === trade._importId ? null : trade._importId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Importing progress ────────────────────────────────────── */}
          {step === 'importing' && (
            <div className="p-10 flex flex-col items-center gap-5">
              <Loader2 className="w-8 h-8 text-[#10F088] animate-spin" />
              <div className="text-center">
                <p className="text-[14px] font-semibold text-[var(--text-secondary)]">
                  Importing {selectedIds.size} trade{selectedIds.size !== 1 ? 's' : ''}…
                </p>
                <p className="text-[12px] text-[var(--text-muted)] mt-1">{importProgress}% complete</p>
              </div>
              <div className="w-64 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#10F088] to-[#22D3EE] transition-all"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Done ─────────────────────────────────────────────────── */}
          {step === 'done' && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-[#10F088]/15 flex items-center justify-center">
                <Check className="w-7 h-7 text-[#10F088]" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[16px] font-extrabold text-[var(--text-primary)]">Import complete</p>
                <p className="text-[12px] text-[var(--text-muted)] mt-1">
                  Your trades are now in the Journal, marked as Non-System imports.
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-6 py-2.5 rounded-[10px] bg-gradient-to-br from-[#10F088] to-[#22D3EE] text-black text-[12px] font-extrabold uppercase tracking-wider hover:brightness-110 transition"
              >
                View Journal
              </button>
            </div>
          )}
        </div>

        {/* Footer — only shown on preview */}
        {step === 'preview' && (
          <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-shrink-0 bg-[var(--bg-modal)]">
            <span className="text-[12px] text-[var(--text-muted)]">
              <span className="font-bold text-[var(--text-secondary)]">{selectedCount}</span> of {trades.length} trades selected
              {trades.some(t => t.isDuplicate) && (
                <span className="text-amber-400 ml-2">
                  · {trades.filter(t => t.isDuplicate).length} duplicate{trades.filter(t => t.isDuplicate).length !== 1 ? 's' : ''} excluded
                </span>
              )}
            </span>
            <div className="flex gap-2.5">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-[9px] border border-[var(--border-strong)] text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-dim)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleImport()}
                disabled={selectedCount === 0}
                className={cn(
                  'px-5 py-2 rounded-[9px] text-[12px] font-extrabold uppercase tracking-wider transition-all flex items-center gap-2',
                  selectedCount === 0
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed'
                    : 'bg-gradient-to-br from-[#10F088] to-[#22D3EE] text-black hover:brightness-110 shadow-[0_0_18px_rgba(16,240,136,0.25)]',
                )}
              >
                Import {selectedCount} Trade{selectedCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── PreviewRow ────────────────────────────────────────────────────────────────

function PreviewRow({
  trade, selected, expanded, onToggle, onExpand,
}: {
  trade:    ImportedTrade;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  const pnlPositive  = (trade.pnl_dollars ?? 0) >= 0;
  const sells        = trade.partials.filter(p => p.action === 'sell');

  return (
    <div className={cn(
      'transition-colors',
      trade.isDuplicate ? 'opacity-50' : 'hover:bg-[var(--bg-elevated)]',
    )}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox */}
        <button
          type="button"
          onClick={onToggle}
          disabled={trade.isDuplicate}
          className={cn(
            'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
            trade.isDuplicate
              ? 'border-[var(--border-dim)] cursor-not-allowed'
              : selected
                ? 'bg-[#10F088] border-[#10F088]'
                : 'border-[var(--border-strong)] hover:border-[#10F088]',
          )}
          aria-label={selected ? 'Deselect' : 'Select'}
        >
          {selected && !trade.isDuplicate && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
        </button>

        {/* Ticker */}
        <span className="font-mono text-[14px] font-extrabold tracking-tight w-16 flex-shrink-0">
          {trade.ticker}
        </span>

        {/* Entry date */}
        <span className="text-[11px] font-mono text-[var(--text-muted)] w-20 flex-shrink-0">
          {fmtDate(trade.phase1_date)}
        </span>

        {/* Entry price */}
        <span className="text-[11px] font-mono text-[var(--text-dim)] w-16 flex-shrink-0">
          ${trade.phase1_price.toFixed(2)}
        </span>

        {/* Shares */}
        <span className="text-[11px] font-mono text-[var(--text-faint)] w-14 flex-shrink-0">
          {trade.phase1_shares} sh
        </span>

        {/* Exit / status */}
        <span className="text-[11px] font-mono text-[var(--text-muted)] w-20 flex-shrink-0">
          {trade.exit_date ? fmtDate(trade.exit_date) : '—'}
        </span>

        {/* P&L */}
        <span className={cn(
          'font-mono text-[12px] font-bold w-20 flex-shrink-0',
          trade.pnl_dollars === null ? 'text-[var(--text-faint)]' :
          pnlPositive ? 'text-[#10F088]' : 'text-[#FF3B5C]',
        )}>
          {trade.pnl_dollars === null ? 'Open' :
           `${pnlPositive ? '+' : ''}$${Math.abs(trade.pnl_dollars).toFixed(0)}`}
        </span>

        {/* Status badges */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {trade.isDuplicate ? (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
              Duplicate
            </span>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-faint)] border border-[var(--border-subtle)]">
              Non-System
            </span>
          )}
          {trade.outcome && (
            <span className={cn(
              'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
              trade.outcome === 'winner'    ? 'bg-[#10F088]/10 text-[#10F088] border border-[#10F088]/20' :
              trade.outcome === 'loser'     ? 'bg-[#FF3B5C]/10 text-[#FF3B5C] border border-[#FF3B5C]/20' :
              'bg-amber-400/10 text-amber-400 border border-amber-400/20',
            )}>
              {trade.outcome}
            </span>
          )}
        </div>

        {/* Expand toggle (if has partials) */}
        {sells.length > 0 && (
          <button
            type="button"
            onClick={onExpand}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-faint)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-all flex-shrink-0"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Expanded partials */}
      {expanded && sells.length > 0 && (
        <div className="px-10 pb-3 flex flex-col gap-1">
          {sells.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-1.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px]">
              <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#A78BFA]/15 text-[#A78BFA]">Trim</span>
              <span className="font-mono text-[var(--text-faint)]">{fmtDate(p.date)}</span>
              <span className="font-mono text-[var(--text-muted)]">{p.shares} sh @ ${p.price.toFixed(2)}</span>
              <span className={cn('ml-auto font-mono font-bold', p.pnl_dollars >= 0 ? 'text-[#10F088]' : 'text-[#FF3B5C]')}>
                {p.pnl_dollars >= 0 ? '+' : ''}${p.pnl_dollars.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}
