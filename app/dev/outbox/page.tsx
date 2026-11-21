import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Inbox } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui/display";
import { isProduction } from "@/lib/env";
import { OUTBOX_DIR } from "@/lib/email/send";

export const metadata: Metadata = { title: "Dev outbox", robots: { index: false } };

type Mail = { file: string; to: string; subject: string; kind: string; text: string };

// Development only: emails written by lib/email/send.ts when Resend isn't configured.
export default async function DevOutbox() {
  if (isProduction) notFound();
  let mails: Mail[] = [];
  try {
    const files = (await readdir(OUTBOX_DIR)).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, 50);
    mails = await Promise.all(files.map(async (f) => ({ file: f, ...JSON.parse(await readFile(path.join(OUTBOX_DIR, f), "utf8")) })));
  } catch { /* no outbox yet */ }

  return (
    <main id="main" className="mx-auto max-w-[var(--layout-content-max)] px-[var(--layout-gutter)] py-12">
      <PageHeader title="Dev outbox" description="Emails the app would have sent. Newest first. Not available in production." />
      {mails.length === 0 ? (
        <Card><EmptyState icon={Inbox} title="No emails yet">Ask for a sign-in link or make a test gift.</EmptyState></Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {mails.map((m) => (
            <li key={m.file}>
              <Card>
                <p className="text-caption text-text-muted">{m.kind} · to {m.to} · {m.file.slice(0, 19).replace(/T(\d\d)-(\d\d)-(\d\d)/, " $1:$2:$3")} UTC</p>
                <h2 className="text-lg mt-1">{m.subject}</h2>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-text-muted">
                  {m.text.split(/(https?:\/\/\S+)/g).map((part, i) =>
                    /^https?:\/\//.test(part) ? <a key={i} href={part} className="text-accent underline break-all">{part}</a> : part)}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
