import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "@/lib/auth";

// POST only, so a link or image can't sign someone out. Same-origin is checked by the browser's form post + SameSite cookie.
export async function POST(req: NextRequest) {
  await signOut("signed_out");
  const to = req.nextUrl.clone();
  to.pathname = "/login";
  to.search = "?reason=signedout";
  return NextResponse.redirect(to, 303);
}
