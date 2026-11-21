import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  await requireRole(["owner", "admin", "auditor"], "/settings");
  return <ComingSoon title="Settings" screen="S11" what="Organization, team, payments and scholarship settings." />;
}
