import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Awards" };

export default async function Page() {
  await requireRole(["owner", "admin", "auditor"], "/awards");
  return <ComingSoon title="Awards" screen="S25" what="Scholarships awarded, paid and still to pay." />;
}
