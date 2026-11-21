import { NextResponse, type NextRequest } from "next/server";
import { consumeMagicLink, homeFor } from "@/lib/auth";

// GET /auth/callback?token=…: exchange a one-use link for a session, then route by role.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const next = req.nextUrl.searchParams.get("next");
  const to = req.nextUrl.clone();
  to.search = "";
  if (!token) {
    to.pathname = "/login";
    to.searchParams.set("reason", "invalid");
    return NextResponse.redirect(to);
  }
  const result = await consumeMagicLink(token);
  if (!result.ok) {
    to.pathname = "/login";
    to.searchParams.set("reason", result.reason);
    return NextResponse.redirect(to);
  }
  to.pathname = next && next.startsWith("/") && !next.startsWith("//") ? next : await homeFor(result.userId);
  return NextResponse.redirect(to);
}
