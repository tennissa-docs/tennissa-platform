"use client";
import { useId, type ComponentProps, type ReactNode } from "react";
import { AlertCircle, Check } from "lucide-react";

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-2 flex items-center gap-1.5 text-caption text-danger">
      <AlertCircle aria-hidden className="size-3.5" /> {children}
    </p>
  );
}

const inputCls =
  "h-12 w-full rounded-md border border-border-input bg-bg px-4 text-base text-text placeholder:text-text-subtle " +
  "hover:border-border-strong focus:border-accent focus:shadow-focus focus:outline-none " +
  "aria-invalid:border-danger disabled:bg-surface disabled:text-text-subtle";

export function TextField({ label, hint, error, prefix, className = "", ...rest }: {
  label: string; hint?: ReactNode; error?: string; prefix?: string; className?: string;
} & Omit<ComponentProps<"input">, "prefix">) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      {hint && <p id={hintId} className="text-caption text-text-muted mt-0.5">{hint}</p>}
      <div className="relative mt-2">
        {prefix && <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">{prefix}</span>}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hint ? hintId : "", error ? errId : ""].filter(Boolean).join(" ") || undefined}
          className={`${inputCls} ${prefix ? "pl-8 tabular" : ""}`}
          {...rest}
        />
      </div>
      <FieldError id={errId}>{error}</FieldError>
    </div>
  );
}

export function SelectField({ label, error, children, className = "", ...rest }: {
  label: string; error?: string; children: ReactNode; className?: string;
} & ComponentProps<"select">) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      <select id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined}
        className={`${inputCls} mt-2 appearance-none bg-[length:16px] pr-10`} {...rest}>
        {children}
      </select>
      <FieldError id={`${id}-err`}>{error}</FieldError>
    </div>
  );
}

/** A large selectable card (one option of a radio group). */
export function RadioCard({ name, value, checked, onChange, title, detail, description }: {
  name: string; value: string; checked: boolean; onChange: (v: string) => void;
  title: string; detail?: string; description?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors duration-[var(--motion-fast)] ${
        checked ? "border-2 border-accent bg-accent-tint p-[15px]" : "border-border-strong hover:bg-surface"
      } has-[:focus-visible]:shadow-focus`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="sr-only" />
      <span aria-hidden className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
        checked ? "border-accent bg-accent" : "border-border-input bg-bg"}`}>
        {checked && <span className="size-2 rounded-full bg-on-accent" />}
      </span>
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        {description && <span className="block text-sm text-text-muted mt-0.5">{description}</span>}
      </span>
      {detail && <span className="text-sm text-text-muted">{detail}</span>}
    </label>
  );
}

export function CheckboxField({ checked, onChange, children, error }: {
  checked: boolean; onChange: (v: boolean) => void; children: ReactNode; error?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined} className="peer sr-only" />
        <span aria-hidden className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] border peer-focus-visible:shadow-focus ${
          checked ? "border-accent bg-accent" : error ? "border-danger bg-bg" : "border-border-input bg-bg"}`}>
          {checked && <Check className="size-3.5 text-on-accent" strokeWidth={3} />}
        </span>
        <span className="text-base">{children}</span>
      </label>
      <div className="pl-8"><FieldError id={`${id}-err`}>{error}</FieldError></div>
    </div>
  );
}
