// app/api/cron/scan-leaders/route.ts
//
// Scheduled daily at 21:15 UTC (4:15 PM ET) Mon–Fri via vercel.json.
// Scrapes FinViz screener for Minervini Trend Template stocks sorted by
// relative volume, then replaces the stage2_leaders table with fresh data.
//
// Auth: Vercel sets Authorization: Bearer <CRON_SECRET> on cron requests
// when CRON_SECRET is configured as an environment variable.
// Add CRON_SECRET + SUPABASE_SERVICE_ROLE_KEY to Vercel env vars.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeaderRow {
  rank: number;
  ticker: string;
  company: string | null;
  price: number | null;
  change_pct: number | null;
  volume: number | null;
  market_cap: string | null;
  rs_rating: number | null;
}

// ── FinViz parser ─────────────────────────────────────────────────────────────

// FinViz screener v=111 columns (0-indexed after cell extraction):
// 0: No.  1: Ticker  2: Company  3: Sector  4: Industry  5: Country
// 6: Mkt Cap  7: P/E  8: Price  9: Change  10: Volume
function parseFinvizHTML(html: string): LeaderRow[] {
  const rows: LeaderRow[] = [];

  // Each data row contains a ticker link (quote.ashx?t=TICKER)
  const sections = html.split(/(?=<tr[^>]*>)/);

  for (const section of sections) {
    if (!section.includes('quote.ashx?t=')) continue;

    // Extract text content from every <td> in this section
    const cells: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let m: RegExpExecArray | null;
    while ((m = tdRegex.exec(section)) !== null) {
      cells.push(m[1].replace(/<[^>]+>/g, '').trim());
    }

    if (cells.length < 11) continue;

    const rank      = parseInt(cells[0], 10);
    const ticker    = cells[1];
    const company   = cells[2] || null;
    const marketCap = cells[6] || null;
    const price     = parseFloat(cells[8]);
    const changePct = parseFloat((cells[9] ?? '').replace('%', ''));
    const volume    = parseInt((cells[10] ?? '').replace(/,/g, ''), 10);

    if (!ticker || !/^[A-Z.]+$/.test(ticker) || !isFinite(price)) continue;

    rows.push({
      rank:       isFinite(rank) ? rank : rows.length + 1,
      ticker,
      company,
      price:      isFinite(price)     ? price     : null,
      change_pct: isFinite(changePct) ? changePct : null,
      volume:     isFinite(volume)    ? volume    : null,
      market_cap: marketCap,
      rs_rating:  null, // IBD RS not available in free FinViz screener
    });

    if (rows.length >= 20) break;
  }

  return rows;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // Verify cron secret (Vercel passes this automatically when CRON_SECRET is set)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error('[SCAN-LEADERS] Unauthorized cron call');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // FinViz screener — Minervini Trend Template filters + sort by relative volume
  // Filters: price > SMA200, price > SMA50, SMA50 > SMA200, near 52w high
  const finvizUrl =
    'https://finviz.com/screener.ashx?v=111' +
    '&f=sma200_pa,sma50_pa,sma50_sa200,ta_highlow52w_nh' +
    '&o=-relativevolume' +
    '&r=1';

  let html: string;
  try {
    const res = await fetch(finvizUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://finviz.com/',
      },
      // 20s timeout
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`FinViz responded ${res.status}`);
    }
    html = await res.text();
  } catch (err) {
    console.error('[SCAN-LEADERS] FinViz fetch failed:', err);
    return NextResponse.json({ error: 'FinViz fetch failed', detail: String(err) }, { status: 502 });
  }

  const leaders = parseFinvizHTML(html);
  if (leaders.length === 0) {
    console.error('[SCAN-LEADERS] Parsed 0 rows — HTML structure may have changed');
    return NextResponse.json({ error: 'No rows parsed from FinViz' }, { status: 500 });
  }

  // Admin client — bypasses RLS so the cron can DELETE + INSERT freely
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Replace the scan: delete all existing rows, then insert the fresh batch
  const { error: deleteError } = await supabaseAdmin
    .from('stage2_leaders')
    .delete()
    .neq('id', 0); // delete all rows (neq 0 matches every row)

  if (deleteError) {
    console.error('[SCAN-LEADERS] Delete failed:', deleteError.message);
    return NextResponse.json({ error: 'DB delete failed', detail: deleteError.message }, { status: 500 });
  }

  const { error: insertError } = await supabaseAdmin
    .from('stage2_leaders')
    .insert(leaders);

  if (insertError) {
    console.error('[SCAN-LEADERS] Insert failed:', insertError.message);
    return NextResponse.json({ error: 'DB insert failed', detail: insertError.message }, { status: 500 });
  }

  console.log(`[SCAN-LEADERS] Inserted ${leaders.length} leaders`);
  return NextResponse.json({
    ok: true,
    count: leaders.length,
    tickers: leaders.map(r => r.ticker),
    scannedAt: new Date().toISOString(),
  });
}
