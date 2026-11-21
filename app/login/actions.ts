"use server";
import { redirect } from "next/navigation";
import { requestMagicLink } from "@/lib/auth";

export type LoginState = { error?: string; email?: string };

// Public action (no role guard: anyone may ask for a link). The answer never says whether the email
// has an account. TODO: per-IP and per-email rate limits (architecture › The parts that bite).
export async function requestLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const next = String(form.get("next") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200) return { error: "Enter your email address.", email };
  try {
    await requestMagicLink(email, next || undefined);
  } catch (e) {
    console.error("magic link request failed", e);
    return { error: "We couldn't send the link just now. Try again in a minute.", email };
  }
  redirect("/login?sent=1");
}
