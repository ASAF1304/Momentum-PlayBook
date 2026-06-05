// app/api/grow/webhook/route.ts
//
// Receives Grow (Meshulam) webhook events.
// Verifies signature, updates subscriptions table, logs to webhook_events.
// Returns 200 for known events, 422 for unknown, never 500.

import { NextRequest, NextResponse } from 'next/server';
import { verifyGrowWebhook } from '@/lib/grow/webhookVerifier';
import { getServiceClient } from '@/lib/supabase-service';

// Maps Grow event types → our subscription status values
const EVENT_STATUS_MAP: Record<string, string> = {
  'subscription.created':           'trialing',
  'subscription.activated':         'active',
  'subscription.cancelled':         'cancelled',
  'subscription.payment_failed':    'past_due',
  'subscription.payment_succeeded': 'active',
  'subscription.expired':           'expired_grace',
};

export async function POST(request: NextRequest) {
  const rawBody  = await request.text();
  const sigHeader = request.headers.get('x-grow-signature') ?? '';

  if (!verifyGrowWebhook(rawBody, sigHeader)) {
    console.error('[GROW-WEBHOOK] Signature verification failed');
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event: { type: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { type, data } = event;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getServiceClient() as any;

  // Log the raw event regardless of type
  await db.from('webhook_events').insert({
    provider:   'grow',
    event_type: type,
    payload:    event,
    created_at: new Date().toISOString(),
  }).then(() => null).catch(() => null); // non-fatal

  const newStatus = EVENT_STATUS_MAP[type];
  if (!newStatus) {
    console.log(`[GROW-WEBHOOK] Unknown event type: ${type} — acknowledged`);
    return NextResponse.json({ ok: true, ignored: true }, { status: 422 });
  }

  try {
    const userId           = (data.user_id ?? data.userId) as string | undefined;
    const growSubId        = (data.subscription_id ?? data.subscriptionId) as string | undefined;
    const currentPeriodEnd = (data.current_period_end ?? data.currentPeriodEnd) as string | null | undefined;

    if (!userId && !growSubId) {
      console.error('[GROW-WEBHOOK] No user_id or subscription_id in event', { type, data });
      return NextResponse.json({ error: 'missing identifiers' }, { status: 422 });
    }

    const updatePayload: Record<string, unknown> = {
      status:     newStatus,
      updated_at: new Date().toISOString(),
    };
    if (growSubId) updatePayload.grow_subscription_id = growSubId;
    if (currentPeriodEnd) updatePayload.current_period_end = currentPeriodEnd;

    if (userId) {
      await db.from('subscriptions').upsert(
        { user_id: userId, ...updatePayload },
        { onConflict: 'user_id' },
      );
    } else if (growSubId) {
      await db.from('subscriptions')
        .update(updatePayload)
        .eq('grow_subscription_id', growSubId);
    }
  } catch (err) {
    console.error('[GROW-WEBHOOK] DB update failed:', err);
    // Return 200 so Grow doesn't retry indefinitely — we logged the event above
  }

  return NextResponse.json({ ok: true });
}
