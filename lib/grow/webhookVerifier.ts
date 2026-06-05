// lib/grow/webhookVerifier.ts
//
// Verifies Grow (Meshulam) webhook signatures using HMAC-SHA256.
// Returns false (never throws) when the secret is missing or signature is invalid.

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies the Grow webhook signature.
 * @param payload  Raw request body string
 * @param signature  Value of the X-Grow-Signature header (hex digest)
 */
export function verifyGrowWebhook(payload: string, signature: string): boolean {
  const secret = process.env.GROW_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[GROW-WEBHOOK] GROW_WEBHOOK_SECRET not set — skipping verification');
    return false;
  }
  if (!signature) return false;

  try {
    const expected = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
    const sigBuf   = Buffer.from(signature, 'hex');
    const expBuf   = Buffer.from(expected,  'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}
