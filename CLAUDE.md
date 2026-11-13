# TENNISSA platform: project memory for Claude Code

The scholarship-granting-organization (SGO) platform for **TENNISSA (Tennessee Islamic School Scholarship Alliance)**: a rebuild of SGO HQ's Money, Students and Books areas, clean-room, under TENNISSA's own brand. Planned with the Replica skill pack (recon → architecture → design done; next: `/replica-build`).

## Read before building

| file | what it is |
| --- | --- |
| `replica/recon.md` | screens (S-IDs), flows (F-IDs), data model, rules, and every decision log entry at the top |
| `replica/features.csv` | the checklist: 74 must / 21 should / 4 could / 15 skip; `clone` column gets ticked as features ship |
| `replica/architecture.md` | stack, schema overview, posting rules, roles and permissions, every route and job, retention, compliance, build order |
| `replica/schema.sql` | migration 0001 (Postgres 15+). 51 tables, 14 views. **Tested**: `replica/db-tests/run.sh` (12 files, all pass) |
| `replica/design/` | `tokens.json` → `tokens.css` (Tailwind v4 `@theme`), `components.md`, `preview.html` (the design system, open in a browser), `brand/` (TENNISSA logos) |
| `replica/screens/` | reference frames of the original product. **Never shipped, never copied into the app** |
| `replica/competitor-sgoone.md`, `replica/checklist-eftc-sgo-software.md` | comparisons; gaps 2–6 in the EFTC checklist are still open by choice |

## Decisions (do not undo without asking)

- **One SGO** (TENNISSA), **no districts**, single state to start (TN); `org_id` stays on top-level tables.
- **One-time gifts only, charged at checkout.** No pledges, no monthly gifts, no pre-registration. Giving opens after Jan 1, 2027.
- **Records:** financial records (donations, receipts, refunds, awards, payments, proofs, ledger, audit log, statements, IRS reports, certifications) are **permanent**: never deleted, never edited; fix with reversing entries or superseding records. Applicant documents kept **5 years** after the decision, then purged by a job. The database enforces this with triggers; do not work around them.
- **Refunds** are separate linked transactions (`donation_refunds`) with RF- numbers and refund receipts; every §25F refund is flagged for tax review (cross-year = priority). Money a school/vendor sends back is `payment_returns` (income in the year it comes back, spend by Dec 31 next year).
- **Roles:** owner, admin, committee_member (recommends; owner/admin decides; auto-added to disqualified persons; recusals), auditor (read-only, owner-granted, ≤1 year, documents off by default, masked TIN/bank), school_admin, donor/parent.
- **Paying out:** NACHA ACH file the SGO's own bank sends; nothing is paid without proof (school: enrollment + per-term confirmation + term tuition statement; vendor: invoice + delivery proof, optional family confirmation). A reported withdrawal/transfer blocks further school payments.
- **Compliance:** per-state 90% test (gross and net of refunds until the CPA picks), distribution rule, payout progress by receipt year, Jan 31 donor statements, Feb 28 IRS donor report (format placeholder), annual certification pack, audit package, state report.
- **Design:** premium, minimal, Apple-inspired but our own: white/light-gray, near-black type, accent blue `#0b67d8` for actions only, TENNISSA navy `#142a64` / red `#9b1a28` for brand marks only, pill buttons, 12–20px radii, system font (SF Pro on Apple devices via the stack; Inter self-hosted elsewhere; never bundle SF Pro), Lucide icons, few modals (pages, side sheets, inline confirm). 29 colour pairs pass WCAG AA: run `python3 replica/design/contrast.py replica/design/tokens.json` after any colour change.

## Stack

Next.js (App Router) + TypeScript · Tailwind v4 with `replica/design/tokens.css` · shadcn/ui on Radix · Postgres on Supabase · Drizzle (SQL migrations; `schema.sql` is 0001) · Supabase Auth magic links (+TOTP for owner/admin) · Stripe (Payment Element, ACH + card, Connect: one §25F account per state + general) · Resend + React Email · @react-pdf/renderer · Inngest jobs · S3 Object Lock (compliance mode) for financial records and applicant documents · Vercel.

## Rules for every change

- Money is integer **cents** (`bigint`) plus currency. Never floats. Format only at the edge.
- Every money event posts a **balanced journal entry** through one posting function per event type with an **idempotency key** (see posting rules in architecture.md). Never write to `postings` from feature code.
- The browser never talks to the database. Every server action starts with one role guard (`requireRole`, `requireSchool`, `requireGuardian`, `requireDonor`, auditor read-only).
- Stripe fees come from the balance transaction, never computed.
- Dates that are calendar dates (`received_on`, `spend_by`, terms) are `date`; events are `timestamptz`; tax year is computed in `America/Chicago`.
- UI uses token classes (`bg-surface`, `text-text-muted`, `rounded-xl`), never raw hex. One primary (blue) button per screen. Every screen has loading, empty, error and success states.
- Write fresh copy; never copy SGO HQ's text, logos, icons, illustrations or sample data.
- Tests: `replica/db-tests/run.sh` must stay green; add a test file for every new database rule. Add Playwright tests per flow (`/replica-test`).
- Things only a CPA/lawyer can settle are configuration, not constants: $1,700 cap (`credit_caps`), 300% AMGI (`amgi_limits`), 90/10 basis, retention years, IRS file layout, deadlines.

## First task: the vertical slice

One dollar end to end, ugly is fine: `/donate` (S05, plain) → give flow (S06: single donor, ACH and card, Stripe **test mode**) → thank-you (S07) → webhook books it once even when replayed → receipt email → `/donations` (S01) → `/overview` tiles + Books balances (S31) → `/ledger` trial balance $0 (S32). Then the must-haves, area by area, as listed in architecture.md › Build order.

## Open questions (for the owner / CPA)

Tax year of an ACH gift made Dec 30 that clears Jan 3 · 90/10 gross vs net of refunds · whether a refunded credit gift frees the $1,700 cap · donor obligations after a cross-year refund · fourth permitted income method · IRS report format and deadlines · original vector logo from the designer (current SVGs are traced from a 309×84 PNG).
