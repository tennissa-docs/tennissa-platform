import { NextResponse } from "next/server";
import { giveInput } from "@/lib/give/schema";
import { createGift, GiveError } from "@/lib/give/create-gift";
import { isStripeConfigured } from "@/lib/stripe";

// Public (anyone may give). TODO before launch: Turnstile check and a per-IP rate limit (architecture › Security).
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Online giving isn't connected to a payment processor yet." }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = giveInput.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[i.path.join(".")] ??= i.message;
    return NextResponse.json({ error: "Check the highlighted fields.", fields }, { status: 422 });
  }
  try {
    const gift = await createGift(parsed.data);
    return NextResponse.json(gift);
  } catch (e) {
    if (e instanceof GiveError) {
      const status = e.code === "closed" ? 403 : e.code === "payment" || e.code === "no_account" ? 503 : 422;
      return NextResponse.json({ error: e.message, fields: e.field ? { [e.field]: e.message } : undefined }, { status });
    }
    console.error("give intent failed", e);
    return NextResponse.json({ error: "Something went wrong on our side. Nothing was charged." }, { status: 500 });
  }
}
