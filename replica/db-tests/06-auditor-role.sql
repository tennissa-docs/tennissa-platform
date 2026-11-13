\set ON_ERROR_STOP 0
insert into orgs (id,name,ein,states) values ('00000000-0000-0000-0000-000000000001','Test Fund','12-3456789','{TN}');
insert into users (id,email) values ('00000000-0000-0000-0000-0000000000a1','owner@x.org'),('00000000-0000-0000-0000-0000000000a2','admin@x.org'),('00000000-0000-0000-0000-0000000000a3','cpa@firm.com');
insert into memberships (user_id,org_id,role) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','owner'),('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000001','admin');
\echo '--- expect FAIL: auditor with no end date'
insert into memberships (user_id,org_id,role,granted_by) values ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000001','auditor','00000000-0000-0000-0000-0000000000a1');
\echo '--- expect FAIL: auditor access longer than a year'
insert into memberships (user_id,org_id,role,granted_by,expires_at) values ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000001','auditor','00000000-0000-0000-0000-0000000000a1',now()+interval '2 years');
\echo '--- expect FAIL: an admin (not owner) grants auditor access'
insert into memberships (user_id,org_id,role,granted_by,expires_at) values ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000001','auditor','00000000-0000-0000-0000-0000000000a2',now()+interval '90 days');
\echo '--- expect FAIL: document access on a non-auditor'
update memberships set can_view_applicant_documents=true where role='admin';
\echo '--- expect OK: owner grants 90 days, documents off'
insert into memberships (user_id,org_id,role,granted_by,expires_at,auditor_firm) values ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000001','auditor','00000000-0000-0000-0000-0000000000a1',now()+interval '90 days','Smith & Co CPAs');
select role, auditor_firm, can_view_applicant_documents, expires_at::date - now()::date as days_left from memberships where role='auditor';
