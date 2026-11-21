import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Payments" };

export default async function Page() {
  await requireRole(["owner", "admin", "auditor"], "/payments");
  return <ComingSoon title="Payments" screen="S27" what="Payment batches to schools and vendors, and what is waiting on proof." />;
}
