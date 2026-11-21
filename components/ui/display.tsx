import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";

export function Card({ children, className = "", as: As = "section", ...rest }: {
  children: ReactNode; className?: string; as?: "section" | "div" | "article"; "aria-labelledby"?: string;
}) {
  return (
    <As className={`bg-surface-raised border border-border rounded-xl shadow-card p-6 ${className}`} {...rest}>
      {children}
    </As>
  );
}

export function SectionTitle({ id, children, description }: { id?: string; children: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 id={id} className="text-lg">{children}</h2>
      {description && <p className="text-sm text-text-muted mt-1">{description}</p>}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-caption text-text-subtle mb-2">{eyebrow}</p>}
        <h1 className="text-headline break-words">{title}</h1>
        {description && <p className="text-base text-text-muted mt-2 max-w-[var(--layout-reading-max)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3 md:shrink-0">{actions}</div>}
    </header>
  );
}

export function StatTile({ label, value, sub, icon: Icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: LucideIcon }) {
  return (
    <Card as="div" className="relative">
      {Icon && <Icon aria-hidden className="absolute right-6 top-6 size-5 text-text-subtle" />}
      <p className="text-caption text-text-muted">{label}</p>
      <p className="text-stat tabular mt-2 break-words">{value}</p>
      {sub && <p className="text-caption text-text-muted mt-1">{sub}</p>}
    </Card>
  );
}

type Tone = "neutral" | "info" | "success" | "warning" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-text-muted",
  info: "bg-accent-tint text-accent",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-pill px-2.5 text-caption font-semibold whitespace-nowrap ${tones[tone]}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

const DONATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "neutral" },
  processing: { label: "Processing", tone: "info" },
  succeeded: { label: "Succeeded", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  partly_refunded: { label: "Partly refunded", tone: "warning" },
  refunded: { label: "Refunded", tone: "warning" },
  returned: { label: "Returned", tone: "danger" },
  disputed: { label: "Disputed", tone: "danger" },
};

export function DonationStatus({ status }: { status: string }) {
  const s = DONATION_STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function EmptyState({ icon: Icon, title, children, action }: {
  icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface mb-4">
        <Icon aria-hidden className="size-6 text-text-muted" />
      </span>
      <p className="text-lg">{title}</p>
      {children && <p className="text-sm text-text-muted mt-1 max-w-md">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const bannerTone: Record<Exclude<Tone, "neutral">, { cls: string; icon: LucideIcon }> = {
  info: { cls: "bg-accent-tint text-text", icon: Info },
  success: { cls: "bg-success-tint text-text", icon: CheckCircle2 },
  warning: { cls: "bg-warning-tint text-text", icon: AlertTriangle },
  danger: { cls: "bg-danger-tint text-text", icon: XCircle },
};
const iconTone = { info: "text-accent", success: "text-success", warning: "text-warning", danger: "text-danger" };

export function Banner({ tone = "info", children, action, role }: {
  tone?: Exclude<Tone, "neutral">; children: ReactNode; action?: ReactNode; role?: "alert" | "status";
}) {
  const { cls, icon: Icon } = bannerTone[tone];
  return (
    <div role={role} className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${cls}`}>
      <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${iconTone[tone]}`} />
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}

export function KeyValueList({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-border">
      {items.map(([k, v], i) => (
        <div key={i} className="flex min-h-11 items-center justify-between gap-6 py-2.5">
          <dt className="text-sm text-text-muted">{k}</dt>
          <dd className="text-sm font-medium text-right tabular break-words min-w-0">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}
