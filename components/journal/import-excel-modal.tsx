// components/journal/import-excel-modal.tsx
//
// Drag-and-drop Excel/CSV import for broker trade history.
// Supports Meitav Trade (Hebrew), IBI, Interactive Brokers, eToro, generic CSV.
//
// Multi-file continuity: loads existing open positions from Supabase and merges
// new transactions into them, preventing duplicate trades across uploads.

'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, ChevronUp,
  FileSpreadsheet, Loader2, RefreshCw, Upload, X,
} from 'lucide-react';
import { supabase, type Trade } from '@/lib/supabase-client';
import {
  parseFile,
  type BrokerFormat,
  type ExistingPosition,
  type ImportedTrade,
  type PartialRecord,
  type TradeUpdate,
} from '@/lib/broker-parser';
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
  userId:     string;
  onClose:    () => void;
  onImported: (count: number) => void;
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
  const [mounted,           setMounted]          = useState(false);
  const [step,              setStep]             = useState<Step>('upload');
  const [isDragging,        setIsDragging]       = useState(false);
  const [parsing,           setParsing]          = useState(false);
  const [parseError,        setParseError]       = useState<string | null>(null);
  const [detectedFormat,    setDetectedFormat]   = useState<BrokerFormat | null>(null);
  const [rawHeaders,        setRawHeaders]       = useState<string[]>([]);
  const [manualMapping,     setManualMapping]    = useState<ManualMapping>({ ticker: '', action: '', quantity: '', price: '', date: '' });

  // Parsed results
  const [newTrades,         setNewTrades]        = useState<ImportedTrade[]>([]);
  const [updates,           setUpdates]          = useState<TradeUpdate[]>([]);
  const [skippedRows,       setSkippedRows]      = useState(0);
  const [dupSkipped,        setDupSkipped]       = useState(0);

  // Selection
  const [selectedIds,       setSelectedIds]      = useState<Set<string>>(new Set());
  const [selectedUpdateIds, setSelectedUpdateIds]= useState<Set<string>>(new Set());

  // Import progress
  const [importing,         setImporting]        = useState(false);
  const [importProgress,    setImportProgress]   = useState(0);
  const [expandedId,        setExpandedId]       = useState<string | null>(null);

  // Existing positions loaded from DB (for cross-file continuity)
  const existingPositionsRef  = useRef<Map<string, ExistingPosition>>(new Map());
  const existingSignaturesRef = useRef<Set<string>>(new Set());
  const [existingLoaded,    setExistingLoaded]   = useState(false);

  const fileRef      = useRef<HTMLInputElement>(null);
  const backdropRef  = useRef<HTMLDivElement>(null);
  const pendingFile  = useRef<File | null>(null);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ── Layer 1: Load existing imported trades on mount ───────────────────────

  useEffect(() => {
    async function loadExisting() {
      const { data } = await supabase
        .from('trades')
        .select('id, ticker, phase1_date, phase1_price, phase1_shares, current_shares, partials, initial_stop, status, failed_gates')
        .eq('user_id', userId)
        .eq('is_what_if', true);

      const positions = new Map<string, ExistingPosition>();
      const signatures = new Set<string>();

      for (const t of data ?? []) {
        const buys   = ((t.partials ?? []) as PartialRecord[]).filter(p => p.action === 'buy');
        const sells  = ((t.partials ?? []) as PartialRecord[]).filter(p => p.action === 'sell');

        // Signature for phase1 buy
        signatures.add(`${t.ticker}|${(t.phase1_date as string).slice(0, 10)}|${Number(t.phase1_price).toFixed(2)}|${t.phase1_shares}|buy`);
        // Signatures for all partials
        for (const p of (t.partials ?? []) as PartialRecord[]) {
          signatures.add(`${t.ticker}|${(p.date as string).slice(0, 10)}|${Number(p.price).toFixed(2)}|${p.shares}|${p.action}`);
        }

        // Open positions for merge
        if (t.status === 'open') {
          const totalInvested = Number(t.phase1_price) * Number(t.phase1_shares)
            + buys.reduce((s, p) => s + p.price * p.shares, 0);
          const totalShares = Number(t.phase1_shares)
            + buys.reduce((s, p) => s + p.shares, 0)
            - sells.reduce((s, p) => s + p.shares, 0);
          const isShort = ((t.failed_gates ?? []) as string[]).includes('short_position');
          positions.set(t.ticker as string, {
            existingId:   t.id as string,
            ticker:       t.ticker as string,
            phase1Date:   t.phase1_date as string,
            shares:       Number(t.current_shares),
            avgCost:      totalShares > 0 ? totalInvested / totalShares : Number(t.phase1_price),
            initial_stop: Number(t.initial_stop),
            isShort,
          });
        }
      }

      existingPositionsRef.current  = positions;
      existingSignaturesRef.current = signatures;
      setExistingLoaded(true);
      console.log(`[MODAL] Loaded ${positions.size} open positions, ${signatures.size} existing signatures`);
    }
    void loadExisting();
  }, [userId]);

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
      const result = await parseFile(
        file,
        existingPositionsRef.current,
        existingSignaturesRef.current,
      );

      if (result.format === 'generic' && result.transactions.length === 0) {
        // Need manual mapping — store headers and move to mapping step
        pendingFile.current = file;
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

      if (result.newTrades.length === 0 && result.updates.length === 0) {
        if (result.dupSkipped > 0) {
          setParseError(`All ${result.dupSkipped} transaction${result.dupSkipped !== 1 ? 's' : ''} in this file are already imported — nothing new to add.`);
        } else {
          setParseError('No trades detected in file. Check the format or make sure the file contains buy/sell transactions.');
        }
        return;
      }

      finishParse(result.format, result.newTrades, result.updates, result.skippedRows, result.dupSkipped);
    } catch (err) {
      setParseError(`Could not read file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setParsing(false);
    }
  }, []);

  const finishParse = useCallback((
    format:      BrokerFormat,
    incoming:    ImportedTrade[],
    incomingUpd: TradeUpdate[],
    skipped:     number,
    dupCount:    number,
  ) => {
    setDetectedFormat(format);
    setSkippedRows(skipped);
    setDupSkipped(dupCount);
    setNewTrades(incoming);
    setUpdates(incomingUpd);
    setSelectedIds(new Set(incoming.map(t => t._importId)));
    setSelectedUpdateIds(new Set(incomingUpd.map(u => u._updateId)));
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
      const result = await manualMapToTransactions(
        pendingFile.current,
        manualMapping,
        existingPositionsRef.current,
        existingSignaturesRef.current,
      );
      if (result.newTrades.length === 0 && result.updates.length === 0) {
        setParseError('No trades could be built with this mapping. Check column selection.');
        setStep('upload');
        return;
      }
      finishParse('generic', result.newTrades, result.updates, result.skippedRows, result.dupSkipped);
    } catch (err) {
      setParseError(`Mapping failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStep('upload');
    } finally {
      setParsing(false);
    }
  }, [manualMapping, finishParse]);

  // ── Selection ─────────────────────────────────────────────────────────────

  const toggleAll = () => {
    const allTradeIds  = newTrades.map(t => t._importId);
    const allUpdateIds = updates.map(u => u._updateId);
    const allSelected  = selectedIds.size === allTradeIds.length && selectedUpdateIds.size === allUpdateIds.length;
    if (allSelected) {
      setSelectedIds(new Set());
      setSelectedUpdateIds(new Set());
    } else {
      setSelectedIds(new Set(allTradeIds));
      setSelectedUpdateIds(new Set(allUpdateIds));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleUpdate = (id: string) => {
    setSelectedUpdateIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ── Layer 4: Import ───────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    const toImport = newTrades.filter(t => selectedIds.has(t._importId));
    const toUpdate = updates.filter(u => selectedUpdateIds.has(u._updateId));
    const total    = toImport.length + toUpdate.length;
    if (total === 0) return;

    setImporting(true);
    setStep('importing');
    setImportProgress(0);

    const brokerLabel  = BROKER_LABELS[detectedFormat ?? 'generic'];
    const importedNote = `Imported from ${brokerLabel} on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    let succeeded = 0;
    let i = 0;

    // Insert new trades
    for (const t of toImport) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _importId, isDuplicate, hasWarning, warningMsg, is_short, isOrphan, ...rest } = t;
      const row: Omit<Trade, 'id' | 'created_at'> & { user_id: string } = {
        user_id:               userId,
        ticker:                rest.ticker,
        setup_type:            null,
        phase1_date:           rest.phase1_date,
        phase1_price:          rest.phase1_price,
        phase1_shares:         rest.phase1_shares,
        phase2_date:           null,
        phase2_price:          null,
        phase2_shares:         null,
        initial_stop:          rest.initial_stop,
        current_stop:          rest.current_stop,
        stop_distance_pct:     rest.stop_distance_pct,
        risk_dollars:          rest.risk_dollars,
        rs_rating:             null,
        trend_template_passed: false,
        exit_date:             rest.exit_date,
        exit_price:            rest.exit_price,
        status:                rest.status,
        outcome:               rest.outcome ?? null,
        pnl_dollars:           rest.pnl_dollars,
        pnl_pct:               rest.pnl_pct,
        r_multiple:            rest.r_multiple,
        notes:                 importedNote,
        lesson_learned:        null,
        screenshot_url:        null,
        partials:              rest.partials,
        current_shares:        rest.current_shares,
        is_what_if:            true,
        failed_gates:          is_short ? ['imported_from_broker', 'short_position'] : ['imported_from_broker'],
        what_if_reason:        `Imported from ${brokerLabel}${is_short ? ' (Short)' : ''}`,
      };
      const { error } = await supabase.from('trades').insert(row);
      if (!error) succeeded++;
      i++;
      setImportProgress(Math.round((i / total) * 100));
    }

    // Apply updates to existing DB trades
    for (const upd of toUpdate) {
      const { data: existing, error: fetchErr } = await supabase
        .from('trades')
        .select('partials, phase1_price, phase1_shares, initial_stop')
        .eq('id', upd.existingId)
        .single();

      if (fetchErr || !existing) {
        i++;
        setImportProgress(Math.round((i / total) * 100));
        continue;
      }

      const mergedPartials = [...((existing.partials ?? []) as PartialRecord[]), ...upd.newPartials];
      const sellPs   = mergedPartials.filter(p => p.action === 'sell');
      const buyPs    = mergedPartials.filter(p => p.action === 'buy');
      const totalPnl = sellPs.reduce((s, p) => s + p.pnl_dollars, 0);

      const updateFields: Record<string, unknown> = {
        partials:       mergedPartials,
        current_shares: upd.newShares,
      };

      if (upd.willClose) {
        const totalInvested = Number(existing.phase1_price) * Number(existing.phase1_shares)
          + buyPs.reduce((s, p) => s + p.price * p.shares, 0);
        const riskPerSh = Math.max(0, Number(existing.phase1_price) - Number(existing.initial_stop));

        updateFields.status      = 'closed';
        updateFields.exit_date   = upd.closeDate;
        updateFields.exit_price  = upd.closePrice;
        updateFields.pnl_dollars = totalPnl;
        updateFields.pnl_pct     = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : null;
        updateFields.r_multiple  = riskPerSh > 0 ? totalPnl / (riskPerSh * Number(existing.phase1_shares)) : null;
        updateFields.outcome     = totalPnl > 0.005 ? 'winner' : totalPnl < -0.005 ? 'loser' : 'breakeven';
      }

      const { error } = await supabase.from('trades').update(updateFields).eq('id', upd.existingId);
      if (!error) succeeded++;
      i++;
      setImportProgress(Math.round((i / total) * 100));
    }

    setImporting(false);
    setStep('done');

    if (succeeded > 0) {
      toast({
        title:   `Imported ${toImport.length} trade${toImport.length !== 1 ? 's' : ''}${toUpdate.length > 0 ? ` + updated ${toUpdate.length} position${toUpdate.length !== 1 ? 's' : ''}` : ''}`,
        body:    `From ${brokerLabel}. Marked as Non-System imports.`,
        variant: 'success',
        durationMs: 5000,
      });
      onImported(succeeded);
    } else {
      toast({ title: 'Import failed', body: 'All inserts were rejected. Check Supabase RLS.', variant: 'error' });
    }
  }, [newTrades, updates, selectedIds, selectedUpdateIds, detectedFormat, userId, onImported]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!mounted) return null;

  const selectedCount       = selectedIds.size + selectedUpdateIds.size;
  const totalPreviewItems   = newTrades.length + updates.length;

  const modal = (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6"
      style={{ background: 'var(--modal-overlay)', backdropFilter: 'blur(20px) saturate(130%)', WebkitBackdropFilter: 'blur(20px) saturate(130%)' }}
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
              Upload your Excel or CSV export — trades merge across files automatically.
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

          {/* ── Upload step ────────────────────────────────────────── */}
          {(step === 'upload' || parsing) && (
            <div className="p-6 flex flex-col gap-4">
              <div className="flex gap-2 flex-wrap">
                {Object.entries(BROKER_LABELS).map(([k, v]) => (
                  <span key={k} className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]">{v}</span>
                ))}
              </div>

              <div
                onDragOver={e  => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'cursor-pointer rounded-[14px] border-2 border-dashed p-10 flex flex-col items-center justify-center gap-3 transition-all select-none',
                  isDragging ? 'border-[#10F088]/60 bg-[#10F088]/[0.06]' : 'border-[var(--border-strong)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]',
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
                      <p className="text-[14px] font-semibold text-[var(--text-secondary)]">Drop your broker export here</p>
                      <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                        or <span className="text-[#10F088] font-semibold">click to browse</span> — .xlsx, .xls, .csv
                      </p>
                    </div>
                    <p className="text-[10px] text-[var(--text-faint)]">Max 5 MB · Multiple files supported (upload one at a time)</p>
                  </>
                )}
              </div>

              {!parsing && existingPositionsRef.current.size > 0 && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-[8px] bg-[#22D3EE]/[0.06] border border-[#22D3EE]/20">
                  <RefreshCw className="w-3.5 h-3.5 text-[#22D3EE] flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[#22D3EE]/90">
                    <strong>{existingPositionsRef.current.size} open position{existingPositionsRef.current.size !== 1 ? 's' : ''}</strong> loaded from your journal ({[...existingPositionsRef.current.keys()].join(', ')}) — new transactions will merge into them automatically.
                  </p>
                </div>
              )}

              {parseError && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-[10px] bg-[#FF3B5C]/[0.07] border border-[#FF3B5C]/25">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#FF3B5C] flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-[#FF3B5C]">{parseError}</p>
                </div>
              )}

              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-[10px] bg-amber-400/[0.07] border border-amber-400/20">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-400/90 leading-relaxed">
                  Imported trades can&apos;t be validated retroactively against Minervini&apos;s Trend Template.
                  They&apos;ll be marked <strong>Non-System</strong> in your Playbook.
                </p>
              </div>

              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
            </div>
          )}

          {/* ── Manual mapping step ─────────────────────────────────── */}
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
                    <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)] capitalize">{field} column</label>
                    <select value={manualMapping[field]} onChange={e => setManualMapping(prev => ({ ...prev, [field]: e.target.value }))}
                      className="bg-[var(--bg-input)] border border-[var(--border-dim)] rounded-[8px] px-3 py-2.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[#10F088] focus:ring-[3px] focus:ring-[#10F088]/15 transition appearance-none">
                      <option value="">— select column —</option>
                      {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex gap-2.5 pt-1">
                <button onClick={() => setStep('upload')} className="flex-1 py-2.5 rounded-[10px] border border-[var(--border-strong)] text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-dim)] transition-all">Back</button>
                <button onClick={() => void handleManualMapping()} disabled={Object.values(manualMapping).some(v => !v)}
                  className={cn('flex-[2] py-2.5 rounded-[10px] text-[12px] font-extrabold uppercase tracking-wider transition-all',
                    Object.values(manualMapping).some(v => !v) ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed' : 'bg-gradient-to-br from-[#10F088] to-[#22D3EE] text-black hover:brightness-110')}>
                  Confirm Mapping
                </button>
              </div>
            </div>
          )}

          {/* ── Preview step ────────────────────────────────────────── */}
          {step === 'preview' && (
            <div className="flex flex-col">
              {/* ── Layer 5: Summary bar ───────────────────────────── */}
              <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3 text-[12px] flex-wrap">
                  <span className="font-semibold text-[var(--text-secondary)]">
                    Detected: <span className="text-[#10F088] font-bold">{BROKER_LABELS[detectedFormat ?? 'generic']}</span>
                  </span>
                  <span className="text-[var(--text-faint)]">·</span>
                  {newTrades.length > 0 && (
                    <span className="text-[#10F088] font-semibold">📥 {newTrades.length} new trade{newTrades.length !== 1 ? 's' : ''}</span>
                  )}
                  {updates.length > 0 && (
                    <>
                      {newTrades.length > 0 && <span className="text-[var(--text-faint)]">·</span>}
                      <span className="text-[#22D3EE] font-semibold">🔄 {updates.length} position update{updates.length !== 1 ? 's' : ''}</span>
                    </>
                  )}
                  {dupSkipped > 0 && (
                    <>
                      <span className="text-[var(--text-faint)]">·</span>
                      <span className="text-[var(--text-muted)] text-[11px]">⏭ {dupSkipped} already imported</span>
                    </>
                  )}
                  {skippedRows > 0 && (
                    <>
                      <span className="text-[var(--text-faint)]">·</span>
                      <span className="text-amber-400 text-[11px]">
                        <AlertTriangle className="inline w-3 h-3 mr-0.5" />{skippedRows} rows skipped
                      </span>
                    </>
                  )}
                  {newTrades.some(t => t.isOrphan) && (
                    <>
                      <span className="text-[var(--text-faint)]">·</span>
                      <span className="text-amber-400 text-[11px] font-semibold">
                        ⚠ {newTrades.filter(t => t.isOrphan).length} inherited ({newTrades.filter(t => t.isOrphan).map(t => t.ticker).join(', ')})
                      </span>
                    </>
                  )}
                </div>
                <button onClick={toggleAll} className="text-[11px] font-semibold text-[#22D3EE] hover:underline whitespace-nowrap flex-shrink-0">
                  {selectedIds.size === newTrades.length && selectedUpdateIds.size === updates.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {/* ── Updates to existing positions ──────────────────── */}
              {updates.length > 0 && (
                <div className="border-b border-[var(--border-subtle)]">
                  <div className="px-4 py-2 bg-[#22D3EE]/[0.04] border-b border-[#22D3EE]/10">
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#22D3EE]">
                      🔄 Updates to existing positions
                    </span>
                  </div>
                  {updates.map(upd => (
                    <UpdateRow
                      key={upd._updateId}
                      update={upd}
                      selected={selectedUpdateIds.has(upd._updateId)}
                      expanded={expandedId === upd._updateId}
                      onToggle={() => toggleUpdate(upd._updateId)}
                      onExpand={() => setExpandedId(expandedId === upd._updateId ? null : upd._updateId)}
                    />
                  ))}
                </div>
              )}

              {/* ── New trades ─────────────────────────────────────── */}
              {newTrades.length > 0 && (
                <div>
                  {updates.length > 0 && (
                    <div className="px-4 py-2 bg-[#10F088]/[0.03] border-b border-[#10F088]/10">
                      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#10F088]">
                        📥 New trades
                      </span>
                    </div>
                  )}
                  <div className="divide-y divide-[var(--divider)]">
                    {newTrades.map(trade => (
                      <PreviewRow
                        key={trade._importId}
                        trade={trade}
                        selected={selectedIds.has(trade._importId)}
                        expanded={expandedId === trade._importId}
                        onToggle={() => toggleOne(trade._importId)}
                        onExpand={() => setExpandedId(expandedId === trade._importId ? null : trade._importId)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Importing progress ──────────────────────────────────── */}
          {step === 'importing' && (
            <div className="p-10 flex flex-col items-center gap-5">
              <Loader2 className="w-8 h-8 text-[#10F088] animate-spin" />
              <div className="text-center">
                <p className="text-[14px] font-semibold text-[var(--text-secondary)]">
                  Importing {selectedIds.size} trade{selectedIds.size !== 1 ? 's' : ''}{selectedUpdateIds.size > 0 ? ` + ${selectedUpdateIds.size} update${selectedUpdateIds.size !== 1 ? 's' : ''}` : ''}…
                </p>
                <p className="text-[12px] text-[var(--text-muted)] mt-1">{importProgress}% complete</p>
              </div>
              <div className="w-64 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#10F088] to-[#22D3EE] transition-all" style={{ width: `${importProgress}%` }} />
              </div>
            </div>
          )}

          {/* ── Done ───────────────────────────────────────────────── */}
          {step === 'done' && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-[#10F088]/15 flex items-center justify-center">
                <Check className="w-7 h-7 text-[#10F088]" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[16px] font-extrabold text-[var(--text-primary)]">Import complete</p>
                <p className="text-[12px] text-[var(--text-muted)] mt-1">Your trades are now in the Journal, marked as Non-System imports.</p>
              </div>
              <button onClick={onClose} className="mt-2 px-6 py-2.5 rounded-[10px] bg-gradient-to-br from-[#10F088] to-[#22D3EE] text-black text-[12px] font-extrabold uppercase tracking-wider hover:brightness-110 transition">
                View Journal
              </button>
            </div>
          )}
        </div>

        {/* Footer — preview only */}
        {step === 'preview' && (
          <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-shrink-0 bg-[var(--bg-modal)]">
            <span className="text-[12px] text-[var(--text-muted)]">
              <span className="font-bold text-[var(--text-secondary)]">{selectedCount}</span> of {totalPreviewItems} selected
              {dupSkipped > 0 && (
                <span className="text-[var(--text-faint)] ml-2">· {dupSkipped} duplicate{dupSkipped !== 1 ? 's' : ''} auto-skipped</span>
              )}
            </span>
            <div className="flex gap-2.5">
              <button onClick={onClose} className="px-4 py-2 rounded-[9px] border border-[var(--border-strong)] text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-dim)] transition-all">Cancel</button>
              <button
                onClick={() => void handleImport()}
                disabled={selectedCount === 0}
                className={cn('px-5 py-2 rounded-[9px] text-[12px] font-extrabold uppercase tracking-wider transition-all flex items-center gap-2',
                  selectedCount === 0 ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed' : 'bg-gradient-to-br from-[#10F088] to-[#22D3EE] text-black hover:brightness-110 shadow-[0_0_18px_rgba(16,240,136,0.25)]')}
              >
                Import {selectedCount > 0 ? `${selectedCount}` : ''} Item{selectedCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── UpdateRow ─────────────────────────────────────────────────────────────────

function UpdateRow({
  update, selected, expanded, onToggle, onExpand,
}: { update: TradeUpdate; selected: boolean; expanded: boolean; onToggle: () => void; onExpand: () => void; }) {
  const buyCnt  = update.newPartials.filter(p => p.action === 'buy').length;
  const sellCnt = update.newPartials.filter(p => p.action === 'sell').length;
  const parts: string[] = [];
  if (buyCnt  > 0) parts.push(`+${buyCnt} add${buyCnt  !== 1 ? 's' : ''}`);
  if (sellCnt > 0) parts.push(`+${sellCnt} trim${sellCnt !== 1 ? 's' : ''}`);

  return (
    <div className="transition-colors hover:bg-[#22D3EE]/[0.02]">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <button type="button" onClick={onToggle}
          className={cn('w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
            selected ? 'bg-[#22D3EE] border-[#22D3EE]' : 'border-[var(--border-strong)] hover:border-[#22D3EE]')}>
          {selected && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
        </button>

        {/* Ticker */}
        <span className="font-mono text-[13px] font-extrabold tracking-tight w-14 flex-shrink-0 text-[#22D3EE]">
          {update.ticker}
        </span>

        {/* Original entry date */}
        <span className="text-[10px] font-mono text-[var(--text-muted)] w-16 flex-shrink-0">
          {fmtDate(update.existingPhase1Date)}
        </span>

        {/* Shares before / after */}
        <div className="w-28 flex-shrink-0">
          <span className="text-[10px] font-mono text-[var(--text-faint)]">
            {update.currentShares} sh → <span className={cn('font-bold', update.willClose ? 'text-[#FF3B5C]' : 'text-[#10F088]')}>{update.newShares} sh</span>
          </span>
        </div>

        {/* Partial summary */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#22D3EE]/10 text-[#22D3EE] border border-[#22D3EE]/20 whitespace-nowrap">
            {parts.join(', ')}
          </span>
          {update.willClose && (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FF3B5C]/10 text-[#FF3B5C] border border-[#FF3B5C]/20 whitespace-nowrap">
              → CLOSES
            </span>
          )}
        </div>

        {/* Expand toggle */}
        {update.newPartials.length > 0 && (
          <button type="button" onClick={onExpand}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-faint)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-all flex-shrink-0">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Expanded new partials */}
      {expanded && update.newPartials.length > 0 && (
        <div className="px-10 pb-3 flex flex-col gap-1">
          {update.newPartials.map(p => {
            const isBuy = p.action === 'buy';
            return (
              <div key={p.id} className={cn('flex items-center gap-3 px-3 py-1.5 rounded-[6px] border text-[10px]',
                isBuy ? 'bg-[#22D3EE]/[0.03] border-[#22D3EE]/15' : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]')}>
                <span className={cn('text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                  isBuy ? 'bg-[#22D3EE]/15 text-[#22D3EE]' : 'bg-[#A78BFA]/15 text-[#A78BFA]')}>
                  {isBuy ? 'Add' : 'Trim'}
                </span>
                <span className="font-mono text-[var(--text-faint)]">{fmtDate(p.date)}</span>
                <span className="font-mono text-[var(--text-muted)]">{isBuy ? '+' : '−'}{p.shares} sh @ ${p.price.toFixed(2)}</span>
                {!isBuy && (
                  <span className={cn('ml-auto font-mono font-bold', p.pnl_dollars >= 0 ? 'text-[#10F088]' : 'text-[#FF3B5C]')}>
                    {p.pnl_dollars >= 0 ? '+' : ''}${p.pnl_dollars.toFixed(0)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Preview helpers ───────────────────────────────────────────────────────────

function computePreviewValues(trade: ImportedTrade) {
  let shares  = trade.phase1_shares;
  let avgCost = trade.phase1_price;
  let invested = shares * avgCost;
  let realizedPnL  = 0;
  let hasBuyPartials = false;

  for (const p of trade.partials) {
    if (p.action === 'buy') {
      invested   += p.shares * p.price;
      shares     += p.shares;
      avgCost     = invested / shares;
      hasBuyPartials = true;
    } else {
      realizedPnL += p.pnl_dollars;
      shares      -= p.shares;
      invested     = shares * avgCost;
    }
  }

  const buyCnt  = trade.partials.filter(p => p.action === 'buy').length;
  const sellCnt = trade.partials.filter(p => p.action === 'sell').length;
  const parts: string[] = [];
  if (buyCnt  > 0) parts.push(`${buyCnt} add${buyCnt  !== 1 ? 's' : ''}`);
  if (sellCnt > 0) parts.push(`${sellCnt} exit${sellCnt !== 1 ? 's' : ''}`);

  return { avgEntry: avgCost, realizedPnL, hasBuyPartials, partialLabel: parts.join(', '), buyCnt, sellCnt };
}

// ── PreviewRow ────────────────────────────────────────────────────────────────

function PreviewRow({
  trade, selected, expanded, onToggle, onExpand,
}: { trade: ImportedTrade; selected: boolean; expanded: boolean; onToggle: () => void; onExpand: () => void; }) {
  const { avgEntry, realizedPnL, hasBuyPartials, partialLabel } = computePreviewValues(trade);

  const displayPnL = trade.isOrphan
    ? null
    : trade.status === 'closed'
      ? trade.pnl_dollars
      : realizedPnL !== 0 ? realizedPnL : null;

  const pnlPositive = (displayPnL ?? 0) >= 0;

  const sharesDisplay = trade.isOrphan
    ? `${trade.phase1_shares} sh`
    : trade.status === 'open'
      ? `${trade.current_shares} sh`
      : `${trade.phase1_shares} sh`;

  const hasPartials = trade.partials.length > 0;

  return (
    <div className={cn('transition-colors', 'hover:bg-[var(--bg-elevated)]')}>
      <div className="flex items-center gap-2.5 px-4 py-3">
        <button type="button" onClick={onToggle}
          className={cn('w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
            selected ? 'bg-[#10F088] border-[#10F088]' : 'border-[var(--border-strong)] hover:border-[#10F088]')}
          aria-label={selected ? 'Deselect' : 'Select'}>
          {selected && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
        </button>

        <span className="font-mono text-[13px] font-extrabold tracking-tight w-14 flex-shrink-0">{trade.ticker}</span>

        <span className="text-[10px] font-mono text-[var(--text-muted)] w-16 flex-shrink-0">{fmtDate(trade.phase1_date)}</span>

        <div className="w-20 flex-shrink-0">
          {trade.isOrphan ? (
            <span className="text-[10px] font-mono text-amber-400">? (review)</span>
          ) : (
            <div>
              <span className="text-[11px] font-mono text-[var(--text-dim)]">${avgEntry.toFixed(2)}</span>
              {hasBuyPartials && <span className="text-[8px] text-[#22D3EE] ml-0.5">avg</span>}
            </div>
          )}
        </div>

        <div className="w-16 flex-shrink-0">
          <span className="text-[10px] font-mono text-[var(--text-faint)]">{sharesDisplay}</span>
          {trade.status === 'open' && realizedPnL !== 0 && (
            <div className={cn('text-[8px] font-mono font-bold', realizedPnL >= 0 ? 'text-[#10F088]' : 'text-[#FF3B5C]')}>
              {realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(0)} realized
            </div>
          )}
        </div>

        <span className="text-[10px] font-mono text-[var(--text-muted)] w-16 flex-shrink-0">
          {trade.exit_date ? fmtDate(trade.exit_date) : '—'}
        </span>

        <span className={cn('font-mono text-[11px] font-bold w-16 flex-shrink-0',
          displayPnL === null ? 'text-[var(--text-faint)]' : pnlPositive ? 'text-[#10F088]' : 'text-[#FF3B5C]')}>
          {displayPnL === null
            ? (trade.status === 'open' ? 'Open' : trade.isOrphan ? '?' : '—')
            : `${pnlPositive ? '+' : ''}$${Math.abs(displayPnL).toFixed(0)}`}
        </span>

        <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
          {trade.is_short && (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 whitespace-nowrap">🔻 Short</span>
          )}
          {trade.isOrphan ? (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20 whitespace-nowrap">⚠ Inherited</span>
          ) : (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-faint)] border border-[var(--border-subtle)]">Non-System</span>
          )}
          {trade.outcome && (
            <span className={cn('text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap',
              trade.outcome === 'winner'   ? 'bg-[#10F088]/10 text-[#10F088] border border-[#10F088]/20' :
              trade.outcome === 'loser'    ? 'bg-[#FF3B5C]/10 text-[#FF3B5C] border border-[#FF3B5C]/20' :
              'bg-amber-400/10 text-amber-400 border border-amber-400/20')}>
              {trade.outcome}
            </span>
          )}
          {partialLabel && <span className="text-[8px] text-[var(--text-faint)] font-mono whitespace-nowrap">{partialLabel}</span>}
        </div>

        {hasPartials && (
          <button type="button" onClick={onExpand}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-faint)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-all flex-shrink-0">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Expanded partials */}
      {expanded && hasPartials && (
        <div className="px-10 pb-3 flex flex-col gap-1">
          {trade.partials.map(p => {
            const isBuy = p.action === 'buy';
            return (
              <div key={p.id} className={cn('flex items-center gap-3 px-3 py-1.5 rounded-[6px] border text-[10px]',
                isBuy ? 'bg-[#22D3EE]/[0.03] border-[#22D3EE]/15' : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]')}>
                <span className={cn('text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                  isBuy ? 'bg-[#22D3EE]/15 text-[#22D3EE]' : 'bg-[#A78BFA]/15 text-[#A78BFA]')}>
                  {isBuy ? 'Add' : 'Trim'}
                </span>
                <span className="font-mono text-[var(--text-faint)]">{fmtDate(p.date)}</span>
                <span className="font-mono text-[var(--text-muted)]">{isBuy ? '+' : '−'}{p.shares} sh @ ${p.price.toFixed(2)}</span>
                {!isBuy && (
                  <span className={cn('ml-auto font-mono font-bold',
                    p.pnl_dollars !== 0 ? p.pnl_dollars >= 0 ? 'text-[#10F088]' : 'text-[#FF3B5C]' : 'text-[var(--text-faint)]')}>
                    {p.pnl_dollars === 0 ? '? (edit entry)' : `${p.pnl_dollars >= 0 ? '+' : ''}$${p.pnl_dollars.toFixed(0)}`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}
