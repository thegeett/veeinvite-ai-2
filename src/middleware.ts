// STUB — Stream C replaces with auth-protecting middleware per plan §23 VI-F015.
// For Day 0, pass every request through unmodified so the app boots.

import { NextResponse, type NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // Stream C will add protection for /dashboard, /onboarding, and /api/*
  // (except /api/rsvp which is public for guest submissions).
  matcher: []
};
