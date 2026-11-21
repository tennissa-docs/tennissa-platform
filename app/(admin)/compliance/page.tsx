import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Compliance" };

export default async function Page() {
  await requireRole(["owner", "admin", "auditor"], "/compliance");
  return <ComingSoon title="Compliance" screen="S35" what="The 90% test, confirmation numbers and the audit package, by tax year." />;
}
