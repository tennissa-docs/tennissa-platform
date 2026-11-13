# Recon map: SGO HQ (web)

Scope: the three sidebar areas the user asked for, exactly as SGO HQ groups them:
- **Money:** Donations, Donors, plus the public giving page and give flow, offline gifts, and payment-account settings.
- **Students:** Schools, Rounds, Applications, Students, Awards, Payments, Vendors, plus the public application and family portal, and the school's enrollment check.
- **Books:** Ledger (accounts, journal, reconciliation), Compliance (audit package), and the Overview dashboard.

For: **one SGO**, the user's own (decided 2026-11-12). **No districts.** One fund, so no per-tenant separation in the database; keep an `org_id` column on top-level tables so a move to many SGOs later is cheap.
Date: 2026-11-12 (revised with the user's screenshots)

**Records retention (decided 2026-11-12):** receipts, payment records, the books and all supporting financial documents are kept **permanently** and never deleted. Applicant documents are kept five years. See architecture.md.

**Scholarship committee (decided 2026-11-12, not in the original):** committee members review applications including documents and recommend; an owner or admin decides. They are disqualified persons and must recuse on conflicts. See architecture.md.

**Refunds (decided 2026-11-12):** a refund is a separate, permanent transaction linked to the original gift, with its own refund receipt and a tax-compliance review flag; reported in an Annual Donation Report, an Annual Refund Report and a Lifetime Transaction Ledger. See architecture.md.

**One-time gifts only (decided 2026-11-12).** The original lets donors pledge ahead (charged January 1) or give monthly. The clone does neither: every gift is a single payment charged when the donor gives. No pre-registration either, because giving opens after January 1, 2027, once the SGO is fully set up. The screen rows below still describe the original (pledge wording, timing choice, "Pledged" tiles, S03); the clone drops those parts. See F01, F03, F04 and features.csv.

**Out of this slice:** Setup onboarding (bylaws, agreement, state registration), Branding and Domains, and the Grow area (Journeys, Campaigns, Inbox, AI drafting). They're noted where a flow touches them. **Districts and payroll giving** (S10, S15, F06, F13) are dropped by decision and kept below only for reference.

## Sources

| # | source | URL / file | notes |
| --- | --- | --- | --- |
| 1 | **the user's recording of the demo tour** | `replica/screens/frame_0001…0100.jpg` | 100 frames, a 16:30 guided tour across 22 chapters, one fictional fund ("Cedar Valley Scholarship Fund"). **Main source.** Frame numbers are cited below as f01–f100 |
| 2 | demo landing | https://demo.sgohq.app/story | invite-only; payments run in sandbox mode |
| 3 | families / donors / schools / admin pages | https://sgohq.com/families · /donors · /schools · /admin | marketing summaries |
| 4 | compliance, pricing, FAQ | https://sgohq.com/compliance · /pricing · /faq | rules, fees (3% bank / 5% card) |
| 5 | EFTC guide | https://eftccredit.com/learn/how-to-start-an-sgo | pipeline overview |

The invite link was **not used**. The recording already shows every screen in scope. A one-time link would also have to be opened in your own browser, not from here. No terms of use were visible in the frames or on the public site.

## Core loop

Donor gives (up to $1,700 each, $3,400 per married couple) on the fund's or a school's page and is charged right away, one time, into that state's separate §25F account, with a receipt and a ledger entry → family applies through its school's page and the income check runs → school confirms enrollment → admin approves and awards (one at a time or in batches) → awards go into a payment batch → an ACH file is made and the fund's own bank sends it → the school gets remittance advice per student → the ledger, reconciliation and audit package stay balanced to the cent.

## Roles and portals

| role | where | sees |
| --- | --- | --- |
| Fund admin (owner, admin) | app.…/ full sidebar | everything |
| Partner school admin | app.…/school/* | Overview, Roster, Applications (verify enrollment), Payments received, Giving page, Email, Settings |
| Donor | app.…/my/giving | gifts and receipts |
| Parent | app.…/my/applications | every application, every child, every fund |
| Public | give.<fund-domain>/donate, …/donate/<school>, …/apply | giving page, give modal, eligibility pre-check, application |

Sign-in for every role is an emailed one-time link. No passwords. The link works once and expires in 24 hours (f07, f08).

Admin sidebar (f10): START Overview, Tour · **MONEY** Donations, Donors · **STUDENTS** Schools, Districts, Rounds, Applications, Students, Awards, Payments, Vendors · GROW Journeys, Campaigns, Inbox · **BOOKS** Ledger, Compliance · SETUP Domains · user menu. Settings tabs: Organization, Branding, Team, Danger, Scholarships, Payments, Privacy.

## Screens

States: **seen** = in the frames; anything else is a guess.

### Money

| ID | screen | route | purpose | key components | states | frames |
| --- | --- | --- | --- | --- | --- | --- |
| S01 | Donations | /donations | every gift, filterable | header counts ("98 donations · $69,400.77 received · $22,850.00 pledged · $2,412.04 in fees"); filters: search donor/email, status, method, designation, date from–to, CSV; columns Date, Donor (name + email), Designation (school, "Greatest need", or a business name), Method (ACH, Card, Check), Amount, Fee, Status (Pending, Succeeded); buttons "Record offline donation", "Simulate January 1: collect pledges" (demo only) | filled seen; empty/error not seen | f51, f72 |
| S02 | Record offline donation | modal on S01 | check or wire that arrived in the operating account | Amount, Method (Check…), Check/wire number, Received on, Donor first/last name, Donor email, Designate a school, "For the §25F credit?" (yes: donor designated it as a qualified contribution / no), Note ("memo line, envelope date…"); rule text: a gift received before Jan 1, 2027 is always a general gift and the designation can't be changed later | form seen | f54 |
| S03 | Monthly gifts | /donations/monthly | recurring gifts | "1 active · $141.66 a month"; Donor, Each month, Method, Designation, Progress ("0 of 12 given"), Next, Stop | seen | f89 |
| S04 | Donors | /donors, /donors/[id] | donor list; clone adds a donor page (details, every gift, receipts, refunds, statements, running total for the year) | — | **not seen** in the original | — |
| S05 | Public giving page | give.<domain>/donate; school: …/donate/<school>; district and campus pages | the pitch and the pledge button | fund logo + name + tagline, "Pre-register" button, hero "Up to $1,700 each, $3,400 for a married couple", "See if I'm eligible", explainer video, "Nothing is charged until January 1". School/district pages use **their own** logo, color and domain; a gift there is designated to that school automatically | seen | f15, f31, f42, f80, f86, f87 |
| S06 | Pledge modal (one question at a time) | modal on S05 | collect a pledge | 1) How do you file your taxes? Single/head of household · Married filing jointly · Married filing separately; 2) amount (one field, or "Your gift" + "Your spouse's gift"); timing: **All at once** on [Jan 1, 2027 ▾] or **Monthly** on the [1st ▾], Jan–Dec ("12 gifts of $141.66, each with its own receipt, stop any time"); 3) About you: first, last, email ("your account is set up with this email"), mailing address; 4) Where should it go? [Wherever the need is greatest / school ▾]; Which state is it for? (multi-state funds); How will you pay? Bank account "Lower fee" / Card "2.9% fee" + ☑ "Add $50.77 to cover the card fee, or pay by bank for a lower fee"; For the tax credit: ☑ U.S. citizen or resident, ☑ my own money, not a business's, ☑ count toward the federal credit (can't be changed later), ☑ my spouse agreed (couples); consent line for the year-end statement by email; button "Pledge $1,700 · No charge until January 1, 2027" or "Give $141.66 a month"; legal fine print | seen across states | f16–f19, f43, f48, f49, f81, f88 |
| S07 | Pledge confirmed | give.<domain>/give/<fund>/thanks | receipt-like confirmation | Donor, Amount, Designated to, §25F credit ("Designated as a qualified contribution (IA)"), Pledged, Tax year, Confirmation number, the card-statement line ("CEDAR VLY* LINCOLN HS"), "Go to my account" | seen | f44 |
| S08 | Donor portal | /my/giving | given, pledged, receipts, federal credit earned | stat tiles + list | loading seen only | f53 |
| S09 | Receipt email | email | §25F receipt sent when the gift clears | sender is the fund; amount in subject; year-end statement by Jan 31 with the fund's EIN and donor number | inbox seen | f52 |
| S10 | ~~Payroll giving (district)~~ **dropped** | public district page + /district/payroll + import modal | staff give from each paycheck | signup: first, last, work email, each month, For (any school / campus), ☑ designate for the credit, "Sign me up"; coordinator list: Staff member, Email, Deduct each month, For; admin import: pay date, CSV (email,name,amount) or paste, district's transfer amount, arrived on, transfer reference → "Book the gifts" (one gift and one receipt per person) | seen | f95–f97 |
| S11 | Settings › Payments | /settings/payments | where money lands, and fees | **Listing states** (one §25F account per state, per §25F(c)(5)(B)); per-state "IA §25F account · Active" (processor account id, what it can do: payouts to the fund's bank, cards, ACH); **General account** for non-credit gifts; "Take card gifts" toggle; card statement short name (≤10 chars) + preview; **Fees** table on a $1,700 gift: ACH $51.00 → $1,649.00 reaches the fund, Card $85.00 → $1,615.00; how fees and reversals are billed; automatic payment from the general account | seen | f21–f24 |

### Students

| ID | screen | route | purpose | key components | states | frames |
| --- | --- | --- | --- | --- | --- | --- |
| S12 | Schools + Invite a school | /schools | partner schools | modal: School name, Contact email (becomes the school's first admin), Contact name, Website (logo and colors imported); partner agreement attached automatically | modal seen; list not seen clearly | f26 |
| S13 | School invitation and e-sign | /invite/<token> | school admin joins and signs | email (locked), full name, website, agreement text, "Type your full legal name to sign" + box; signature record: name, time, IP, agreement version | seen | f28, f30 |
| S14 | School portal: Overview / Roster / Applications | /school/* | school's side | tiles: Students on roster, Applications to verify, Awarded, Payments received; Roster: Student, Grade, Guardian, Guardian email, Added + Import roster, Add student; **Applications "Awaiting your verification"**: student, grade, parent, round, applied date → **Verify enrollment / Decline** | seen | f29, f32, f61 |
| S15 | ~~Districts + district detail~~ **dropped** | /districts, /districts/<id> | public districts with campuses under them | add modal (district name, contact name, contact email); detail: add a school to this district, payroll giving, logo and color, own web address, **District logins** (read-only), totals, spend-by table, campuses; **Move money** modal: Move it to (fund's general pool / another district), Money from (2027 gifts: $x left, pay by date), Amount, Why | seen | f83–f85, f99 |
| S16 | Spend-by (**fund-wide** in the clone; district portal in the original) | /books/spend-by | 90% of each year's gifts must be paid out by the end of the next year | Received in, Received, 90% to pay out, Paid toward it, Still to pay, Pay by (with days left), Status | seen | f90 |
| S17 | Application rounds | /rounds | families can apply only while a round is open | Round, School year, Opens, Closes, Applications, Status (Open), Close; "+ New round" | seen | f56 |
| S18 | Eligibility pre-check | public …/apply, collapsible | "Is my child eligible?" | State, County, People in household, Household income last year → "Likely eligible: for a household of 4 in Black Hawk County the limit is about $273,000" + "Apply for a scholarship"; HUD 2026 area medians until the IRS publishes its own | seen | f94 |
| S19 | Application (6 steps) | public …/apply (fund, school or district domain) | family applies | step 1 Your details: first, last, email, street, city, state, ZIP, County (sets the limit), phone; steps 2–3 **not seen** (likely the child and the school); step 4 Household: people in household, how the family qualifies (Income documents: tax return, W-2 or pay stub · **Benefit letter**: SNAP, TANF, WIC, Section 8 or SSI · **Foster child**), household income last year, live "your county's limit for 4 is $273,000"; step 5 Documents: "May the automated reader check your documents?" yes/no, upload (photo or file, up to 10 MB each), "Any household income not on these documents?" no-certify / yes-add (court order, statement), privacy note (documents deleted once decided); step 6 review and submit (not seen) | steps 1, 4, 5 seen | f57–f59, f94 |
| S20 | Family portal | /my/applications | every application, every child, every fund | row: student, school, fund · round · applied date, status ("Received"), Open | seen | f60 |
| S21 | Applications (admin) | /applications?tab= | review and award | intro "the income check cleared 37 of 39, flagged 2"; tabs **Open · Flagged · Needs school · Ready to award · Approved · Denied · All** with counts; order line "Renewals first, then siblings, then by date applied, oldest first. Change it"; **reversal-window banner** (money still reversible: cards under 120 days, bank under 60 days, by state); **batch award bar**: Show [school/district ▾], How much [Each student gets ▾ / Split a total evenly], Amount, Preview n selected, "Received and not yet awarded: $19,414.23"; table: ☐, Student + grade, School, District, Requested, Income check ("Clear · Income $58,000: 21% of the Black Hawk County, IA limit for 4 ($273,000)") | seen | f62, f98 |
| S22 | Application detail | /applications/<id> | one decision with its evidence | badges (Possible disqualified person, Ready to award); **Possible disqualified person** panel (name match to the list, "It's a different person" with a recorded reason); **Income check**: how they qualify, household size, family typed, documents show, other income (certified by), county, area median, income limit, result ("Clear. The documents match…"); **School verification** (confirmed on date); Person check (a paid manual review by the vendor: skip); **Decision**: Approve/Deny, Award amount, per-student cap note, "Approve and award" (blocked while flagged) | seen | f64 |
| S23 | Settings › Scholarships | /settings/scholarships | priority order + **people who can't get a scholarship** | priority settings; list of disqualified persons (board members, officers, selection committee, substantial contributors) and their families; "Add <name>'s family member": full name, related as | modal seen | f63 |
| S24 | Students | /students | every student across partner schools | Student, School, Guardian, Grade, Awarded | seen | f73 |
| S25 | Awards | /awards | approved scholarships, to pay | tiles Scholarships, Awaiting payment, Paid out; reversal banner; table: ☐, Student + grade, School, Awarded (date), Amount, Left to pay, Status (Awaiting payment), Open; tick rows → add to a payment batch, or open one to record a vendor bill | seen | f65 |
| S26 | Payments | /payments/* tabs **Batches · Ready to pay · Payees · Bank feed · 1099s · All payouts · Setup** | pay schools and vendors | Payee page: banner "bank details new or changed, held until an owner approves"; **W-9** (tax classification, exempt payee code, TIN masked, signed, recorded, 1099 yes/no, how you checked it, e.g. IRS Tax Exempt Organization Search); **Bank details** (encrypted, last four only, status "Waiting for an owner to approve", entered by, approved); call-back instruction + "How you confirmed it" | seen | f67 |
| S27 | Payment batch | /payments/batches/<id> | one batch = one payment per payee, a line per student | "Batch 1: $15,000.00 · 1 payment from the IA §25F account by ACH, arriving Nov 10 · on bank statements: SCHOL 0001"; Approve / Cancel batch; Payments table: Payee + remittance ref (P0001-001 · 5 lines), Account ••4473, Amount, Status (Not sent → Sent), Take out; **Who and when**: Built, Approved, File made, Sent, Settled; optional **two-person rule**; **On the bank statement** (match from bank feed or uploaded statement); History log; **Download the ACH file**; "Record from statement" | seen | f68, f69 |
| S28 | Remittance email to school | email | what's coming and which students it covers | amount, date, statement reference, a line per student ("Tuition and fees"), total, "See it in your school portal" | seen | f70 |
| S29 | Vendors / Pay a vendor | /vendors, modal from an award | pay tutors, therapists etc. from an award (Coverdell expenses) | "$1,200 is left on this award"; Vendor, Amount, Expense (Tutoring…), What it pays for, Invoice or receipt upload, ☑ "vendor isn't related to the student's family" → "Record the bill" → waits in Ready to pay | seen | f91 |
| S30 | 1099s | /payments/1099 | year-end forms | year tabs; tiles: payees who get a 1099 (≥$2,000 for services), reportable, paid with no W-9; table: Payee, TIN, 1099-NEC, 1099-MISC box 6, Not reportable, Files; Export CSV; exemption note | seen | f92 |

### Books

| ID | screen | route | purpose | key components | states | frames |
| --- | --- | --- | --- | --- | --- | --- |
| S31 | Overview | /overview | the admin home | "Follow one gift · 0 of 7 steps" demo tour card; attention banner (district spend-by: amount still to pay out by Dec 31, days left); tiles **Received** (169 donations), **Pledged**, **Awarded** (49 scholarships), **Owed to schools** (20 partner schools); charts "Received by month" (net of reversals) and "Pledged, received, paid"; **Books** panel: live balances from the ledger (SGO HQ fees not yet invoiced, returned scholarship payments (TN), scholarships awarded (TN), segregated §25F account (TN), awarded not yet paid (TN), payment processor clearing, processing fees, qualified contributions received (TN)); **Next steps**: invite a school, share your giving page, connect a bank account | seen | f71 + user screenshot 2026-11-12 |
| S32 | Ledger › Accounts | /ledger | chart of accounts and trial balance | "Double-entry, append-only. Corrections are reversing entries, never edits." **Trial balance $0.00 balanced** · Debits · Credits · Entries · Postings; chart of accounts with keys (below), "Balances are the sum of postings. Nothing here is a stored number." | seen | f74 |
| S33 | Ledger › Journal | /ledger?tab=journal | every entry | — | **not seen** | — |
| S34 | Ledger › Reconciliation | /ledger?tab=recon | processor events vs journal entries | "Run reconciliation now", "Checked 208 records: 0 new exceptions, 0 cleared", "Every provider event matches an entry, cent for cent" | seen | f75 |
| S35 | Compliance | /compliance?year= | examiner-ready | tax-year picker; **§25F account card** per state (received, disbursed); **90% test** (ratio, Passing badge, bar with 90% line; Receipts = donated + returned, To scholarships = awarded paid or not, Awarded unpaid, Operating = fees + admin, Paid to schools, Paid to vendors, Returned this year); **10 students, not all at one school** (Met); **Per-state 90% test** table; **Vendor payments** by expense type; **Returned payments** (From, Went back on whose award, Spend by Dec 31 next year, Amount); **Donation confirmation numbers** (R-2026-0153…, sequential per year, Date, Donor, Amount, Fee); **Audit package** (9 CSVs); **Where donors are**; **SGO checklist** (certify with state, 90% test, receipt every donor, no donor earmarking, no disqualified persons, renewals then siblings, file the annual report, audit-ready books) | seen | f76 + user screenshots 2026-11-12 |

## Flows

```
F01 Donor gives on the fund's page (clone: charged at checkout; original: pledge)                                   f15–f19, f44
    S05 -> S06 (filing status -> amount + timing -> about you -> designation, method, credit boxes) -> S07
    happy path clicks: ~9 (Pre-register, filing status, timing, continue, ..., Pledge)
    edge: married couple = two gifts in one checkout, each in its own name and with its own receipt;
          card fee add-on ticked by default; credit box unticked = regular gift, not §25F;
          clone: one-time, charged now; giving opens after Jan 1, 2027;
          multi-state fund asks "which state"

F02 Donor gives on a school or campus page                              f42–f44, f80–f81, f87–f88
    same as F01, designation preset to that school; card statement names the school

F03 [dropped in the clone] Monthly gift                                                         f17, f88, f89
    timing = Monthly on day N -> 12 gifts Jan–Dec, each its own donation and receipt -> S03 shows progress -> Stop

F04 [dropped in the clone] January 1: pledges are collected                                     f50–f52
    scheduled job charges every pledge on its date -> each posts to the ledger with its fee
    -> confirmation number + receipt email when it clears (ACH clears in days)

F05 Record an offline gift (check or wire)                               f54
    S01 -> S02 -> posts like an online gift, own receipt, fee at the bank rate

F06 [dropped] Payroll giving                                                       f95–f97
    staff signs up on district page -> coordinator sees list -> district sends one transfer per pay date
    -> admin imports CSV (pay date, lines, transfer amount, reference) -> one gift + receipt per person

F07 School joins                                                          f26, f28–f32
    S12 invite -> email -> S13 sign agreement by typed name -> school portal, branding, roster

F08 Family applies                                                        f56–f60, f94
    S17 round open -> S18 pre-check (optional) -> S19 six steps -> submit -> income check runs -> S20 "Received"
    edge: benefit letter or foster child instead of income docs; other income certified; automated reader declined

F09 School confirms enrollment                                            f61
    S14 Applications -> Verify enrollment / Decline  (nothing moves until the school confirms)
    clone: reminders to the school after 3 days (every 3, max 4), admins alerted after 10;
           owner/admin can record the confirmation on the school's behalf (phone/email/letter, contact, note)

F10 Admin awards                                                          f62–f65, f98
    S21 Ready to award -> one by one (S22 Approve + amount) or batch (Show, Each student gets / Split total, Preview, Award)
    rules: order = renewals, then siblings, then oldest application; flagged disqualified persons blocked until cleared with a reason;
           warn when awarding money still inside the reversal window

F11 Pay the school (clone: only once enrollment is confirmed and the term's tuition statement is on file)                                                         f66–f70
    S25 tick awards -> batch (S27) -> payee bank details approved by an owner (S26) -> Approve (optional second approver)
    -> Download ACH file -> fund uploads it to its own bank -> Mark sent -> remittance email (S28)
    -> bank statement match -> Settled

F12 Pay a vendor from an award (clone: only with invoice + proof of delivery, and the family's confirmation if required)                                            f91
    S25 open award -> S29 bill (vendor, amount, expense, invoice, not-related box) -> Ready to pay -> same batch flow

F13 [dropped] District money not spent in time                                       f90, f99
    S16 spend-by warning (90 days ahead) -> S15 Move money (to general pool or another district, amount, reason)

F15 [clone] Refund a gift
    owner refunds all or part via Stripe (or a bank return / lost dispute arrives) -> linked refund transaction + RF number
    -> refund receipt emailed -> §25F refund flagged for review (cross-year = priority) -> reviewer closes with a note

F16 School or vendor sends money back
    recordPaymentReturn -> income in the year it comes back -> back on the student's award (or pool) -> spend by Dec 31 next year

F17 Donor tax reporting
    Jan: generate + email year-end statements by Jan 31 -> Feb: generate IRS donor report -> upload to the IRS portal
    -> record confirmation by Feb 28; later changes = corrected statement / corrected report

F18 [clone] Student leaves a school
    school reports withdrew / transferred / graduated (date, new school) -> further payments blocked -> admins alerted
    -> admin moves the remaining award to the new school or returns it to the pool -> payments sent after the date flagged for a return

F14 Close the books / answer an examiner                                    f74–f76, f92
    S32 trial balance = 0 -> S34 reconciliation clean -> S35 audit package -> S30 1099s by Jan 31
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| App shell | sidebar with section labels (Start, Money, Students, Grow, Books, Setup), org switcher, user menu, breadcrumb, collapse | active item | all admin, school, district |
| Button | primary (dark green), secondary (outline), ghost, danger, small inline ("Open", "Stop") | default, disabled, loading | all |
| Stat tile | label, big money number, sub-line, icon | — | S14, S25, S30, S31 |
| Data table | checkbox column, two-line cell (name + email or grade), money right-aligned, status pill, row action | empty, loading (skeleton seen in f36, f53), filled | most |
| Filter bar | search, select chips, date range, CSV export | — | S01, S21 |
| Tabs with counts | "Ready to award 5" | — | S21, S26, S32 |
| Status pill | Pending (amber), Succeeded/Clear/Active/Open (green), Awaiting payment (amber), Not sent, Sent, Waiting for DNS, Invited, Possible disqualified person (red) | — | many |
| Info banner | neutral (reversal window), warning (bank details held), success toast top-right ("Round created and open.") | — | many |
| Modal | form modal with Cancel / primary | — | S02, S12, S15, S23, S29, imports |
| One-question-at-a-time modal | radio cards with right-aligned amount or fee, checkbox list, sticky primary button with sub-line | — | S06 |
| Stepper | 6-segment progress bar "Step n of 6 · round · fund" | — | S19 |
| File upload | drag/photo, size limit, file chip with remove | — | S19, S29, imports |
| Key–value panel | label left, value right (receipt, income check, who-and-when) | — | S07, S22, S26, S27 |
| History log | actor, action, time | — | S27 |
| Charts | line by month, three-bar pledged/received/paid | — | S31 |
| Public page header | logo, name, tagline, pill CTA in the brand color | — | S05 |
| Email template | header band with logo, body, button | — | S09, S28 |

## Inferred data model

```
Organization (fund)   id, name, short_descriptor (≤10), ein, primary_color, logo, subdomain, custom_domain, states[]
                      evidence f10, f11, f24 · high

Membership            user_id, org_id | school_id, role (owner | admin | school_admin)
User                  id, email, name — magic-link only                                          evidence f07, f84 · high

ProcessorAccount      id, org_id, kind (segregated_25f | general), state (for 25f), external_id, status, capabilities
                      evidence f21, f22 · high

Donor                 id, org_id, user_id, first_name, last_name, email, address, filing_status,
                      donor_number (year-end statement), [ssn: needed for IRS reporting? — not seen in the tour]
                      evidence f16–f19, f52 · high except ssn

Donation              id, org_id, donor_id, amount_cents, fee_cents, fee_covered_by_donor_cents, method (ach | card | check | wire),
                      designation (greatest_need | school_id), state,
                      qualified_25f (bool, locked once set), tax_year, status (pending | succeeded | failed | returned | disputed),
                      confirmation_no (R-YYYY-NNNN, per org per year), received_on, check_no, note, processor_ref
                      evidence f44, f51, f54, f72, f76 · high
Attestation           donation_id, us_person, own_money, count_toward_credit, spouse_agreed, consented_at
Receipt               donation_id, number, issued_at (on clear), pdf

School                id, org_id, name, website, logo, color, address, contact, status (invited | active), giving_slug, domain
AgreementSignature    school_id, signer_name, signer_email, signed_at, ip, agreement_version, pdf
RosterEntry           school_id, student_id, grade, added_at

Round                 id, org_id, name, school_year, opens_at, closes_at, status (open | closed)
Household             id, address, county, state, size
Guardian              household_id, user_id, first, last, email, phone
Student               id, household_id, name, grade, school_id, prior_recipient, sibling_of_recipient (derived)
Application           id, round_id, student_id, school_id, requested_cents, qualify_by (income_docs | benefit_letter | foster),
                      income_typed_cents, other_income (none_certified | documented), auto_reader_consent,
                      status (open | flagged | needs_school | ready | approved | denied), applied_at
Document              application_id, kind, file (original: deleted after decision; clone: kept 5 years), extracted_income_cents
IncomeCheck           application_id, county, area_median_cents, limit_cents (3 × median, by size), result (clear | over | mismatch), pct_of_limit
AmgiTable             year, state, county, household_size, median_cents, source (HUD 2026)
SchoolVerification    application_id, by_user, at, result (verified | declined)
DisqualifiedPerson    org_id, name, role, related_to_id?, relation
DisqualifiedMatch     application_id, person_id, resolution (same | different), reason, resolved_by
Award                 id, application_id, amount_cents, left_to_pay_cents, awarded_at, status (awaiting_payment | partly_paid | paid)

Payee                 id, kind (school | vendor), w9 fields (classification, exempt_code, tin_enc, signed_by, signed_at, check_method),
                      bank (routing_enc, account_enc, last4, status pending_approval | approved, entered_by, approved_by, callback_note)
VendorBill            award_id, payee_id, amount_cents, expense_type, description, invoice_file, not_related_attested
PaymentBatch          id, number, source_account (25f state), method (ach), arrive_on, statement_ref (SCHOL 0001),
                      built_by/at, approved_by/at, second_approver?, file_made_at, sent_at, settled_at, status
Payment               batch_id, payee_id, amount_cents, remittance_ref (P0001-001), status
PaymentLine           payment_id, award_id | vendor_bill_id, student_id, amount_cents, description
SpendBy               org (computed), received_year, received_cents, required_cents (90%), paid_cents, pay_by

LedgerAccount         key (cash:segregated:IA, cash:operating, clearing:processor, clearing:checks, clearing:disbursement,
                      receivable:sgohq, liability:sgohq:payable, income:…, expense:scholarships, expense:fees, …), name, type
JournalEntry          id, occurred_at, memo, source_type, source_id, reverses_entry_id? — append-only
Posting               entry_id, account_key, debit_cents, credit_cents
ProviderEvent         external_id, type, amount_cents, matched_entry_id? — reconciliation input
AuditEvent            actor, action, subject, at, detail
```

Seen account keys (f74): `cash:segregated:MN`, `cash:operating`, `clearing:disbursement`, `cash:segregated:IA`, `clearing:checks`, `clearing:processor`, `receivable:sgohq`, `liability:sgohq:payable`. Income and expense accounts are below the fold. **Balances are computed from postings, never stored. The trial balance must be $0.**

## Rules the screens enforce (from the frames, unverified legally)

- $1,700 per taxpayer per year; a married couple is two gifts and two receipts.
- One separate §25F account per state. A multi-state fund spends a state's contributions only on students in that state.
- A gift received before Jan 1, 2027 is always a general gift. The §25F designation can't be changed later.
- Fees: 3% bank, 5% card, all-in, paid out of the admin share. The 90% test is measured on everything donors gave. The processor takes its own fee at gift time; the platform invoices the rest monthly from the general account, never from a §25F account.
- Reversal window: card about 120 days, bank about 60. Warn before awarding that money.
- Eligibility: household income ≤ 300% of the county median for that household size (HUD 2026 until the IRS publishes). A benefit letter (SNAP, TANF, WIC, Section 8, SSI) or foster placement also qualifies.
- Priority: renewals, then siblings, then oldest application.
- Disqualified persons (board, officers, selection committee, substantial contributors, and their families) can't receive awards.
- 90% of each year's gifts paid out by the end of the following year (proposed rule; 90-day warning).
- Payee bank detail changes are held until an owner approves. Optional two-person rule on batches.
- 1099 for payees paid ≥ $2,000 for services in the year (most schools exempt), due by January 31.

## Feature matrix

See `features.csv`. Must: 74, should: 21, could: 4, skip: 15 (district/payroll, pledge collection and monthly gifts moved to skip; permanent financial records and five-year applicant documents added as musts, auditor login as a should; refunds as linked transactions, the three financial views and the audit package as musts).

## Out of scope (cannot or should not be cloned)

- **Holding money.** SGO HQ uses Stripe Connect accounts in the fund's name. You need your own processor relationship (Stripe Connect is the obvious one) and must decide who carries loss risk.
- **Bank sending.** The fund's own bank sends payouts. You generate a NACHA ACH file; the bank partnership is the fund's.
- **SGO HQ's paid "Person check"** by its review team, and its automated document reader as a hosted service. You can build your own OCR later.
- **AI drafting** (Inbox, Campaigns) and the whole **Grow** area: outside the three areas.
- **Legal correctness.** Every rule above is read off a vendor's demo. Treasury's final regulations aren't out. A CPA or lawyer must sign off before real money.
- **SGO HQ's brand, copy, explainer video, sample data** ("Cedar Valley", "Lincoln High", names), and the eftccredit.com content.

## Size

Screens 35 (31 seen), flows 14, entities ~35. Hard parts:
1. **The ledger:** double-entry, append-only, multi-state segregated accounts, fees, reversals, reconciliation against processor events, audit export. Everything else reports from it.
2. **Money movement:** ACH settlement and returns, card disputes, offline gifts, ACH file generation, bank statement matching.
3. **Sensitive data:** TINs, bank accounts, tax documents. Encryption, owner approval on bank changes, deleting documents after a decision.

Then: AMGI data loading per county and size; the award engine (priority, disqualified persons, batch split); 1099s.

Size: **L** for one SGO without districts (XL as the original is built). Build it in phases:
- Phase 1 (M–L): Money core (giving page, give now, receipts, donations list) + Books core (ledger, overview).
- Phase 2 (M): Students core (rounds, application, income check, school verify, award).
- Phase 3 (M): Payments (payees, batches, ACH file), reconciliation, compliance export, 1099s.
- Later: vendors, multi-state (only if the SGO lists in more than one state).

With one SGO and no districts, the whole slice drops from **XL to L**.
