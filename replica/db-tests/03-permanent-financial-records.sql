\set ON_ERROR_STOP 0
insert into orgs (id,name,ein,states) values ('00000000-0000-0000-0000-000000000001','Test Fund','12-3456789','{IA}');
insert into users (id,email) values ('00000000-0000-0000-0000-0000000000a1','a@x.org');
insert into donors (id,org_id,first_name,last_name,email,address,donor_number) values ('00000000-0000-0000-0000-0000000000d9','00000000-0000-0000-0000-000000000001','A','B','d@x.org','{}',1);
insert into donations (id,org_id,donor_id,amount_cents,method,qualified_25f,state,tax_year,status) values ('00000000-0000-0000-0000-0000000000a9','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d9',170000,'ach',true,'IA',2027,'processing');
\echo '--- expect OK: webhook marks it succeeded, sets confirmation no, then records the fee'
update donations set status='succeeded', confirmation_no='R-2027-0001', succeeded_at=now() where id='00000000-0000-0000-0000-0000000000a9';
update donations set fee_cents=500 where id='00000000-0000-0000-0000-0000000000a9';
\echo '--- expect FAIL: change amount after success'
update donations set amount_cents=100 where id='00000000-0000-0000-0000-0000000000a9';
\echo '--- expect FAIL: change fee once recorded'
update donations set fee_cents=600 where id='00000000-0000-0000-0000-0000000000a9';
\echo '--- expect OK: later ACH return changes status'
update donations set status='returned' where id='00000000-0000-0000-0000-0000000000a9';
\echo '--- expect FAIL: delete donation, delete donor, truncate postings, truncate donations'
delete from donations;
delete from donors;
truncate postings cascade;
truncate donations cascade;
\echo '--- expect FAIL: delete a draft batch (cancel instead)'
insert into payment_batches (id,org_id,number,state,effective_date,statement_ref,status,built_by) values ('00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-000000000001',1,'IA','2027-03-01','SCHOL 0001','draft','00000000-0000-0000-0000-0000000000a1');
delete from payment_batches;
\echo '--- expect OK: cancel it'
update payment_batches set status='cancelled';
-- (auditor access rules are tested in 06-auditor-role.sql)
