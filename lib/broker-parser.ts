// lib/broker-parser.ts
//
// Parses Excel/CSV broker exports into ImportedTrade objects.
//
// MEITAV (Hebrew broker) uses a completely different path from all other formats:
//   • Each SELL row (מכירה / שורט) = one closed trade; P&L is read DIRECTLY from
//     the file's "P&L" column — no FIFO calculation, no price arithmetic.
//   • Each BUY row (קניה / קניה לכיסוי) = open position; BUYs for the same ticker
//     are aggregated into one open trade (phase1 + buy partials).
//
// All other brokers (IBI, IBKR, eToro, generic) continue to use the FIFO grouping
// logic in broker-parser-internal.ts.

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { groupToTrades } from './broker-parser-internal';

// ── Public types ───────────────────────────────────────────────────────────────

export type BrokerFormat = 'meitav' | 'ibi' | 'ibkr' | 'etoro' | 'generic';

export interface RawTransaction {
  ticker:   string;
  action:   'buy' | 'sell';
  quantity: number;
  price:    number;
  date:     string;   // ISO date string YYYY-MM-DD
  fees:     number;
  currency: 'USD' | 'ILS';
  isShort:  boolean;
  pnl?:     number;
}

export interface PartialRecord {
  id:          string;
  date:        string;
  shares:      number;
  price:       number;
  action:      'buy' | 'sell';
  pnl_dollars: number;
  pnl_pct:     number;
  r_multiple:  number;
}

export interface ImportedTrade {
  _importId:          string;
  ticker:             string;
  phase1_date:        string;
  phase1_price:       number;
  phase1_shares:      number;
  initial_stop:       number;
  current_stop:       number;
  stop_distance_pct:  number;
  risk_dollars:       number;
  status:             'open' | 'closed';
  exit_date:          string | null;
  exit_price:         number | null;
  pnl_dollars:        number | null;
  pnl_pct:            number | null;
  r_multiple:         number | null;
  outcome:            'winner' | 'loser' | 'breakeven' | null;
  partials:           PartialRecord[];
  current_shares:     number;
  trend_template_passed: false;
  is_what_if:         boolean;
  is_short:           boolean;
  failed_gates:       string[];
  notes:              string;
  isDuplicate:        boolean;
  hasWarning:         boolean;
  warningMsg:         string;
  isOrphan:           boolean;
}

export interface ExistingPosition {
  existingId:   string;
  ticker:       string;
  phase1Date:   string;
  shares:       number;
  avgCost:      number;
  initial_stop: number;
  isShort?:     boolean;
}

export interface TradeUpdate {
  _updateId:          string;
  existingId:         string;
  ticker:             string;
  existingPhase1Date: string;
  currentShares:      number;
  newPartials:        PartialRecord[];
  newShares:          number;
  willClose:          boolean;
  closeDate:          string | null;
  closePrice:         number | null;
}

export interface ParseResult {
  format:       BrokerFormat;
  transactions: RawTransaction[];
  newTrades:    ImportedTrade[];
  updates:      TradeUpdate[];
  skippedRows:  number;
  dupSkipped:   number;
}

// ── File → raw rows ────────────────────────────────────────────────────────────

export async function parseFile(
  file:               File,
  existingPositions:  Map<string, ExistingPosition> = new Map(),
  existingSignatures: Set<string>                  = new Set(),
): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  let rawRows: Record<string, string>[];

  if (name.endsWith('.csv')) {
    rawRows = await parseCsv(file);
  } else {
    rawRows = await parseExcel(file);
  }

  const headers = Object.keys(rawRows[0] ?? {});
  const format  = detectBrokerFormat(headers);

  // ── Meitav: bypass FIFO entirely ─────────────────────────────────────────
  if (format === 'meitav') {
    const { newTrades, skippedRows, dupSkipped } = parseMeitavRows(rawRows, existingSignatures);
    return { format, transactions: [], newTrades, updates: [], skippedRows, dupSkipped };
  }

  // ── All other brokers: FIFO grouping ──────────────────────────────────────
  const { transactions, skippedRows } = mapToTransactions(rawRows, format);
  const { newTrades, updates, skippedCount: dupSkipped } = groupToTrades(
    transactions,
    format,
    existingPositions,
    existingSignatures,
  );

  return { format, transactions, newTrades, updates, skippedRows, dupSkipped };
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCsv(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header:         true,
      skipEmptyLines: true,
      complete: r  => resolve(r.data as Record<string, string>[]),
      error:    e  => reject(new Error(e.message)),
    });
  });
}

// ── Excel parser ──────────────────────────────────────────────────────────────

function parseExcel(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data     = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows     = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        resolve(rows.map(r =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? '').trim()])),
        ));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// ── Broker detection ──────────────────────────────────────────────────────────

function detectBrokerFormat(headers: string[]): BrokerFormat {
  const h = headers.map(x => x.toLowerCase().trim());

  if (h.some(x => x.includes('סימול') || x.includes('מחיר') || x.includes('כמות') || x.includes('פעולה'))) {
    return 'meitav';
  }
  if ((h.includes('tradeprice') || h.includes('trade price')) && (h.includes('buy/sell') || h.includes('buysell'))) {
    return 'ibkr';
  }
  if (h.includes('tradedate') && h.includes('quantity') && h.includes('tradeprice')) {
    return 'ibkr';
  }
  if (h.includes('action') && h.includes('symbol') && h.includes('quantity') && h.includes('price')) {
    return 'ibi';
  }
  if (h.some(x => x.includes('position id')) || (h.includes('open date') && h.includes('close date'))) {
    return 'etoro';
  }

  return 'generic';
}

// ── Fuzzy column finder ───────────────────────────────────────────────────────

function findCol(row: Record<string, string>, candidate: string): string | null {
  if (!candidate) return null;
  const keys   = Object.keys(row);
  const target = candidate.toLowerCase().trim();
  const exact  = keys.find(k => k.toLowerCase().trim() === target);
  if (exact) return exact;
  const partial = keys.find(k => k.toLowerCase().includes(target) || target.includes(k.toLowerCase().trim()));
  return partial ?? null;
}

// ════════════════════════════════════════════════════════════════════════════
// MEITAV-SPECIFIC PARSER — no FIFO, no price arithmetic, P&L from file only
// ════════════════════════════════════════════════════════════════════════════
//
// Meitav columns: תאריך | פעולה | כמות | סימול | מחיר | P&L | Principal
//
// Action values:
//   קניה          → BUY  (open long)
//   מכירה         → SELL (close long)  — pnl_dollars = row["P&L"]
//   שורט          → SELL (short trade) — pnl_dollars = row["P&L"]
//   קניה לכיסוי   → BUY  (cover short)
//
// Output:
//   SELL rows  → one ImportedTrade per row, status='closed', pnl from file
//   BUY rows   → aggregated per ticker, status='open'

function parseMeitavRows(
  rows:               Record<string, string>[],
  existingSignatures: Set<string>,
): { newTrades: ImportedTrade[]; skippedRows: number; dupSkipped: number } {

  const closedTrades: ImportedTrade[] = [];
  let skippedRows = 0;
  let dupSkipped  = 0;

  // Accumulate open positions per ticker
  interface OpenAccum {
    ticker:       string;
    phase1_date:  string;
    phase1_price: number;
    phase1_shares:number;
    extraBuys:    Array<{ date: string; price: number; shares: number }>;
    totalShares:  number;
    totalInvested:number;
  }
  const openPositions = new Map<string, OpenAccum>();

  for (const row of rows) {
    try {
      // ── Find columns ──────────────────────────────────────────────────────
      const tickerCol = findCol(row, 'סימול');
      const actionCol = findCol(row, 'פעולה');
      const qtyCol    = findCol(row, 'כמות');
      const priceCol  = findCol(row, 'מחיר');
      const dateCol   = findCol(row, 'תאריך');
      const pnlCol    = findCol(row, 'P&L');

      if (!tickerCol || !actionCol || !qtyCol || !priceCol || !dateCol) {
        skippedRows++;
        continue;
      }

      // ── Parse values ──────────────────────────────────────────────────────
      const rawTicker = row[tickerCol]?.trim().toUpperCase() ?? '';
      const rawAction = row[actionCol]?.trim() ?? '';
      const rawQty    = row[qtyCol]?.replace(/[,\s]/g, '') ?? '';
      const rawPrice  = row[priceCol]?.replace(/[,$₪\s]/g, '') ?? '';
      const rawDate   = row[dateCol]?.trim() ?? '';

      if (!rawTicker || !/^[A-Z.]{1,10}$/.test(rawTicker)) { skippedRows++; continue; }

      const qty   = Math.abs(parseFloat(rawQty));
      const price = parseFloat(rawPrice);
      if (!isFinite(qty) || qty <= 0)   { skippedRows++; continue; }
      if (!isFinite(price) || price <= 0) { skippedRows++; continue; }

      const date = normaliseDate(rawDate, 'meitav');
      if (!date) { skippedRows++; continue; }

      // ── Classify action ───────────────────────────────────────────────────
      // קניה / קניה לכיסוי → BUY   |   מכירה / שורט → SELL
      const isSell = rawAction.includes('מכיר') || rawAction.includes('שורט');
      const isBuy  = rawAction.includes('קני');
      if (!isSell && !isBuy) { skippedRows++; continue; }

      const action: 'buy' | 'sell' = isSell ? 'sell' : 'buy';

      // ── Deduplication ─────────────────────────────────────────────────────
      // Closed trades: dedup via sell signature (exit price, not entry)
      // Open trades:   dedup via buy signature (entry price)
      const sig = `${rawTicker}|${date}|${price.toFixed(2)}|${qty}|${action}`;
      if (existingSignatures.has(sig)) {
        dupSkipped++;
        continue;
      }

      // ── Read P&L for sell rows ────────────────────────────────────────────
      let pnl = 0;
      if (isSell && pnlCol) {
        const rawPnl = row[pnlCol]?.replace(/[,$₪\s]/g, '') ?? '';
        const parsed = parseFloat(rawPnl);
        if (isFinite(parsed)) pnl = parsed;
      }

      // ── BUY → accumulate open position ───────────────────────────────────
      if (!isSell) {
        const existing = openPositions.get(rawTicker);
        if (!existing) {
          openPositions.set(rawTicker, {
            ticker:        rawTicker,
            phase1_date:   `${date}T12:00:00Z`,
            phase1_price:  price,
            phase1_shares: qty,
            extraBuys:     [],
            totalShares:   qty,
            totalInvested: price * qty,
          });
        } else {
          existing.extraBuys.push({ date, price, shares: qty });
          existing.totalShares   += qty;
          existing.totalInvested += price * qty;
        }
        continue;
      }

      // ── SELL → one closed ImportedTrade ───────────────────────────────────
      //
      // Back-calculate the approximate average entry price from the P&L:
      //   pnl = (sellPrice - avgEntry) × qty  →  avgEntry = sellPrice - pnl/qty
      //
      // For שורט (short), the same formula works because Meitav records the
      // net realized gain/loss regardless of direction.
      const avgEntry   = qty > 0 ? price - pnl / qty : price;
      const safeEntry  = Math.max(0.01, avgEntry);
      const estStop    = safeEntry * 0.92;
      const outcome    = pnl >  0.005 ? 'winner'
                       : pnl < -0.005 ? 'loser'
                       : 'breakeven';
      const pnlPct     = safeEntry > 0
        ? (pnl / (safeEntry * qty)) * 100
        : null;

      // The sell partial enables future deduplication: when this trade is
      // already in the DB, the partial's signature matches the sell row's sig.
      const sellPartial: PartialRecord = {
        id:          crypto.randomUUID(),
        date:        `${date}T12:00:00Z`,
        action:      'sell',
        shares:      qty,
        price,           // exit / sell price
        pnl_dollars: pnl,
        pnl_pct:     pnlPct ?? 0,
        r_multiple:  0,
      };

      closedTrades.push({
        _importId:             crypto.randomUUID(),
        ticker:                rawTicker,
        phase1_date:           `${date}T12:00:00Z`,   // best estimate — same day as exit
        phase1_price:          safeEntry,              // back-calculated avg entry
        phase1_shares:         qty,
        initial_stop:          estStop,
        current_stop:          estStop,
        stop_distance_pct:     8,
        risk_dollars:          0,
        status:                'closed',
        exit_date:             `${date}T12:00:00Z`,
        exit_price:            price,
        pnl_dollars:           pnl,                   // ← READ FROM FILE, not calculated
        pnl_pct:               pnlPct,
        r_multiple:            null,
        outcome,
        partials:              [sellPartial],          // for dedup on re-import
        current_shares:        0,
        trend_template_passed: false,
        is_what_if:            true,
        is_short:              rawAction.includes('שורט'),
        failed_gates:          ['imported_from_broker'],
        notes:                 'Imported from Meitav',
        isDuplicate:           false,
        hasWarning:            false,
        warningMsg:            '',
        isOrphan:              false,
      });

    } catch {
      skippedRows++;
    }
  }

  // ── Convert accumulated open positions → ImportedTrade ────────────────────
  const openTrades: ImportedTrade[] = [];
  for (const pos of openPositions.values()) {
    const avgCost = pos.totalShares > 0
      ? pos.totalInvested / pos.totalShares
      : pos.phase1_price;
    const estStop = avgCost * 0.92;

    const buyPartials: PartialRecord[] = pos.extraBuys.map(b => ({
      id:          crypto.randomUUID(),
      date:        `${b.date}T12:00:00Z`,
      action:      'buy' as const,
      shares:      b.shares,
      price:       b.price,
      pnl_dollars: 0,
      pnl_pct:     0,
      r_multiple:  0,
    }));

    openTrades.push({
      _importId:             crypto.randomUUID(),
      ticker:                pos.ticker,
      phase1_date:           pos.phase1_date,
      phase1_price:          pos.phase1_price,
      phase1_shares:         pos.phase1_shares,
      initial_stop:          estStop,
      current_stop:          estStop,
      stop_distance_pct:     8,
      risk_dollars:          0,
      status:                'open',
      exit_date:             null,
      exit_price:            null,
      pnl_dollars:           null,
      pnl_pct:               null,
      r_multiple:            null,
      outcome:               null,
      partials:              buyPartials,
      current_shares:        pos.totalShares,
      trend_template_passed: false,
      is_what_if:            true,
      is_short:              false,
      failed_gates:          ['imported_from_broker'],
      notes:                 'Imported from Meitav',
      isDuplicate:           false,
      hasWarning:            false,
      warningMsg:            '',
      isOrphan:              false,
    });
  }

  // Sort: open trades first (entry ASC), closed trades after (entry DESC)
  openTrades.sort((a, b) => a.phase1_date.localeCompare(b.phase1_date));
  closedTrades.sort((a, b) => b.phase1_date.localeCompare(a.phase1_date));

  const newTrades = [...openTrades, ...closedTrades];
  console.log(`[MEITAV] ${closedTrades.length} closed trades, ${openTrades.length} open positions, ${skippedRows} skipped, ${dupSkipped} duplicates`);

  return { newTrades, skippedRows, dupSkipped };
}

// ── Column mapper (non-Meitav formats) ───────────────────────────────────────

interface ColumnMap {
  ticker:   string;
  action:   string;
  quantity: string;
  price:    string;
  date:     string;
  fees?:    string;
  pnl?:     string;
}

const BROKER_COLUMNS: Record<BrokerFormat, ColumnMap> = {
  meitav: {
    ticker:   'סימול',
    action:   'פעולה',
    quantity: 'כמות',
    price:    'מחיר',
    date:     'תאריך',
    fees:     'עמלה',
    pnl:      'P&L',
  },
  ibi: {
    ticker:   'Symbol',
    action:   'Action',
    quantity: 'Quantity',
    price:    'Price',
    date:     'Date',
    fees:     'Commission',
  },
  ibkr: {
    ticker:   'Symbol',
    action:   'Buy/Sell',
    quantity: 'Quantity',
    price:    'TradePrice',
    date:     'TradeDate',
    fees:     'IBCommission',
  },
  etoro: {
    ticker:   'Ticker',
    action:   'Action',
    quantity: 'Units',
    price:    'Open Rate',
    date:     'Open Date',
    fees:     'Overnight Fee (USD)',
  },
  generic: {
    ticker:   '',
    action:   '',
    quantity: '',
    price:    '',
    date:     '',
  },
};

// ── Transaction mapping (non-Meitav) ─────────────────────────────────────────

function mapToTransactions(
  rows:   Record<string, string>[],
  format: BrokerFormat,
): { transactions: RawTransaction[]; skippedRows: number } {
  const colMap = BROKER_COLUMNS[format];
  const transactions: RawTransaction[] = [];
  let skippedRows = 0;

  for (const row of rows) {
    try {
      const tickerCol   = findCol(row, colMap.ticker);
      const actionCol   = findCol(row, colMap.action);
      const quantityCol = findCol(row, colMap.quantity);
      const priceCol    = findCol(row, colMap.price);
      const dateCol     = findCol(row, colMap.date);
      const feesCol     = colMap.fees ? findCol(row, colMap.fees) : null;
      const pnlCol      = colMap.pnl  ? findCol(row, colMap.pnl)  : null;

      if (!tickerCol || !actionCol || !quantityCol || !priceCol || !dateCol) {
        skippedRows++;
        continue;
      }

      const rawTicker = row[tickerCol]?.trim().toUpperCase() ?? '';
      const rawAction = row[actionCol]?.trim().toLowerCase() ?? '';
      const rawQty    = row[quantityCol]?.replace(/[,\s]/g, '') ?? '';
      const rawPrice  = row[priceCol]?.replace(/[,$₪\s]/g, '') ?? '';
      const rawDate   = row[dateCol]?.trim() ?? '';
      const rawFees   = feesCol ? (row[feesCol]?.replace(/[,$₪\s-]/g, '') ?? '0') : '0';

      if (!rawTicker || !/^[A-Z.]{1,10}$/.test(rawTicker)) { skippedRows++; continue; }

      const actionResult = normaliseAction(rawAction, format);
      if (!actionResult) { skippedRows++; continue; }
      const { action, isShort } = actionResult;

      const quantity = Math.abs(parseFloat(rawQty));
      const price    = parseFloat(rawPrice);
      const fees     = Math.abs(parseFloat(rawFees) || 0);

      if (!isFinite(quantity) || quantity <= 0) { skippedRows++; continue; }
      if (!isFinite(price)    || price    <= 0) { skippedRows++; continue; }

      const date = normaliseDate(rawDate, format);
      if (!date) { skippedRows++; continue; }

      let pnl: number | undefined;
      if (pnlCol) {
        const rawPnl = row[pnlCol]?.replace(/[,$₪\s]/g, '') ?? '';
        const parsed = parseFloat(rawPnl);
        if (isFinite(parsed) && parsed !== 0) pnl = parsed;
      }

      transactions.push({ ticker: rawTicker, action, quantity, price, date, fees, currency: 'USD', isShort, pnl });
    } catch {
      skippedRows++;
    }
  }

  return { transactions, skippedRows };
}

function normaliseAction(raw: string, format: BrokerFormat): { action: 'buy' | 'sell'; isShort: boolean } | null {
  const s = raw.toLowerCase().trim();

  if ((s.includes('short') || s === 'ss') && !s.includes('cover')) {
    return { action: 'buy', isShort: true };
  }
  if (s.includes('cover') || s === 'btc') {
    return { action: 'sell', isShort: true };
  }

  if (format === 'meitav') {
    if (s.includes('קני')  || s.includes('buy'))  return { action: 'buy',  isShort: false };
    if (s.includes('מכיר') || s.includes('שורט') || s.includes('sell')) return { action: 'sell', isShort: false };
    return null;
  }

  if (s === 'buy' || s === 'b' || s === 'bot' || s === 'long') return { action: 'buy',  isShort: false };
  if (s === 'sell' || s === 's' || s === 'sld')                 return { action: 'sell', isShort: false };
  if (s.includes('buy')  || s.includes('long'))                  return { action: 'buy',  isShort: false };
  if (s.includes('sell'))                                        return { action: 'sell', isShort: false };
  return null;
}

function normaliseDate(raw: string, format: BrokerFormat): string | null {
  try {
    if (format === 'ibkr' && /^\d{8}$/.test(raw)) {
      return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(raw)) {
      const [d, m, y] = raw.split('.');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(raw)) {
      const parts = raw.split('/');
      const [a, b, c] = parts;
      const year = c.length === 2 ? `20${c}` : c;
      const isIsraeliBroker = format === 'meitav' || format === 'ibi';
      if (isIsraeliBroker || parseInt(a, 10) > 12) {
        return `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
      }
      return `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
    }
    const ts = Date.parse(raw);
    if (!isNaN(ts)) return new Date(ts).toISOString().slice(0, 10);
    return null;
  } catch {
    return null;
  }
}

export { groupToTrades };
