import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Schools" };

export default async function Page() {
  await requireRole(["owner", "admin", "auditor"], "/schools");
  return <ComingSoon title="Schools" screen="S12" what="Partner schools, their agreements and their students." />;
}
