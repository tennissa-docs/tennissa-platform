\set ON_ERROR_STOP 0
insert into orgs (id,name,ein,states) values ('00000000-0000-0000-0000-000000000001','Test Fund','12-3456789','{TN}');
insert into users (id,email) values ('00000000-0000-0000-0000-0000000000a1','owner@x.org'),('00000000-0000-0000-0000-0000000000a2','principal@school.org'),('00000000-0000-0000-0000-0000000000a3','other@x.org');
insert into schools (id,org_id,name) values ('00000000-0000-0000-0000-0000000005c1','00000000-0000-0000-0000-000000000001','Al-Noor Academy');
insert into memberships (user_id,org_id,role) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','owner');
insert into memberships (user_id,org_id,school_id,role) values ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000005c1','school_admin');
insert into rounds (id,org_id,name,school_year,opens_at) values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','R','2027-28','2027-01-01');
insert into households (id,org_id,address,state,county_fips) values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000001','{}','TN','47037');
insert into students (id,household_id,first_name,last_name) values ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f1','Z','B'),('00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-0000000000f1','Y','B');
insert into applications (id,org_id,round_id,student_id,household_id,school_id,grade,household_size,qualify_by,status) values
 ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000005c1','9',4,'income_docs','needs_school'),
 ('00000000-0000-0000-0000-0000000000f4','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000005c1','6',4,'income_docs','needs_school');
\echo '--- expect FAIL: someone not at the school confirms in the portal'
insert into school_verifications (application_id,result,by_user) values ('00000000-0000-0000-0000-0000000000f3','verified','00000000-0000-0000-0000-0000000000a3');
\echo '--- expect OK: the principal confirms in the portal'
insert into school_verifications (application_id,result,by_user) values ('00000000-0000-0000-0000-0000000000f3','verified','00000000-0000-0000-0000-0000000000a2');
\echo '--- expect FAIL: owner records on behalf with no note or contact'
insert into school_verifications (application_id,result,by_user,method,on_behalf) values ('00000000-0000-0000-0000-0000000000f4','verified','00000000-0000-0000-0000-0000000000a1','phone',true);
\echo '--- expect FAIL: school staff marks "on behalf" (not an owner/admin)'
insert into school_verifications (application_id,result,by_user,method,on_behalf,note,school_contact_name) values ('00000000-0000-0000-0000-0000000000f4','verified','00000000-0000-0000-0000-0000000000a2','phone',true,'Confirmed by phone with the registrar','Registrar');
\echo '--- expect OK: owner records a phone confirmation with note and contact'
insert into school_verifications (application_id,result,by_user,method,on_behalf,note,school_contact_name) values ('00000000-0000-0000-0000-0000000000f4','verified','00000000-0000-0000-0000-0000000000a1','phone',true,'Confirmed by phone with the registrar, Jan 12','Fatima Hassan, registrar');
\echo '--- expect FAIL: edit or delete a confirmation'
update school_verifications set result='declined';
delete from school_verifications;
select method, on_behalf, school_contact_name from school_verifications order by on_behalf;
