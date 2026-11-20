\set ON_ERROR_STOP 0
\pset footer off
insert into orgs (id,name,ein,states) values ('00000000-0000-0000-0000-000000000001','T','12-3456789','{TN}');
insert into users (id,email) values ('00000000-0000-0000-0000-0000000000a1','owner@x.org');
insert into donors (id,org_id,first_name,last_name,email,address,donor_number) values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000001','Maya','Reyes','m@x.org','{}',1);
insert into ledger_accounts (key,org_id,name,type) values ('asset:x','00000000-0000-0000-0000-000000000001','X','asset'),('income:contributions:x','00000000-0000-0000-0000-000000000001','Y','income');
set role app_runtime;
\echo '--- OK: the app can add and update records'
insert into donations (id,org_id,donor_id,amount_cents,method,qualified_25f,state,tax_year) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1',170000,'ach',true,'TN',2027);
update donations set status='processing' where id='00000000-0000-0000-0000-0000000000a1';
insert into sign_in_events (org_id,user_id,email,event,ip,user_agent) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','owner@x.org','signed_in','203.0.113.7','Safari');
insert into sign_in_events (org_id,user_id,email,event,ip) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','owner@x.org','timed_out','203.0.113.7');
\echo '--- FAIL x7: delete, truncate, switch off a protection, change structure, drop, edit the sign-in log, edit a posting'
delete from donations;
truncate postings;
alter table donations disable trigger donations_lock_qualified;
alter table donations add column hack text;
drop table audit_events;
update sign_in_events set ip='10.0.0.1';
update postings set debit_cents = 0;
reset role;
\echo '--- the sign-in log'
select event, host(ip) as ip, user_agent from sign_in_events order by id;
\echo '--- FAIL: session timeout outside 5-60 minutes'
update orgs set session_idle_minutes = 240;
