// lib/supabase-service.ts
//
// Supabase client using the service_role key — bypasses RLS.
// ONLY import in server-side code (API routes, webhooks). Never in client components.

import { createClient } from '@supabase/supabase-js';

let _serviceClient: ReturnType<typeof createClient> | null = null;

export function getServiceClient() {
  if (_serviceClient) return _serviceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service role env vars');
  _serviceClient = createClient(url, key, { auth: { persistSession: false } });
  return _serviceClient;
}
