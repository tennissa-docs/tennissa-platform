import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Vendors" };

export default async function Page() {
  await requireRole(["owner", "admin", "auditor"], "/vendors");
  return <ComingSoon title="Vendors" screen="S29" what="Tutors, therapists and suppliers paid on a student’s award." />;
}
