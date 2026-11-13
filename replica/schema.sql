-- Schema for the SGO platform clone: one SGO, no districts.
-- Postgres 15+ (Supabase). Money is integer cents (bigint) with a currency column.
-- Times are timestamptz (UTC); calendar dates (received on, pay-by) are date.
-- Access: no browser-side database access. Every query goes through the server
-- data layer, which runs one authorisation check per call. RLS is switched on for
-- every table with no policies (deny all) as a backstop against a leaked anon key.
-- users.id = the Supabase Auth user id.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------- helpers
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace function forbid_change() returns trigger language plpgsql as $$
begin raise exception '% is append-only: % not allowed', tg_table_name, tg_op; end $$;

-- ---------------------------------------------------------------- org, people, access
create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ein text not null check (ein ~ '^\d{2}-\d{7}$'),
  statement_descriptor text check (char_length(statement_descriptor) <= 10),
  states text[] not null default '{}',              -- states the SGO is listed in, e.g. {IA}
  priority_order text[] not null default '{renewal,sibling,applied_at}',
  per_student_cap_cents bigint check (per_student_cap_cents > 0),
  min_committee_recommendations smallint not null default 0 check (min_committee_recommendations between 0 and 9),   -- before an award can be made
  two_person_rule boolean not null default false,
  require_family_confirmation boolean not null default false,   -- vendor services also need the parent's confirmation before payment
  timezone text not null default 'America/Chicago',
  retention_years smallint not null default 5 check (retention_years >= 5),   -- applicant documents only; financial records are permanent
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key,                                -- = auth user id
  email citext not null unique,
  first_name text,
  last_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table schools (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  name text not null,
  website text,
  contact_name text,
  contact_email citext,
  address jsonb,
  logo_path text,
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  giving_slug text unique,
  enabled_for_donors boolean not null default true,
  status text not null default 'invited' check (status in ('invited','active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on schools (org_id, status);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  role text not null check (role in ('owner','admin','school_admin','auditor','committee_member')),   -- see Roles and permissions in architecture.md
  -- auditor-only settings: access ends on a date, family documents are off unless an owner grants them
  expires_at timestamptz,
  auditor_firm text,
  can_view_applicant_documents boolean not null default false,
  granted_by uuid references users(id) on delete restrict,
  revoked_at timestamptz,
  -- committee members: how to hear about applications waiting for review
  notify_new_applications text not null default 'daily_digest' check (notify_new_applications in ('daily_digest','each','off')),
  created_at timestamptz not null default now(),
  constraint school_role_needs_school check ((role = 'school_admin') = (school_id is not null)),
  constraint auditor_has_expiry check (role <> 'auditor' or (expires_at is not null and granted_by is not null)),
  constraint auditor_only_settings check (role = 'auditor' or (not can_view_applicant_documents and auditor_firm is null)),
  constraint auditor_expiry_limit check (role <> 'auditor' or expires_at <= created_at + interval '1 year')
);

-- only an owner may grant or change auditor access
create or replace function auditor_grant_guard() returns trigger language plpgsql as $$
begin
  if new.role = 'auditor' and not exists (
       select 1 from memberships m where m.user_id = new.granted_by and m.org_id = new.org_id
         and m.role = 'owner' and m.revoked_at is null) then
    raise exception 'only an owner of this SGO can grant auditor access';
  end if;
  if new.role = 'auditor' and new.user_id = new.granted_by then
    raise exception 'an owner cannot grant auditor access to themselves';
  end if;
  return new;
end $$;
create trigger memberships_auditor_grant before insert or update on memberships
  for each row execute function auditor_grant_guard();
create unique index on memberships (user_id, org_id, coalesce(school_id, '00000000-0000-0000-0000-000000000000'));
create index on memberships (school_id);

create table school_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  email citext not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index on school_invitations (school_id);

create table school_agreements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete restrict,
  agreement_version text not null,
  signer_user_id uuid not null references users(id) on delete restrict,
  signer_name text not null,
  signed_at timestamptz not null default now(),
  signer_ip inet,
  pdf_path text
);
create index on school_agreements (school_id);

-- ---------------------------------------------------------------- processor accounts
create table processor_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  kind text not null check (kind in ('segregated_25f','general')),
  state char(2),                                      -- required for 25F accounts
  stripe_account_id text not null unique,
  status text not null default 'pending' check (status in ('pending','active','restricted')),
  accepts_cards boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint state_for_25f check ((kind = 'segregated_25f') = (state is not null))
);
create unique index on processor_accounts (org_id, kind, coalesce(state, '--'));

-- ---------------------------------------------------------------- money: donors, donations
create table donors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  user_id uuid references users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email citext not null,
  address jsonb not null,                             -- {line1, city, state, zip}
  filing_status text check (filing_status in ('single','married_joint','married_separate')),
  spouse_donor_id uuid references donors(id) on delete set null,
  donor_number int not null,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, donor_number)
);
create index on donors (org_id, email);
create index on donors (user_id);

-- No pledges and no recurring gifts: every gift is one-time and charged at checkout.

-- per-donor annual cap ($1,700 for 2027) lives in a table so it can change by year
create table credit_caps (
  tax_year smallint primary key,
  per_taxpayer_cents bigint not null
);

-- sequential confirmation numbers per org per year, R-2027-0001
-- sequential numbers per org, kind and year: R-2027-0001 (gift receipts), RF-2028-0001 (refund receipts)
create table confirmation_counters (
  org_id uuid not null references orgs(id) on delete restrict,
  kind text not null default 'R' check (kind in ('R','RF')),
  year smallint not null,
  last_value int not null default 0,
  primary key (org_id, kind, year)
);

create or replace function next_number(p_org uuid, p_kind text, p_year smallint) returns text
language plpgsql as $$
declare v int;
begin
  insert into confirmation_counters (org_id, kind, year, last_value) values (p_org, p_kind, p_year, 1)
  on conflict (org_id, kind, year) do update set last_value = confirmation_counters.last_value + 1
  returning last_value into v;
  return format('%s-%s-%s', p_kind, p_year, lpad(v::text, 4, '0'));
end $$;

create or replace function next_confirmation_no(p_org uuid, p_year smallint) returns text
language sql as $$ select next_number(p_org, 'R', p_year) $$;

create table donations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  donor_id uuid not null references donors(id) on delete restrict,
  checkout_id uuid not null default gen_random_uuid(),     -- groups a couple's two gifts
  processor_account_id uuid references processor_accounts(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  fee_cents bigint not null default 0 check (fee_cents >= 0),
  fee_covered_cents bigint not null default 0 check (fee_covered_cents >= 0),
  currency char(3) not null default 'USD',
  method text not null check (method in ('ach','card','check','wire')),
  designation_school_id uuid references schools(id) on delete restrict,
  state char(2),
  qualified_25f boolean not null,
  tax_year smallint not null,
  status text not null default 'pending'
    check (status in ('pending','processing','succeeded','failed','partly_refunded','refunded','returned','disputed')),   -- a summary only; donation_refunds is the record
  confirmation_no text unique,                        -- set when it succeeds
  received_on date,
  check_number text,
  note text,
  stripe_payment_intent_id text unique,
  stripe_charge_id text unique,
  -- attestations captured at checkout (S06); null for offline gifts entered by staff
  attest_us_person boolean,
  attest_own_money boolean,
  attest_count_toward_credit boolean,
  attest_spouse_agreed boolean,
  attested_at timestamptz,
  disclosure_version text,
  succeeded_at timestamptz,
  created_by uuid references users(id) on delete restrict,   -- staff, for offline gifts
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qualified_has_state check (not qualified_25f or state is not null),
  constraint offline_has_received_on check (method in ('ach','card') or received_on is not null)
);
create index on donations (org_id, created_at desc);
create index on donations (donor_id, tax_year);
create index on donations (status);
create index on donations (designation_school_id);
create index on donations (checkout_id);
create index on donations (processor_account_id);

-- the §25F designation can't change once set (S02 rule text)
create or replace function lock_qualified_flag() returns trigger language plpgsql as $$
begin
  if new.qualified_25f is distinct from old.qualified_25f then
    raise exception 'qualified_25f is locked once set';
  end if;
  return new;
end $$;
create trigger donations_lock_qualified before update on donations
  for each row execute function lock_qualified_flag();

create table receipts (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null unique references donations(id) on delete restrict,
  issued_at timestamptz not null default now(),
  emailed_at timestamptz,
  pdf_path text
);
-- a receipt is never deleted and its facts never change; only emailed_at and pdf_path can be filled in
create or replace function receipts_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'receipts cannot be deleted'; end if;
  if (new.id, new.donation_id, new.issued_at) is distinct from (old.id, old.donation_id, old.issued_at) then
    raise exception 'receipt facts are immutable';
  end if;
  if old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path then
    raise exception 'a receipt PDF, once stored, is kept';
  end if;
  return new;
end $$;
create trigger receipts_immutable before update or delete on receipts
  for each row execute function receipts_guard();

-- Money sent back to a donor is its own permanent transaction, linked to the original gift.
-- The original donation and its receipt are never changed. Covers refunds the SGO makes,
-- bank (ACH) returns and lost card disputes. counts_in_year = the year the money went back.
create table donation_refunds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  donation_id uuid not null references donations(id) on delete restrict,   -- the original transaction
  kind text not null check (kind in ('refund','ach_return','dispute_lost')),
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'USD',
  refunded_at timestamptz not null,                   -- when the money actually went back
  counts_in_year smallint not null,                   -- calendar year of refunded_at, in the org's time zone
  original_tax_year smallint not null,                -- copied from the donation, for the reports
  was_qualified_25f boolean not null,
  reason text not null,
  refund_no text not null unique,                     -- RF-2028-0001, on the refund receipt
  stripe_refund_id text unique,
  stripe_dispute_id text unique,
  receipt_pdf_path text,
  receipt_emailed_at timestamptz,
  -- tax-compliance review: every refund of a §25F gift is flagged
  review_required boolean not null,
  review_priority text check (review_priority in ('normal','cross_year')),
  review_status text check (review_status in ('open','donor_notified','no_action_needed','resolved')),
  review_note text,
  reviewed_by uuid references users(id) on delete restrict,
  reviewed_at timestamptz,
  created_by uuid references users(id) on delete restrict,   -- null = from a Stripe event
  created_at timestamptz not null default now(),
  constraint review_fields check (
    (review_required and review_status is not null and review_priority is not null) or
    (not review_required and review_status is null)),
  constraint review_close_needs_who check (review_status in ('open') or review_status is null or (reviewed_by is not null and review_note is not null))
);
create index on donation_refunds (donation_id);
create index on donation_refunds (org_id, counts_in_year);
create index on donation_refunds (review_status) where review_required;

create or replace function donation_refunds_guard() returns trigger language plpgsql as $$
declare d record; already bigint;
begin
  if tg_op = 'INSERT' then
    select amount_cents, tax_year, qualified_25f, status into d from donations where id = new.donation_id;
    if d.status not in ('succeeded','partly_refunded') then
      raise exception 'only a completed gift can be refunded (status %)', d.status;
    end if;
    select coalesce(sum(amount_cents),0) into already from donation_refunds where donation_id = new.donation_id;
    if already + new.amount_cents > d.amount_cents then
      raise exception 'refunds (% + %) would exceed the original gift (%)', already, new.amount_cents, d.amount_cents;
    end if;
    if new.original_tax_year <> d.tax_year or new.was_qualified_25f <> d.qualified_25f then
      raise exception 'original_tax_year and was_qualified_25f must match the original gift';
    end if;
    if new.review_required <> d.qualified_25f then
      raise exception 'every refund of a §25F gift must be flagged for review (and only those)';
    end if;
    if d.qualified_25f and new.review_priority <> (case when new.counts_in_year > d.tax_year then 'cross_year' else 'normal' end) then
      raise exception 'review_priority must be cross_year when the refund year is after the gift''s tax year';
    end if;
    return new;
  end if;
  -- updates: only the receipt and review fields may change
  if (new.id, new.org_id, new.donation_id, new.kind, new.amount_cents, new.currency, new.refunded_at, new.counts_in_year,
      new.original_tax_year, new.was_qualified_25f, new.reason, new.refund_no, new.stripe_refund_id, new.stripe_dispute_id,
      new.review_required, new.review_priority, new.created_by, new.created_at)
     is distinct from
     (old.id, old.org_id, old.donation_id, old.kind, old.amount_cents, old.currency, old.refunded_at, old.counts_in_year,
      old.original_tax_year, old.was_qualified_25f, old.reason, old.refund_no, old.stripe_refund_id, old.stripe_dispute_id,
      old.review_required, old.review_priority, old.created_by, old.created_at) then
    raise exception 'refund facts are permanent; record another transaction instead';
  end if;
  if old.receipt_pdf_path is not null and new.receipt_pdf_path is distinct from old.receipt_pdf_path then
    raise exception 'a refund receipt PDF, once stored, is kept';
  end if;
  return new;
end $$;
create trigger donation_refunds_guard before insert or update on donation_refunds
  for each row execute function donation_refunds_guard();

-- ---------------------------------------------------------------- students: rounds, applications
create table rounds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  name text not null,
  school_year text not null check (school_year ~ '^\d{4}-\d{2}$'),
  opens_at timestamptz not null,
  closes_at timestamptz,
  status text not null default 'open' check (status in ('draft','open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at is null or closes_at > opens_at)
);
create index on rounds (org_id, status);

create table households (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  address jsonb not null,
  state char(2) not null,
  county_fips char(5) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on households (org_id);

create table guardians (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references users(id) on delete restrict,
  phone text,
  primary key (household_id, user_id)
);
create index on guardians (user_id);

create table students (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on students (household_id);

create table roster_entries (
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  student_name text not null,
  grade text,
  guardian_name text,
  guardian_email citext,
  added_at timestamptz not null default now(),
  id uuid primary key default gen_random_uuid()
);
create index on roster_entries (school_id);
create index on roster_entries (student_id);

-- HUD area median income by county and household size; limit = 3 x median
create table amgi_limits (
  year smallint not null,
  state char(2) not null,
  county_fips char(5) not null,
  county_name text not null,
  household_size smallint not null check (household_size between 1 and 8),
  median_cents bigint not null check (median_cents > 0),
  source text not null default 'HUD',
  primary key (year, county_fips, household_size)
);
create index on amgi_limits (state, county_name);

create table applications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  round_id uuid not null references rounds(id) on delete restrict,
  student_id uuid not null references students(id) on delete restrict,
  household_id uuid not null references households(id) on delete restrict,
  school_id uuid not null references schools(id) on delete restrict,
  grade text not null,
  requested_cents bigint check (requested_cents > 0),
  household_size smallint not null check (household_size between 1 and 20),
  qualify_by text not null check (qualify_by in ('income_docs','benefit_letter','foster')),
  income_typed_cents bigint check (income_typed_cents >= 0),
  other_income text not null default 'none_certified' check (other_income in ('none_certified','documented')),
  other_income_certified_by uuid references users(id) on delete restrict,
  auto_reader_consent boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft','submitted','flagged','needs_school','ready','approved','denied','withdrawn')),
  is_renewal boolean not null default false,          -- had an award in an earlier round
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references users(id) on delete restrict,
  deny_reason text,
  documents_purged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, student_id)
);
create index on applications (org_id, status, submitted_at);
create index on applications (school_id, status);
create index on applications (household_id);
create index on applications (student_id);

create table application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  kind text not null check (kind in ('w2','1099','tax_return','pay_stub','benefit_letter','foster_placement','other_income','other')),
  storage_path text not null,
  byte_size int not null check (byte_size <= 10485760),
  content_type text not null,
  extracted_income_cents bigint,
  uploaded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on application_documents (application_id);

create table income_checks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  amgi_year smallint not null,
  county_fips char(5) not null,
  household_size smallint not null,
  median_cents bigint not null,
  limit_cents bigint not null,
  income_typed_cents bigint,
  income_documented_cents bigint,
  result text not null check (result in ('clear','over_limit','mismatch','needs_review','categorical')),
  pct_of_limit numeric(6,2),
  checked_at timestamptz not null default now(),
  checked_by uuid references users(id) on delete restrict      -- null = automatic
);
create index on income_checks (application_id, checked_at desc);

create table school_verifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references applications(id) on delete cascade,
  result text not null check (result in ('verified','declined')),
  by_user uuid not null references users(id) on delete restrict,
  at timestamptz not null default now(),
  note text,
  -- how the school confirmed: in its portal, or told the SGO and an owner/admin recorded it
  method text not null default 'portal' check (method in ('portal','phone','email','letter','in_person')),
  on_behalf boolean not null default false,
  school_contact_name text,                           -- who at the school confirmed (on-behalf only)
  evidence_path text,                                 -- e.g. the school's email or letter, kept permanently
  constraint portal_is_not_on_behalf check ((method = 'portal') = (not on_behalf)),
  constraint on_behalf_needs_details check (not on_behalf or (note is not null and length(trim(note)) >= 10 and school_contact_name is not null))
);

-- portal confirmations must come from that school's own staff; on-behalf ones only from an owner or admin
create or replace function school_verification_guard() returns trigger language plpgsql as $$
declare app record;
begin
  select a.org_id, a.school_id into app from applications a where a.id = new.application_id;
  if not new.on_behalf and not exists (
       select 1 from memberships m where m.user_id = new.by_user and m.school_id = app.school_id
         and m.role = 'school_admin' and m.revoked_at is null) then
    raise exception 'only staff of this school can confirm enrollment in the portal';
  end if;
  if new.on_behalf and not exists (
       select 1 from memberships m where m.user_id = new.by_user and m.org_id = app.org_id
         and m.role in ('owner','admin') and m.revoked_at is null) then
    raise exception 'only an owner or admin can record a school''s confirmation on its behalf';
  end if;
  return new;
end $$;
create trigger school_verifications_guard before insert on school_verifications
  for each row execute function school_verification_guard();
create trigger school_verifications_no_update before update on school_verifications
  for each row execute function forbid_change();

create table disqualified_persons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  full_name text not null,
  role text not null check (role in ('board_member','officer','selection_committee','substantial_contributor','family_member')),
  related_to_id uuid references disqualified_persons(id) on delete cascade,
  relation text,
  user_id uuid references users(id) on delete restrict,          -- set when added automatically from a committee membership
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint family_needs_relation check ((role = 'family_member') = (related_to_id is not null))
);
create index on disqualified_persons (org_id);
create index on disqualified_persons (related_to_id);

create table disqualified_matches (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  person_id uuid not null references disqualified_persons(id) on delete restrict,
  matched_name text not null,
  resolution text check (resolution in ('same_person','different_person')),
  reason text,
  resolved_by uuid references users(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (application_id, person_id),
  constraint resolution_needs_reason check (resolution is null or (reason is not null and resolved_by is not null))
);
create index on disqualified_matches (person_id);

create table awards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  application_id uuid not null unique references applications(id) on delete restrict,
  school_id uuid not null references schools(id) on delete restrict,
  state char(2) not null,                             -- which §25F pool pays it
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'USD',
  priority_reason text check (priority_reason in ('renewal','sibling')),
  awarded_by uuid not null references users(id) on delete restrict,
  awarded_at timestamptz not null default now(),
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment','partly_paid','paid','cancelled')),
  letter_path text,
  transferred_from_award_id uuid unique references awards(id) on delete restrict,   -- the remaining award moved here from another school
  updated_at timestamptz not null default now()
);
create index on awards (org_id, status);
create index on awards (school_id);


-- ---------------------------------------------------------------- scholarship committee
-- Committee members review applications and recommend; an owner or admin makes the decision.
-- They are disqualified persons under §25F: added to the list automatically when given the role.

create or replace function committee_member_disqualified() returns trigger language plpgsql as $$
begin
  if new.role = 'committee_member' and not exists (
       select 1 from disqualified_persons d where d.org_id = new.org_id and d.user_id = new.user_id and d.removed_at is null) then
    insert into disqualified_persons (org_id, full_name, role, user_id)
    select new.org_id, coalesce(nullif(trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')), ''), u.email::text),
           'selection_committee', new.user_id
    from users u where u.id = new.user_id;
  end if;
  return new;
end $$;
create trigger memberships_committee_disqualified after insert or update of role on memberships
  for each row execute function committee_member_disqualified();

create table committee_recusals (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete restrict,
  member_user_id uuid not null references users(id) on delete restrict,
  reason text not null,                               -- e.g. "related to the family", "works at the school"
  automatic boolean not null default false,
  created_at timestamptz not null default now(),
  unique (application_id, member_user_id)
);
create index on committee_recusals (member_user_id);

create table committee_recommendations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete restrict,
  member_user_id uuid not null references users(id) on delete restrict,
  recommendation text not null check (recommendation in ('approve','deny','abstain')),
  suggested_amount_cents bigint check (suggested_amount_cents > 0),
  score smallint check (score between 1 and 5),
  comment text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, member_user_id),
  constraint approve_has_amount check (recommendation <> 'approve' or suggested_amount_cents is not null)
);
create index on committee_recommendations (member_user_id);

create or replace function committee_recommendation_guard() returns trigger language plpgsql as $$
declare app record;
begin
  select a.*, a.status as st into app from applications a where a.id = coalesce(new.application_id, old.application_id);
  if tg_op = 'DELETE' then raise exception 'committee recommendations are kept with the decision record'; end if;
  if app.st in ('approved','denied') then
    raise exception 'the application is decided; recommendations can no longer change';
  end if;
  if not exists (select 1 from memberships m where m.user_id = new.member_user_id and m.org_id = app.org_id
                   and m.role = 'committee_member' and m.revoked_at is null) then
    raise exception 'only an active committee member can recommend';
  end if;
  if exists (select 1 from committee_recusals r where r.application_id = new.application_id and r.member_user_id = new.member_user_id) then
    raise exception 'this member is recused from this application';
  end if;
  -- conflict: a member who is also staff at the student's school must recuse
  if exists (select 1 from memberships m where m.user_id = new.member_user_id and m.school_id = app.school_id and m.revoked_at is null) then
    raise exception 'conflict of interest: the member is on staff at this school; record a recusal instead';
  end if;
  -- conflict: the application is matched (unresolved or confirmed) to this member on the disqualified list
  if exists (select 1 from disqualified_matches x join disqualified_persons d on d.id = x.person_id
               where x.application_id = new.application_id
                 and (d.user_id = new.member_user_id or d.related_to_id in (select id from disqualified_persons where user_id = new.member_user_id))
                 and coalesce(x.resolution,'same_person') = 'same_person') then
    raise exception 'conflict of interest: this application matches the member or their family; record a recusal instead';
  end if;
  return new;
end $$;
create trigger committee_recommendations_guard before insert or update or delete on committee_recommendations
  for each row execute function committee_recommendation_guard();

create trigger committee_recusals_no_delete before delete on committee_recusals
  for each row execute function forbid_change();

-- an award needs the configured number of committee recommendations, and only owner/admin can make it
create or replace function award_needs_committee() returns trigger language plpgsql as $$
declare need smallint; have int;
begin
  select o.min_committee_recommendations into need from orgs o where o.id = new.org_id;
  select count(*) into have from committee_recommendations where application_id = new.application_id and recommendation <> 'abstain';
  if have < need then
    raise exception 'this award needs % committee recommendations; it has %', need, have;
  end if;
  if not exists (select 1 from memberships m where m.user_id = new.awarded_by and m.org_id = new.org_id
                   and m.role in ('owner','admin') and m.revoked_at is null) then
    raise exception 'only an owner or admin can make the award decision';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- payments out
create table payees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  kind text not null check (kind in ('school','vendor')),
  school_id uuid unique references schools(id) on delete restrict,
  name text not null,
  email citext,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_payee check ((kind = 'school') = (school_id is not null))
);
create index on payees (org_id, kind);

create table w9s (
  id uuid primary key default gen_random_uuid(),
  payee_id uuid not null references payees(id) on delete restrict,
  tax_classification text not null,
  exempt_payee_code text,
  tin_ciphertext bytea not null,                      -- encrypted in the app with a KMS-held key
  tin_last4 char(4) not null,
  signed_by text not null,
  signed_on date not null,
  file_path text,
  checked_method text,                                -- e.g. "IRS Tax Exempt Organization Search, EIN and name match"
  checked_by uuid references users(id) on delete restrict,
  checked_at timestamptz,
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  superseded_at timestamptz
);
create index on w9s (payee_id);

create table payee_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  payee_id uuid not null references payees(id) on delete restrict,
  routing_ciphertext bytea not null,
  account_ciphertext bytea not null,
  account_last4 char(4) not null,
  routing_last4 char(4) not null,
  account_type text not null check (account_type in ('checking','savings')),
  status text not null default 'pending_approval' check (status in ('pending_approval','approved','replaced','rejected')),
  entered_by uuid not null references users(id) on delete restrict,
  entered_at timestamptz not null default now(),
  approved_by uuid references users(id) on delete restrict,
  approved_at timestamptz,
  callback_note text,
  constraint approver_differs check (approved_by is null or approved_by <> entered_by),
  constraint approval_needs_callback check (status <> 'approved' or (approved_by is not null and callback_note is not null))
);
create unique index one_live_bank_account on payee_bank_accounts (payee_id) where status in ('pending_approval','approved');

create table vendor_bills (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references awards(id) on delete restrict,
  payee_id uuid not null references payees(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'USD',
  expense_type text not null,
  description text not null,
  invoice_path text,
  not_related_attested boolean not null check (not_related_attested),
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index on vendor_bills (award_id);
create index on vendor_bills (payee_id);

create table payment_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  number int not null,
  state char(2) not null,                             -- pays from this state's §25F account
  method text not null default 'ach' check (method in ('ach','check')),
  effective_date date not null,
  statement_ref text not null,                        -- e.g. SCHOL 0001
  status text not null default 'draft'
    check (status in ('draft','approved','file_made','sent','settled','cancelled')),
  built_by uuid not null references users(id) on delete restrict,
  built_at timestamptz not null default now(),
  approved_by uuid references users(id) on delete restrict,
  approved_at timestamptz,
  second_approved_by uuid references users(id) on delete restrict,
  second_approved_at timestamptz,
  file_made_at timestamptz,
  file_hash text,
  file_path text,                                     -- the ACH file as sent, kept with the batch
  sent_at timestamptz,
  settled_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (org_id, number),
  constraint second_approver_differs check (second_approved_by is null or second_approved_by <> approved_by)
);
create index on payment_batches (org_id, status);

create table payments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references payment_batches(id) on delete cascade,
  payee_id uuid not null references payees(id) on delete restrict,
  bank_account_id uuid not null references payee_bank_accounts(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'USD',
  remittance_ref text not null,                       -- P0001-001
  status text not null default 'not_sent' check (status in ('not_sent','sent','settled','returned')),
  remittance_emailed_at timestamptz,
  unique (batch_id, payee_id)
);
create index on payments (payee_id);

create table payment_lines (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  award_id uuid not null references awards(id) on delete restrict,
  vendor_bill_id uuid references vendor_bills(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  description text not null default 'Tuition and fees',
  term text,                                          -- school lines: the term this pays for, e.g. "2027-28 Fall"
  constraint school_line_has_term check (vendor_bill_id is not null or term is not null)
);
create index on payment_lines (payment_id);
create index on payment_lines (award_id);
create unique index on payment_lines (vendor_bill_id) where vendor_bill_id is not null;

-- ---------------------------------------------------------------- proof of delivery
-- Nothing is paid until it is proven. Vendors/providers: an invoice AND proof the goods or
-- service were delivered (and the parent's confirmation if the SGO requires it). Schools:
-- enrollment confirmed AND the school's tuition statement or invoice for that term.
-- Proof records and files are permanent, kept with the payment records.

create table delivery_proofs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  vendor_bill_id uuid references vendor_bills(id) on delete restrict,   -- vendor/provider proof
  award_id uuid references awards(id) on delete restrict,               -- school proof (with term)
  term text,
  kind text not null check (kind in ('invoice','delivery_receipt','session_log','signed_confirmation','tuition_statement')),
  file_path text not null,                            -- in the locked financial-records bucket
  description text not null,                          -- e.g. "24 math sessions, Jan 6 - Mar 28"
  service_from date,
  service_to date,
  recorded_by uuid not null references users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint one_subject check ((vendor_bill_id is not null) <> (award_id is not null)),
  constraint school_proof_kind check (award_id is null or (kind = 'tuition_statement' and term is not null)),
  constraint vendor_proof_kind check (vendor_bill_id is null or kind <> 'tuition_statement'),
  constraint service_dates check (service_to is null or service_from is null or service_to >= service_from)
);
create index on delivery_proofs (vendor_bill_id);
create index on delivery_proofs (award_id, term);
create trigger delivery_proofs_no_update before update on delivery_proofs
  for each row execute function forbid_change();

-- one-click confirmation from the parent: "Did Leo receive these 24 tutoring sessions?"
create table family_confirmations (
  id uuid primary key default gen_random_uuid(),
  vendor_bill_id uuid not null references vendor_bills(id) on delete restrict,
  guardian_user_id uuid not null references users(id) on delete restrict,
  token_hash text not null unique,
  question text not null,
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  response text check (response in ('confirmed','disputed')),
  comment text,
  responded_at timestamptz,
  dispute_resolved_by uuid references users(id) on delete restrict,   -- owner/admin after looking into a dispute
  dispute_resolution text,
  dispute_resolved_at timestamptz,
  constraint response_has_time check ((response is null) = (responded_at is null)),
  constraint dispute_needs_comment check (response <> 'disputed' or comment is not null),
  constraint resolution_complete check ((dispute_resolved_by is null) = (dispute_resolution is null))
);
create index on family_confirmations (vendor_bill_id);

create or replace function family_confirmation_guard() returns trigger language plpgsql as $$
begin
  if old.response is not null and (new.response, new.comment, new.responded_at) is distinct from (old.response, old.comment, old.responded_at) then
    raise exception 'a family''s answer is kept as given';
  end if;
  if new.dispute_resolved_by is not null and new.response is distinct from 'disputed' then
    raise exception 'only a disputed confirmation can be resolved';
  end if;
  return new;
end $$;
create trigger family_confirmations_guard before update on family_confirmations
  for each row execute function family_confirmation_guard();

-- Each term, before that term's payment, the school confirms the student is still enrolled.
create table term_enrollment_confirmations (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references awards(id) on delete restrict,
  term text not null,
  result text not null check (result in ('enrolled','not_enrolled')),
  by_user uuid not null references users(id) on delete restrict,
  on_behalf boolean not null default false,
  method text not null default 'portal' check (method in ('portal','phone','email','letter','in_person')),
  note text,
  at timestamptz not null default now(),
  unique (award_id, term),
  constraint portal_is_not_on_behalf check ((method = 'portal') = (not on_behalf)),
  constraint on_behalf_needs_note check (not on_behalf or (note is not null and length(trim(note)) >= 10))
);
create index on term_enrollment_confirmations (award_id);

-- The school reports that a scholarship student withdrew, transferred or graduated.
create table enrollment_status_changes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  award_id uuid not null references awards(id) on delete restrict,
  school_id uuid not null references schools(id) on delete restrict,
  student_id uuid not null references students(id) on delete restrict,
  change text not null check (change in ('withdrew','transferred','graduated')),
  effective_date date not null,
  new_school_name text,                               -- when transferred, if known
  new_school_id uuid references schools(id) on delete restrict,   -- when it's a partner school
  reported_by uuid not null references users(id) on delete restrict,
  on_behalf boolean not null default false,
  note text,
  reported_at timestamptz not null default now(),
  admin_action text check (admin_action in ('moved_to_new_school','returned_to_pool','no_remaining_amount')),
  admin_action_by uuid references users(id) on delete restrict,
  admin_action_at timestamptz,
  unique (award_id),
  constraint on_behalf_needs_note check (not on_behalf or (note is not null and length(trim(note)) >= 10)),
  constraint action_complete check ((admin_action is null) = (admin_action_by is null))
);
create index on enrollment_status_changes (school_id);
create index on enrollment_status_changes (student_id);

-- who may confirm or report: that school's staff, or an owner/admin on its behalf
create or replace function school_report_guard() returns trigger language plpgsql as $$
declare a record; j jsonb := to_jsonb(new); actor uuid; behalf boolean;
begin
  actor  := coalesce((j->>'by_user')::uuid, (j->>'reported_by')::uuid);
  behalf := (j->>'on_behalf')::boolean;
  select aw.org_id, aw.school_id into a from awards aw where aw.id = (j->>'award_id')::uuid;
  if tg_table_name = 'enrollment_status_changes' and (j->>'school_id')::uuid <> a.school_id then
    raise exception 'the school on the report must be the award''s school';
  end if;
  if not behalf and not exists (
       select 1 from memberships m where m.user_id = actor and m.school_id = a.school_id
         and m.role = 'school_admin' and m.revoked_at is null) then
    raise exception 'only staff of this school can report this in the portal';
  end if;
  if behalf and not exists (
       select 1 from memberships m where m.user_id = actor and m.org_id = a.org_id
         and m.role in ('owner','admin') and m.revoked_at is null) then
    raise exception 'only an owner or admin can record this on the school''s behalf';
  end if;
  return new;
end $$;
create trigger term_enrollment_confirmations_guard before insert on term_enrollment_confirmations
  for each row execute function school_report_guard();
create trigger term_enrollment_confirmations_no_update before update on term_enrollment_confirmations
  for each row execute function forbid_change();
create trigger enrollment_status_changes_guard before insert on enrollment_status_changes
  for each row execute function school_report_guard();

-- a status report is permanent; only the admin's follow-up (once) can be added
create or replace function status_change_guard() returns trigger language plpgsql as $$
begin
  if (new.award_id, new.school_id, new.student_id, new.change, new.effective_date, new.new_school_name, new.new_school_id,
      new.reported_by, new.on_behalf, new.note, new.reported_at)
     is distinct from
     (old.award_id, old.school_id, old.student_id, old.change, old.effective_date, old.new_school_name, old.new_school_id,
      old.reported_by, old.on_behalf, old.note, old.reported_at) then
    raise exception 'an enrollment status report is permanent';
  end if;
  if old.admin_action is not null and (new.admin_action, new.admin_action_by, new.admin_action_at)
       is distinct from (old.admin_action, old.admin_action_by, old.admin_action_at) then
    raise exception 'the follow-up on a status report is recorded once';
  end if;
  return new;
end $$;
create trigger enrollment_status_changes_facts before update on enrollment_status_changes
  for each row execute function status_change_guard();

-- why a line can or can't be paid yet (for the Ready to pay / Awaiting proof tabs)
create view vendor_bill_payability as
  select b.id as vendor_bill_id, b.award_id, b.payee_id, b.amount_cents,
    exists (select 1 from delivery_proofs p where p.vendor_bill_id = b.id and p.kind = 'invoice') as has_invoice,
    exists (select 1 from delivery_proofs p where p.vendor_bill_id = b.id and p.kind in ('delivery_receipt','session_log','signed_confirmation')) as has_delivery_proof,
    exists (select 1 from family_confirmations f where f.vendor_bill_id = b.id and f.response = 'confirmed') as family_confirmed,
    exists (select 1 from family_confirmations f where f.vendor_bill_id = b.id and f.response = 'disputed' and f.dispute_resolved_by is null) as open_dispute
  from vendor_bills b;

create or replace function payment_line_proof_guard() returns trigger language plpgsql as $$
declare v record; need_family boolean; app_id uuid;
begin
  select o.require_family_confirmation into need_family
  from awards a join orgs o on o.id = a.org_id where a.id = new.award_id;
  if new.vendor_bill_id is not null then
    select * into v from vendor_bill_payability where vendor_bill_id = new.vendor_bill_id;
    if not v.has_invoice then raise exception 'not payable yet: the vendor bill has no invoice'; end if;
    if not v.has_delivery_proof then raise exception 'not payable yet: no proof of delivery (delivery receipt, session log or signed confirmation)'; end if;
    if v.open_dispute then raise exception 'not payable: the family disputed delivery and it is not resolved'; end if;
    if need_family and not v.family_confirmed then raise exception 'not payable yet: waiting for the family to confirm delivery'; end if;
  else
    select application_id into app_id from awards where id = new.award_id;
    if not exists (select 1 from school_verifications sv where sv.application_id = app_id and sv.result = 'verified') then
      raise exception 'not payable yet: the school has not confirmed enrollment';
    end if;
    if not exists (select 1 from delivery_proofs p where p.award_id = new.award_id and p.term = new.term and p.kind = 'tuition_statement') then
      raise exception 'not payable yet: no tuition statement or invoice from the school for %', new.term;
    end if;
    if not exists (select 1 from term_enrollment_confirmations t where t.award_id = new.award_id and t.term = new.term and t.result = 'enrolled') then
      raise exception 'not payable yet: the school has not confirmed the student is still enrolled for %', new.term;
    end if;
    if exists (select 1 from enrollment_status_changes c join awards a on a.id = new.award_id
                 where c.award_id = new.award_id) then
      raise exception 'not payable: the school reported the student withdrew, transferred or graduated';
    end if;
  end if;
  return new;
end $$;
create trigger payment_lines_need_proof before insert or update on payment_lines
  for each row execute function payment_line_proof_guard();

-- Money a school or vendor sends back (an ACH return, an overpayment, a student who left).
-- Proposed rules: it is income in the year it comes back, and must be spent by the end of
-- the next year. It goes back on the award it came from (or the general pool).
create table payment_returns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  payment_id uuid references payments(id) on delete restrict,          -- the payment it reverses, if known
  payee_id uuid not null references payees(id) on delete restrict,      -- who sent it back
  award_id uuid references awards(id) on delete restrict,               -- the award it goes back on; null = general pool
  state char(2) not null,                                               -- which §25F account received it
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'USD',
  received_on date not null,
  counts_in_year smallint not null,                                     -- year it came back = year it counts as income
  spend_by date not null,                                               -- Dec 31 of the next year
  reason text not null,
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint counts_in_receipt_year check (counts_in_year = extract(year from received_on)),
  constraint spend_by_next_year_end check (spend_by = make_date(counts_in_year + 1, 12, 31))
);
create index on payment_returns (org_id, counts_in_year);
create index on payment_returns (award_id);
create index on payment_returns (payee_id);
create trigger payment_returns_facts before update on payment_returns
  for each row execute function forbid_change();

-- every automatic email (receipts, reminders, digests): who, what, about which record, when.
-- Used to space out reminders and to prove what was sent. Permanent.
create table notification_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  kind text not null check (kind in ('receipt','refund_receipt','remittance','award_letter','magic_link',
                                     'school_verification_reminder','school_verification_overdue_admin',
                                     'committee_digest','committee_new_application','year_end_statement')),
  recipient_user_id uuid references users(id) on delete restrict,
  recipient_email citext not null,
  subject_type text,
  subject_id uuid,
  subject_ids uuid[],                                 -- for digests and reminders covering several applications
  provider_message_id text,
  sent_at timestamptz not null default now(),
  bounced_at timestamptz
);
create index on notification_log (kind, subject_id, sent_at desc);
create index on notification_log (recipient_user_id, kind, sent_at desc);

-- ---------------------------------------------------------------- donor tax reporting (gap 1)
-- January 31: a year-end statement to every donor. February 28: the donor report to the IRS
-- (through its SGO portal). Both are permanent snapshots; a correction is a new statement or
-- report that supersedes the old one, never an edit. The IRS file format is a placeholder
-- until the IRS publishes it.

create table year_end_statements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  donor_id uuid not null references donors(id) on delete restrict,
  tax_year smallint not null,
  donor_number int not null,                          -- snapshot
  donor_name text not null,                           -- snapshot
  donor_address jsonb not null,                       -- snapshot
  gift_count int not null check (gift_count >= 0),
  qualified_cents bigint not null check (qualified_cents >= 0),   -- §25F-designated gifts in the tax year
  general_cents bigint not null check (general_cents >= 0),       -- other gifts in the tax year
  refunded_qualified_cents bigint not null default 0 check (refunded_qualified_cents >= 0),  -- refunds of those §25F gifts known when issued
  sgo_ein text not null,                              -- snapshot of the SGO's EIN
  supersedes_id uuid unique references year_end_statements(id) on delete restrict,   -- a corrected statement points to the one it replaces
  correction_reason text,
  pdf_path text,
  content_hash text,
  generated_by uuid references users(id) on delete restrict,
  generated_at timestamptz not null default now(),
  emailed_at timestamptz,
  constraint correction_needs_reason check (supersedes_id is null or correction_reason is not null)
);
create index on year_end_statements (org_id, tax_year);
create index on year_end_statements (donor_id, tax_year);

create table irs_donor_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  tax_year smallint not null,
  format_version text not null default 'placeholder-v0',   -- replace when the IRS publishes the file layout
  status text not null default 'generated' check (status in ('generated','submitted')),
  corrects_report_id uuid unique references irs_donor_reports(id) on delete restrict,
  correction_reason text,
  donor_count int not null,
  qualified_total_cents bigint not null,
  file_path text,
  file_hash text,
  generated_by uuid not null references users(id) on delete restrict,
  generated_at timestamptz not null default now(),
  submitted_by uuid references users(id) on delete restrict,
  submitted_at timestamptz,
  irs_confirmation text,                              -- the portal's confirmation or receipt number
  constraint submitted_needs_who check (status <> 'submitted' or (submitted_by is not null and submitted_at is not null and irs_confirmation is not null)),
  constraint correction_needs_reason check (corrects_report_id is null or correction_reason is not null)
);
create index on irs_donor_reports (org_id, tax_year);

create table irs_donor_report_lines (
  id bigserial primary key,
  report_id uuid not null references irs_donor_reports(id) on delete restrict,
  donor_id uuid not null references donors(id) on delete restrict,
  donor_number int not null,
  donor_name text not null,
  donor_address jsonb not null,
  qualified_cents bigint not null check (qualified_cents >= 0),
  refunded_qualified_cents bigint not null default 0 check (refunded_qualified_cents >= 0),
  unique (report_id, donor_id)
);

-- statements: facts never change; only the PDF (once), hash (once) and emailed_at can be filled in
create or replace function year_end_statement_guard() returns trigger language plpgsql as $$
begin
  if (new.org_id, new.donor_id, new.tax_year, new.donor_number, new.donor_name, new.donor_address, new.gift_count,
      new.qualified_cents, new.general_cents, new.refunded_qualified_cents, new.sgo_ein, new.supersedes_id,
      new.correction_reason, new.generated_by, new.generated_at)
     is distinct from
     (old.org_id, old.donor_id, old.tax_year, old.donor_number, old.donor_name, old.donor_address, old.gift_count,
      old.qualified_cents, old.general_cents, old.refunded_qualified_cents, old.sgo_ein, old.supersedes_id,
      old.correction_reason, old.generated_by, old.generated_at) then
    raise exception 'a year-end statement is permanent; issue a corrected statement instead';
  end if;
  if (old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path)
     or (old.content_hash is not null and new.content_hash is distinct from old.content_hash) then
    raise exception 'a stored statement file is kept as issued';
  end if;
  return new;
end $$;
create trigger year_end_statements_guard before update on year_end_statements
  for each row execute function year_end_statement_guard();

-- IRS reports: figures never change; only file (once) and the submission record can be added
create or replace function irs_report_guard() returns trigger language plpgsql as $$
begin
  if (new.org_id, new.tax_year, new.format_version, new.corrects_report_id, new.correction_reason,
      new.donor_count, new.qualified_total_cents, new.generated_by, new.generated_at)
     is distinct from
     (old.org_id, old.tax_year, old.format_version, old.corrects_report_id, old.correction_reason,
      old.donor_count, old.qualified_total_cents, old.generated_by, old.generated_at) then
    raise exception 'an IRS donor report is permanent; generate a corrected report instead';
  end if;
  if old.status = 'submitted' and (new.status, new.submitted_by, new.submitted_at, new.irs_confirmation)
       is distinct from (old.status, old.submitted_by, old.submitted_at, old.irs_confirmation) then
    raise exception 'a submitted report''s submission record cannot change';
  end if;
  if (old.file_path is not null and new.file_path is distinct from old.file_path)
     or (old.file_hash is not null and new.file_hash is distinct from old.file_hash) then
    raise exception 'a stored report file is kept as generated';
  end if;
  return new;
end $$;
create trigger irs_donor_reports_guard before update on irs_donor_reports
  for each row execute function irs_report_guard();
create trigger irs_donor_report_lines_no_update before update on irs_donor_report_lines
  for each row execute function forbid_change();

-- per donor, per tax year: the donor page's running totals, the statement and the IRS report
create view donor_annual_totals as
  select t.*, c.per_taxpayer_cents as cap_cents,
         c.per_taxpayer_cents - (t.qualified_cents - t.refunded_qualified_cents) as cap_remaining_cents
  from (
    select d.org_id, d.donor_id, d.tax_year,
           count(*)                                                             as gift_count,
           coalesce(sum(d.amount_cents),0)                                      as total_cents,
           coalesce(sum(d.amount_cents) filter (where d.qualified_25f),0)       as qualified_cents,
           coalesce(sum(d.amount_cents) filter (where not d.qualified_25f),0)   as general_cents,
           coalesce(sum(r.refunded),0)                                          as refunded_cents,
           coalesce(sum(r.refunded) filter (where d.qualified_25f),0)           as refunded_qualified_cents,
           coalesce(sum(d.fee_cents),0)                                         as fees_cents,
           max(d.succeeded_at)                                                  as last_gift_at
    from donations d
    left join (select donation_id, sum(amount_cents) as refunded from donation_refunds group by donation_id) r
           on r.donation_id = d.id
    where d.succeeded_at is not null
    group by d.org_id, d.donor_id, d.tax_year
  ) t left join credit_caps c on c.tax_year = t.tax_year;

-- ---------------------------------------------------------------- annual certification (gap 7)
-- The year's compliance figures, frozen as a snapshot and certified by an owner. Permanent.
create table annual_certifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  tax_year smallint not null,
  state char(2) not null,
  figures jsonb not null,                             -- receipts, scholarships, 90% (both bases), distribution rule,
                                                      -- payout progress by receipt year, donors, refunds, returns, open reviews
  file_path text,
  status text not null default 'draft' check (status in ('draft','certified')),
  supersedes_id uuid unique references annual_certifications(id) on delete restrict,
  generated_by uuid not null references users(id) on delete restrict,
  generated_at timestamptz not null default now(),
  certified_by uuid references users(id) on delete restrict,
  certified_at timestamptz,
  certification_statement text,                       -- the owner's signed statement, as typed
  constraint certified_needs_who check (status <> 'certified' or (certified_by is not null and certified_at is not null and certification_statement is not null))
);
create index on annual_certifications (org_id, tax_year, state);

create or replace function annual_certification_guard() returns trigger language plpgsql as $$
begin
  if old.status = 'certified' then
    raise exception 'a certified annual certification is permanent; create a superseding one instead';
  end if;
  if new.status = 'certified' and not exists (
       select 1 from memberships m where m.user_id = new.certified_by and m.org_id = new.org_id
         and m.role = 'owner' and m.revoked_at is null) then
    raise exception 'only an owner can certify';
  end if;
  return new;
end $$;
create trigger annual_certifications_guard before update on annual_certifications
  for each row execute function annual_certification_guard();

-- ---------------------------------------------------------------- books
create table ledger_accounts (
  key text primary key,                               -- asset:bank:25f:IA
  org_id uuid not null references orgs(id) on delete restrict,
  name text not null,
  type text not null check (type in ('asset','liability','net_assets','income','expense')),
  state char(2),
  created_at timestamptz not null default now()
);
create index on ledger_accounts (org_id, type);

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  occurred_at timestamptz not null,
  memo text not null,
  source_type text not null check (source_type in
    ('donation','donation_fee','donation_reversal','donation_refund','payout_to_bank','award','award_cancel',
     'payment_sent','payment_settled','payment_returned','returned_to_award','admin_expense','transfer','adjustment')),
  source_id uuid,
  idempotency_key text not null unique,               -- e.g. stripe event id + purpose
  reverses_entry_id uuid unique references journal_entries(id) on delete restrict,
  created_by uuid references users(id) on delete restrict,   -- null = system
  created_at timestamptz not null default now()
);
create index on journal_entries (org_id, occurred_at);
create index on journal_entries (source_type, source_id);

create table postings (
  id bigserial primary key,
  entry_id uuid not null references journal_entries(id) on delete restrict,
  account_key text not null references ledger_accounts(key) on delete restrict,
  debit_cents bigint not null default 0 check (debit_cents >= 0),
  credit_cents bigint not null default 0 check (credit_cents >= 0),
  currency char(3) not null default 'USD',
  constraint one_side check ((debit_cents = 0) <> (credit_cents = 0))
);
create index on postings (entry_id);
create index on postings (account_key);

create trigger journal_append_only before update or delete on journal_entries
  for each row execute function forbid_change();
create trigger postings_append_only before update or delete on postings
  for each row execute function forbid_change();

-- every entry must balance and have at least two postings, checked at commit
create or replace function check_entry_balanced() returns trigger language plpgsql as $$
declare d bigint; c bigint; n int;
begin
  select coalesce(sum(debit_cents),0), coalesce(sum(credit_cents),0), count(*)
    into d, c, n from postings where entry_id = new.entry_id;
  if n < 2 or d <> c then
    raise exception 'journal entry % does not balance (debits %, credits %, postings %)', new.entry_id, d, c, n;
  end if;
  return null;
end $$;
create constraint trigger postings_balanced after insert on postings
  deferrable initially deferred for each row execute function check_entry_balanced();

-- no 25F money may be spent on another state's students: enforced in the data layer
-- (award.state = household.state) and visible here by account key.

create view account_balances as
  select a.key, a.org_id, a.name, a.type, a.state,
         coalesce(sum(p.debit_cents),0)  as debits_cents,
         coalesce(sum(p.credit_cents),0) as credits_cents,
         case when a.type in ('asset','expense')
              then coalesce(sum(p.debit_cents - p.credit_cents),0)
              else coalesce(sum(p.credit_cents - p.debit_cents),0) end as balance_cents
  from ledger_accounts a left join postings p on p.account_key = a.key
  group by a.key;

create view trial_balance as
  select j.org_id, sum(p.debit_cents) as debits_cents, sum(p.credit_cents) as credits_cents,
         count(distinct j.id) as entries, count(*) as postings
  from journal_entries j join postings p on p.entry_id = j.id
  group by j.org_id;

-- ---- the three financial views (decided 2026-11-12) + the 90/10 summary
-- Years are calendar years in the org's time zone.

-- 1. Annual Donation Report: donations received during each calendar year (originals never change)
create view annual_donation_report as
  select d.org_id,
         extract(year from d.succeeded_at at time zone o.timezone)::int as year,
         count(*)                                                      as donations,
         sum(d.amount_cents)                                           as received_cents,
         sum(d.amount_cents) filter (where d.qualified_25f)            as qualified_25f_cents,
         sum(d.amount_cents) filter (where not d.qualified_25f)        as general_cents,
         sum(d.fee_cents)                                              as fees_cents,
         count(distinct d.donor_id)                                    as donors
  from donations d join orgs o on o.id = d.org_id
  where d.succeeded_at is not null
  group by 1, 2;

-- 2. Annual Refund Report: money actually sent back during each calendar year
create view annual_refund_report as
  select r.org_id, r.counts_in_year as year,
         count(*)                                                       as refunds,
         sum(r.amount_cents)                                            as refunded_cents,
         sum(r.amount_cents) filter (where r.kind = 'refund')           as refunds_cents,
         sum(r.amount_cents) filter (where r.kind = 'ach_return')       as ach_returns_cents,
         sum(r.amount_cents) filter (where r.kind = 'dispute_lost')     as disputes_lost_cents,
         sum(r.amount_cents) filter (where r.was_qualified_25f)         as qualified_25f_cents,
         count(*) filter (where r.counts_in_year > r.original_tax_year) as cross_year_refunds,
         count(*) filter (where r.review_status = 'open')               as reviews_open
  from donation_refunds r
  group by 1, 2;

-- 3. Lifetime Transaction Ledger: every donation, payment, refund, adjustment and reversal, forever
create view lifetime_transaction_ledger as
  select j.org_id, j.occurred_at, j.id as entry_id, j.source_type, j.source_id, j.memo,
         j.reverses_entry_id, j.idempotency_key,
         coalesce(r.donation_id, case when j.source_type in ('donation','donation_fee','donation_reversal') then j.source_id end) as donation_id,
         r.refund_no,
         sum(p.debit_cents) as amount_cents,
         string_agg(case when p.debit_cents > 0 then 'Dr ' || p.account_key || ' ' || p.debit_cents
                         else 'Cr ' || p.account_key || ' ' || p.credit_cents end, '; ' order by p.id) as postings
  from journal_entries j
  join postings p on p.entry_id = j.id
  left join donation_refunds r on j.source_type = 'donation_refund' and r.id = j.source_id
  group by j.id, r.donation_id, r.refund_no;

-- The 90% test, per state (one §25F account per listing state) and per calendar year, from the journal.
-- receipts     = contributions + money returned by schools/vendors (income in the year it comes back)
-- scholarships = awarded, paid or not (expense:scholarships, which includes vendor payments on an award)
-- operating    = processing fees + admin
-- ratio_gross uses receipts; ratio_net subtracts donor refunds paid that year. Your CPA picks the basis.
create view ninety_ten as
  with p as (
    select j.org_id, extract(year from j.occurred_at at time zone o.timezone)::int as year,
           a.state, p.account_key, p.debit_cents, p.credit_cents
    from journal_entries j join postings p on p.entry_id = j.id
    join ledger_accounts a on a.key = p.account_key join orgs o on o.id = j.org_id
  )
  select org_id, year, state,
    coalesce(sum(credit_cents - debit_cents) filter (where account_key like 'income:contributions:%'),0)       as donated_cents,
    coalesce(sum(credit_cents - debit_cents) filter (where account_key like 'income:returned_payments:%'),0)   as returned_cents,
    coalesce(sum(credit_cents - debit_cents) filter (where account_key like 'income:contributions:%' or account_key like 'income:returned_payments:%'),0) as receipts_cents,
    coalesce(sum(debit_cents - credit_cents) filter (where account_key like 'income:contribution_refunds:%'),0) as donor_refunds_cents,
    coalesce(sum(debit_cents - credit_cents) filter (where account_key like 'expense:scholarships:%'),0)       as scholarships_cents,
    coalesce(sum(debit_cents - credit_cents) filter (where account_key like 'expense:fees%' or account_key like 'expense:admin%'),0) as operating_cents
  from p
  group by org_id, year, state;

create view ninety_ten_status as
  select n.*,
    round(100.0 * scholarships_cents / nullif(receipts_cents,0), 1) as ratio_gross_pct,
    round(100.0 * scholarships_cents / nullif(receipts_cents - donor_refunds_cents,0), 1) as ratio_net_pct,
    case when receipts_cents = 0 then 'no_receipts'
         when scholarships_cents * 10 >= receipts_cents * 9 then 'passing' else 'failing' end as status_gross
  from ninety_ten n where state is not null;

-- Payout progress by receipt year (gap 7): 90% of each year's receipts must be paid out by
-- Dec 31 of the next year. Scholarships actually paid (payments sent) are applied to the
-- oldest receipt year first (first in, first out), per state.
create view receipt_year_payout as
  with receipts as (
    select org_id, state, year, receipts_cents,
           ceil(receipts_cents * 0.9)::bigint as required_cents
    from ninety_ten where state is not null and receipts_cents > 0
  ),
  paid as (
    select j.org_id, a.state, sum(p.debit_cents - p.credit_cents) as paid_cents
    from journal_entries j join postings p on p.entry_id = j.id join ledger_accounts a on a.key = p.account_key
    where p.account_key like 'liability:awards_payable:%' and j.source_type in ('payment_sent','payment_returned')
    group by 1, 2
  ),
  cum as (
    select r.*, coalesce(sum(r.required_cents) over (partition by r.org_id, r.state order by r.year
                         rows between unbounded preceding and 1 preceding),0) as required_before_cents
    from receipts r
  )
  select c.org_id, c.state, c.year as receipt_year, c.receipts_cents, c.required_cents,
         least(c.required_cents, greatest(0, coalesce(pd.paid_cents,0) - c.required_before_cents)) as paid_toward_cents,
         c.required_cents - least(c.required_cents, greatest(0, coalesce(pd.paid_cents,0) - c.required_before_cents)) as still_to_pay_cents,
         make_date(c.year + 1, 12, 31) as pay_by,
         case when coalesce(pd.paid_cents,0) - c.required_before_cents >= c.required_cents then 'met'
              when current_date > make_date(c.year + 1, 12, 31) then 'overdue'
              else 'to_pay' end as status
  from cum c left join paid pd on pd.org_id = c.org_id and pd.state = c.state;

-- the school portal's "Scholarship students" page
create view school_scholarship_students as
  select a.school_id, a.id as award_id, st.id as student_id, st.first_name, st.last_name, ap.grade,
         ap.round_id, a.amount_cents as awarded_cents,
         coalesce((select sum(pl.amount_cents) from payment_lines pl join payments pm on pm.id = pl.payment_id
                    join payment_batches b on b.id = pm.batch_id
                   where pl.award_id = a.id and b.status in ('sent','settled')),0) as paid_cents,
         a.status as award_status,
         c.change as status_change, c.effective_date,
         (select max(t.term) from term_enrollment_confirmations t where t.award_id = a.id and t.result = 'enrolled') as last_term_confirmed
  from awards a join applications ap on ap.id = a.application_id join students st on st.id = ap.student_id
  left join enrollment_status_changes c on c.award_id = a.id
  where a.status <> 'cancelled';

-- school payments sent on or after the date a student left: candidates for a return from the school
create view payments_after_leaving as
  select c.school_id, c.student_id, c.change, c.effective_date, pl.id as payment_line_id, pl.term,
         pl.amount_cents, b.sent_at
  from enrollment_status_changes c
  join payment_lines pl on pl.award_id = c.award_id and pl.vendor_bill_id is null
  join payments pm on pm.id = pl.payment_id join payment_batches b on b.id = pm.batch_id
  where b.status in ('sent','settled') and b.sent_at::date >= c.effective_date;

-- "10 students, not all at one school": students with an award in the year, counted by the
-- school they attend. Vendors are not schools and don't count.
create view distribution_rule as
  select a.org_id, extract(year from a.awarded_at at time zone o.timezone)::int as year,
         count(distinct ap.student_id) as students,
         count(distinct a.school_id)   as schools,
         (count(distinct ap.student_id) >= 10 and count(distinct a.school_id) >= 2) as met
  from awards a join applications ap on ap.id = a.application_id join orgs o on o.id = a.org_id
  where a.status <> 'cancelled'
  group by 1, 2;

-- returned money still to re-spend by its deadline
create view returned_payments_to_spend as
  select r.*, p.name as from_payee,
         (select coalesce(sum(pl.amount_cents),0) from payment_lines pl join payments pm on pm.id = pl.payment_id
            join payment_batches b on b.id = pm.batch_id
           where pl.award_id = r.award_id and b.status in ('sent','settled') and b.sent_at::date > r.received_on) as respent_on_award_cents
  from payment_returns r join payees p on p.id = r.payee_id;

create table provider_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,               -- webhooks arrive twice; this makes them once
  type text not null,
  stripe_account_id text,
  object_id text,
  amount_cents bigint,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  matched_entry_id uuid references journal_entries(id) on delete restrict,
  reconcile_status text not null default 'unchecked' check (reconcile_status in ('unchecked','matched','exception','ignored')),
  error text
);
create index on provider_events (processed_at) where processed_at is null;
create index on provider_events (reconcile_status);

create table bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  account_key text not null references ledger_accounts(key) on delete restrict,
  posted_on date not null,
  amount_cents bigint not null,                       -- signed: negative = money out
  description text not null,
  matched_batch_id uuid references payment_batches(id) on delete set null,
  imported_at timestamptz not null default now(),
  import_hash text not null unique
);
create index on bank_statement_lines (org_id, posted_on);

create table audit_events (
  id bigserial primary key,
  org_id uuid not null references orgs(id) on delete restrict,
  actor_id uuid references users(id) on delete restrict,
  action text not null,
  subject_type text not null,
  subject_id uuid,
  detail jsonb not null default '{}',
  ip inet,
  at timestamptz not null default now()
);
create index on audit_events (org_id, at desc);
create index on audit_events (subject_type, subject_id);
create trigger audit_append_only before update or delete on audit_events
  for each row execute function forbid_change();

-- ---------------------------------------------------------------- record retention
-- Policy (decided 2026-11-12):
--   FINANCIAL RECORDS ARE PERMANENT. Receipts, donations, donors, awards, payment batches,
--   payments, per-student lines, vendor bills, W-9s, bank-detail history, statement lines,
--   processor events, the chart of accounts, the journal, postings and the audit log can
--   never be deleted or truncated. Mistakes are fixed by status changes (cancelled, replaced,
--   superseded) or reversing journal entries, never by removing rows.
--   APPLICANT DOCUMENTS are kept at least orgs.retention_years (5) years from the decision
--   (or the round close / start, if never decided), then may be deleted.
-- Files in storage follow the same split; see architecture.md.

create or replace function application_retained_until(p_app uuid) returns timestamptz
language sql stable as $$
  select coalesce(a.decided_at, r.closes_at, a.created_at) + make_interval(years => o.retention_years)
  from applications a join rounds r on r.id = a.round_id join orgs o on o.id = a.org_id
  where a.id = p_app
$$;

create or replace function documents_retention_guard() returns trigger language plpgsql as $$
declare until timestamptz;
begin
  until := application_retained_until(old.application_id);
  if tg_op = 'DELETE' or (new.deleted_at is not null and old.deleted_at is null) then
    if until > now() then
      raise exception 'applicant documents are kept until % (retention policy)', until::date;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.storage_path is distinct from old.storage_path then
    raise exception 'a stored document path is never rewritten';
  end if;
  return new;
end $$;
create trigger application_documents_retention before update or delete on application_documents
  for each row execute function documents_retention_guard();

-- applications with documents can't be deleted at all (they are the decision record)
create or replace function applications_no_delete() returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' then raise exception 'submitted applications are kept (retention policy)'; end if;
  return old;
end $$;
create trigger applications_retention before delete on applications
  for each row execute function applications_no_delete();

create or replace function forbid_delete_permanent() returns trigger language plpgsql as $$
begin
  raise exception '% is a permanent financial record: % not allowed', tg_table_name, tg_op;
end $$;

-- the financial facts of a gift can't change after it succeeds (status may still move to refunded/returned/disputed)
create or replace function donations_facts_guard() returns trigger language plpgsql as $$
begin
  if old.status not in ('pending','processing') and
     (new.amount_cents, new.donor_id, new.method, new.currency, new.tax_year, new.designation_school_id, new.state, new.confirmation_no)
     is distinct from
     (old.amount_cents, old.donor_id, old.method, old.currency, old.tax_year, old.designation_school_id, old.state, old.confirmation_no) then
    raise exception 'the facts of a completed gift are permanent; record a refund or adjustment instead';
  end if;
  if old.fee_cents <> 0 and new.fee_cents is distinct from old.fee_cents then
    raise exception 'a recorded fee is permanent; post an adjustment instead';
  end if;
  return new;
end $$;
create trigger donations_facts_permanent before update on donations
  for each row execute function donations_facts_guard();

-- a payment's amount and payee can't change once its batch has been approved
create or replace function payments_facts_guard() returns trigger language plpgsql as $$
declare st text;
begin
  select status into st from payment_batches where id = old.batch_id;
  if st <> 'draft' and (new.amount_cents, new.payee_id, new.bank_account_id, new.remittance_ref)
     is distinct from (old.amount_cents, old.payee_id, old.bank_account_id, old.remittance_ref) then
    raise exception 'payment facts are permanent once the batch is approved';
  end if;
  return new;
end $$;
create trigger payments_facts_permanent before update on payments
  for each row execute function payments_facts_guard();

do $$ declare t text; begin
  foreach t in array array[
    'donors','donations','donation_refunds','payment_returns','receipts','awards','payment_batches','payments','payment_lines',
    'vendor_bills','w9s','payee_bank_accounts','bank_statement_lines','provider_events',
    'processor_accounts','ledger_accounts','journal_entries','postings','audit_events',
    'confirmation_counters','credit_caps','school_agreements',
    'income_checks','school_verifications','disqualified_matches','committee_recommendations','committee_recusals','disqualified_persons','notification_log',
    'year_end_statements','irs_donor_reports','irs_donor_report_lines','annual_certifications',
    'delivery_proofs','family_confirmations','term_enrollment_confirmations','enrollment_status_changes'] loop
    execute format('create trigger %I_never_delete before delete on %I for each row execute function forbid_delete_permanent()', t, t);
    execute format('create trigger %I_never_truncate before truncate on %I for each statement execute function forbid_delete_permanent()', t, t);
  end loop;
end $$;
-- removing a draft batch line is done by cancelling the batch (status = cancelled), not deleting


-- ---------------------------------------------------------------- updated_at triggers
do $$ declare t text; begin
  foreach t in array array['orgs','users','schools','processor_accounts','donors','donations',
    'rounds','households','students','applications','awards','payees','payment_batches'] loop
    execute format('create trigger %I_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- RLS backstop: deny all from the browser
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t.tablename);
  end loop;
end $$;

create trigger awards_need_committee before insert on awards
  for each row execute function award_needs_committee();
