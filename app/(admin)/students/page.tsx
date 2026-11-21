import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Students" };

export default async function Page() {
  await requireRole(["owner", "admin", "auditor"], "/students");
  return <ComingSoon title="Students" screen="S24" what="Every student across partner schools." />;
}
