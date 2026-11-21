// Signed tokens for sessions and dev magic links (HS256, AUTH_SECRET). Used by proxy.ts and the server.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "tn_session";

function key(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ characters)");
  return new TextEncoder().encode(s);
}

export type SessionClaims = { sub: string; sid: string; seen: number };

export async function signSession(c: SessionClaims): Promise<string> {
  return new SignJWT({ sid: c.sid, seen: c.seen })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(c.sub)
    .setIssuedAt()
    .setAudience("session")
    .setExpirationTime("12h") // hard cap; the idle limit (30 min) is enforced on every request
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { audience: "session" });
    if (typeof payload.sub !== "string" || typeof payload.seen !== "number" || typeof payload.sid !== "string") return null;
    return { sub: payload.sub, sid: payload.sid, seen: payload.seen };
  } catch {
    return null;
  }
}

export function idleMinutes(): number {
  const n = Number(process.env.SESSION_IDLE_MINUTES ?? 30);
  return Number.isFinite(n) && n >= 5 && n <= 60 ? n : 30;
}

export async function signMagicLink(c: { sub: string; email: string; jti: string }): Promise<string> {
  return new SignJWT({ email: c.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(c.sub)
    .setJti(c.jti)
    .setIssuedAt()
    .setAudience("magic-link")
    .setExpirationTime("24h")
    .sign(key());
}

export async function verifyMagicLink(token: string) {
  const { payload } = await jwtVerify(token, key(), { audience: "magic-link" });
  return { sub: String(payload.sub), email: String(payload.email), jti: String(payload.jti) };
}

/** HMAC of a value, for unguessable public links (thank-you pages). */
export async function signValue(value: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", key() as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(value));
  return Buffer.from(sig).toString("base64url").slice(0, 32);
}

export async function checkSignedValue(value: string, sig: string | undefined | null): Promise<boolean> {
  if (!sig) return false;
  const expected = await signValue(value);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
