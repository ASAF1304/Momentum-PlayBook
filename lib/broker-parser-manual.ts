// lib/broker-parser-manual.ts
//
// Handles the "generic / unknown" broker format where the user picks
// column names manually. Dynamically imported — keeps main bundle lean.

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { groupToTrades } from './broker-parser-internal';
import type { ImportedTrade } from './broker-parser';

interface ManualMapping {
  ticker:   string;
  action:   string;
  quantity: string;
  price:    string;
  date:     string;
}

export async function manualMapToTransactions(
  file:    File,
  mapping: ManualMapping,
): Promise<{ trades: ImportedTrade[]; skippedRows: number }> {
  const rows = await readFile(file);
  let skippedRows = 0;

  const transactions = [];
  for (const row of rows) {
    try {
      const rawTicker = String(row[mapping.ticker] ?? '').trim().toUpperCase();
      const rawAction = String(row[mapping.action] ?? '').trim().toLowerCase();
      const rawQty    = String(row[mapping.quantity] ?? '').replace(/[,\s]/g, '');
      const rawPrice  = String(row[mapping.price] ?? '').replace(/[,$₪\s]/g, '');
      const rawDate   = String(row[mapping.date] ?? '').trim();

      if (!rawTicker || !/^[A-Z.]{1,10}$/.test(rawTicker)) { skippedRows++; continue; }

      const action = rawAction.includes('buy') || rawAction === 'b' || rawAction === 'bot' ? 'buy'
                   : rawAction.includes('sell') || rawAction === 's' || rawAction === 'sld' ? 'sell'
                   : null;
      if (!action) { skippedRows++; continue; }

      const quantity = Math.abs(parseFloat(rawQty));
      const price    = parseFloat(rawPrice);
      if (!isFinite(quantity) || quantity <= 0 || !isFinite(price) || price <= 0) { skippedRows++; continue; }

      const date = normaliseDate(rawDate);
      if (!date) { skippedRows++; continue; }

      transactions.push({ ticker: rawTicker, action: action as 'buy' | 'sell', quantity, price, date, fees: 0, currency: 'USD' as const });
    } catch {
      skippedRows++;
    }
  }

  const trades = groupToTrades(transactions, 'generic');
  return { trades, skippedRows };
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
  const workbook = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function normaliseDate(raw: string): string | null {
  try {
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(raw)) {
      const [m, d, y] = raw.split('/');
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(raw)) {
      const [d, m, y] = raw.split('.');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const ts = Date.parse(raw);
    if (!isNaN(ts)) return new Date(ts).toISOString().slice(0, 10);
    return null;
  } catch {
    return null;
  }
}
