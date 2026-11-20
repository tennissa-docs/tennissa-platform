\set ON_ERROR_STOP 0
insert into orgs (id,name,ein,states) values ('00000000-0000-0000-0000-000000000001','Test Fund','12-3456789','{IA}');
insert into users (id,email) values ('00000000-0000-0000-0000-0000000000a1','a@x.org');
insert into schools (id,org_id,name) values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000001','S');
insert into rounds (id,org_id,name,school_year,opens_at) values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','R','2027-28','2027-01-01');
insert into rounds (id,org_id,name,school_year,opens_at) values ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000001','Old','2021-22','2021-01-01');
insert into households (id,org_id,address,state,county_fips) values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000001','{}','IA','19013');
insert into students (id,household_id,first_name,last_name) values ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f1','A','B');
insert into applications (id,org_id,round_id,student_id,household_id,school_id,grade,household_size,qualify_by,status,decided_at)
 values ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000c1','9',4,'income_docs','approved', now() - interval '1 year'),
        ('00000000-0000-0000-0000-0000000000f4','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000c1','9',4,'income_docs','approved', now() - interval '5 years 1 day');
update applications set round_id = round_id where false;
\echo '(second application needs its own round: unique round+student)'
insert into application_documents (id,application_id,kind,storage_path,byte_size,content_type,kms_key_id,wrapped_dek,nonce,plaintext_sha256,uploaded_by) values
 ('00000000-0000-0000-0000-00000000d001','00000000-0000-0000-0000-0000000000f3','w2','a/w2.png',1000,'image/png','kms/doc-key','\x01','\x000000000000000000000000','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-00000000d002','00000000-0000-0000-0000-0000000000f4','w2','b/w2.png',1000,'image/png','kms/doc-key','\x01','\x000000000000000000000000','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','00000000-0000-0000-0000-0000000000a1');
\echo '--- expect FAIL: delete a document decided 1 year ago'
delete from application_documents where id='00000000-0000-0000-0000-00000000d001';
\echo '--- expect FAIL: soft-delete it'
update application_documents set deleted_at=now() where id='00000000-0000-0000-0000-00000000d001';
\echo '--- expect OK: document decided 5 years + 1 day ago'
update application_documents set deleted_at=now() where id='00000000-0000-0000-0000-00000000d002';
\echo '--- expect FAIL: delete a decided application'
delete from applications where id='00000000-0000-0000-0000-0000000000f3';
\echo '--- batches: draft delete OK, sent delete FAIL'
insert into payment_batches (id,org_id,number,state,effective_date,statement_ref,status,built_by) values
 ('00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-000000000001',1,'IA','2027-03-01','SCHOL 0001','draft','00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-00000000b002','00000000-0000-0000-0000-000000000001',2,'IA','2027-03-01','SCHOL 0002','sent','00000000-0000-0000-0000-0000000000a1');
delete from payment_batches where id='00000000-0000-0000-0000-00000000b001';
delete from payment_batches where id='00000000-0000-0000-0000-00000000b002';
\echo '--- expect FAIL: lowering retention below 5 years'
update orgs set retention_years = 3;
\echo '--- receipt PDF: set once OK, then change FAIL'
insert into donors (id,org_id,first_name,last_name,email,address,donor_number) values ('00000000-0000-0000-0000-0000000000d9','00000000-0000-0000-0000-000000000001','A','B','d@x.org','{}',1);
insert into donations (id,org_id,donor_id,amount_cents,method,qualified_25f,state,tax_year) values ('00000000-0000-0000-0000-0000000000a9','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d9',170000,'ach',true,'IA',2027);
insert into receipts (donation_id) values ('00000000-0000-0000-0000-0000000000a9');
update receipts set pdf_path='r/1.pdf';
update receipts set pdf_path=null;
