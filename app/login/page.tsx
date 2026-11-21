import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Banner, Card } from "@/components/ui/display";
import { isProduction } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const REASONS: Record<string, { tone: "info" | "warning" | "danger"; text: string }> = {
  timeout: { tone: "info", text: "You were signed out after 30 minutes without activity. Sign in again to continue." },
  expired: { tone: "warning", text: "That sign-in link has expired. Links work for 24 hours. Ask for a new one below." },
  reused: { tone: "warning", text: "That sign-in link was already used. Each link works once. Ask for a new one below." },
  invalid: { tone: "danger", text: "That sign-in link isn't valid. Ask for a new one below." },
  signedout: { tone: "info", text: "You're signed out." },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; reason?: string; next?: string }> }) {
  const { sent, reason, next } = await searchParams;
  const r = reason ? REASONS[reason] : undefined;
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-surface px-[var(--layout-gutter)] py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex justify-center"><Logo variant="full" href="/donate" className="h-16" /></div>
        <Card className="p-8">
          {sent ? (
            <div className="text-center" role="status">
              <MailCheck aria-hidden className="mx-auto size-8 text-accent" />
              <h1 className="text-title mt-4">Check your email</h1>
              <p className="text-sm text-text-muted mt-2">
                If that address has a TENNISSA account, a sign-in link is on its way. It works once and expires in 24 hours.
              </p>
              {!isProduction && (
                <p className="mt-6 text-caption text-text-muted">
                  Development: open the <Link href="/dev/outbox" className="text-accent hover:underline">dev outbox</Link> to find the link.
                </p>
              )}
              <p className="mt-6"><Link href="/login" className="text-sm text-accent hover:underline">Use a different email</Link></p>
            </div>
          ) : (
            <>
              <h1 className="text-title">Sign in</h1>
              <p className="text-sm text-text-muted mt-1 mb-6">We&apos;ll email you a link. No password needed.</p>
              {r && <div className="mb-6"><Banner tone={r.tone} role="status">{r.text}</Banner></div>}
              <LoginForm next={next} />
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
