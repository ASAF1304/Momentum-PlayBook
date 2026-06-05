// lib/grow/types.ts — Grow (Meshulam) payment provider type definitions.

export interface GrowSubscription {
  id: string;
  status: 'active' | 'trialing' | 'cancelled' | 'past_due' | 'expired';
  planId: string;
  currentPeriodEnd: string;        // ISO date
  cancelAtPeriodEnd: boolean;
  paymentMethodLast4: string | null;
  paymentMethodBrand: string | null;
}

export interface GrowTransaction {
  id: string;
  amount: number;
  currency: string;               // e.g. "ILS"
  status: 'paid' | 'failed' | 'pending' | 'refunded';
  createdAt: string;              // ISO date
  invoiceUrl: string | null;
}

export interface GrowWebhookEvent {
  type: string;                   // e.g. "subscription.activated"
  data: Record<string, unknown>;
  signature: string;
}
