import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Donors" };

export default async function Page() {
  await requireRole(["owner", "admin", "auditor"], "/donors");
  return <ComingSoon title="Donors" screen="S04" what="Everyone who has given, with this year’s running total against the credit limit." />;
}
