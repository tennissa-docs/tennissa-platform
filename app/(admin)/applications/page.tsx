import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Applications" };

export default async function Page() {
  await requireRole(["owner", "admin", "auditor"], "/applications");
  return <ComingSoon title="Applications" screen="S21" what="Applications by status, in priority order." />;
}
