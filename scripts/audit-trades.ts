#!/usr/bin/env tsx
// scripts/audit-trades.ts
//
// Read-only audit of all trades in the DB for the primary user.
// Checks data integrity, calculation consistency, and potential duplicates.
// Does NOT modify any data.
//
// Usage: npx tsx scripts/audit-trades.ts
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// ── Load env vars from .env.local ─────────────────────────────────────────────
function loadEnv() {
  try {
    const content = readFileSync('.env.local', 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch { /* rely on existing process.env */ }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_USER  = 'd3505bb8-320c-4abf-a1dc-3bccd1988497';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Add SUPABASE_SERVICE_ROLE_KEY=<key> to .env.local and retry.');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── Types ─────────────────────────────────────────────────────────────────────

interface PartialRecord {
  id?: string;
  date: string;
  shares: number;
  price: number;
  action?: 'buy' | 'sell';
  pnl_dollars?: number;
}

interface Trade {
  id: string;
  ticker: string;
  phase1_date: string;
  phase1_price: number;
  phase1_shares: number;
  initial_stop: number;
  current_stop: number | null;
  exit_date: string | null;
  exit_price: number | null;
  status: string;
  outcome: string | null;
  pnl_dollars: number | null;
  pnl_pct: number | null;
  r_multiple: number | null;
  current_shares: number;
  partials: PartialRecord[];
  is_what_if: boolean;
  risk_dollars: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBuys(t: Trade): PartialRecord[] {
  return (t.partials ?? []).filter(p => p.action === 'buy');
}

function getSells(t: Trade): PartialRecord[] {
  return (t.partials ?? []).filter(p => (p.action ?? 'sell') === 'sell');
}

function computeAvgEntry(t: Trade): number {
  const buys = getBuys(t);
  if (buys.length === 0) return t.phase1_price;
  const extraShares   = buys.reduce((s, p) => s + p.shares, 0);
  const totalShares   = t.phase1_shares + extraShares;
  const totalInvested = t.phase1_price * t.phase1_shares
                      + buys.reduce((s, p) => s + p.shares * p.price, 0);
  return totalInvested / totalShares;
}

function computeCurrentShares(t: Trade): number {
  const sold  = getSells(t).reduce((s, p) => s + p.shares, 0);
  const added = getBuys(t).reduce((s, p) => s + p.shares, 0);
  return t.phase1_shares + added - sold;
}

function fmt(n: number | null, dec = 2): string {
  return n == null ? 'null' : n.toFixed(dec);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== TRADE AUDIT REPORT ===');
  console.log(`User: ${TARGET_USER}`);
  console.log(`Run at: ${new Date().toISOString()}`);
  console.log('');

  const { data: trades, error } = await db
    .from('trades')
    .select('*')
    .eq('user_id', TARGET_USER)
    .order('phase1_date', { ascending: true });

  if (error) {
    console.error('DB query failed:', error.message);
    process.exit(1);
  }

  const all = (trades ?? []) as Trade[];
  console.log(`Total trades in DB: ${all.length}`);
  console.log('');

  const issues: string[] = [];
  let ok = 0;

  // ── Check 1: Closed trades with null outcome ──────────────────────────────
  const closedNullOutcome = all.filter(t => t.status !== 'open' && t.outcome === null);
  if (closedNullOutcome.length > 0) {
    issues.push(`[MED-2] ${closedNullOutcome.length} closed/stopped trades have outcome=null:`);
    for (const t of closedNullOutcome) {
      issues.push(`  ${t.ticker} ${t.phase1_date.slice(0, 10)} status=${t.status} pnl=${fmt(t.pnl_dollars)}`);
    }
  }

  // ── Check 2: Open trades with no shares ──────────────────────────────────
  const openNoShares = all.filter(t => t.status === 'open' && computeCurrentShares(t) <= 0);
  if (openNoShares.length > 0) {
    issues.push(`[DATA] ${openNoShares.length} open trades have 0 or negative computed shares:`);
    for (const t of openNoShares) {
      issues.push(`  ${t.ticker} ${t.phase1_date.slice(0, 10)} stored=${t.current_shares} computed=${computeCurrentShares(t)}`);
    }
  }

  // ── Check 3: current_shares drift from partials ───────────────────────────
  const sharesDrift = all.filter(t => {
    const computed = computeCurrentShares(t);
    return Math.abs((t.current_shares ?? 0) - computed) > 0.001;
  });
  if (sharesDrift.length > 0) {
    issues.push(`[DATA] ${sharesDrift.length} trades where current_shares doesn't match partials:`);
    for (const t of sharesDrift) {
      issues.push(`  ${t.ticker} ${t.phase1_date.slice(0, 10)} stored=${t.current_shares} computed=${computeCurrentShares(t)}`);
    }
  }

  // ── Check 4: Phase1 price <= 0 ───────────────────────────────────────────
  const zeroPrices = all.filter(t => t.phase1_price <= 0);
  if (zeroPrices.length > 0) {
    issues.push(`[DATA] ${zeroPrices.length} trades with phase1_price <= 0:`);
    for (const t of zeroPrices) {
      issues.push(`  ${t.ticker} ${t.phase1_date.slice(0, 10)} price=${t.phase1_price}`);
    }
  }

  // ── Check 5: Initial stop >= phase1 price (for longs) ────────────────────
  const badStop = all.filter(t => !t.is_what_if && t.initial_stop >= t.phase1_price);
  if (badStop.length > 0) {
    issues.push(`[DATA] ${badStop.length} long trades where initial_stop >= entry price:`);
    for (const t of badStop) {
      issues.push(`  ${t.ticker} ${t.phase1_date.slice(0, 10)} entry=${fmt(t.phase1_price)} stop=${fmt(t.initial_stop)}`);
    }
  }

  // ── Check 6: exit_date without exit_price (or vice versa) ────────────────
  const exitMismatch = all.filter(t =>
    (t.exit_date != null) !== (t.exit_price != null),
  );
  if (exitMismatch.length > 0) {
    issues.push(`[DATA] ${exitMismatch.length} trades where exit_date / exit_price are mismatched:`);
    for (const t of exitMismatch) {
      issues.push(`  ${t.ticker} ${t.phase1_date.slice(0, 10)} exit_date=${t.exit_date} exit_price=${t.exit_price}`);
    }
  }

  // ── Check 7: Closed status but no exit_date ───────────────────────────────
  const closedNoExit = all.filter(t => t.status !== 'open' && !t.exit_date);
  if (closedNoExit.length > 0) {
    issues.push(`[DATA] ${closedNoExit.length} non-open trades without exit_date:`);
    for (const t of closedNoExit) {
      issues.push(`  ${t.ticker} ${t.phase1_date.slice(0, 10)} status=${t.status}`);
    }
  }

  // ── Check 8: R-multiple inconsistency (rough check) ──────────────────────
  const rWrong: string[] = [];
  for (const t of all.filter(t => t.status !== 'open' && t.r_multiple !== null && t.pnl_dollars !== null && t.risk_dollars > 0)) {
    const computedR = t.pnl_dollars! / t.risk_dollars;
    if (Math.abs(computedR - t.r_multiple!) > 0.25) {
      rWrong.push(`  ${t.ticker} ${t.phase1_date.slice(0, 10)} stored_R=${fmt(t.r_multiple)} computed_R=${fmt(computedR)} pnl=${fmt(t.pnl_dollars)} risk=${fmt(t.risk_dollars)}`);
    }
  }
  if (rWrong.length > 0) {
    issues.push(`[CALC] ${rWrong.length} trades with R-multiple deviation > 0.25:`);
    issues.push(...rWrong);
  }

  // ── Check 9: Potential duplicates (same ticker + same date) ──────────────
  const seen = new Map<string, Trade[]>();
  for (const t of all) {
    const key = `${t.ticker}|${t.phase1_date.slice(0, 10)}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(t);
  }
  const dupes = [...seen.entries()].filter(([, ts]) => ts.length > 1);
  if (dupes.length > 0) {
    issues.push(`[DUPE] ${dupes.length} ticker+date combinations with multiple trades:`);
    for (const [key, ts] of dupes) {
      issues.push(`  ${key}: ${ts.map(t => `id=${t.id.slice(0, 8)} what_if=${t.is_what_if} status=${t.status}`).join(' | ')}`);
    }
  }

  // ── Check 10: Avg entry drift from phase1_price for scaled positions ──────
  const avgEntryDrift: string[] = [];
  for (const t of all.filter(t => getBuys(t).length > 0)) {
    const avg = computeAvgEntry(t);
    const drift = Math.abs(avg - t.phase1_price) / t.phase1_price;
    if (drift > 0.01) {
      avgEntryDrift.push(`  ${t.ticker} ${t.phase1_date.slice(0, 10)} phase1=${fmt(t.phase1_price)} avg_entry=${fmt(avg)} drift=${(drift * 100).toFixed(1)}%`);
    }
  }
  if (avgEntryDrift.length > 0) {
    issues.push(`[INFO] ${avgEntryDrift.length} scaled positions where avg entry differs from phase1 price:`);
    issues.push(...avgEntryDrift);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const cleanCount = all.length - new Set([
    ...closedNullOutcome.map(t => t.id),
    ...openNoShares.map(t => t.id),
    ...sharesDrift.map(t => t.id),
    ...zeroPrices.map(t => t.id),
    ...badStop.map(t => t.id),
    ...exitMismatch.map(t => t.id),
    ...closedNoExit.map(t => t.id),
  ]).size;

  if (issues.length === 0) {
    console.log(`✓ All ${all.length} trades look clean. No data integrity issues found.`);
  } else {
    for (const line of issues) {
      console.log(line);
    }
    console.log('');
    console.log(`=== SUMMARY ===`);
    console.log(`Total trades:         ${all.length}`);
    console.log(`Closed, null outcome: ${closedNullOutcome.length}`);
    console.log(`Open, no shares:      ${openNoShares.length}`);
    console.log(`Shares drift:         ${sharesDrift.length}`);
    console.log(`Zero/neg price:       ${zeroPrices.length}`);
    console.log(`Stop >= entry:        ${badStop.length}`);
    console.log(`Exit date/price mismatch: ${exitMismatch.length}`);
    console.log(`Closed, no exit_date: ${closedNoExit.length}`);
    console.log(`R-multiple deviation: ${rWrong.length}`);
    console.log(`Potential duplicates: ${dupes.length}`);
    console.log(`Scaled avg entry:     ${avgEntryDrift.length} (informational only)`);
  }
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
