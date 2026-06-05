// lib/grow/client.ts
//
// Grow (Meshulam) API client.
// Base URL: https://grow.meshulam.com/api  (confirm exact path from Grow dashboard)
//
// All methods throw Error("GROW_API_KEY not configured") when the key is absent
// so callers can catch and return 503 gracefully. The app never crashes on
// missing key — getGrowClient() returns null and callers check for null first.

import type { GrowSubscription, GrowTransaction } from './types';

interface GrowClient {
  createCheckoutSession(userId: string, planId: string, email: string): Promise<{ iframeUrl: string; sessionId: string }>;
  getSubscription(growSubscriptionId: string): Promise<GrowSubscription>;
  cancelSubscription(growSubscriptionId: string): Promise<void>;
  updatePaymentMethod(growSubscriptionId: string): Promise<{ iframeUrl: string }>;
  listTransactions(growSubscriptionId: string): Promise<GrowTransaction[]>;
}

const GROW_BASE_URL = 'https://grow.meshulam.com/api'; // TODO: confirm with Grow/Meshulam docs

function makeClient(apiKey: string): GrowClient {
  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${GROW_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Grow API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  return {
    /** POST /checkout/sessions — create an embedded checkout iframe session */
    async createCheckoutSession(userId, planId, email) {
      return request<{ iframeUrl: string; sessionId: string }>('/checkout/sessions', {
        method: 'POST',
        body: JSON.stringify({ userId, planId, email }),
      });
    },

    /** GET /subscriptions/:id — fetch subscription details */
    async getSubscription(growSubscriptionId) {
      return request<GrowSubscription>(`/subscriptions/${growSubscriptionId}`);
    },

    /** POST /subscriptions/:id/cancel — cancel at period end */
    async cancelSubscription(growSubscriptionId) {
      await request<void>(`/subscriptions/${growSubscriptionId}/cancel`, { method: 'POST' });
    },

    /** POST /subscriptions/:id/update-payment — get update-card iframe URL */
    async updatePaymentMethod(growSubscriptionId) {
      return request<{ iframeUrl: string }>(`/subscriptions/${growSubscriptionId}/update-payment`, { method: 'POST' });
    },

    /** GET /subscriptions/:id/transactions — list invoices/payments */
    async listTransactions(growSubscriptionId) {
      return request<GrowTransaction[]>(`/subscriptions/${growSubscriptionId}/transactions`);
    },
  };
}

let _client: GrowClient | null = null;

/**
 * Returns the Grow API client, or null if GROW_API_KEY is not set.
 * Never throws — callers must handle the null case and return 503.
 */
export function getGrowClient(): GrowClient | null {
  const key = process.env.GROW_API_KEY;
  if (!key) return null;
  if (!_client) _client = makeClient(key);
  return _client;
}
