// lib/ticker-validation.ts
// Shared ticker validation — 1–5 uppercase English letters only.
export function isValidTicker(value: string): boolean {
  return /^[A-Z]{1,5}$/.test(value);
}

export const TICKER_ERROR = 'Ticker must be 1–5 letters (e.g. AAPL)';
