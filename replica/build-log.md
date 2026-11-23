# Build log

One line per screen: ID, date, done or partial, what is missing, what was harder than expected.

## Step 1–2: shell and vertical slice (2026-11-20)

| ID | date | state | missing | harder than expected |
| --- | --- | --- | --- | --- |
| shell | 2026-11-20 | partial | tablet icon rail (sidebar collapses to the mobile menu below 1024px); org switcher; real stub content for 10 nav screens | Next 16 renamed middleware to `proxy.ts`; nonce CSP forces dynamic rendering (fine here) |
| S05 | 2026-11-20 | done (plain) | school-branded variant (S05 school, F02) | — |
| S06 | 2026-11-20 | partial | married couple in one checkout (two gifts, two receipts); school designation; card fee add-on; Turnstile and rate limit on /api/give/intent; **not yet run against Stripe test mode** (no keys yet) | Stripe SDK 23 removed `payment_method_types`, now `allowed_payment_method_types` |
| S07 | 2026-11-20 | done | card-statement line; "Go to my account" (donor portal S08 not built) | — |
| S09 | 2026-11-20 | partial | receipt PDF (@react-pdf); Resend not configured, so emails go to `.dev-outbox/` (view at `/dev/outbox`) | — |
| S01 | 2026-11-20 | partial | CSV export; "Record offline donation" (S02); row click into the donor page (S04) | — |
| S31 | 2026-11-20 | partial | setup checklist, attention banner, the two charts, next steps | — |
| S32 | 2026-11-20 | done (Accounts tab) | Journal (S33) and Reconciliation (S34) tabs | — |

### Backend in the slice

- **Database:** Postgres 16 in Docker (`tennissa-db`, port 54329); `replica/schema.sql` is migration 0001 (`npm run db:migrate`), seed is idempotent (`npm run db:seed`). The app connects as `tennissa_app`, a member of `app_runtime`. `replica/db-tests/run.sh`: 13/13 pass.
- **Money path:** `POST /api/give/intent` (donor + cap check under a row lock + pending donation + one PaymentIntent with idempotency key `checkout:<id>:1`) → Stripe → `POST /api/stripe/webhook` (signature check → `provider_events`, unique event id → process under row locks → confirmation number, receipt row, gift + fee entries keyed `<event_id>:gift` / `<event_id>:fee`, fee from the balance transaction) → receipt email.
- **Tests:** `npm run test:money`, 11 tests against a scratch database: replayed webhook books once; a second distinct success event books nothing; trial balance $0; sequential R-numbers; ACH processing/failed; general vs §25F accounts; amount mismatch refused; $1,700 cap (incl. gifts still processing, not failed ones); giving closed before 2027; signed webhook route end to end.

### Deviations to know about (said here so they aren't missed)

1. **Sign-in is a dev-only magic-link provider**, not Supabase Auth: signed one-use links (24h) delivered through the email layer, session cookie with a 30-minute idle limit, every event in `sign_in_events`. It refuses to run in production. Single use is tracked in memory (fine for one dev server, not for production). Swap for Supabase Auth + TOTP for owner/admin when the project exists; the calls (`requestMagicLink`, `consumeMagicLink`, `requireRole`, `guardRole`) stay.
2. **No Drizzle query builder yet.** Queries are postgres.js tagged templates. `drizzle(sql)` replaces the client's date serializers, which breaks plain queries on the same client, so if typed Drizzle queries are added they need their own `postgres()` instance. postgres.js v4 also stopped inferring parameter types; the client uses `infer: true`.
3. **Inngest isn't wired.** The webhook stores the event, then processes it and sends the receipt inline. Both functions are idempotent and ready to move into `process-provider-event` / `send-receipt` jobs.
4. **`DEV_CLOCK`** shifts the app's clock (development only, refused with live keys) so 2027 §25F gifts can be tested now; giving opens 2027-01-01 America/Chicago (`GIVING_OPENS_AT`).
5. **Processor accounts** are placeholders (`platform:25f:TN`, `platform:general`) that charge the platform account in test mode. Set `STRIPE_ACCOUNT_25F_TN` / `STRIPE_ACCOUNT_GENERAL` to `acct_…` and re-seed to route to Connect accounts.
6. **Cap counting:** unconfirmed (pending) gifts count against the cap for one hour; refunded gifts still count (open question for the CPA). Existing donors are matched by email; their stored name/address isn't changed by a later gift.
7. `.github/` (CI, ZAP, Dependabot) is listed in CLAUDE.md but isn't in the repo.

## Real services, part 1: Stripe test mode (2026-11-23)

- **Card verified end to end against Stripe test mode**: two gifts ($250, $500) → `payment_intent.succeeded` → booked R-2027-0001/0002 → fees $7.55 and $14.80 read from Stripe's balance transactions → trial balance $0.
- **Harder than expected: the fee arrives after the payment.** Stripe attaches the balance transaction to the charge a few seconds after `payment_intent.succeeded`, so the old code (which refused to book without the fee and returned 500) would never have booked a real gift locally (`stripe listen` doesn't retry). Now the gift is booked on `payment_intent.succeeded` and the fee on whichever event first sees it (`charge.updated` usually). The fee's idempotency key changed from `<event_id>:fee` to `fee:<balance_transaction_id>`, so it books once whichever event carries it. New money test covers it (12 tests).
- **Stripe Link turned off in the Payment Element** (`wallets.link: "never"`): it added its own "Bank" and "Klarna" options to a card-only PaymentIntent.
- Local webhooks: `stripe listen --events payment_intent.processing,payment_intent.succeeded,payment_intent.payment_failed,charge.updated --forward-to localhost:3000/api/stripe/webhook` (Stripe CLI 1.55 requires `--events`). The production webhook endpoint needs the same four events.
- Dev-clock quirk: with `DEV_CLOCK` set, `tax_year` follows the shifted clock (2027) but `received_on` follows Stripe's real event time (2026-11-23). Only affects testing before 2027.

- **ACH verified too**: $1,700 from Stripe's test bank (Financial Connections) → `payment_intent.processing` (thank-you page shows "on its way") → `payment_intent.succeeded` and `charge.updated` arriving in the same second → R-2027-0003 booked once, fee $5.00 booked once, trial balance $0. The bank-connection window is Stripe's Link-branded Financial Connections; donors can finish without saving to Link.
- Must-haves now yes: "Give now" and "Bank (ACH) and card payment" (11 yes, 7 partial of 86).

### Not verified yet

- Receipt email through Resend: `tennissa.org` isn't verified in Resend yet, so sending fails (the gift is booked regardless and `emailed_at` stays empty for a resend).
- 390px layouts were not screenshotted (the browser window wouldn't shrink below its minimum); the layouts are responsive by construction (mobile cards on S01, mobile menu, stacked tiles).
