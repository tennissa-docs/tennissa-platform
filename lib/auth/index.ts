import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { sql } from "@/lib/db";
import { env, isProduction } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { magicLinkEmail } from "@/lib/email/templates";
import {
  SESSION_COOKIE, idleMinutes, signMagicLink, signSession, verifyMagicLink, verifySession,
} from "./token";

export type Role = "owner" | "admin" | "committee_member" | "auditor" | "school_admin";
export type Ctx = { userId: string; email: string; name: string; orgId: string; role: Role; schoolId: string | null };

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) { super(message); }
}

// ------------------------------------------------------------------ request facts
export async function requestMeta() {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  return { ip: fwd && isIP(fwd) ? fwd : null, userAgent: h.get("user-agent")?.slice(0, 500) ?? null };
}

type SignInEvent = "link_requested" | "signed_in" | "signed_out" | "timed_out" | "link_expired" | "link_reused" | "rate_limited";

export async function logSignIn(e: { event: SignInEvent; email: string; userId?: string | null }) {
  const { ip, userAgent } = await requestMeta();
  const [org] = await sql`select id from orgs order by created_at limit 1`;
  await sql`insert into sign_in_events (org_id, user_id, email, event, ip, user_agent)
    values (${org?.id ?? null}, ${e.userId ?? null}, ${e.email}, ${e.event}, ${ip}, ${userAgent})`;
}

// ------------------------------------------------------------------ magic links
// Provider "dev": the link is signed here and delivered through the email layer (the dev outbox when
// Resend isn't configured). It is refused in production; Supabase Auth replaces it (same calls).
const used = (globalThis as unknown as { __usedLinks?: Set<string> }).__usedLinks ?? new Set<string>();
(globalThis as unknown as { __usedLinks?: Set<string> }).__usedLinks = used;

function assertDevProvider() {
  if (env.authProvider !== "dev") throw new Error(`auth provider ${env.authProvider} is not wired up yet`);
  if (isProduction) throw new Error("the dev sign-in provider is refused in production");
}

/** Always answers the same way, whether or not the email has an account. */
export async function requestMagicLink(rawEmail: string, next?: string): Promise<void> {
  assertDevProvider();
  const email = rawEmail.trim().toLowerCase();
  const [user] = await sql`select u.id, u.first_name from users u where u.email = ${email}`;
  await logSignIn({ event: "link_requested", email, userId: user?.id ?? null });
  if (!user) return;
  const token = await signMagicLink({ sub: user.id, email, jti: randomUUID() });
  const url = new URL("/auth/callback", env.appUrl);
  url.searchParams.set("token", token);
  if (next && next.startsWith("/") && !next.startsWith("//")) url.searchParams.set("next", next);
  const [org] = await sql`select id from orgs order by created_at limit 1`;
  await sendEmail({
    orgId: org.id, kind: "magic_link", to: email, recipientUserId: user.id,
    ...(await magicLinkEmail({ firstName: user.first_name, url: url.toString() })),
  });
}

export type ConsumeResult = { ok: true; userId: string } | { ok: false; reason: "expired" | "reused" | "invalid" };

export async function consumeMagicLink(token: string): Promise<ConsumeResult> {
  assertDevProvider();
  let claims: { sub: string; email: string; jti: string };
  try {
    claims = await verifyMagicLink(token);
  } catch (e) {
    const expired = (e as { code?: string }).code === "ERR_JWT_EXPIRED";
    if (expired) {
      const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString() || "{}");
      if (payload.email) await logSignIn({ event: "link_expired", email: String(payload.email) });
      return { ok: false, reason: "expired" };
    }
    return { ok: false, reason: "invalid" };
  }
  if (used.has(claims.jti)) {
    await logSignIn({ event: "link_reused", email: claims.email, userId: claims.sub });
    return { ok: false, reason: "reused" };
  }
  used.add(claims.jti);
  await startSession(claims.sub, claims.email);
  return { ok: true, userId: claims.sub };
}

async function startSession(userId: string, email: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession({ sub: userId, sid: randomUUID(), seen: Date.now() }), {
    httpOnly: true, secure: env.appUrl.startsWith("https://"), sameSite: "lax", path: "/", maxAge: 12 * 3600,
  });
  await logSignIn({ event: "signed_in", email, userId });
}

export async function signOut(event: "signed_out" | "timed_out" = "signed_out") {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  if (claims) {
    const [u] = await sql`select email from users where id = ${claims.sub}`;
    if (u) await logSignIn({ event, email: u.email, userId: claims.sub });
  }
}

// ------------------------------------------------------------------ guards
async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  // the proxy refreshes `seen` on every request; this is the server-side backstop
  if (Date.now() - claims.seen > idleMinutes() * 60_000) return null;
  return claims.sub;
}

/** Live memberships only: not revoked, not past an auditor's end date. */
async function loadCtx(userId: string, roles: Role[]): Promise<Ctx | null> {
  const rows = await sql`
    select u.id, u.email, coalesce(nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''), u.email) as name,
           m.org_id, m.role, m.school_id
    from users u join memberships m on m.user_id = u.id
    where u.id = ${userId} and m.revoked_at is null and (m.expires_at is null or m.expires_at > now())
      and m.role = any(${roles})
    order by array_position(array['owner','admin','auditor','committee_member','school_admin'], m.role)
    limit 1`;
  const r = rows[0];
  if (!r) return null;
  return { userId: r.id, email: r.email, name: r.name, orgId: r.org_id, role: r.role, schoolId: r.school_id };
}

/** For pages: redirects to sign-in, or to the no-access page. */
export async function requireRole(roles: Role[], here = "/"): Promise<Ctx> {
  const userId = await currentUserId();
  if (!userId) redirect(`/login?next=${encodeURIComponent(here)}`);
  const ctx = await loadCtx(userId, roles);
  if (!ctx) redirect("/no-access");
  return ctx;
}

/** For route handlers and server actions: throws AuthError (401/403). Auditors never pass a write guard. */
export async function guardRole(roles: Role[], opts: { write?: boolean } = {}): Promise<Ctx> {
  const userId = await currentUserId();
  if (!userId) throw new AuthError(401, "Sign in to continue.");
  const allowed = opts.write ? roles.filter((r) => r !== "auditor") : roles;
  const ctx = await loadCtx(userId, allowed);
  if (!ctx) throw new AuthError(403, "You don't have access to this.");
  return ctx;
}

export async function homeFor(userId: string): Promise<string> {
  const ctx = await loadCtx(userId, ["owner", "admin", "auditor", "committee_member", "school_admin"]);
  if (!ctx) return "/no-access";
  switch (ctx.role) {
    case "owner": case "admin": return "/overview";
    case "auditor": return "/compliance";
    case "committee_member": return "/review";
    case "school_admin": return "/school";
  }
}
