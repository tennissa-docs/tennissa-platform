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
\echo '=== SCHOOL ==='
\echo '--- FAIL: pay school before enrollment confirmed'
insert into payment_lines (payment_id,award_id,amount_cents,term) values ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000aa',225000,'2027-28 Fall');
insert into school_verifications (application_id,result,by_user) values ('00000000-0000-0000-0000-0000000000f3','verified','00000000-0000-0000-0000-0000000000a3');
\echo '--- FAIL: confirmed, but no tuition statement for the term'
insert into payment_lines (payment_id,award_id,amount_cents,term) values ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000aa',225000,'2027-28 Fall');
insert into delivery_proofs (org_id,award_id,term,kind,file_path,description,recorded_by) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000aa','2027-28 Fall','tuition_statement','p/fall.pdf','Fall tuition statement, $2,250','00000000-0000-0000-0000-0000000000a2');
\echo '--- FAIL: statement is for Fall, line is for Spring'
insert into payment_lines (payment_id,award_id,amount_cents,term) values ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000aa',225000,'2027-28 Spring');
insert into term_enrollment_confirmations (award_id,term,result,by_user) values ('00000000-0000-0000-0000-0000000000aa','2027-28 Fall','enrolled','00000000-0000-0000-0000-0000000000a3');
\echo '--- OK: Fall line with Fall statement'
insert into payment_lines (payment_id,award_id,amount_cents,term) values ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000aa',225000,'2027-28 Fall');
\echo '=== VENDOR ==='
\echo '--- FAIL: no invoice'
insert into payment_lines (payment_id,award_id,vendor_bill_id,amount_cents,description) values ('00000000-0000-0000-0000-00000000aa02','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000bb',120000,'Tutoring');
insert into delivery_proofs (org_id,vendor_bill_id,kind,file_path,description,recorded_by) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000bb','invoice','p/inv.pdf','Invoice #1042','00000000-0000-0000-0000-0000000000a2');
\echo '--- FAIL: invoice but no proof of delivery'
insert into payment_lines (payment_id,award_id,vendor_bill_id,amount_cents,description) values ('00000000-0000-0000-0000-00000000aa02','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000bb',120000,'Tutoring');
insert into delivery_proofs (org_id,vendor_bill_id,kind,file_path,description,service_from,service_to,recorded_by) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000bb','session_log','p/log.pdf','24 sessions signed by tutor','2027-01-06','2027-03-28','00000000-0000-0000-0000-0000000000a2');
\echo '--- with family confirmation required:'
update orgs set require_family_confirmation = true;
insert into family_confirmations (id,vendor_bill_id,guardian_user_id,token_hash,question,expires_at) values ('00000000-0000-0000-0000-00000000fc01','00000000-0000-0000-0000-0000000000bb','00000000-0000-0000-0000-0000000000a4','h1','Did Leo receive these 24 tutoring sessions?',now()+interval '14 days');
\echo '--- FAIL: parent has not answered yet'
insert into payment_lines (payment_id,award_id,vendor_bill_id,amount_cents,description) values ('00000000-0000-0000-0000-00000000aa02','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000bb',120000,'Tutoring');
update family_confirmations set response='disputed', comment='Only 18 sessions happened', responded_at=now();
\echo '--- FAIL: parent disputed'
insert into payment_lines (payment_id,award_id,vendor_bill_id,amount_cents,description) values ('00000000-0000-0000-0000-00000000aa02','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000bb',120000,'Tutoring');
\echo '--- FAIL: change the parent answer'
update family_confirmations set response='confirmed';
update family_confirmations set dispute_resolved_by='00000000-0000-0000-0000-0000000000a1', dispute_resolution='Tutor provided 24 signed attendance sheets; parent agreed', dispute_resolved_at=now();
insert into family_confirmations (vendor_bill_id,guardian_user_id,token_hash,question,expires_at,response,responded_at) values ('00000000-0000-0000-0000-0000000000bb','00000000-0000-0000-0000-0000000000a4','h2','Do you now confirm 24 sessions?',now()+interval '14 days','confirmed',now());
\echo '--- OK: dispute resolved and parent confirmed'
insert into payment_lines (payment_id,award_id,vendor_bill_id,amount_cents,description) values ('00000000-0000-0000-0000-00000000aa02','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000bb',120000,'Tutoring');
\echo '--- FAIL: edit or delete a proof'
update delivery_proofs set description='x';
delete from delivery_proofs;
