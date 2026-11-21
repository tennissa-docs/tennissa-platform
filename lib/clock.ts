// One clock for the whole app. In development, DEV_CLOCK shifts "now" (the clock keeps ticking
// from that moment) so 2027 §25F gifts can be tested in Stripe test mode before giving opens.
export const ORG_TZ = "America/Chicago";

let offsetMs: number | null = null;
function offset(): number {
  if (offsetMs !== null) return offsetMs;
  const override = process.env.DEV_CLOCK;
  if (override) {
    if (process.env.NODE_ENV === "production" && !(process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")) {
      throw new Error("DEV_CLOCK is not allowed in production with live keys");
    }
    const t = new Date(override).getTime();
    if (Number.isNaN(t)) throw new Error("DEV_CLOCK is not a valid date");
    offsetMs = t - Date.now();
  } else offsetMs = 0;
  return offsetMs;
}

export function now(): Date {
  return new Date(Date.now() + offset());
}

export function isClockShifted(): boolean {
  return offset() !== 0;
}

/** Calendar parts of an instant in the org's time zone. */
export function orgDateParts(d: Date, tz = ORG_TZ) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** The tax year of an instant: the calendar year in America/Chicago, never UTC. */
export function taxYearOf(d: Date, tz = ORG_TZ): number {
  return orgDateParts(d, tz).year;
}

/** A calendar date (YYYY-MM-DD) in the org's time zone, for `date` columns. */
export function orgDate(d: Date, tz = ORG_TZ): string {
  const { year, month, day } = orgDateParts(d, tz);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatDate(d: Date | string, tz = ORG_TZ): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatDateTime(d: Date | string, tz = ORG_TZ): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(date);
}
