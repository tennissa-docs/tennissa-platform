"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen, CalendarRange, FileCheck2, GraduationCap, HandCoins, LayoutDashboard, LogOut, Menu,
  School, Settings, ShieldCheck, Store, Trophy, Users, Wallet, X, type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";

type Item = { href: string; label: string; icon: LucideIcon };
const NAV: { group: string | null; items: Item[] }[] = [
  { group: null, items: [{ href: "/overview", label: "Overview", icon: LayoutDashboard }] },
  { group: "Money", items: [
    { href: "/donations", label: "Donations", icon: HandCoins },
    { href: "/donors", label: "Donors", icon: Users },
  ] },
  { group: "Students", items: [
    { href: "/schools", label: "Schools", icon: School },
    { href: "/rounds", label: "Rounds", icon: CalendarRange },
    { href: "/applications", label: "Applications", icon: FileCheck2 },
    { href: "/students", label: "Students", icon: GraduationCap },
    { href: "/awards", label: "Awards", icon: Trophy },
    { href: "/payments", label: "Payments", icon: Wallet },
    { href: "/vendors", label: "Vendors", icon: Store },
  ] },
  { group: "Books", items: [
    { href: "/ledger", label: "Ledger", icon: BookOpen },
    { href: "/compliance", label: "Compliance", icon: ShieldCheck },
  ] },
];

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", admin: "Admin", auditor: "Auditor", committee_member: "Committee member", school_admin: "School admin",
};

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const item = (i: Item) => {
    const active = path === i.href || path.startsWith(i.href + "/");
    return (
      <li key={i.href}>
        <Link href={i.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
          className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-[var(--motion-fast)] ${
            active ? "bg-accent-tint text-accent font-semibold" : "text-text-muted hover:bg-surface hover:text-text"}`}>
          <i.icon aria-hidden className="size-5" />
          {i.label}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col overflow-y-auto px-3">
      {NAV.map((g) => (
        <div key={g.group ?? "top"} className={g.group ? "mt-6" : ""}>
          {g.group && <p className="px-3 pb-2 text-caption text-text-subtle">{g.group}</p>}
          <ul className="flex flex-col gap-0.5">{g.items.map(item)}</ul>
        </div>
      ))}
      <ul className="mt-auto pt-6 pb-2">{item({ href: "/settings", label: "Settings", icon: Settings })}</ul>
    </nav>
  );
}

function UserCard({ name, role }: { name: string; role: string }) {
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-4">
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-caption font-semibold">{initials}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" title={name}>{name}</p>
        <p className="text-caption text-text-muted">{ROLE_LABEL[role] ?? role}</p>
      </div>
      <form action="/auth/sign-out" method="post">
        <button type="submit" aria-label="Sign out" title="Sign out"
          className="flex size-9 items-center justify-center rounded-full text-text-muted hover:bg-surface hover:text-text">
          <LogOut aria-hidden className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function AppShell({ user, children }: { user: { name: string; role: string }; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-dvh bg-surface lg:pl-[var(--layout-sidebar)]">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[var(--layout-sidebar)] flex-col border-r border-border bg-bg lg:flex">
        <div className="flex h-16 items-center px-6"><Logo variant="compact" href="/overview" className="h-7" /></div>
        <NavLinks />
        <UserCard {...user} />
      </aside>

      {/* mobile and tablet top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg px-[var(--layout-gutter)] lg:hidden">
        <Logo variant="compact" href="/overview" className="h-7" />
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}
          className="flex size-10 items-center justify-center rounded-full hover:bg-surface">
          <Menu aria-hidden className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-overlay/25" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(320px,85vw)] flex-col bg-bg shadow-pop">
            <div className="flex h-14 items-center justify-between px-4">
              <Logo variant="compact" href={null} className="h-7" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" autoFocus
                className="flex size-10 items-center justify-center rounded-full hover:bg-surface">
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <UserCard {...user} />
          </div>
        </div>
      )}

      <main id="main" className="mx-auto max-w-[calc(var(--layout-content-max)+2*var(--layout-gutter))] px-[var(--layout-gutter)] py-8 lg:py-12">
        {children}
      </main>
    </div>
  );
}

