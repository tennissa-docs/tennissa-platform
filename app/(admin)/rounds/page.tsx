import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Rounds" };

export default async function Page() {
  await requireRole(["owner", "admin", "auditor"], "/rounds");
  return <ComingSoon title="Rounds" screen="S17" what="Application rounds: when families can apply." />;
}
