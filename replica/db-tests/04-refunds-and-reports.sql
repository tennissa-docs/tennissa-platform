\set ON_ERROR_STOP 0
\pset footer off
insert into orgs (id,name,ein,states) values ('00000000-0000-0000-0000-000000000001','Test Fund','12-3456789','{IA}');
insert into users (id,email) values ('00000000-0000-0000-0000-0000000000a1','owner@x.org');
insert into ledger_accounts (key,org_id,name,type,state) values
 ('asset:stripe:25f:IA','00000000-0000-0000-0000-000000000001','Stripe IA 25F','asset','IA'),
 ('income:contributions:25f:IA','00000000-0000-0000-0000-000000000001','Contributions IA','income','IA'),
 ('income:contribution_refunds:25f:IA','00000000-0000-0000-0000-000000000001','Refunds of contributions IA (contra)','income','IA');
insert into donors (id,org_id,first_name,last_name,email,address,donor_number) values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000001','Maya','Reyes','m@x.org','{}',1);
-- 2027 gift
insert into donations (id,org_id,donor_id,amount_cents,method,qualified_25f,state,tax_year,status,succeeded_at,confirmation_no)
 values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1',170000,'card',true,'IA',2027,'succeeded','2027-06-01 15:00Z', next_confirmation_no('00000000-0000-0000-0000-000000000001',2027::smallint));
insert into receipts (donation_id) values ('00000000-0000-0000-0000-0000000000a1');
begin;
insert into journal_entries (id,org_id,occurred_at,memo,source_type,source_id,idempotency_key) values ('00000000-0000-0000-0000-00000000e001','00000000-0000-0000-0000-000000000001','2027-06-01 15:00Z','Gift R-2027-0001','donation','00000000-0000-0000-0000-0000000000a1','evt_gift');
insert into postings (entry_id,account_key,debit_cents) values ('00000000-0000-0000-0000-00000000e001','asset:stripe:25f:IA',170000);
insert into postings (entry_id,account_key,credit_cents) values ('00000000-0000-0000-0000-00000000e001','income:contributions:25f:IA',170000);
commit;
\echo '--- March 2028: refund $500 of the 2027 gift (expect OK, cross_year)'
begin;
insert into donation_refunds (id,org_id,donation_id,kind,amount_cents,refunded_at,counts_in_year,original_tax_year,was_qualified_25f,reason,refund_no,review_required,review_priority,review_status,created_by)
 values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','refund',50000,'2028-03-10 16:00Z',2028,2027,true,'Donor gave twice by mistake',next_number('00000000-0000-0000-0000-000000000001','RF',2028::smallint),true,'cross_year','open','00000000-0000-0000-0000-0000000000a1');
insert into journal_entries (id,org_id,occurred_at,memo,source_type,source_id,idempotency_key) values ('00000000-0000-0000-0000-00000000e002','00000000-0000-0000-0000-000000000001','2028-03-10 16:00Z','Refund RF-2028-0001 of R-2027-0001','donation_refund','00000000-0000-0000-0000-0000000000f1','refund:f1');
insert into postings (entry_id,account_key,debit_cents) values ('00000000-0000-0000-0000-00000000e002','income:contribution_refunds:25f:IA',50000);
insert into postings (entry_id,account_key,credit_cents) values ('00000000-0000-0000-0000-00000000e002','asset:stripe:25f:IA',50000);
update donations set status='partly_refunded' where id='00000000-0000-0000-0000-0000000000a1';
commit;
\echo '--- expect FAIL: refund $1,300 more (would exceed $1,700 with the $500)'
insert into donation_refunds (org_id,donation_id,kind,amount_cents,refunded_at,counts_in_year,original_tax_year,was_qualified_25f,reason,refund_no,review_required,review_priority,review_status)
 values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','refund',130001,now(),2028,2027,true,'x','RF-X',true,'cross_year','open');
\echo '--- expect FAIL: flag it as normal priority though it crosses years'
insert into donation_refunds (org_id,donation_id,kind,amount_cents,refunded_at,counts_in_year,original_tax_year,was_qualified_25f,reason,refund_no,review_required,review_priority,review_status)
 values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','refund',100,now(),2028,2027,true,'x','RF-Y',true,'normal','open');
\echo '--- expect FAIL: skip the review flag on a §25F refund'
insert into donation_refunds (org_id,donation_id,kind,amount_cents,refunded_at,counts_in_year,original_tax_year,was_qualified_25f,reason,refund_no,review_required)
 values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','refund',100,now(),2028,2027,true,'x','RF-Z',false);
\echo '--- expect FAIL: change the refund amount / delete the refund'
update donation_refunds set amount_cents=40000;
delete from donation_refunds;
\echo '--- expect FAIL: close the review without who + note'
update donation_refunds set review_status='resolved';
\echo '--- expect OK: close the review properly'
update donation_refunds set review_status='donor_notified', reviewed_by='00000000-0000-0000-0000-0000000000a1', reviewed_at=now(), review_note='Refund receipt sent; donor told to amend 2027 Form 8911-style claim per CPA';
\echo '--- the original 2027 gift is untouched:'
select confirmation_no, amount_cents, tax_year, status from donations;
\echo '--- 1. Annual Donation Report'
select year, donations, received_cents, qualified_25f_cents, fees_cents from annual_donation_report;
\echo '--- 2. Annual Refund Report'
select year, refunds, refunded_cents, qualified_25f_cents, cross_year_refunds, reviews_open from annual_refund_report;
\echo '--- 3. Lifetime Transaction Ledger'
select occurred_at::date, source_type, refund_no, amount_cents, postings from lifetime_transaction_ledger order by occurred_at;
\echo '--- 90/10 inputs, both bases'
select year, state, donated_cents, donor_refunds_cents from ninety_ten order by year;
