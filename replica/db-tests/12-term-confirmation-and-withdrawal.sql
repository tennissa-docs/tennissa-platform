\set ON_ERROR_STOP 0
\set QUIET on
insert into orgs (id,name,ein,states) values ('00000000-0000-0000-0000-000000000001','T','12-3456789','{TN}');
insert into users (id,email) values ('00000000-0000-0000-0000-0000000000a1','owner@x.org'),('00000000-0000-0000-0000-0000000000a2','admin@x.org'),('00000000-0000-0000-0000-0000000000a3','principal@s.org'),('00000000-0000-0000-0000-0000000000a4','parent@x.org');
insert into memberships (user_id,org_id,role) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','owner'),('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000001','admin');
insert into schools (id,org_id,name) values ('00000000-0000-0000-0000-0000000005c1','00000000-0000-0000-0000-000000000001','Al-Noor Academy');
insert into memberships (user_id,org_id,school_id,role) values ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000005c1','school_admin');
insert into rounds (id,org_id,name,school_year,opens_at) values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','R','2027-28','2027-01-01');
insert into households (id,org_id,address,state,county_fips) values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000001','{}','TN','47037');
insert into students (id,household_id,first_name,last_name) values ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f1','Leo','T');
insert into applications (id,org_id,round_id,student_id,household_id,school_id,grade,household_size,qualify_by,status) values ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000005c1','9',4,'income_docs','ready');
insert into awards (id,org_id,application_id,school_id,state,amount_cents,awarded_by) values ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000005c1','TN',450000,'00000000-0000-0000-0000-0000000000a1');
insert into payees (id,org_id,kind,school_id,name) values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000001','school','00000000-0000-0000-0000-0000000005c1','Al-Noor Academy');
insert into payees (id,org_id,kind,name) values ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-000000000001','vendor','Bright Path Tutoring');
insert into payee_bank_accounts (id,payee_id,routing_ciphertext,account_ciphertext,account_last4,routing_last4,account_type,status,entered_by,approved_by,callback_note) values
 ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000b1','x','y','1111','0013','checking','approved','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1','called'),
 ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000b2','x','y','2222','0013','checking','approved','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1','called');
insert into payment_batches (id,org_id,number,state,effective_date,statement_ref,built_by) values ('00000000-0000-0000-0000-00000000ba01','00000000-0000-0000-0000-000000000001',1,'TN','2027-09-01','SCHOL 0001','00000000-0000-0000-0000-0000000000a2');
insert into payments (id,batch_id,payee_id,bank_account_id,amount_cents,remittance_ref) values
 ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-00000000ba01','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1',225000,'P0001-001'),
 ('00000000-0000-0000-0000-00000000aa02','00000000-0000-0000-0000-00000000ba01','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000c2',120000,'P0001-002');
insert into vendor_bills (id,award_id,payee_id,amount_cents,expense_type,description,not_related_attested,recorded_by) values ('00000000-0000-0000-0000-0000000000bb','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000b2',120000,'Tutoring','Math tutoring, 24 sessions',true,'00000000-0000-0000-0000-0000000000a2');
\set QUIET off
\pset footer off
insert into school_verifications (application_id,result,by_user) values ('00000000-0000-0000-0000-0000000000f3','verified','00000000-0000-0000-0000-0000000000a3');
insert into delivery_proofs (org_id,award_id,term,kind,file_path,description,recorded_by) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000aa','2027-28 Fall','tuition_statement','p/fall.pdf','Fall statement','00000000-0000-0000-0000-0000000000a2'),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000aa','2027-28 Spring','tuition_statement','p/spring.pdf','Spring statement','00000000-0000-0000-0000-0000000000a2');
\echo '--- FAIL: statement on file, but no per-term enrollment confirmation'
insert into payment_lines (payment_id,award_id,amount_cents,term) values ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000aa',225000,'2027-28 Fall');
\echo '--- FAIL: a non-staff user confirms the term in the portal'
insert into term_enrollment_confirmations (award_id,term,result,by_user) values ('00000000-0000-0000-0000-0000000000aa','2027-28 Fall','enrolled','00000000-0000-0000-0000-0000000000a4');
\echo '--- OK: principal confirms Fall; Fall payment goes in'
insert into term_enrollment_confirmations (award_id,term,result,by_user) values ('00000000-0000-0000-0000-0000000000aa','2027-28 Fall','enrolled','00000000-0000-0000-0000-0000000000a3');
insert into payment_lines (payment_id,award_id,amount_cents,term) values ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000aa',225000,'2027-28 Fall');
update payment_batches set status='sent', sent_at='2027-09-01 15:00Z';
\echo '--- the school portal: scholarship students'
select first_name, grade, awarded_cents, paid_cents, last_term_confirmed, status_change from school_scholarship_students;
\echo '--- school reports Leo withdrew effective Aug 25 (before the Fall payment went out)'
insert into enrollment_status_changes (org_id,award_id,school_id,student_id,change,effective_date,reported_by,note) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000005c1','00000000-0000-0000-0000-0000000000f2','withdrew','2027-08-25','00000000-0000-0000-0000-0000000000a3','Family moved out of state');
insert into payment_batches (id,org_id,number,state,effective_date,statement_ref,built_by) values ('00000000-0000-0000-0000-00000000ba02','00000000-0000-0000-0000-000000000001',2,'TN','2028-01-10','SCHOL 0002','00000000-0000-0000-0000-0000000000a2');
insert into payments (id,batch_id,payee_id,bank_account_id,amount_cents,remittance_ref) values ('00000000-0000-0000-0000-00000000aa03','00000000-0000-0000-0000-00000000ba02','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1',225000,'P0002-001');
insert into term_enrollment_confirmations (award_id,term,result,by_user,on_behalf,method,note) values ('00000000-0000-0000-0000-0000000000aa','2027-28 Spring','enrolled','00000000-0000-0000-0000-0000000000a1',true,'phone','Registrar said enrolled (before withdrawal was known)');
\echo '--- FAIL: Spring payment after the withdrawal (even with a statement and a confirmation)'
insert into payment_lines (payment_id,award_id,amount_cents,term) values ('00000000-0000-0000-0000-00000000aa03','00000000-0000-0000-0000-0000000000aa',225000,'2027-28 Spring');
\echo '--- flagged for a return from the school: payment sent on/after the date the student left'
select change, effective_date, term, amount_cents, sent_at::date from payments_after_leaving;
\echo '--- FAIL: edit the report; OK: record the admin follow-up once; FAIL: change the follow-up'
update enrollment_status_changes set effective_date='2027-12-31';
update enrollment_status_changes set admin_action='returned_to_pool', admin_action_by='00000000-0000-0000-0000-0000000000a1', admin_action_at=now();
update enrollment_status_changes set admin_action='moved_to_new_school';
