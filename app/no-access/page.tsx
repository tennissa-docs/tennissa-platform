import type { Metadata } from "next";
import { ShieldOff } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/display";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "No access", robots: { index: false } };

export default function NoAccessPage() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-surface px-[var(--layout-gutter)]">
      <Card className="w-full max-w-md">
        <EmptyState icon={ShieldOff} title="You don't have access to this page"
          action={<form action="/auth/sign-out" method="post"><Button type="submit" variant="secondary">Sign out</Button></form>}>
          Your account doesn&apos;t include this area of TENNISSA. If you think it should, ask an owner to check your role.
        </EmptyState>
      </Card>
    </main>
  );
}
