// app/api/import/ai-parse/route.ts
//
// AI Smart Import — fallback for ANY broker export format.
// Sends file content as plaintext to Claude Haiku 4.5 with a structured
// extraction prompt and returns validated trade records.
//
// Designed to handle: IBKR Activity Statements, Meitav Hebrew exports, IBI,
// Blink, eToro, Excellence, Robinhood, Schwab — and unknown brokers with
// non-standard formats.
//
// Cost target: ≤ $0.15 per 500-trade file (Haiku pricing).
// Privacy: ANTHROPIC API processes the content; we never store it.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_INPUT_CHARS = 180_000; // ≈ 45k tokens — keeps cost predictable

interface AIExtractedTrade {
  ticker:   string;
  action:   'buy' | 'sell';
  quantity: number;
  price:    number;
  date:     string;  // YYYY-MM-DD
  currency?: string;
}

interface AIParseResponse {
  trades:  AIExtractedTrade[];
  warning: string | null;
  cost_usd: number;
}

const SYSTEM_PROMPT = `You are a broker-export parser. Your only job is to extract stock trades from the input and return JSON.

You handle export files from any broker worldwide: Interactive Brokers (IBKR), Meitav Trade, IBI, Blink, eToro, Excellence, Hapoalim, Discount, Robinhood, Schwab, Fidelity, Webull, TD Ameritrade — anything.

Rules:
1. Return ONLY a JSON object matching the schema below. No prose, no markdown.
2. Extract ONE trade per buy or sell EXECUTION. Ignore: summary rows, totals, fees-only rows, dividends, deposits, withdrawals, currency conversions, headers, footers, account-info rows.
3. Asset filter: include ONLY equity stocks. Exclude: options, futures, forex, crypto, bonds, ETFs are OK.
4. action field is strictly "buy" or "sell". Normalize Hebrew (קניה=buy, מכירה=sell, שורט=sell, קניה לכיסוי=buy), English (BOT/B/Bought=buy, SLD/S/Sold=sell), and any other language.
5. date field is strictly YYYY-MM-DD format. Convert ALL date formats (D/M/Y, M/D/Y, YYYYMMDD, "May 4 2026", etc.).
6. quantity is the absolute number of shares (always positive integer or float).
7. price is the per-share execution price (positive number, no currency symbol).
8. ticker is the stock symbol UPPERCASE, no exchange suffix unless it's Israeli (TEVA, ICL etc.).
9. If you see signed quantity (negative = sell), use the sign to determine action and report quantity as absolute value.
10. Skip any row you cannot confidently classify. Mention in 'warning' if you skipped many.

Output JSON schema:
{
  "trades": [
    {"ticker": "NVDA", "action": "buy", "quantity": 100, "price": 875.20, "date": "2026-05-04"},
    ...
  ],
  "warning": null | "string describing anything unusual"
}`;

function pricePerInputToken(): number  { return 1.00 / 1_000_000; }  // Haiku 4.5 input
function pricePerOutputToken(): number { return 5.00 / 1_000_000; }  // Haiku 4.5 output

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI Smart Import is not configured on the server (missing ANTHROPIC_API_KEY).' }, { status: 500 });
  }

  let plaintext = '';
  let sourceLabel = 'unknown';

  try {
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      sourceLabel = file.name;
      plaintext = await fileToText(file);
    } else {
      const body = await request.json().catch(() => ({})) as { text?: string };
      if (!body.text || body.text.trim().length === 0) {
        return NextResponse.json({ error: 'No text provided' }, { status: 400 });
      }
      sourceLabel = 'pasted text';
      plaintext = body.text;
    }
  } catch (err) {
    return NextResponse.json({
      error: `Failed to read input: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }, { status: 400 });
  }

  // Truncate very large inputs to keep cost bounded
  if (plaintext.length > MAX_INPUT_CHARS) {
    plaintext = plaintext.slice(0, MAX_INPUT_CHARS) + '\n\n[... input truncated for size ...]';
  }
  if (plaintext.trim().length < 20) {
    return NextResponse.json({ error: 'Input is empty or too short to contain trades.' }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await anthropic.messages.create({
      model:       MODEL,
      max_tokens:  8192,
      temperature: 0,
      system:      SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Source: ${sourceLabel}\n\n${plaintext}`,
      }],
    });

    const textBlock = response.content.find(c => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'AI returned no text content.' }, { status: 502 });
    }

    let parsed: { trades?: AIExtractedTrade[]; warning?: string | null };
    try {
      const jsonStr = extractJson(textBlock.text);
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      return NextResponse.json({
        error: 'AI returned invalid JSON. Try paste-mode or a smaller file.',
        debug: textBlock.text.slice(0, 300),
        debugErr: err instanceof Error ? err.message : 'parse',
      }, { status: 502 });
    }

    const trades = (parsed.trades ?? []).filter(validTrade);

    const costUsd =
      (response.usage.input_tokens  * pricePerInputToken()) +
      (response.usage.output_tokens * pricePerOutputToken());

    const result: AIParseResponse = {
      trades,
      warning:  parsed.warning ?? null,
      cost_usd: Math.round(costUsd * 10000) / 10000,
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown AI error';
    return NextResponse.json({ error: `AI parse failed: ${message}` }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buf  = await file.arrayBuffer();

  if (name.endsWith('.csv')) {
    const txt = new TextDecoder().decode(buf);
    // Parse + re-emit as clean CSV (handles encoding quirks)
    const parsed = Papa.parse<string[]>(txt, { skipEmptyLines: true });
    return (parsed.data as string[][]).map(row => row.join('\t')).join('\n');
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const workbook = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      lines.push(`=== Sheet: ${sheetName} ===`);
      const sheet = workbook.Sheets[sheetName];
      const csv   = XLSX.utils.sheet_to_csv(sheet, { strip: false });
      lines.push(csv);
    }
    return lines.join('\n');
  }

  // Plain text or unknown — decode as UTF-8
  return new TextDecoder().decode(buf);
}

function extractJson(text: string): string {
  // Strip markdown code fences if Claude wrapped the JSON
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Otherwise find first { ... last }
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function validTrade(t: unknown): t is AIExtractedTrade {
  if (!t || typeof t !== 'object') return false;
  const o = t as Record<string, unknown>;
  if (typeof o.ticker !== 'string' || !o.ticker.trim()) return false;
  if (o.action !== 'buy' && o.action !== 'sell') return false;
  if (typeof o.quantity !== 'number' || !isFinite(o.quantity) || o.quantity <= 0) return false;
  if (typeof o.price !== 'number'    || !isFinite(o.price)    || o.price    <= 0) return false;
  if (typeof o.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return false;
  return true;
}
