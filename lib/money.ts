// Money is integer cents (bigint) plus a currency. Never floats. Format only at the edge.
export type Cents = bigint;

export function toCents(v: bigint | number | string | null | undefined): Cents {
  if (v === null || v === undefined) return 0n;
  if (typeof v === "bigint") return v;
  if (typeof v === "number") {
    if (!Number.isInteger(v)) throw new Error("cents must be an integer");
    return BigInt(v);
  }
  return BigInt(v);
}

/** "1,700.00" or "$1,700" -> 170000n. Returns null when the text is not a valid amount. */
export function parseDollars(text: string): Cents | null {
  const t = text.replace(/[$,\s]/g, "");
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const frac = (m[2] ?? "").padEnd(2, "0");
  return BigInt(m[1]) * 100n + BigInt(frac);
}

export function formatMoney(cents: Cents | number | string, opts: { showCents?: boolean } = {}): string {
  const c = toCents(cents);
  const neg = c < 0n;
  const abs = neg ? -c : c;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const rest = (abs % 100n).toString().padStart(2, "0");
  const s = (opts.showCents ?? true) ? `$${whole}.${rest}` : `$${whole}`;
  return neg ? `−${s}` : s;
}
