import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Returns a Supabase client.
 * - Client-side use `VITE_SUPABASE_ANON_KEY` (exposed to the browser).
 * - Server-side use `SUPABASE_SERVICE_ROLE_KEY` or a SERVICE role key stored in env.
 *
 * Make sure to set the following environment variables in Vercel or `.env.local`:
 * - `VITE_SUPABASE_URL` (public client URL, e.g. https://<project>.supabase.co)
 * - `VITE_SUPABASE_ANON_KEY` (public anon key) for browser usage
 * - `SUPABASE_SERVICE_ROLE_KEY` (sensitive) for server-side privileged operations
 */
export function getSupabaseClient(serverSide = false): SupabaseClient {
  const url = SUPABASE_URL;
  if (!url) {
    throw new Error('Supabase URL not configured (VITE_SUPABASE_URL or SUPABASE_URL)');
  }

  const key = serverSide ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(`${serverSide ? 'SUPABASE_SERVICE_ROLE_KEY' : 'VITE_SUPABASE_ANON_KEY'} is not set`);
  }

  return createClient(url, key);
}

export default getSupabaseClient;
