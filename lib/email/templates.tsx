import "server-only";
import * as React from "react";
import { render } from "@react-email/render";
import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import tokens from "@/replica/design/tokens.json";
import { env } from "@/lib/env";

// Email clients can't read CSS variables, so templates take their values from the same tokens.json.
const c = tokens.color;
const font = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

function Shell({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: c.surface, fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: c.bg, maxWidth: 600, padding: 32, borderRadius: 20, border: `1px solid ${c.border}` }}>
          <Img src={`${env.appUrl}/brand/tennissa-logo.png`} alt="TENNISSA" width="200" style={{ marginBottom: 24 }} />
          {children}
          <Hr style={{ borderColor: c.border, margin: "32px 0 16px" }} />
          <Text style={{ color: c["text-muted"], fontSize: 12, lineHeight: "18px", margin: 0 }}>
            TENNISSA, the Tennessee Islamic School Scholarship Alliance. You are getting this email because of a gift or
            sign-in request made with this address.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const p = { color: c.text, fontSize: 16, lineHeight: "24px", margin: "0 0 16px" };
const h1 = { color: c.text, fontSize: 24, lineHeight: "30px", fontWeight: 700, margin: "0 0 16px" };
const button = {
  backgroundColor: c.accent, color: c["on-accent"], borderRadius: 999, padding: "12px 28px",
  fontSize: 16, fontWeight: 600, textDecoration: "none",
};

export async function magicLinkEmail(a: { firstName: string | null; url: string }) {
  const el = (
    <Shell preview="Your sign-in link for TENNISSA">
      <Heading style={h1}>Sign in to TENNISSA</Heading>
      <Text style={p}>{a.firstName ? `Hi ${a.firstName}, here` : "Here"} is your sign-in link. It works once and expires in 24 hours.</Text>
      <Section style={{ margin: "24px 0" }}><Button href={a.url} style={button}>Sign in</Button></Section>
      <Text style={{ ...p, color: c["text-muted"], fontSize: 14 }}>If you didn&apos;t ask for this, you can ignore it. Nobody can sign in without the link.</Text>
    </Shell>
  );
  return {
    subject: "Your TENNISSA sign-in link",
    html: await render(el),
    text: `Sign in to TENNISSA: ${a.url}\n\nThe link works once and expires in 24 hours. If you didn't ask for it, ignore this email.`,
  };
}

export type ReceiptFacts = {
  donorName: string;
  donorNumber: number;
  amount: string;           // already formatted at the edge
  date: string;
  confirmationNo: string;
  method: string;
  designation: string;
  qualified25f: boolean;
  state: string | null;
  taxYear: number;
  ein: string;
  thanksUrl: string;
};

export async function receiptEmail(r: ReceiptFacts) {
  const credit = r.qualified25f
    ? `Designated as a qualified contribution for the federal scholarship tax credit (${r.state}), tax year ${r.taxYear}.`
    : `A general gift, not designated for the federal scholarship tax credit.`;
  const rows: [string, string][] = [
    ["Confirmation number", r.confirmationNo],
    ["Amount", r.amount],
    ["Date", r.date],
    ["Paid by", r.method],
    ["Goes to", r.designation],
    ["Tax credit", r.qualified25f ? `Yes (${r.state}), tax year ${r.taxYear}` : "No"],
    ["Donor number", String(r.donorNumber)],
    ["TENNISSA EIN", r.ein],
  ];
  const el = (
    <Shell preview={`Receipt ${r.confirmationNo} for your ${r.amount} gift`}>
      <Heading style={h1}>Thank you, {r.donorName}</Heading>
      <Text style={p}>Your gift of {r.amount} has cleared. Keep this email as your receipt.</Text>
      <Section style={{ backgroundColor: c.surface, borderRadius: 16, padding: "8px 20px", margin: "8px 0 24px" }}>
        {rows.map(([k, v]) => (
          <Text key={k} style={{ margin: "10px 0", fontSize: 14, lineHeight: "20px", color: c.text }}>
            <span style={{ color: c["text-muted"] }}>{k}</span><br /><strong>{v}</strong>
          </Text>
        ))}
      </Section>
      <Text style={p}>{credit}</Text>
      <Text style={p}>TENNISSA did not provide any goods or services in exchange for this gift. Your year-end statement arrives by January 31.</Text>
      <Section style={{ margin: "24px 0 0" }}><Button href={r.thanksUrl} style={button}>View your gift</Button></Section>
    </Shell>
  );
  const text = [
    `Thank you, ${r.donorName}. Your gift of ${r.amount} has cleared. Keep this email as your receipt.`,
    "", ...rows.map(([k, v]) => `${k}: ${v}`), "", credit,
    "TENNISSA did not provide any goods or services in exchange for this gift. Your year-end statement arrives by January 31.",
    "", `View your gift: ${r.thanksUrl}`,
  ].join("\n");
  return { subject: `Your receipt for ${r.amount} (${r.confirmationNo})`, html: await render(el), text };
}
