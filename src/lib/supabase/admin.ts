// Service-role Supabase client — bypasses RLS. NEVER import from a client component
// or from code that can reach the browser. Only use in server-side route handlers
// and server actions that intentionally need to bypass RLS (storage writes,
// guest RSVP insert with couple lookup, etc.).

import { createClient as createAdminClient } from "@supabase/supabase-js";

export function createAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
