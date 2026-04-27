// lib/broker-parser.ts
//
// Parses Excel/CSV broker exports into normalised trade rows, then groups
// individual buy/sell transactions into complete trades (open or closed).
// Merges with existing open positions already in the database so that
// uploading multiple month-files produces correct single trades per ticker.

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
  pnl?:     number;   // realized P&L from file (Meitav sell rows only)
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
  _importId:          string;    // client-only ID for dedup/selection
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
  // computed display-only
  isDuplicate:        boolean;
  hasWarning:         boolean;
  warningMsg:         string;
  isOrphan:           boolean;
}

/** An existing open trade in Supabase that a new file should merge into. */
export interface ExistingPosition {
  existingId:   string;
  ticker:       string;
  phase1Date:   string;   // ISO string — used for display in preview
  shares:       number;   // current_shares from DB
  avgCost:      number;   // computed from partials
  initial_stop: number;
  isShort?:     boolean;
}

/** Pending update to an existing DB trade — new partials to attach. */
export interface TradeUpdate {
  _updateId:          string;   // client-only ID for selection
  existingId:         string;
  ticker:             string;
  existingPhase1Date: string;
  currentShares:      number;   // shares BEFORE this update (for display)
  newPartials:        PartialRecord[];
  newShares:          number;   // shares AFTER update
  willClose:          boolean;
  closeDate:          string | null;
  closePrice:         number | null;
}

export interface ParseResult {
  format:       BrokerFormat;
  transactions: RawTransaction[];
  newTrades:    ImportedTrade[];  // brand-new trades to INSERT
  updates:      TradeUpdate[];    // existing DB trades to UPDATE
  skippedRows:  number;           // rows that failed to parse (bad format/data)
  dupSkipped:   number;           // rows skipped because already in DB
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
      header:       true,
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
        // Convert all cell values to strings for uniform handling
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

  // Meitav Trade — Hebrew headers
  if (h.some(x => x.includes('סימול') || x.includes('מחיר') || x.includes('כמות') || x.includes('פעולה'))) {
    return 'meitav';
  }
  // Interactive Brokers — specific column combo
  if ((h.includes('tradeprice') || h.includes('trade price')) && (h.includes('buy/sell') || h.includes('buysell'))) {
    return 'ibkr';
  }
  if (h.includes('tradedate') && h.includes('quantity') && h.includes('tradeprice')) {
    return 'ibkr';
  }
  // IBI — specific action + symbol pattern
  if (h.includes('action') && h.includes('symbol') && h.includes('quantity') && h.includes('price')) {
    return 'ibi';
  }
  // eToro
  if (h.some(x => x.includes('position id')) || (h.includes('open date') && h.includes('close date'))) {
    return 'etoro';
  }

  return 'generic';
}

// ── Column mapper ─────────────────────────────────────────────────────────────

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

// Fuzzy column finder — matches case-insensitively, with partial match fallback
function findCol(row: Record<string, string>, candidate: string): string | null {
  if (!candidate) return null;
  const keys   = Object.keys(row);
  const target = candidate.toLowerCase().trim();
  // Exact match first
  const exact = keys.find(k => k.toLowerCase().trim() === target);
  if (exact) return exact;
  // Partial match
  const partial = keys.find(k => k.toLowerCase().includes(target) || target.includes(k.toLowerCase().trim()));
  return partial ?? null;
}

// ── Transaction mapping ───────────────────────────────────────────────────────

function mapToTransactions(
  rows: Record<string, string>[],
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

      // Extract realized P&L from file (only meaningful on Meitav sell rows)
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

  // ── Short / Cover — must come BEFORE generic buy/sell checks ──────────────
  // "short", "sell short", "short sale" → opens a short (treated like a buy)
  if ((s.includes('short') || s === 'ss') && !s.includes('cover')) {
    return { action: 'buy', isShort: true };
  }
  // "buy to cover", "cover", "btc" → closes a short (treated like a sell)
  if (s.includes('cover') || s === 'btc') {
    return { action: 'sell', isShort: true };
  }

  // ── Meitav Hebrew ─────────────────────────────────────────────────────────
  // קניה / קניה לכיסוי → buy   |   מכירה / מכירה לכיסוי / שורט → sell
  if (format === 'meitav') {
    if (s.includes('קני')  || s.includes('buy'))  return { action: 'buy',  isShort: false };
    if (s.includes('מכיר') || s.includes('שורט') || s.includes('sell')) return { action: 'sell', isShort: false };
    return null;
  }

  // ── Standard long buy/sell keywords ──────────────────────────────────────
  if (s === 'buy' || s === 'b' || s === 'bot' || s === 'long') return { action: 'buy',  isShort: false };
  if (s === 'sell' || s === 's' || s === 'sld')                 return { action: 'sell', isShort: false };
  if (s.includes('buy')  || s.includes('long'))                  return { action: 'buy',  isShort: false };
  if (s.includes('sell'))                                        return { action: 'sell', isShort: false };
  return null;
}

function normaliseDate(raw: string, format: BrokerFormat): string | null {
  try {
    // IBKR: YYYYMMDD
    if (format === 'ibkr' && /^\d{8}$/.test(raw)) {
      return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }
    // ISO already: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    // DD.MM.YYYY (European / Israeli — dots are unambiguous)
    if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(raw)) {
      const [d, m, y] = raw.split('.');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // Slash-delimited: DD/MM/YYYY or MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(raw)) {
      const parts = raw.split('/');
      const [a, b, c] = parts;
      const year = c.length === 2 ? `20${c}` : c;
      // Israeli brokers (meitav, ibi) use DD/MM/YYYY.
      // If first part > 12 it MUST be DD (no month 13+).
      // If broker is a known Israeli format, always treat as DD/MM.
      const isIsraeliBroker = format === 'meitav' || format === 'ibi';
      if (isIsraeliBroker || parseInt(a, 10) > 12) {
        // DD/MM/YYYY
        return `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
      }
      // US: MM/DD/YYYY (IBKR, eToro, generic)
      return `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
    }
    // Date object serialised as number (Excel serial)
    const ts = Date.parse(raw);
    if (!isNaN(ts)) return new Date(ts).toISOString().slice(0, 10);
    return null;
  } catch {
    return null;
  }
}

export { groupToTrades };
