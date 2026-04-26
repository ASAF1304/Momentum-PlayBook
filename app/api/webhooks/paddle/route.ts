// app/api/webhooks/paddle/route.ts
//
// Handles Paddle Billing webhook events. Paddle calls this endpoint whenever a
// subscription changes state. We verify the webhook signature then upsert into
// the subscriptions table using the service role key (bypasses RLS).

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { Paddle, Environment, EventName } from '@paddle/paddle-node-sdk';
import { getServiceClient } from '@/lib/supabase-service';

function getPaddle(): Paddle | null {
  const key = process.env.PADDLE_API_KEY;
  if (!key) return null;
  const env = process.env.PADDLE_ENVIRONMENT === 'sandbox'
    ? Environment.sandbox
    : Environment.production;
  return new Paddle(key, { environment: env });
}

// Supabase generic client typed as any to handle tables not in generated schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = ReturnType<typeof import('@supabase/supabase-js').createClient<any>>;

export async function POST(request: NextRequest) {
  const paddle = getPaddle();
  if (!paddle) {
    console.warn('[PADDLE-WEBHOOK] PADDLE_API_KEY not set — ignoring webhook');
    return NextResponse.json({ ok: true });
  }

  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[PADDLE-WEBHOOK] PADDLE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }

  const rawBody   = await request.text();
  const sigHeader = request.headers.get('Paddle-Signature') ?? '';

  let event;
  try {
    event = await paddle.webhooks.unmarshal(rawBody, secret, sigHeader);
  } catch (err) {
    console.error('[PADDLE-WEBHOOK] Signature verification failed:', err);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  const db = getServiceClient() as unknown as AnyDb;

  try {
    switch (event.eventType) {
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionActivated:
      case EventName.SubscriptionUpdated: {
        // Paddle SDK uses camelCase; cast via unknown to avoid type mismatch
        const sub = event.data as unknown as {
          id: string;
          customerId: string;
          status: string;
          customData?: { user_id?: string };
          trialDates?: { endsAt?: string };
          currentBillingPeriod?: { endsAt?: string };
        };

        const userId = sub.customData?.user_id;
        if (!userId) {
          console.error('[PADDLE-WEBHOOK] No user_id in custom_data', sub.id);
          break;
        }

        await db.from('subscriptions').upsert({
          user_id:            userId,
          paddle_customer_id: sub.customerId,
          paddle_sub_id:      sub.id,
          status:             sub.status,
          trial_ends_at:      sub.trialDates?.endsAt ?? null,
          current_period_end: sub.currentBillingPeriod?.endsAt ?? null,
          updated_at:         new Date().toISOString(),
        }, { onConflict: 'paddle_sub_id' });
        break;
      }

      case EventName.SubscriptionCanceled: {
        const sub = event.data as unknown as { id: string };
        await db.from('subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('paddle_sub_id', sub.id);
        break;
      }

      case EventName.SubscriptionPaused: {
        const sub = event.data as unknown as { id: string };
        await db.from('subscriptions')
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('paddle_sub_id', sub.id);
        break;
      }

      case EventName.SubscriptionResumed: {
        const sub = event.data as unknown as { id: string; status: string };
        await db.from('subscriptions')
          .update({ status: sub.status, updated_at: new Date().toISOString() })
          .eq('paddle_sub_id', sub.id);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    Sentry.captureException(err, { extra: { eventType: event.eventType } });
    console.error('[PADDLE-WEBHOOK] DB upsert failed:', err);
    return NextResponse.json({ error: 'db error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
