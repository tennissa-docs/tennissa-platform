import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

// Owner, admin and (read-only) auditor share this shell. Each page and action checks its own role too.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRole(["owner", "admin", "auditor"], "/overview");
  return <AppShell user={{ name: ctx.name, role: ctx.role }}>{children}</AppShell>;
}
