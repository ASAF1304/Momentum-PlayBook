// app/api/cron/scan-leaders/route.ts
//
// Scheduled daily at 21:15 UTC (4:15 PM ET) Mon–Fri via vercel.json.
//
// Strategy:
//   PRIMARY  — FinViz screener HTML (Minervini filters, sorted by relative volume)
//   FALLBACK — yahoo-finance2 batch quote() on a 150-ticker seed list, filtered
//              by Minervini Trend Template criteria using SMA/52w fields from quote().
//
// The fallback is fast (~2s for 120 concurrent quote() calls) and reliable because
// it uses Yahoo Finance, not a website scrape. FinViz blocks Vercel server IPs
// intermittently, so the fallback fires often.
//
// Required Vercel env vars (Settings → Environment Variables):
//   CRON_SECRET                — any random secret; Vercel injects it as
//                                "Authorization: Bearer <secret>" on cron calls
//
// Uses NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (already set).
// RLS policies on stage2_leaders must allow anon INSERT + DELETE.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeaderRow {
  rank:       number;
  ticker:     string;
  company:    string | null;
  price:      number | null;
  change_pct: number | null;
  volume:     number | null;
  market_cap: string | null;
  rs_rating:  number | null;
}

// ── Seed list for Yahoo fallback ──────────────────────────────────────────────
// ~150 liquid US equities across sectors — the Minervini filter will cull them.
// Update this list quarterly if needed; it just determines the candidate universe.

const SEED_TICKERS = [
  // Mega-cap tech / semis
  'NVDA','AAPL','MSFT','AMZN','GOOGL','META','TSLA','AVGO','AMD','QCOM',
  'ORCL','CRM','NOW','ADBE','INTU','ANET','MRVL','LRCX','KLAC','AMAT',
  'MU','TXN','SNPS','CDNS','FTNT','PANW','CRWD','ZS','DDOG','NET',
  // Large-cap growth
  'COST','UNH','LLY','NVO','ABBV','TMO','DHR','ISRG','ELV','CVS',
  'MCK','HCA','REGN','VRTX','BIIB','MRNA','GILD','BMY','PFE',
  // Financials / payments
  'JPM','V','MA','GS','MS','BLK','SPGI','CME','ICE','MCO',
  'AXP','COF','PYPL','SQ','FI','FIS',
  // Industrials / defense
  'CAT','DE','HON','UPS','LMT','RTX','GE','BA','NOC','GD',
  'MMM','EMR','ETN','PH','ROK',
  // Consumer / retail
  'HD','LOW','TGT','WMT','NKE','LULU','DECK','TPX','RCL','MAR',
  'HLT','BKNG','ABNB','EXPE',
  // Energy / materials
  'XOM','CVX','COP','OXY','SLB','FCX','NEM','ALB','MP',
  // Mid-cap momentum / high-RS names
  'AXON','CAVA','WING','CELH','MOD','POWL','SAIA','KNSL','UFPI',
  'TREX','MELI','SE','NU','GRAB','SHOP','TTD','HUBS','BILL',
  'TOST','GTLB','DUOL','ARM','SMCI','PLTR','RKLB','RDDT',
  // Other S&P leaders
  'NFLX','DIS','CMCSA','TMUS','T','VZ',
  'NEE','DUK','SO','AEP','PCG',
  'PLD','AMT','EQIX','PSA','WELL',
];

// ── FinViz HTML parser ────────────────────────────────────────────────────────

function parseFinvizHTML(html: string): LeaderRow[] {
  const rows: LeaderRow[] = [];
  const sections = html.split(/(?=<tr[^>]*>)/);

  for (const section of sections) {
    if (!section.includes('quote.ashx?t=')) continue;

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
      rank:       isFinite(rank)      ? rank      : rows.length + 1,
      ticker,
      company,
      price:      isFinite(price)     ? price     : null,
      change_pct: isFinite(changePct) ? changePct : null,
      volume:     isFinite(volume)    ? volume    : null,
      market_cap: marketCap,
      rs_rating:  null,
    });
    if (rows.length >= 20) break;
  }
  return rows;
}

// ── Yahoo Finance fallback ────────────────────────────────────────────────────

async function scanViaYahoo(log: (m: string) => void): Promise<LeaderRow[]> {
  log(`Yahoo fallback: fetching quotes for ${SEED_TICKERS.length} seed tickers…`);

  type QuoteResult = {
    symbol: string;
    shortName?: string;
    regularMarketPrice?: number;
    regularMarketChangePercent?: number;
    regularMarketVolume?: number;
    marketCap?: number;
    fiftyDayAverage?: number;
    twoHundredDayAverage?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    fiftyTwoWeekChangePercent?: number;
  };

  const results: QuoteResult[] = [];
  await Promise.allSettled(
    SEED_TICKERS.map(async (ticker) => {
      try {
        const q = await yf.quote(ticker) as QuoteResult;
        if (q) results.push(q);
      } catch {
        // skip individual failures
      }
    }),
  );
  log(`Received ${results.length} quote responses`);

  // Apply Minervini Trend Template criteria using fields from quote():
  //   1. price > SMA200
  //   2. price > SMA50
  //   3. SMA50 > SMA200
  //   4. price > 52w-low × 1.30  (30%+ above low)
  //   5. price > 52w-high × 0.75 (within 25% of high — "near 52w high")
  const passing = results.filter(q => {
    const p    = q.regularMarketPrice   ?? 0;
    const s50  = q.fiftyDayAverage      ?? 0;
    const s200 = q.twoHundredDayAverage ?? 0;
    const h52  = q.fiftyTwoWeekHigh     ?? 0;
    const l52  = q.fiftyTwoWeekLow      ?? 0;
    if (p <= 0 || s50 <= 0 || s200 <= 0 || h52 <= 0 || l52 <= 0) return false;
    return (
      p    > s200        &&   // price above SMA200
      p    > s50         &&   // price above SMA50
      s50  > s200        &&   // SMA50 above SMA200 (golden cross)
      p    > l52 * 1.30  &&   // 30%+ above 52w low
      p    > h52 * 0.75       // within 25% of 52w high
    );
  });
  log(`${passing.length} tickers pass Minervini criteria`);

  // Sort by 52-week % change as RS proxy (highest = strongest relative strength)
  passing.sort((a, b) =>
    (b.fiftyTwoWeekChangePercent ?? 0) - (a.fiftyTwoWeekChangePercent ?? 0),
  );

  const top20 = passing.slice(0, 20);
  log(`Top ${top20.length} after sort`);

  return top20.map((q, i) => ({
    rank:       i + 1,
    ticker:     q.symbol,
    company:    q.shortName ?? null,
    price:      q.regularMarketPrice      ?? null,
    change_pct: q.regularMarketChangePercent ?? null,
    volume:     q.regularMarketVolume     ?? null,
    market_cap: q.marketCap != null ? formatMarketCap(q.marketCap) : null,
    rs_rating:  q.fiftyTwoWeekChangePercent != null
      ? Math.min(99, Math.max(1, Math.round((q.fiftyTwoWeekChangePercent + 50) * 0.99)))
      : null,
  }));
}

function formatMarketCap(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9)  return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(0)}M`;
  return String(n);
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const url    = new URL(request.url);
  const debug  = url.searchParams.get('debug') === '1';
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[SCAN-LEADERS] ${msg}`);
    logs.push(msg);
  };

  // Top-level try/catch so every crash path returns JSON (never empty body)
  try {
    log('Starting scan…');

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      log('Auth failed');
      return NextResponse.json({ ok: false, step: 'auth', error: 'Unauthorized' }, { status: 401 });
    }
    log('Auth OK');

    // ── Env-var check ─────────────────────────────────────────────────────────
    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl) {
      log('MISSING: NEXT_PUBLIC_SUPABASE_URL');
      return NextResponse.json({ ok: false, step: 'env', error: 'NEXT_PUBLIC_SUPABASE_URL not set', logs }, { status: 500 });
    }
    if (!supabaseAnon) {
      log('MISSING: NEXT_PUBLIC_SUPABASE_ANON_KEY');
      return NextResponse.json({ ok: false, step: 'env', error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY not set', logs }, { status: 500 });
    }
    log('Env vars OK');

    // ── Primary: FinViz scrape ─────────────────────────────────────────────────
    let leaders: LeaderRow[] = [];
    let source = 'finviz';

    const finvizUrl =
      'https://finviz.com/screener.ashx?v=111' +
      '&f=sma200_pa,sma50_pa,sma50_sa200,ta_highlow52w_nh' +
      '&o=-relativevolume&r=1';

    log(`Fetching FinViz: ${finvizUrl}`);
    try {
      // Use AbortController (safer than AbortSignal.timeout across Node versions)
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 15_000);
      let html: string;
      try {
        const res = await fetch(finvizUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://finviz.com/',
            'Cookie': 'screenerUrl=screener.ashx%3Fv%3D111; isHuman=1',
          },
          signal: ctrl.signal,
        });
        log(`FinViz responded: HTTP ${res.status}`);
        if (!res.ok) throw new Error(`HTTP ${res.status} from finviz.com`);
        html = await res.text();
        log(`FinViz HTML: ${html.length} bytes`);
      } finally {
        clearTimeout(tid);
      }

      const parsed = parseFinvizHTML(html);
      log(`FinViz parsed: ${parsed.length} stocks`);

      if (parsed.length >= 5) {
        leaders = parsed;
        log('Using FinViz results');
      } else {
        log('FinViz returned < 5 stocks (likely blocked or CAPTCHA) — falling back to Yahoo');
        source = 'yahoo_fallback';
      }
    } catch (finvizErr) {
      log(`FinViz error: ${String(finvizErr)} — falling back to Yahoo`);
      source = 'yahoo_fallback';
    }

    // ── Fallback: Yahoo Finance batch quote ────────────────────────────────────
    if (source === 'yahoo_fallback') {
      leaders = await scanViaYahoo(log);
    }

    if (leaders.length === 0) {
      log('ERROR: 0 leaders after both paths');
      return NextResponse.json({ ok: false, step: 'scan', error: 'No leaders found via FinViz or Yahoo', logs }, { status: 500 });
    }
    log(`${leaders.length} leaders ready (source: ${source})`);

    // ── Write to Supabase ──────────────────────────────────────────────────────
    log('Creating Supabase client (anon key)…');
    const supabase = createClient(supabaseUrl, supabaseAnon);

    log('Deleting old rows from stage2_leaders…');
    const { error: deleteError } = await supabase
      .from('stage2_leaders')
      .delete()
      .neq('id', 0);

    if (deleteError) {
      log(`Delete error: ${deleteError.message} (code: ${deleteError.code})`);
      // If table doesn't exist, the error will say so explicitly
      return NextResponse.json({
        ok: false, step: 'db_delete',
        error: deleteError.message,
        hint: deleteError.code === '42P01'
          ? 'Table stage2_leaders does not exist. Run the SQL migration in Supabase SQL editor.'
          : undefined,
        logs,
      }, { status: 500 });
    }
    log('Delete OK');

    log(`Inserting ${leaders.length} rows…`);
    const { error: insertError } = await supabase
      .from('stage2_leaders')
      .insert(leaders);

    if (insertError) {
      log(`Insert error: ${insertError.message} (code: ${insertError.code})`);
      return NextResponse.json({
        ok: false, step: 'db_insert',
        error: insertError.message,
        hint: insertError.code === '42P01'
          ? 'Table stage2_leaders does not exist. Run the SQL migration in Supabase SQL editor.'
          : undefined,
        logs,
      }, { status: 500 });
    }
    log('Insert OK — scan complete!');

    const result = {
      ok: true,
      count:     leaders.length,
      source,
      tickers:   leaders.map(r => r.ticker),
      scannedAt: new Date().toISOString(),
      ...(debug ? { logs } : {}),
    };
    return NextResponse.json(result);

  } catch (err) {
    // Catch-all — ensures we always return JSON, never an empty 500
    const errStr = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    log(`UNHANDLED ERROR: ${errStr}`);
    console.error('[SCAN-LEADERS] Unhandled:', err);
    return NextResponse.json({
      ok: false, step: 'unhandled', error: errStr, logs,
    }, { status: 500 });
  }
}
