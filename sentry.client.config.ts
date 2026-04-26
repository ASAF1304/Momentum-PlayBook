// sentry.client.config.ts — browser-side Sentry initialization.
// Only active when NEXT_PUBLIC_SENTRY_DSN is set.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Session replays disabled — we don't need video playback and they are costly.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    debug: false,
  });
}
