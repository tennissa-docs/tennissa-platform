import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "@/lib/auth";

// The proxy sends an idle session here: log `timed_out` in sign_in_events, clear the cookie, show sign-in.
export async function GET(req: NextRequest) {
  await signOut("timed_out");
  const next = req.nextUrl.searchParams.get("next");
  const to = req.nextUrl.clone();
  to.pathname = "/login";
  to.search = "";
  to.searchParams.set("reason", "timeout");
  if (next && next.startsWith("/") && !next.startsWith("//")) to.searchParams.set("next", next);
  return NextResponse.redirect(to);
}
