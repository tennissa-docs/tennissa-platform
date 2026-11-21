import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, idleMinutes, signSession, verifySession } from "@/lib/auth/token";

// Runs before every page: a strict CSP with a fresh nonce, security headers, and the 30-minute idle
// sign-out (the session's `seen` time slides forward on activity). Authorization itself happens in
// each page and server action (requireRole / guardRole); this is only the first check.

const SIGNED_IN_PREFIXES = ["/overview", "/donations", "/donors", "/schools", "/rounds", "/applications", "/students",
  "/awards", "/payments", "/vendors", "/ledger", "/compliance", "/settings", "/review", "/school"];

function csp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.stripe.com",
    "font-src 'self'",
    "connect-src 'self' https://api.stripe.com https://*.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token);
  const needsSession = SIGNED_IN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const idle = claims ? Date.now() - claims.seen > idleMinutes() * 60_000 : false;

  if (needsSession && (!claims || idle)) {
    const to = request.nextUrl.clone();
    if (idle) {
      // log the timeout and clear the cookie server-side, then show sign-in
      to.pathname = "/auth/timed-out";
      to.search = `?next=${encodeURIComponent(pathname + search)}`;
    } else {
      to.pathname = "/login";
      to.search = `?next=${encodeURIComponent(pathname + search)}`;
    }
    return NextResponse.redirect(to);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);

  // slide the idle window forward (at most once a minute)
  if (claims && !idle && Date.now() - claims.seen > 60_000) {
    response.cookies.set(SESSION_COOKIE, await signSession({ ...claims, seen: Date.now() }), {
      httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: 12 * 3600,
    });
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|brand|fonts).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
