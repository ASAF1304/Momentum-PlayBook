// lib/broker-parser-manual.ts
//
// Handles the "generic / unknown" broker format where the user picks
// column names manually. Dynamically imported — keeps main bundle lean.
//
// Recognises:
//   - English actions:  buy, sell, b, s, bot, sld, bought, sold, purchase, redemption
//   - Hebrew actions:   קניה, רכישה, מכירה, שורט, קניה לכיסוי, פדיון
//   - Date formats:     YYYY-MM-DD, D/M/Y, D.M.Y, D-M-Y, M/D/Y (with US/EU sniffing),
//                       8-digit YYYYMMDD, and Date.parse() fallback
//
// Returns granular skip reasons so the UI can show users why specific rows
// were dropped — no more silent failures.

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { groupToTrades } from './broker-parser-internal';
import type {
  ExistingPosition, ImportedTrade, SkipReason, TradeUpdate,
} from './broker-parser';

interface ManualMapping {
  ticker:   string;
  action:   string;
  quantity: string;
  price:    string;
  date:     string;
}

const BUY_KEYWORDS = [
  'buy', 'bought', 'bot', 'b', 'purchase', 'long',
  'קניה', 'קנייה', 'רכישה', 'קונה',
];
const SELL_KEYWORDS = [
  'sell', 'sold', 'sld', 's', 'sale', 'redemption', 'redeem', 'close', 'cover', 'short',
  'מכירה', 'מכר', 'מוכר', 'פדיון', 'שורט', 'קניה לכיסוי', 'כיסוי',
];

function classifyAction(rawAction: string): 'buy' | 'sell' | null {
  const norm = rawAction.toLowerCase().trim();
  if (!norm) return null;
  for (const k of BUY_KEYWORDS) {
    if (norm === k.toLowerCase() || norm.includes(k.toLowerCase())) return 'buy';
  }
  for (const k of SELL_KEYWORDS) {
    if (norm === k.toLowerCase() || norm.includes(k.toLowerCase())) return 'sell';
  }
  return null;
}

interface SkipTracker {
  add(reason: string, sample: string): void;
  toArray(): SkipReason[];
}

function makeSkipTracker(): SkipTracker {
  const map = new Map<string, { count: number; samples: Set<string> }>();
  return {
    add(reason, sample) {
      const safeSample = (sample || '').toString().trim().slice(0, 60);
      const e = map.get(reason) ?? { count: 0, samples: new Set() };
      e.count += 1;
      if (safeSample && e.samples.size < 5) e.samples.add(safeSample);
      map.set(reason, e);
    },
    toArray() {
      return Array.from(map.entries())
        .map(([reason, e]) => ({ reason, count: e.count, samples: Array.from(e.samples) }))
        .sort((a, b) => b.count - a.count);
    },
  };
}

export async function manualMapToTransactions(
  file:               File,
  mapping:            ManualMapping,
  existingPositions:  Map<string, ExistingPosition> = new Map(),
  existingSignatures: Set<string>                  = new Set(),
): Promise<{
  newTrades:    ImportedTrade[];
  updates:      TradeUpdate[];
  skippedRows:  number;
  dupSkipped:   number;
  skipReasons:  SkipReason[];
  totalRows:    number;
}> {
  const rows = await readFile(file);
  const skipTracker = makeSkipTracker();
  let skippedRows = 0;

  const isEuropeanDate = inferEuropeanDate(rows.map(r => String(r[mapping.date] ?? '')));

  const transactions = [];
  for (const row of rows) {
    try {
      const rawTicker = String(row[mapping.ticker] ?? '').trim().toUpperCase();
      const rawAction = String(row[mapping.action] ?? '').trim();
      const rawQty    = String(row[mapping.quantity] ?? '').replace(/[,\s]/g, '');
      const rawPrice  = String(row[mapping.price] ?? '').replace(/[,$₪€£\s]/g, '');
      const rawDate   = String(row[mapping.date] ?? '').trim();

      if (!rawTicker) { skipTracker.add('Empty ticker (likely summary/total row)', ''); skippedRows++; continue; }
      if (!/^[A-Z0-9.\-]{1,12}$/.test(rawTicker)) {
        skipTracker.add('Ticker contains invalid characters', rawTicker);
        skippedRows++; continue;
      }

      const action = classifyAction(rawAction);
      if (!action) {
        skipTracker.add('Unrecognized action value', rawAction || '(empty)');
        skippedRows++; continue;
      }

      const quantity = Math.abs(parseFloat(rawQty));
      if (!isFinite(quantity) || quantity <= 0) {
        skipTracker.add('Quantity not a positive number', rawQty || '(empty)');
        skippedRows++; continue;
      }

      const price = parseFloat(rawPrice);
      if (!isFinite(price) || price <= 0) {
        skipTracker.add('Price not a positive number', rawPrice || '(empty)');
        skippedRows++; continue;
      }

      const date = normaliseDate(rawDate, isEuropeanDate);
      if (!date) {
        skipTracker.add('Date format not recognized', rawDate || '(empty)');
        skippedRows++; continue;
      }

      transactions.push({
        ticker:   rawTicker,
        action:   action as 'buy' | 'sell',
        quantity,
        price,
        date,
        fees:     0,
        currency: 'USD' as const,
        isShort:  false,
      });
    } catch {
      skipTracker.add('Unexpected error parsing row', '');
      skippedRows++;
    }
  }

  const { newTrades, updates, skippedCount: dupSkipped } = groupToTrades(
    transactions,
    'generic',
    existingPositions,
    existingSignatures,
  );
  return {
    newTrades,
    updates,
    skippedRows,
    dupSkipped,
    skipReasons: skipTracker.toArray(),
    totalRows:   rows.length,
  };
}

async function readFile(file: File): Promise<Record<string, unknown>[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: r => resolve(r.data as Record<string, unknown>[]),
        error:    e => reject(new Error(e.message)),
      });
    });
  }
  const buf      = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function inferEuropeanDate(samples: string[]): boolean {
  for (const s of samples) {
    const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
    if (!m) continue;
    const first = parseInt(m[1], 10);
    if (first > 12) return true;
  }
  return true; // default European for IL market safety
}

function normaliseDate(raw: string, isEuropean: boolean): string | null {
  if (!raw) return null;
  const s = raw.trim();

  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const isoSlash = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (isoSlash) {
    const m = isoSlash[2].padStart(2, '0');
    const d = isoSlash[3].padStart(2, '0');
    return `${isoSlash[1]}-${m}-${d}`;
  }

  const slash = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (slash) {
    const a = parseInt(slash[1], 10);
    const b = parseInt(slash[2], 10);
    const c = slash[3];
    const year = c.length === 2 ? `20${c}` : c;
    let day:  number;
    let month: number;
    if (a > 12) { day = a; month = b; }
    else if (b > 12 || isEuropean) { day = a; month = b; }
    else { month = a; day = b; }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const ts = Date.parse(s);
  if (!isNaN(ts)) {
    const d = new Date(ts);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }
  return null;
}

export function suggestMapping(headers: string[]): ManualMapping {
  const lower = headers.map(h => h.toLowerCase().trim());
  const match = (kw: string[]): string => {
    for (const k of kw) {
      const i = lower.indexOf(k);
      if (i >= 0) return headers[i];
    }
    for (const k of kw) {
      const i = lower.findIndex(h => h.includes(k));
      if (i >= 0) return headers[i];
    }
    return '';
  };
  return {
    ticker:   match(['ticker', 'symbol', 'symb', 'instrument', 'security', 'נייר', 'סימול', 'מנייה']),
    action:   match(['action', 'side', 'type', 'buy/sell', 'buysell', 'transaction', 'פעולה', 'סוג']),
    quantity: match(['quantity', 'qty', 'shares', 'amount', 'volume', 'units', 'כמות', 'יחידות']),
    price:    match(['price', 'tradeprice', 'trade price', 'unit price', 'avg price', 'rate', 'מחיר']),
    date:     match(['trade date', 'tradedate', 'date', 'execution date', 'תאריך', 'יום']),
  };
}
