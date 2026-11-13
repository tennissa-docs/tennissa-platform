# Components: the SGO platform design system

Direction: premium and minimal, in the spirit of Apple's product pages, but our own. White and light-gray surfaces, near-black type, **one** blue accent (`accent` #0b67d8) used only for the main action and links, generous whitespace, 12–20px radii, hairline borders, faint shadows. No gradients, no decorative graphics, no dark-green SGO HQ palette, no SGO HQ or Apple logos (the TENNISSA logo is yours and is used as specified below), icons, illustrations or copy.

Tokens: `tokens.json` → `tokens.css` (custom properties + Tailwind v4 `@theme`). Components use classes such as `bg-surface text-text-muted rounded-xl shadow-card`, never raw hex. Contrast: 25 pairs, 0 AA failures.

**Font:** the system stack. Apple devices render SF Pro (built in); everything else gets **Inter**, self-hosted under its open licence. SF Pro is never bundled or served. Money and table numbers use tabular figures.
**Icons:** **Lucide** (ISC licence), 1.75px stroke, 16px in tables and buttons, 20px in navigation, 24px in empty states. Never filled, never coloured except status icons.
**Accessible base:** shadcn/ui on Radix primitives, restyled with these tokens.

## Logo (TENNISSA)

```
Files       brand/tennissa-logo.svg (full: icon + TENNISSA + "Tennessee Islamic School Scholarship Alliance")
            brand/tennissa-logo-compact.svg (icon + TENNISSA, no subtitle)
            brand/tennissa-logo-icon.svg (icon only) · PNG exports: tennissa-logo.png (2400px), tennissa-icon.png (1024), tennissa-icon-512.png
Source      traced from the supplied PNG (icon and wordmark are the logo's own shapes, gradients rebuilt);
            the subtitle is reset in Montserrat Medium (OFL) as outlines, because 7px text cannot be traced cleanly
Which one   full logo: 240px wide or more (public hero, sign-in, documents, emails, certification PDFs)
            compact: top bars and anything 120–240px wide; icon: sidebar org mark, favicon, app icon, under 120px
Space       clear space on every side = the height of the "T" in TENNISSA; never on a busy or coloured background
Colours     brand-navy #142A64, brand-red #9B1A28 (from the logo); used for the logo, the fund name and document headers only.
            Buttons and links stay accent blue
Don't       recolour, stretch, add effects or shadows, or set the subtitle in another font
a11y        <title> inside each SVG; when the logo links home, the link's name is "TENNISSA home"
```

## Principles (apply to every screen)

1. **One primary action per screen.** It is the only filled blue button visible. Everything else is secondary (outline), ghost or a link.
2. **Few pop-ups.** SGO HQ's modals become: a **page** (give flow, application, record offline donation on mobile), an **inline step** (confirm before an irreversible action), or a **side sheet** on desktop (quick record forms: offline donation, invite school, vendor bill, proof upload). A centred dialog is used only for "are you sure" on money-moving or permanent actions, and only when inline is impossible.
3. **Big, calm headings.** Each page opens with a `headline` title and one muted sentence saying what the page is for. Sections are separated by space and a light-gray band, not by heavy lines.
4. **Every async state is designed:** loading (skeleton, never a blank page), success (toast + updated row), error (inline under the field, plus a banner for page-level failures), empty (sentence + one action).
5. **Permanent things say so.** Actions that create permanent financial records (refund, award, mark batch sent, certify) show a one-line note under the button: "This is recorded permanently."
6. **Motion is quiet:** 120–220ms, ease-out, fades and 4–8px slides only. Nothing bounces. All motion is off under `prefers-reduced-motion`.

## Layout

```
AppShell (admin, school, committee, auditor)
  desktop ≥1024  sidebar 248px (white, hairline right border) + content on surface (#f4f5f7)
                 content column max 1120px, gutter 48px
  tablet 768–1023 sidebar collapses to a 72px icon rail; labels in tooltips
  mobile <768    top bar 56px (title + menu button); navigation in a full-height sheet; gutter 20px
  tokens         bg bg (sidebar), surface (page), radius-xl cards on top
  a11y           skip link "Skip to content"; <nav aria-label="Main">; current page aria-current="page"
```

```
PublicShell (giving page, application, donor and family portals)
  top bar 56px: fund logo + name left, one pill button right ("Give" / "Sign in"); white, hairline bottom border on scroll only
  hero: hero/display type centred, max 720px, 80–120px vertical space, one primary action
  sections alternate bg and surface bands; content max 1120px, forms max 560px
  footer: small muted text, legal links
```

```
Sidebar (admin)
  groups    Overview · Money (Donations, Donors) · Students (Schools, Rounds, Applications, Students, Awards, Payments, Vendors)
            · Books (Ledger, Compliance) · Settings at the bottom; Review queue for committee members; Compliance first for auditors
  item      40px tall, radius md, icon 20 + label sm/500, text-muted; hover bg surface; active bg accent-tint, text accent, 600
  group     caption label, uppercase off (sentence case), text-subtle, 24px above
  footer    org switcher card + user menu (avatar, name, role)
```

```
PageHeader
  parts     breadcrumb (caption, text-subtle) → title (headline 32/700) → one-line description (base, text-muted) → actions right
  actions   max one primary pill + up to two secondary; overflow in a "More" menu
  mobile    actions move under the title, primary full width
```

```
Section / Card
  card      bg surface-raised, 1px border, radius-xl (20), padding 24 (32 on desktop hero cards), shadow-card
  section   title lg/600 + optional muted sentence, 16 below; sections 40 apart
  hover     interactive cards only: shadow-raised, border-strong, 220ms
```

## Actions

```
Button
  variants  primary (accent, on-accent) · secondary (bg, 1px border-strong, text) · ghost (transparent, text) · danger (danger, on-danger)
            · link (accent text, underline on hover)
  shape     pill (radius 999); horizontal padding 20 (md), 16 (sm), 28 (lg)
  sizes     sm 32px (sm/600) · md 40px (sm/600) · lg 48px (base/600, public pages and the give flow)
  states    default · hover (accent-hover / surface) · active (accent-pressed, scale .98) · focus-visible (2px ring focus-ring + 4px soft halo)
            · disabled (40% opacity, no pointer, aria-disabled when explained by a tooltip) · loading (spinner replaces icon, label stays, width fixed)
  rules     one primary per screen; destructive actions never primary blue; money actions show the amount in the label ("Refund $500.00")
  a11y      real <button>; loading sets aria-busy; icon-only buttons have aria-label
  used on   every screen
```

```
IconButton
  36px circle, ghost; hover bg surface; tooltip with the label after 400ms; aria-label required
```

```
InlineConfirm (instead of a confirm dialog)
  a button turns into a short row: sentence ("Mark Batch 3 as sent? This is recorded permanently.") + primary/danger "Confirm" + ghost "Cancel"
  keyboard  Enter confirms, Escape cancels, focus moves to Confirm
  used on   mark sent, approve batch, cancel award, close review, certify, revoke access
```

## Forms

```
TextField
  label     sm/600 above, text; optional hint caption text-muted below the label
  input     48px tall, radius md (12), 1px border-input, bg bg, padding 0 16, base text
  states    hover border-strong · focus border accent + shadow focus · error border danger + message caption danger below with icon
            · disabled bg surface, text-subtle · read-only no border, bg surface
  spacing   20 between fields, 32 between groups; forms max 560px
  a11y      <label for>; error via aria-describedby + aria-invalid; required fields say "Required" in the label, not only *
  used on   give flow, application, settings, all record forms
```

```
MoneyField       TextField + "$" prefix, tabular numbers, formats on blur ("1,700.00"); shows the cap ("Up to $1,700") as hint; over-cap error inline
MaskedField      TIN / bank account: shows •••• 4321 after save; full value only while typing; never in auditor views
Select           native-feeling: 48px, chevron icon, radius md; long lists become Combobox
Combobox         school picker, county picker: type to search, keyboard list, "No matches" empty row
RadioCard        large tappable cards for choices (filing status, how you pay, how the family qualifies): radius lg, 1px border;
                 selected border accent 2px + accent-tint bg; right-aligned detail ("Lower fee", "2.9% fee"); whole card clickable; arrow keys move
Checkbox         20px, radius 6; checked bg accent with white check; label to the right, base text; for attestations each line is its own checkbox
Switch           44×26 pill; on = accent; label left, state announced ("On")
DatePicker       text input (MM/DD/YYYY) + calendar popover; keyboard typing always works
FileUpload       dashed 1.5px border-strong zone, radius lg, "Choose a file or drag it here", size/type hint; on mobile "Take a photo" first;
                 each file becomes a row: icon, name, size, remove; uploading shows a thin progress bar; rejected file shows the reason inline
Stepper          the give flow and the application: thin segmented progress bar (n segments) + "Step 2 of 6" caption + step title;
                 Back is a ghost button, Continue the primary; steps keep their data when going back
```

## Navigation within a page

```
SegmentedControl (tabs)
  Apple-style: pill track bg surface-sunken, selected segment white with shadow-card; counts after labels ("Ready to award  5")
  used on   Applications tabs, Payments tabs, Ledger tabs, year pickers with ≤4 options
  a11y      role=tablist, arrow keys move, panels labelled
FilterBar        search field (pill, 40px, search icon) + filter chips (pill, secondary) that open small popovers + date range + Export link
Breadcrumb       caption, text-subtle, chevron separators; last item text
Pagination       "1–50 of 312" + previous/next icon buttons; tables load 50 rows
```

## Data display

```
DataTable
  header    caption/600, text-subtle, sentence case, no background; sticky on scroll
  rows      56px; 1px border bottom; hover bg surface; whole row clickable when it opens a record (keyboard: Enter)
  cells     two-line cells (name sm/600 + email caption text-muted); money right-aligned, tabular; dates "Nov 10, 2026"
  select    checkbox column for bulk actions; a bulk bar slides up from the bottom with the count and actions
  states    loading (6 skeleton rows) · empty (EmptyState inside the card) · error (Banner above the table, Retry)
  mobile    rows become stacked cards: primary line, secondary line, amount right, status below
  used on   donations, donors, applications, students, awards, payments, ledger, compliance
```

```
StatTile
  label caption/500 text-muted · value stat 34/600 tabular · sub-line caption text-muted ("169 donations") · optional icon top-right 20px text-subtle
  card radius-xl, padding 24; no coloured backgrounds
  used on   Overview, Awards, 1099s, school portal, donor page
```

```
StatusBadge
  pill, 24px, caption/600, tint background + matching text, optional 6px dot
  neutral (surface-sunken / text-muted): Draft, Not sent, Pending, Invited, Abstain
  info    (accent-tint / accent): Processing, Submitted, Under review, Ready to award, Sent
  success (success-tint / success): Succeeded, Clear, Verified, Approved, Paid, Settled, Passing, Met, Active, Confirmed
  warning (warning-tint / warning): Awaiting payment, Awaiting proof, Needs school, To pay, Partly refunded, Cross-year review, Recorded on behalf
  danger  (danger-tint / danger): Failed, Returned, Disputed, Denied, Flagged, Overdue, Failing, Withdrew, Possible disqualified person
  rule      colour is never the only signal: the word is always there
```

```
KeyValueList      label left (sm, text-muted) · value right (sm/500, text, tabular for money); 44px rows; hairline separators
                  used on receipts, income check, batch "who and when", donor details
Timeline          vertical hairline with 8px dots; each item: actor + action (sm/600), time (caption text-muted), optional note
                  used on history, audit trail, refund review, application status for families
ProgressBar       8px tall, radius pill, track surface-sunken, fill accent (success when met); optional marker line (the 90% line) with caption
                  used on 90% test, payout progress, upload progress
Charts            line and bar only; accent for the main series, border-strong for comparisons; no gridline clutter (3 light horizontal lines);
                  axis labels caption text-subtle; tooltip card on hover/focus; every chart has a "View as table" link
Banner            full-width rounded card, icon + one sentence + optional action link; info / warning / danger / success tints
                  used on Overview attention list, reversal window, payout deadlines, "bank details held"
Toast             bottom-centre on mobile, bottom-right on desktop; white card, shadow-pop, radius lg; icon + sentence + optional Undo; 5s, pauses on hover/focus;
                  role=status (success) or role=alert (error)
EmptyState        24px icon in a 48px surface circle, title lg/600, one muted sentence, one action; centred in the card
Skeleton          surface-sunken blocks with a slow 1.6s shimmer (off under reduced motion), shaped like the real content
Spinner           16/20px ring, accent; only inside buttons and small areas; pages use skeletons
Avatar            initials on surface-sunken, 32px circle; no photos of donors or families
Tooltip           dark (#17181a) 12px text, radius sm, 6×10 padding; for icon buttons and truncated text only
```

## Overlays (used sparingly)

```
Sheet (side panel)
  desktop   slides in from the right, 480px, white, shadow-pop, radius xl on the left edge; page behind dims to overlay 24%
  mobile    becomes a full page (with Back), never a cramped modal
  use       quick record forms: record offline donation, invite school, add vendor bill, upload proof, add family member to the list
  a11y      focus trapped, Escape closes (with "discard changes?" inline if dirty), focus returns to the opener
Dialog
  only for an irreversible confirmation that cannot be inline; 440px, radius xl, title + sentence + two buttons
Popover / Menu    radius lg, shadow-pop, 8px padding, items 40px; keyboard navigable
```

## Documents (PDF and print)

```
Receipt / Refund receipt / Year-end statement / Award letter / Remittance advice / Certification
  white A4/Letter page, 64px margins; fund logo + name top-left; document title headline; KeyValueList of the facts;
  receipt number large and tabular top-right; a single hairline rule between sections; plain footer with EIN and address
  no colour except the fund's accent on the title rule; prints in black and white without losing meaning
```

```
Email
  600px, white, 32px padding; fund logo; one heading; short paragraphs; one pill button; muted footer
  plain-text alternative always included
```

## Key screens, how the system applies

- **Give (public):** full page, not a modal. Hero ("Give up to $1,700. Get it back as a tax credit.") with one "Give" button → a 4-step flow in a centred 560px card: filing status (RadioCards) → amount (MoneyField, cap shown) and where it goes (Combobox: greatest need or a school) → about you → how you pay (RadioCards, fee shown) + attestations (Checkboxes) → one large primary "Give $1,700.00". Thank-you page shows the confirmation number large.
- **Overview (admin):** PageHeader; attention Banners only when needed; 3 StatTiles in a row (stack on mobile); two chart cards; Books card (KeyValueList of balances); Next steps card.
- **Applications (admin):** SegmentedControl tabs with counts; FilterBar; DataTable with income-check badges; batch award bar slides up when rows are selected.
- **Application detail:** two columns on desktop (left: family, income check, documents; right: school verification, committee recommendations, decision card with the only primary button "Approve and award"); one column on mobile with the decision card last and sticky.
- **Compliance:** large 90% figure (display 48/700) with ProgressBar and the 90% marker; StatTiles; per-state table; checklist with ✓/⚠ icons.
- **School portal / family portal / donor portal:** same components, PublicShell or a lighter AppShell with 3–5 items.
