\set ON_ERROR_STOP 0
insert into orgs (id,name,ein,states) values ('00000000-0000-0000-0000-000000000001','Test Fund','12-3456789','{IA}');
insert into users (id,email) values ('00000000-0000-0000-0000-0000000000a1','a@x.org'),('00000000-0000-0000-0000-0000000000a2','b@x.org');
insert into ledger_accounts (key,org_id,name,type,state) values
 ('asset:stripe:25f:IA','00000000-0000-0000-0000-000000000001','Stripe balance, IA §25F','asset','IA'),
 ('income:contributions:25f:IA','00000000-0000-0000-0000-000000000001','Qualified contributions IA','income','IA'),
 ('expense:fees:processing','00000000-0000-0000-0000-000000000001','Processing fees','expense',null);
-- 1 balanced donation + fee
begin;
insert into journal_entries (id,org_id,occurred_at,memo,source_type,idempotency_key) values ('00000000-0000-0000-0000-00000000e001','00000000-0000-0000-0000-000000000001','2027-01-01','gift','donation','evt_1:gift');
insert into postings (entry_id,account_key,debit_cents) values ('00000000-0000-0000-0000-00000000e001','asset:stripe:25f:IA',170000);
insert into postings (entry_id,account_key,credit_cents) values ('00000000-0000-0000-0000-00000000e001','income:contributions:25f:IA',170000);
commit;
\echo '--- expect FAIL: unbalanced entry'
begin;
insert into journal_entries (id,org_id,occurred_at,memo,source_type,idempotency_key) values ('00000000-0000-0000-0000-00000000e002','00000000-0000-0000-0000-000000000001','2027-01-01','bad','adjustment','k2');
insert into postings (entry_id,account_key,debit_cents) values ('00000000-0000-0000-0000-00000000e002','asset:stripe:25f:IA',500);
insert into postings (entry_id,account_key,credit_cents) values ('00000000-0000-0000-0000-00000000e002','income:contributions:25f:IA',400);
commit;
\echo '--- expect FAIL: duplicate webhook (same idempotency key)'
insert into journal_entries (org_id,occurred_at,memo,source_type,idempotency_key) values ('00000000-0000-0000-0000-000000000001','2027-01-01','gift','donation','evt_1:gift');
\echo '--- expect FAIL: editing a posting'
update postings set debit_cents = 1 where id = 1;
\echo '--- expect FAIL: deleting an entry'
delete from journal_entries;
\echo '--- trial balance + balances'
select * from trial_balance; select key, balance_cents from account_balances order by key;
\echo '--- confirmation numbers'
select next_confirmation_no('00000000-0000-0000-0000-000000000001',2027::smallint), next_confirmation_no('00000000-0000-0000-0000-000000000001',2027::smallint), next_confirmation_no('00000000-0000-0000-0000-000000000001',2028::smallint);
\echo '--- expect FAIL: change §25F designation'
insert into donors (id,org_id,first_name,last_name,email,address,donor_number) values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000001','A','B','d@x.org','{}',1);
insert into donations (id,org_id,donor_id,amount_cents,method,qualified_25f,state,tax_year) values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1',170000,'ach',true,'IA',2027);
update donations set qualified_25f=false where id='00000000-0000-0000-0000-0000000000f1';
\echo '--- receipt: fill emailed_at OK, change issued_at FAIL, delete FAIL'
insert into receipts (donation_id) values ('00000000-0000-0000-0000-0000000000f1');
update receipts set emailed_at=now();
update receipts set issued_at=now()-interval '1 day';
delete from receipts;
\echo '--- expect FAIL: bank details approved by the person who entered them'
insert into payees (id,org_id,kind,name) values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000001','vendor','Tutor');
insert into payee_bank_accounts (payee_id,routing_ciphertext,account_ciphertext,account_last4,routing_last4,account_type,status,entered_by,approved_by,callback_note) values ('00000000-0000-0000-0000-0000000000b1','x','y','4473','0013','checking','approved','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','called');
\echo '--- expect OK: approved by someone else'
insert into payee_bank_accounts (payee_id,routing_ciphertext,account_ciphertext,account_last4,routing_last4,account_type,status,entered_by,approved_by,callback_note) values ('00000000-0000-0000-0000-0000000000b1','x','y','4473','0013','checking','approved','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','called the number on file');
