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

export interface SkipReason {
  reason:  string;
  count:   number;
  samples: string[];  // up to 5 sanitized sample values
}

export interface ParseResult {
  format:       BrokerFormat;
  transactions: RawTransaction[];
  newTrades:    ImportedTrade[];
  updates:      TradeUpdate[];
  skippedRows:  number;
  dupSkipped:   number;
  skipReasons?: SkipReason[];
  totalRows?:   number;
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
//
// Key design decisions:
//   1. Use header:1 (raw arrays) so we can detect the ACTUAL header row.
//      Israeli broker files commonly have 2-5 metadata rows before the column
//      names — using the default header:0 would treat those metadata rows as
//      column keys, making every findCol call return null and skipping all data.
//   2. Convert Date objects with local-time getters (getDate/getMonth/getFullYear)
//      NOT with toISOString(). In UTC+2 (Israel), toISOString() shifts midnight
//      dates back by 2 hours into the previous day, corrupting every date.

function parseExcel(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data     = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];

        // Get raw arrays — rows are unknown[], not keyed objects yet
        const rawArrays = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header:  1,
          defval:  '',
          raw:     true,
        });

        // Scan for the actual header row — first row whose cells include any
        // known Meitav Hebrew keyword OR common English broker column keyword.
        const HEADER_MARKERS = [
          'סימול', 'פעולה', 'תאריך', 'כמות', 'מחיר',   // Meitav Hebrew
          'ticker', 'symbol', 'action', 'trade', 'price', 'quantity', 'buy/sell',
        ];
        let headerIdx = rawArrays.findIndex(row =>
          Array.isArray(row) && row.some(cell => {
            const s = String(cell ?? '').trim().toLowerCase();
            return s.length > 0 && HEADER_MARKERS.some(m => s.includes(m));
          }),
        );
        if (headerIdx < 0) headerIdx = 0; // fallback: treat first row as headers

        const headers  = (rawArrays[headerIdx] as unknown[]).map(h => String(h ?? '').trim());
        const dataRows = rawArrays.slice(headerIdx + 1);

        // Convert a single cell value to a clean string.
        // Dates get DD/MM/YYYY in LOCAL time (avoids UTC-shift bug).
        const cellToStr = (v: unknown): string => {
          if (v instanceof Date) {
            const dd = String(v.getDate()).padStart(2, '0');
            const mm = String(v.getMonth() + 1).padStart(2, '0');
            return `${dd}/${mm}/${v.getFullYear()}`;
          }
          return String(v ?? '').trim();
        };

        const rows = dataRows
          .map(row => {
            const cells = Array.isArray(row) ? row : [];
            return Object.fromEntries(headers.map((h, i) => [h, cellToStr(cells[i])]));
          })
          .filter(r => Object.values(r).some(v => v !== '')); // drop blank rows

        resolve(rows);
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
// MEITAV-SPECIFIC PARSER
// ════════════════════════════════════════════════════════════════════════════
//
// Columns: תאריך | פעולה | כמות | סימול | מחיר | P&L | Principal
//
// Action values (exact strings from Meitav export):
//   קניה          → BUY    open long position
//   מכירה         → SELL   close long; P&L column = realized P&L (read directly)
//   שורט          → SHORT  open short position
//   קניה לכיסוי   → COVER  close short; P&L column = realized P&L (read directly)
//
// Closed trade output: one ImportedTrade per SELL/COVER row — P&L from file, NEVER recalculated
// Open position output: one ImportedTrade per ticker — FIFO weighted-avg of remaining lots

// ── Stock split configuration ─────────────────────────────────────────────
// Add future splits here. Rows dated BEFORE `date` are pre-split:
//   qty  × ratio  (more shares at lower price per share)
//   price ÷ ratio
// P&L dollars are NOT adjusted — they are already in dollar terms.
export const STOCK_SPLITS: Record<string, Array<{ date: string; ratio: number }>> = {
  POWL: [{ date: '2026-03-06', ratio: 3 }],   // 3-for-1 on 2026-03-06
};

function applySplits(ticker: string, isoDate: string, qty: number, price: number) {
  const splits = STOCK_SPLITS[ticker] ?? [];
  let adjQty   = qty;
  let adjPrice = price;
  for (const s of splits) {
    if (isoDate < s.date) {
      adjQty   *= s.ratio;
      adjPrice /= s.ratio;
    }
  }
  return { qty: adjQty, price: adjPrice };
}

function parseMeitavRows(
  rows:               Record<string, string>[],
  existingSignatures: Set<string>,
): { newTrades: ImportedTrade[]; skippedRows: number; dupSkipped: number } {

  const closedTrades: ImportedTrade[] = [];
  let skippedRows = 0;
  let dupSkipped  = 0;

  // posKey = "TICKER|long" or "TICKER|short"
  interface BuyLot { date: string; price: number; qty: number; }
  const buyLots = new Map<string, BuyLot[]>();   // per-ticker BUY lots (split-adjusted)
  const soldQty  = new Map<string, number>();    // per-ticker cumulative sold qty (split-adjusted)
  const skipReasons: string[] = [];              // for validation log

  // ── Per-row loop ──────────────────────────────────────────────────────────
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    try {
      const tickerCol = findCol(row, 'סימול');
      const actionCol = findCol(row, 'פעולה');
      const qtyCol    = findCol(row, 'כמות');
      const priceCol  = findCol(row, 'מחיר');
      const dateCol   = findCol(row, 'תאריך');
      const pnlCol    = findCol(row, 'P&L');

      if (!tickerCol || !actionCol || !qtyCol || !priceCol || !dateCol) {
        skippedRows++;
        skipReasons.push(`row ${rowIdx}: missing required column(s)`);
        continue;
      }

      const rawTicker = (row[tickerCol] ?? '').trim().toUpperCase();
      const rawAction = (row[actionCol] ?? '').trim();
      const rawQtyStr = (row[qtyCol]   ?? '').replace(/[,\s]/g, '');
      const rawPrice  = (row[priceCol] ?? '').replace(/[,$₪\s]/g, '');
      const rawDate   = (row[dateCol]  ?? '').trim();

      // Accept tickers: 1-10 uppercase letters, optional dots, optional trailing digits
      if (!rawTicker || !/^[A-Z][A-Z0-9.]{0,9}$/.test(rawTicker)) {
        skippedRows++;
        skipReasons.push(`row ${rowIdx}: invalid ticker "${rawTicker}"`);
        continue;
      }

      const qty   = Math.abs(parseFloat(rawQtyStr));
      const price = parseFloat(rawPrice);
      if (!isFinite(qty) || qty <= 0) {
        skippedRows++;
        skipReasons.push(`row ${rowIdx}: invalid qty "${rawQtyStr}"`);
        continue;
      }
      if (!isFinite(price) || price <= 0) {
        skippedRows++;
        skipReasons.push(`row ${rowIdx}: invalid price "${rawPrice}"`);
        continue;
      }

      const date = normaliseDate(rawDate, 'meitav');
      if (!date) {
        skippedRows++;
        skipReasons.push(`row ${rowIdx}: unparseable date "${rawDate}"`);
        continue;
      }

      // ── Action classification ──────────────────────────────────────────
      // Check "כיסוי" BEFORE "קני" — "קניה לכיסוי" contains "קני".
      const isKniyaLekisui = rawAction.includes('כיסוי');
      const isMechira      = rawAction.includes('מכיר') || rawAction === 'מכירה';
      const isShortOpen    = rawAction.includes('שורט');
      const isKniya        = rawAction.includes('קני') && !isKniyaLekisui;

      const isClosed = isMechira || isKniyaLekisui;  // SELL or COVER
      const isOpen   = isKniya   || isShortOpen;     // BUY  or SHORT

      if (!isClosed && !isOpen) {
        skippedRows++;
        skipReasons.push(`row ${rowIdx}: unknown action "${rawAction}" for ${rawTicker}`);
        continue;
      }

      // ── P&L (closed rows only — read from file, never recalculated) ───
      let pnl = 0;
      if (isClosed && pnlCol) {
        const rawPnl = (row[pnlCol] ?? '').replace(/[,$₪\s]/g, '');
        const parsed = parseFloat(rawPnl);
        if (isFinite(parsed)) pnl = parsed;
      }

      // ── Apply stock splits (always first — needed in dedup path too) ──────
      const adj = applySplits(rawTicker, date, qty, price);

      // ── Per-row trace for debug tickers ───────────────────────────────
      const _dbgTickers = new Set(['ALAB', 'TER', 'POWL', 'IREN']);
      if (_dbgTickers.has(rawTicker)) {
        const splitNote = STOCK_SPLITS[rawTicker]
          ? ` → adj qty=${adj.qty.toFixed(4)}`
          : '';
        console.log(
          `[MEITAV DBG] ${rawTicker} row${rowIdx}  action="${rawAction}"  raw qty=${qty}${splitNote}  price=${price.toFixed(2)}  date=${date}  ${isClosed ? 'SELL' : 'BUY'}`,
        );
      }

      // ── Deduplication — sig uses RAW (pre-split) values ───────────────
      // For BOTH buy and sell dedup'd rows we still track qty in
      // buyLots / soldQty so the net-share formula stays accurate.
      const dedupAction = isClosed ? 'sell' : 'buy';
      const sig = `${rawTicker}|${date}|${price.toFixed(2)}|${qty}|${dedupAction}`;
      if (existingSignatures.has(sig)) {
        dupSkipped++;
        if (isClosed) {
          const closedPosKey = `${rawTicker}|${isKniyaLekisui ? 'short' : 'long'}`;
          soldQty.set(closedPosKey, (soldQty.get(closedPosKey) ?? 0) + adj.qty);
        } else {
          // BUY dedup'd: still add to buyLots so totalBought is correct
          const posKey = `${rawTicker}|${isShortOpen ? 'short' : 'long'}`;
          const lots   = buyLots.get(posKey) ?? [];
          lots.push({ date, price: adj.price, qty: adj.qty });
          buyLots.set(posKey, lots);
        }
        continue;
      }

      // ── OPEN row → accumulate split-adjusted buy lot ───────────────────
      if (isOpen) {
        const posKey = `${rawTicker}|${isShortOpen ? 'short' : 'long'}`;
        const lots   = buyLots.get(posKey) ?? [];
        lots.push({ date, price: adj.price, qty: adj.qty });
        buyLots.set(posKey, lots);
        continue;
      }

      // ── CLOSED row → one ImportedTrade + update soldQty ───────────────
      const isShortClose = isKniyaLekisui;
      const closedPosKey = `${rawTicker}|${isShortClose ? 'short' : 'long'}`;
      soldQty.set(closedPosKey, (soldQty.get(closedPosKey) ?? 0) + adj.qty);

      // Back-calculate entry price for display only (P&L is authoritative)
      //   long:  avgEntry = sellPrice - P&L / qty
      //   short: avgEntry = coverPrice + P&L / qty
      const avgEntry  = adj.qty > 0
        ? isShortClose ? adj.price + pnl / adj.qty : adj.price - pnl / adj.qty
        : adj.price;
      const safeEntry = Math.max(0.01, avgEntry);
      const estStop   = isShortClose ? safeEntry * 1.08 : safeEntry * 0.92;
      const outcome   = pnl >  0.005 ? 'winner' : pnl < -0.005 ? 'loser' : 'breakeven';
      const pnlPct    = safeEntry > 0 ? (pnl / (safeEntry * adj.qty)) * 100 : null;

      closedTrades.push({
        _importId:             crypto.randomUUID(),
        ticker:                rawTicker,
        phase1_date:           `${date}T12:00:00Z`,
        phase1_price:          safeEntry,
        phase1_shares:         adj.qty,
        initial_stop:          estStop,
        current_stop:          estStop,
        stop_distance_pct:     8,
        risk_dollars:          0,
        status:                'closed',
        exit_date:             `${date}T12:00:00Z`,
        exit_price:            adj.price,
        pnl_dollars:           pnl,    // ← FROM FILE — never recalculated
        pnl_pct:               pnlPct,
        r_multiple:            null,
        outcome,
        partials:              [{
          id:          crypto.randomUUID(),
          date:        `${date}T12:00:00Z`,
          action:      'sell',
          shares:      adj.qty,
          price:       adj.price,
          pnl_dollars: pnl,
          pnl_pct:     pnlPct ?? 0,
          r_multiple:  0,
        }],
        current_shares:        0,
        trend_template_passed: false,
        is_what_if:            true,
        is_short:              isShortClose,
        failed_gates:          ['imported_from_broker'],
        notes:                 'Imported from Meitav',
        isDuplicate:           false,
        hasWarning:            false,
        warningMsg:            '',
        isOrphan:              false,
      });

    } catch (err) {
      skippedRows++;
      skipReasons.push(`row ${rowIdx}: exception — ${String(err)}`);
    }
  }

  // ── FIFO open position conversion ─────────────────────────────────────────
  // For each ticker, sort buy lots oldest-first, consume the already-sold qty
  // from the front of the queue (FIFO), then compute the weighted-average cost
  // from the remaining (unclosed) lots only.
  const openTrades: ImportedTrade[] = [];
  for (const [posKey, lots] of buyLots.entries()) {
    lots.sort((a, b) => a.date.localeCompare(b.date));

    const totalBought = lots.reduce((s, l) => s + l.qty, 0);
    const alreadySold = soldQty.get(posKey) ?? 0;
    const netShares   = Math.round(totalBought - alreadySold);
    if (netShares <= 0) continue;   // ticker is fully closed

    // Consume sold shares FIFO from oldest lots
    let toConsume = alreadySold;
    const remainingLots: BuyLot[] = [];
    for (const lot of lots) {
      if (toConsume <= 0) {
        remainingLots.push({ ...lot });
      } else if (lot.qty <= toConsume) {
        toConsume -= lot.qty;
      } else {
        remainingLots.push({ ...lot, qty: lot.qty - toConsume });
        toConsume = 0;
      }
    }

    const totalCost = remainingLots.reduce((s, l) => s + l.price * l.qty, 0);
    const avgCost   = netShares > 0 ? totalCost / netShares : (remainingLots[0]?.price ?? 0);

    const [ticker, direction] = posKey.split('|');
    const isShortPos = direction === 'short';
    const estStop    = isShortPos ? avgCost * 1.08 : avgCost * 0.92;
    const phase1Lot  = remainingLots[0];

    openTrades.push({
      _importId:             crypto.randomUUID(),
      ticker,
      phase1_date:           `${phase1Lot.date}T12:00:00Z`,
      phase1_price:          phase1Lot.price,
      phase1_shares:         phase1Lot.qty,
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
      partials:              remainingLots.slice(1).map(b => ({
        id:          crypto.randomUUID(),
        date:        `${b.date}T12:00:00Z`,
        action:      'buy' as const,
        shares:      b.qty,
        price:       b.price,
        pnl_dollars: 0,
        pnl_pct:     0,
        r_multiple:  0,
      })),
      current_shares:        netShares,
      trend_template_passed: false,
      is_what_if:            true,
      is_short:              isShortPos,
      failed_gates:          ['imported_from_broker'],
      notes:                 'Imported from Meitav',
      isDuplicate:           false,
      hasWarning:            false,
      warningMsg:            '',
      isOrphan:              false,
    });
  }

  // Sort: open positions first (oldest entry first), closed trades last (newest first)
  openTrades.sort((a, b) => a.phase1_date.localeCompare(b.phase1_date));
  closedTrades.sort((a, b) => b.phase1_date.localeCompare(a.phase1_date));

  const newTrades = [...openTrades, ...closedTrades];

  // ── Debug breakdown for ALAB / TER / POWL / IREN ─────────────────────────
  console.group('[MEITAV] Net-share breakdown for debug tickers');
  const _dbg = new Set(['ALAB', 'TER', 'POWL', 'IREN']);
  const _allPosKeys = new Set([...buyLots.keys(), ...soldQty.keys()]);
  for (const posKey of _allPosKeys) {
    const [ticker] = posKey.split('|');
    if (!_dbg.has(ticker)) continue;
    const lots   = buyLots.get(posKey) ?? [];
    const tb     = lots.reduce((s, l) => s + l.qty, 0);
    const ts     = soldQty.get(posKey) ?? 0;
    const net    = Math.round(tb - ts);
    const splitFlag = STOCK_SPLITS[ticker] ? ' [split-adjusted]' : '';
    console.log(
      `${ticker.padEnd(8)} totalBought=${tb.toFixed(4).padStart(10)}  totalSold=${ts.toFixed(4).padStart(10)}  net=${net}${splitFlag}`,
    );
  }
  console.groupEnd();

  // ── Validation log ────────────────────────────────────────────────────────
  console.group('[MEITAV] Import summary');
  console.log(`Rows in file  : ${rows.length}`);
  console.log(`Rows skipped  : ${skippedRows}${skippedRows > 0 ? ' (see details below)' : ''}`);
  console.log(`Dedup-skipped : ${dupSkipped}`);
  console.log(`Closed trades : ${closedTrades.length}`);
  console.log(`Open positions: ${openTrades.length}`);
  if (openTrades.length > 0) {
    console.group('Open position details');
    for (const t of openTrades) {
      console.log(
        `  ${t.ticker.padEnd(8)} ${t.current_shares} shares @ $${t.phase1_price.toFixed(2)} avg` +
        `${STOCK_SPLITS[t.ticker] ? '  [split-adjusted]' : ''}`,
      );
    }
    console.groupEnd();
  }
  if (skipReasons.length > 0) {
    console.group('Skip reasons (first 20)');
    skipReasons.slice(0, 20).forEach(r => console.log(' ', r));
    console.groupEnd();
  }
  console.groupEnd();

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
