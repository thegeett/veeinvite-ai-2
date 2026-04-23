// Auth middleware. Two jobs:
//   1. Refresh the Supabase session cookie on every matched request.
//   2. Gate protected pages and owner-only API routes when the session is missing.
//
// Public routes (landing, auth pages, public wedding site, shareable preview,
// and guest RSVP submissions) are excluded via the matcher.
//
// Plan §23 VI-F015, §21 architecture rule 10.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const PROTECTED_API_PREFIXES = [
  "/api/generate",
  "/api/edit",
  "/api/structured",
  "/api/publish",
  "/api/photos",
  "/api/restore",
  "/api/preview-token",
  "/api/custom-section",
  "/api/rsvp/export",
  "/api/couple",
  "/api/versions"
];

// /api/rsvp has BOTH: owner-only GET (list) and public POST (guest). The
// middleware can't branch on method — it gates only on path. The GET handler
// in the route performs its own auth check.

function isProtectedApi(pathname: string): boolean {
  return PROTECTED_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isProtectedPage(pathname: string): boolean {
  return pathname.startsWith("/dashboard") || pathname === "/onboarding";
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user) {
    if (isProtectedApi(pathname)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (isProtectedPage(pathname)) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

// Match everything except static assets and the routes that are always public
// (we still run through the matcher for session refresh, then fall through).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)"
  ]
};
