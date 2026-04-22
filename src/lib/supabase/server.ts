import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createStandaloneClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client that reads the auth cookie. Use this
 * from any server component, route handler, or server action that
 * needs the current user's session.
 */
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server components can't set cookies — middleware handles refresh.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Ignore.
          }
        },
      },
    },
  );
}

/**
 * A service-role Supabase client. Use sparingly — only in routes that
 * must bypass RLS (e.g. the public `/w/[slug]` route that needs to
 * look up any couple by slug without a session).
 */
export function createServiceRoleClient() {
  return createStandaloneClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
