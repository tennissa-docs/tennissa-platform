\set ON_ERROR_STOP 0
\pset footer off
insert into orgs (id,name,ein,states,min_committee_recommendations) values ('00000000-0000-0000-0000-000000000001','Test Fund','12-3456789','{TN}',2);
insert into users (id,email,first_name,last_name) values
 ('00000000-0000-0000-0000-0000000000a1','owner@x.org','Olivia','Owner'),
 ('00000000-0000-0000-0000-0000000000c1','amina@x.org','Amina','Khan'),
 ('00000000-0000-0000-0000-0000000000c2','yusuf@x.org','Yusuf','Ali'),
 ('00000000-0000-0000-0000-0000000000c3','sara@school.org','Sara','Noor');
insert into memberships (user_id,org_id,role) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','owner');
insert into schools (id,org_id,name) values ('00000000-0000-0000-0000-0000000005c1','00000000-0000-0000-0000-000000000001','Al-Noor Academy');
\echo '--- three committee members; Sara is also staff at the school'
insert into memberships (user_id,org_id,role) values
 ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000001','committee_member'),
 ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-000000000001','committee_member'),
 ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-000000000001','committee_member');
insert into memberships (user_id,org_id,school_id,role) values ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000005c1','school_admin');
\echo '--- they were added to the disqualified-persons list automatically:'
select full_name, role from disqualified_persons order by full_name;
insert into rounds (id,org_id,name,school_year,opens_at) values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','R','2027-28','2027-01-01');
insert into households (id,org_id,address,state,county_fips) values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000001','{}','TN','47037');
insert into students (id,household_id,first_name,last_name) values ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f1','Zayd','B');
insert into applications (id,org_id,round_id,student_id,household_id,school_id,grade,household_size,qualify_by,status)
 values ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000005c1','9',4,'income_docs','ready');
\echo '--- expect FAIL: Sara (staff at that school) recommends'
insert into committee_recommendations (application_id,member_user_id,recommendation,suggested_amount_cents,comment) values ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000c3','approve',300000,'x');
\echo '--- expect FAIL: approve without an amount'
insert into committee_recommendations (application_id,member_user_id,recommendation,comment) values ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000c1','approve','x');
\echo '--- expect OK: Amina recommends'
insert into committee_recommendations (application_id,member_user_id,recommendation,suggested_amount_cents,score,comment) values ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000c1','approve',300000,4,'Clear income check, renewal');
\echo '--- expect FAIL: owner awards with only 1 of 2 required recommendations'
insert into awards (org_id,application_id,school_id,state,amount_cents,awarded_by) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000005c1','TN',300000,'00000000-0000-0000-0000-0000000000a1');
\echo '--- expect OK: Yusuf recommends'
insert into committee_recommendations (application_id,member_user_id,recommendation,suggested_amount_cents,score,comment) values ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000c2','approve',250000,4,'Agree; suggest 2,500');
\echo '--- expect FAIL: a committee member tries to make the award'
insert into awards (org_id,application_id,school_id,state,amount_cents,awarded_by) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000005c1','TN',300000,'00000000-0000-0000-0000-0000000000c1');
\echo '--- expect OK: owner decides'
insert into awards (org_id,application_id,school_id,state,amount_cents,awarded_by) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000005c1','TN',275000,'00000000-0000-0000-0000-0000000000a1');
update applications set status='approved', decided_at=now() where id='00000000-0000-0000-0000-0000000000f3';
\echo '--- expect FAIL: change a recommendation after the decision; delete one'
update committee_recommendations set comment='changed' where member_user_id='00000000-0000-0000-0000-0000000000c1';
delete from committee_recommendations;
