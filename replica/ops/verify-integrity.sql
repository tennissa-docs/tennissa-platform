-- Integrity checks: run after a restore drill (and any time). Every row must say ok = true.
-- psql -d <restored db> -f replica/ops/verify-integrity.sql
\pset footer off
with checks as (
  select 'trial balance is zero' as rule,
         coalesce(sum(debit_cents),0) = coalesce(sum(credit_cents),0) as ok,
         format('debits %s, credits %s', coalesce(sum(debit_cents),0), coalesce(sum(credit_cents),0)) as detail
  from postings
  union all
  select 'every journal entry balances, with 2+ postings',
         count(*) = 0, format('%s unbalanced entries', count(*))
  from (select entry_id from postings group by entry_id
        having sum(debit_cents) <> sum(credit_cents) or count(*) < 2) x
  union all
  select 'no journal entry without postings',
         count(*) = 0, format('%s empty entries', count(*))
  from journal_entries j where not exists (select 1 from postings p where p.entry_id = j.id)
  union all
  select 'every succeeded gift has a confirmation number',
         count(*) = 0, format('%s missing', count(*))
  from donations where status in ('succeeded','partly_refunded','refunded') and confirmation_no is null
  union all
  select 'every succeeded gift has a receipt',
         count(*) = 0, format('%s missing', count(*))
  from donations d where d.succeeded_at is not null and not exists (select 1 from receipts r where r.donation_id = d.id)
  union all
  select 'confirmation numbers have no duplicates',
         count(*) = 0, format('%s duplicates', count(*))
  from (select confirmation_no from donations where confirmation_no is not null group by 1 having count(*) > 1) x
  union all
  select 'refunds never exceed their gift',
         count(*) = 0, format('%s over-refunded gifts', count(*))
  from (select d.id from donations d join donation_refunds r on r.donation_id = d.id
        group by d.id, d.amount_cents having sum(r.amount_cents) > d.amount_cents) x
  union all
  select 'payment lines never exceed their award',
         count(*) = 0, format('%s over-paid awards', count(*))
  from (select a.id from awards a join payment_lines pl on pl.award_id = a.id
        join payments pm on pm.id = pl.payment_id join payment_batches b on b.id = pm.batch_id
        where b.status in ('sent','settled') group by a.id, a.amount_cents
        having sum(pl.amount_cents) > a.amount_cents) x
  union all
  select 'append-only protections are switched on',
         count(*) = 0, format('%s protective triggers disabled: %s', count(*), string_agg(tgname, ', '))
  from pg_trigger where not tgisinternal and tgenabled = 'D'
  union all
  select 'row level security is on for every table',
         count(*) = 0, format('%s tables without RLS: %s', count(*), string_agg(relname, ', '))
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
)
select rule, ok, detail from checks;

-- row counts and checksums of the financial tables, to compare with the source database
select 'donations' as table_name, count(*) as rows, md5(coalesce(string_agg(id::text || amount_cents || status, ',' order by id), '')) as checksum from donations
union all select 'donation_refunds', count(*), md5(coalesce(string_agg(id::text || amount_cents, ',' order by id), '')) from donation_refunds
union all select 'receipts', count(*), md5(coalesce(string_agg(id::text || donation_id, ',' order by id), '')) from receipts
union all select 'journal_entries', count(*), md5(coalesce(string_agg(id::text || idempotency_key, ',' order by id), '')) from journal_entries
union all select 'postings', count(*), md5(coalesce(string_agg(id::text || account_key || debit_cents || credit_cents, ',' order by id), '')) from postings
union all select 'awards', count(*), md5(coalesce(string_agg(id::text || amount_cents, ',' order by id), '')) from awards
union all select 'payments', count(*), md5(coalesce(string_agg(id::text || amount_cents || status, ',' order by id), '')) from payments
union all select 'audit_events', count(*), md5(coalesce(string_agg(id::text || action, ',' order by id), '')) from audit_events;
