\set ON_ERROR_STOP 0
\pset footer off
insert into orgs (id,name,ein,states) values ('00000000-0000-0000-0000-000000000001','Test Fund','12-3456789','{TN}');
insert into users (id,email) values ('00000000-0000-0000-0000-0000000000a1','o@x.org');
insert into ledger_accounts (key,org_id,name,type,state) values
 ('asset:bank:25f:TN','00000000-0000-0000-0000-000000000001','Bank TN','asset','TN'),
 ('income:contributions:25f:TN','00000000-0000-0000-0000-000000000001','Contrib TN','income','TN'),
 ('income:returned_payments:25f:TN','00000000-0000-0000-0000-000000000001','Returned TN','income','TN'),
 ('expense:scholarships:TN','00000000-0000-0000-0000-000000000001','Scholarships TN','expense','TN'),
 ('liability:awards_payable:TN','00000000-0000-0000-0000-000000000001','Awards payable TN','liability','TN'),
 ('expense:fees:processing','00000000-0000-0000-0000-000000000001','Fees','expense',null);
create function post(k text, at text, src text, dr text, cr text, amt bigint) returns void language plpgsql as $$
declare e uuid := gen_random_uuid(); begin
 insert into journal_entries (id,org_id,occurred_at,memo,source_type,idempotency_key) values (e,'00000000-0000-0000-0000-000000000001',at::timestamptz,k,src,k);
 insert into postings (entry_id,account_key,debit_cents) values (e,dr,amt);
 insert into postings (entry_id,account_key,credit_cents) values (e,cr,amt); end $$;
select post('gifts','2026-06-01 12:00Z','donation','asset:bank:25f:TN','income:contributions:25f:TN',10506800);
select post('fees','2026-06-01 12:00Z','donation_fee','expense:fees:processing','asset:bank:25f:TN',401406);
select post('awards','2026-08-01 12:00Z','award','expense:scholarships:TN','liability:awards_payable:TN',9719150);
\echo '--- a vendor sends $60 back in 2026: expect FAIL with wrong spend-by, OK with Dec 31 2027'
insert into payees (id,org_id,kind,name) values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000001','vendor','ClassTech Devices');
insert into payment_returns (org_id,payee_id,state,amount_cents,received_on,counts_in_year,spend_by,reason,recorded_by) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','TN',6000,'2026-10-01',2026,'2026-12-31','device returned','00000000-0000-0000-0000-0000000000a1');
insert into payment_returns (org_id,payee_id,state,amount_cents,received_on,counts_in_year,spend_by,reason,recorded_by) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','TN',6000,'2026-10-01',2026,'2027-12-31','device returned','00000000-0000-0000-0000-0000000000a1');
select post('returned','2026-10-01 12:00Z','payment_returned','asset:bank:25f:TN','income:returned_payments:25f:TN',6000);
select post('back on award','2026-10-01 12:00Z','returned_to_award','expense:scholarships:TN','liability:awards_payable:TN',6000);
\echo '--- expect FAIL: edit or delete the return'
update payment_returns set amount_cents=1;
delete from payment_returns;
\echo '--- per-state 90% test'
select year, state, donated_cents, returned_cents, receipts_cents, scholarships_cents, ratio_gross_pct, status_gross from ninety_ten_status;
\echo '--- operating (no state)'
select year, operating_cents from ninety_ten where state is null;
