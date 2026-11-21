import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { sql, type Tx } from "@/lib/db";
import { env, isProduction } from "@/lib/env";

export type NotificationKind = "receipt" | "refund_receipt" | "magic_link" | "remittance" | "award_letter" | "year_end_statement";

export type OutgoingEmail = {
  orgId: string;
  kind: NotificationKind;
  to: string;
  recipientUserId?: string | null;
  subject: string;
  html: string;
  text: string;
  subjectType?: string;
  subjectId?: string;
};

export const OUTBOX_DIR = path.resolve(".dev-outbox");

/**
 * Sends through Resend when RESEND_API_KEY is set; otherwise (development only) writes the email to
 * .dev-outbox/ so it can be opened at /dev/outbox. Every email is recorded in notification_log.
 */
export async function sendEmail(m: OutgoingEmail, tx: Tx = sql): Promise<{ messageId: string }> {
  let messageId: string;
  if (env.resendApiKey) {
    const resend = new Resend(env.resendApiKey);
    const { data, error } = await resend.emails.send({
      from: env.emailFrom, to: m.to, subject: m.subject, html: m.html, text: m.text,
    });
    if (error || !data) throw new Error(`email not sent: ${error?.message ?? "unknown error"}`);
    messageId = data.id;
  } else {
    if (isProduction) throw new Error("RESEND_API_KEY is required in production");
    messageId = `dev-${randomUUID()}`;
    await mkdir(OUTBOX_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const base = path.join(OUTBOX_DIR, `${stamp}-${m.kind}`);
    await writeFile(`${base}.html`, m.html);
    await writeFile(`${base}.json`, JSON.stringify({ to: m.to, subject: m.subject, kind: m.kind, text: m.text, messageId }, null, 2));
    console.log(`[dev-outbox] ${m.kind} to ${m.to}: ${m.subject}`);
  }
  await tx`insert into notification_log (org_id, kind, recipient_user_id, recipient_email, subject_type, subject_id, provider_message_id)
    values (${m.orgId}, ${m.kind}, ${m.recipientUserId ?? null}, ${m.to}, ${m.subjectType ?? null}, ${m.subjectId ?? null}, ${messageId})`;
  return { messageId };
}
