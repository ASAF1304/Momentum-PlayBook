#!/usr/bin/env tsx
// scripts/reconcile-trades.ts
//
// AUDIT-ONLY — compares broker Excel file against DB trades. Does NOT modify any data.
//
// Usage: npx tsx scripts/reconcile-trades.ts
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local

import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

// ── Load .env.local ───────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const content = readFileSync('.env.local', 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch { /* rely on process.env */ }
}
loadEnv();

const EXCEL_PATH  = 'C:\\Users\\asafa\\Downloads\\meitav_updated (2).xlsx';
const TARGET_USER = 'd3505bb8-320c-4abf-a1dc-3bccd1988497';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Add SUPABASE_SERVICE_ROLE_KEY=<key> to .env.local and retry.');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExcelRow {
  ticker:      string;
  tradeDate:   string;   // normalized to YYYY-MM-DD
  shares:      number | null;
  entryPrice:  number | null;
  stopPrice:   number | null;
  exitPrice:   number | null;
  exitDate:    string | null;
  status:      'open' | 'closed' | 'unknown';
  side:        'long' | 'short' | 'unknown';
  rawRow:      Record<string, unknown>;
}

interface DbTrade {
  id: string;
  ticker: string;
  phase1_date: string;
  phase1_price: number;
  phase1_shares: number;
  initial_stop: number;
  exit_date: string | null;
  exit_price: number | null;
  status: string;
  current_shares: number;
}

// ── Date normalisation ────────────────────────────────────────────────────────
// Handles DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, Excel serial numbers

function normaliseDate(val: unknown): string | null {
  if (val == null || val === '') return null;

  // Excel serial number (number type)
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    if (!date) return null;
    const y = date.y, m = String(date.m).padStart(2, '0'), d = String(date.d).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const s = String(val).trim();

  // ISO YYYY-MM-DD or YYYY-MM-DDTHH:...
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // DD/MM/YYYY (Israeli format — check if day > 12 to disambiguate)
  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (c > 1900) {
      // A/B/YYYY
      if (a > 12) {
        // Must be DD/MM/YYYY
        return `${c}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
      } else if (b > 12) {
        // Must be MM/DD/YYYY
        return `${c}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
      } else {
        // Ambiguous — assume Israeli DD/MM/YYYY as primary format
        return `${c}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
      }
    }
  }
  return null;
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

// ── Column detection ──────────────────────────────────────────────────────────

type ColMap = {
  ticker?:     string;
  date?:       string;
  shares?:     string;
  entry?:      string;
  stop?:       string;
  exitPrice?:  string;
  exitDate?:   string;
  status?:     string;
  side?:       string;
};

const TICKER_KEYS  = ['ticker', 'symbol', 'מניה', 'סימול', 'stock'];
const DATE_KEYS    = ['date', 'trade date', 'entry date', 'תאריך', 'תאריך כניסה', 'open date'];
const SHARES_KEYS  = ['shares', 'qty', 'quantity', 'כמות', 'units'];
const ENTRY_KEYS   = ['entry', 'entry price', 'price', 'buy price', 'מחיר כניסה', 'מחיר'];
const STOP_KEYS    = ['stop', 'stop price', 'initial stop', 'סטופ', 'stop loss'];
const EXIT_P_KEYS  = ['exit price', 'sell price', 'close price', 'מחיר יציאה'];
const EXIT_D_KEYS  = ['exit date', 'close date', 'sell date', 'תאריך יציאה'];
const STATUS_KEYS  = ['status', 'סטטוס', 'state'];
const SIDE_KEYS    = ['side', 'direction', 'type', 'long/short', 'כיוון'];

function matchCol(headers: string[], candidates: string[]): string | undefined {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.findIndex(h => h === c || h.includes(c));
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

function detectColumns(headers: string[]): ColMap {
  return {
    ticker:    matchCol(headers, TICKER_KEYS),
    date:      matchCol(headers, DATE_KEYS),
    shares:    matchCol(headers, SHARES_KEYS),
    entry:     matchCol(headers, ENTRY_KEYS),
    stop:      matchCol(headers, STOP_KEYS),
    exitPrice: matchCol(headers, EXIT_P_KEYS),
    exitDate:  matchCol(headers, EXIT_D_KEYS),
    status:    matchCol(headers, STATUS_KEYS),
    side:      matchCol(headers, SIDE_KEYS),
  };
}

// ── Parse Excel ───────────────────────────────────────────────────────────────

function parseExcel(): { rows: ExcelRow[]; sheetName: string; cols: ColMap } {
  let buf: Buffer;
  try {
    buf = readFileSync(EXCEL_PATH);
  } catch {
    console.error(`ERROR: Could not read Excel file at:\n  ${EXCEL_PATH}`);
    console.error('Verify the path is correct and the file exists.');
    process.exit(1);
  }

  const workbook  = XLSX.read(buf, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const ws        = workbook.Sheets[sheetName];
  const rawRows   = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  if (rawRows.length === 0) {
    console.error('ERROR: Excel sheet is empty or unreadable.');
    process.exit(1);
  }

  const headers = Object.keys(rawRows[0]);
  const cols    = detectColumns(headers);

  const rows: ExcelRow[] = [];
  for (const raw of rawRows) {
    const tickerVal = cols.ticker ? String(raw[cols.ticker] ?? '').trim().toUpperCase() : '';
    if (!tickerVal || !/^[A-Z.]{1,6}$/.test(tickerVal)) continue;

    const tradeDate = cols.date ? normaliseDate(raw[cols.date]) : null;
    if (!tradeDate) continue;

    const statusStr = cols.status ? String(raw[cols.status] ?? '').toLowerCase() : '';
    const status: ExcelRow['status'] =
      statusStr.includes('open')   || statusStr.includes('פתוח') ? 'open'   :
      statusStr.includes('close')  || statusStr.includes('סגור') ||
      statusStr.includes('closed') ? 'closed' : 'unknown';

    const sideStr = cols.side ? String(raw[cols.side] ?? '').toLowerCase() : '';
    const side: ExcelRow['side'] =
      sideStr.includes('short') || sideStr.includes('שורט') ? 'short' :
      sideStr.includes('long')  || sideStr.includes('לונג')  ? 'long'  : 'unknown';

    rows.push({
      ticker:     tickerVal,
      tradeDate,
      shares:     cols.shares    ? num(raw[cols.shares])    : null,
      entryPrice: cols.entry     ? num(raw[cols.entry])     : null,
      stopPrice:  cols.stop      ? num(raw[cols.stop])      : null,
      exitPrice:  cols.exitPrice ? num(raw[cols.exitPrice]) : null,
      exitDate:   cols.exitDate  ? normaliseDate(raw[cols.exitDate]) : null,
      status,
      side,
      rawRow: raw,
    });
  }

  return { rows, sheetName, cols };
}

// ── Match Excel → DB ──────────────────────────────────────────────────────────

function matchTrades(
  excelRows: ExcelRow[],
  dbTrades:  DbTrade[],
): {
  matched:   Array<{ ex: ExcelRow; db: DbTrade; diffs: string[] }>;
  missingInDb:   ExcelRow[];
  extraInDb:     DbTrade[];
  ambiguous:     Array<{ ex: ExcelRow; candidates: DbTrade[] }>;
} {
  const dbUnmatched = new Set<string>(dbTrades.map(t => t.id));
  const matched:     Array<{ ex: ExcelRow; db: DbTrade; diffs: string[] }> = [];
  const missingInDb: ExcelRow[]  = [];
  const ambiguous:   Array<{ ex: ExcelRow; candidates: DbTrade[] }> = [];

  for (const ex of excelRows) {
    // Primary: ticker + date
    const byDateTicker = dbTrades.filter(
      db => db.ticker === ex.ticker && db.phase1_date.slice(0, 10) === ex.tradeDate,
    );

    // Secondary: ticker + entry price (within $0.05)
    const byPrice = ex.entryPrice != null
      ? dbTrades.filter(
          db => db.ticker === ex.ticker && Math.abs(db.phase1_price - ex.entryPrice!) <= 0.05,
        )
      : [];

    let candidates = byDateTicker.length > 0 ? byDateTicker : byPrice;
    // Remove already matched
    candidates = candidates.filter(c => dbUnmatched.has(c.id));

    if (candidates.length === 0) {
      missingInDb.push(ex);
      continue;
    }
    if (candidates.length > 1) {
      ambiguous.push({ ex, candidates });
      continue;
    }

    const db = candidates[0];
    dbUnmatched.delete(db.id);

    const diffs: string[] = [];
    const PRICE_TOL = 0.01;
    const SHARE_TOL = 0.001;

    if (ex.shares != null && Math.abs((db.phase1_shares ?? 0) - ex.shares) > SHARE_TOL)
      diffs.push(`shares: Excel=${ex.shares} DB=${db.phase1_shares}`);
    if (ex.entryPrice != null && Math.abs((db.phase1_price ?? 0) - ex.entryPrice) > PRICE_TOL)
      diffs.push(`entry_price: Excel=${ex.entryPrice} DB=${db.phase1_price}`);
    if (ex.stopPrice != null && Math.abs((db.initial_stop ?? 0) - ex.stopPrice) > PRICE_TOL)
      diffs.push(`stop_price: Excel=${ex.stopPrice} DB=${db.initial_stop}`);
    if (ex.exitPrice != null && db.exit_price != null && Math.abs(db.exit_price - ex.exitPrice) > PRICE_TOL)
      diffs.push(`exit_price: Excel=${ex.exitPrice} DB=${db.exit_price}`);
    if (ex.exitDate != null && db.exit_date && db.exit_date.slice(0, 10) !== ex.exitDate)
      diffs.push(`exit_date: Excel=${ex.exitDate} DB=${db.exit_date.slice(0, 10)}`);
    if (ex.status !== 'unknown' && db.status !== ex.status)
      diffs.push(`status: Excel=${ex.status} DB=${db.status}`);

    matched.push({ ex, db, diffs });
  }

  const extraInDb = dbTrades.filter(db => dbUnmatched.has(db.id));
  return { matched, missingInDb, extraInDb, ambiguous };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== EXCEL RECONCILIATION REPORT ===');
  console.log(`Excel file: ${EXCEL_PATH}`);
  console.log('');

  // Parse Excel
  const { rows: excelRows, sheetName, cols } = parseExcel();

  console.log(`Excel sheet used: ${sheetName}`);
  console.log(`Detected columns:`);
  console.log(`  ticker=${cols.ticker ?? '—'}  date=${cols.date ?? '—'}  shares=${cols.shares ?? '—'}`);
  console.log(`  entry=${cols.entry ?? '—'}  stop=${cols.stop ?? '—'}  exit_price=${cols.exitPrice ?? '—'}`);
  console.log(`  exit_date=${cols.exitDate ?? '—'}  status=${cols.status ?? '—'}  side=${cols.side ?? '—'}`);
  console.log(`Excel rows parsed: ${excelRows.length}`);
  console.log('');

  // Fetch DB trades
  const { data, error } = await db
    .from('trades')
    .select('id, ticker, phase1_date, phase1_price, phase1_shares, initial_stop, exit_date, exit_price, status, current_shares')
    .eq('user_id', TARGET_USER);

  if (error) {
    console.error('DB query failed:', error.message);
    process.exit(1);
  }

  const dbTrades = (data ?? []) as DbTrade[];
  console.log(`DB trades found: ${dbTrades.length}`);
  console.log('');

  if (excelRows.length === 0) {
    console.log('No parseable Excel rows found. Check column detection above — if all columns show "—",');
    console.log('the headers may be in an unexpected format. Check the first few rows of the Excel file.');
    return;
  }

  // Match
  const { matched, missingInDb, extraInDb, ambiguous } = matchTrades(excelRows, dbTrades);

  const perfect   = matched.filter(m => m.diffs.length === 0);
  const mismatched = matched.filter(m => m.diffs.length > 0);

  // ── Matches section ────────────────────────────────────────────────────────
  console.log('=== MATCHES ===');
  console.log(`[OK] ${perfect.length} trades match perfectly between Excel and DB`);

  if (mismatched.length > 0) {
    console.log(`[MISMATCH] ${mismatched.length} trades have differences:`);
    console.log('');
    for (const { ex, db: dbT, diffs } of mismatched) {
      console.log(`${ex.ticker} ${ex.tradeDate} (DB id: ${dbT.id.slice(0, 8)})`);
      for (const d of diffs) {
        const [field, rest] = d.split(': ');
        const [exVal, dbVal] = rest.split(' DB=');
        console.log(`  ${field}:`);
        console.log(`    Excel: ${exVal.replace('Excel=', '')}`);
        console.log(`    DB:    ${dbVal}  <-- differs`);
      }
    }
    console.log('');
  }

  if (ambiguous.length > 0) {
    console.log(`[AMBIGUOUS] ${ambiguous.length} Excel rows matched multiple DB trades (manual review needed):`);
    for (const { ex, candidates } of ambiguous) {
      console.log(`  ${ex.ticker} ${ex.tradeDate}:`);
      for (const c of candidates) {
        console.log(`    DB id=${c.id.slice(0, 8)} date=${c.phase1_date.slice(0, 10)} price=${c.phase1_price} status=${c.status}`);
      }
    }
    console.log('');
  }

  // ── Unmatched section ──────────────────────────────────────────────────────
  console.log('=== UNMATCHED ===');

  if (missingInDb.length > 0) {
    console.log(`[MISSING IN DB] ${missingInDb.length} Excel rows not found in DB:`);
    console.log('');
    for (const ex of missingInDb) {
      const details = [
        ex.shares    != null ? `${ex.shares} shares` : null,
        ex.entryPrice != null ? `@ $${ex.entryPrice}` : null,
        ex.stopPrice != null ? `stop $${ex.stopPrice}` : null,
        ex.status !== 'unknown' ? ex.status : null,
      ].filter(Boolean).join(', ');
      console.log(`  ${ex.ticker} ${ex.tradeDate}${details ? ` — ${details}` : ''}`);
    }
    console.log('');
  } else {
    console.log('[MISSING IN DB] None — all Excel rows found in DB');
    console.log('');
  }

  if (extraInDb.length > 0) {
    console.log(`[EXTRA IN DB] ${extraInDb.length} DB trades not found in Excel:`);
    console.log('');
    for (const db of extraInDb) {
      console.log(`  ${db.ticker} ${db.phase1_date.slice(0, 10)} @ $${db.phase1_price} status=${db.status} (manual entry? imported wrongly?)`);
    }
    console.log('');
  } else {
    console.log('[EXTRA IN DB] None — all DB trades matched to Excel');
    console.log('');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('=== SUMMARY ===');
  console.log(`Perfect matches:    ${perfect.length}`);
  console.log(`Mismatched fields:  ${mismatched.length}`);
  console.log(`Ambiguous matches:  ${ambiguous.length}`);
  console.log(`Missing in DB:      ${missingInDb.length}`);
  console.log(`Extra in DB:        ${extraInDb.length}`);
  console.log('');

  if (mismatched.length === 0 && missingInDb.length === 0 && extraInDb.length === 0 && ambiguous.length === 0) {
    console.log(`All ${perfect.length} DB trades match the Excel file. No action needed.`);
  } else {
    console.log('AUDIT-ONLY — no changes were made to the database.');
    console.log('Review the report above and decide what to fix manually.');
  }
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
