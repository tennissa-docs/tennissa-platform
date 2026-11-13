\set ON_ERROR_STOP 0
\pset footer off
insert into orgs (id,name,ein,states) values ('00000000-0000-0000-0000-000000000001','Test Fund','12-3456789','{TN}');
insert into users (id,email) values ('00000000-0000-0000-0000-0000000000a1','owner@x.org'),('00000000-0000-0000-0000-0000000000a2','admin@x.org');
insert into memberships (user_id,org_id,role) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','owner'),('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000001','admin');
insert into donors (id,org_id,first_name,last_name,email,address,donor_number) values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000001','Maya','Reyes','m@x.org','{"city":"Nashville"}',1);
insert into donations (id,org_id,donor_id,amount_cents,method,qualified_25f,state,tax_year,status,succeeded_at) values
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1',170000,'ach',true,'TN',2027,'succeeded','2027-03-01'),
 ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1',10000,'card',false,null,2027,'succeeded','2027-05-01');
insert into donation_refunds (org_id,donation_id,kind,amount_cents,refunded_at,counts_in_year,original_tax_year,was_qualified_25f,reason,refund_no,review_required,review_priority,review_status)
 values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','refund',20000,'2027-09-01',2027,2027,true,'partial refund','RF-2027-0001',true,'normal','open');
\echo '--- donor totals for 2027 (what the statement and IRS report show)'
select tax_year, gift_count, qualified_cents, general_cents, refunded_qualified_cents from donor_annual_totals;
\echo '--- Jan 31 statement issued; expect FAIL editing its amount; expect OK emailing it'
insert into year_end_statements (id,org_id,donor_id,tax_year,donor_number,donor_name,donor_address,gift_count,qualified_cents,general_cents,refunded_qualified_cents,sgo_ein)
 values ('00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1',2027,1,'Maya Reyes','{}',2,170000,10000,20000,'12-3456789');
update year_end_statements set qualified_cents=150000;
update year_end_statements set emailed_at=now(), pdf_path='s/1.pdf';
\echo '--- expect FAIL: corrected statement without a reason; OK with one'
insert into year_end_statements (org_id,donor_id,tax_year,donor_number,donor_name,donor_address,gift_count,qualified_cents,general_cents,refunded_qualified_cents,sgo_ein,supersedes_id)
 values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1',2027,1,'Maya Reyes','{}',2,170000,10000,50000,'12-3456789','00000000-0000-0000-0000-00000000c001');
insert into year_end_statements (org_id,donor_id,tax_year,donor_number,donor_name,donor_address,gift_count,qualified_cents,general_cents,refunded_qualified_cents,sgo_ein,supersedes_id,correction_reason)
 values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1',2027,1,'Maya Reyes','{}',2,170000,10000,50000,'12-3456789','00000000-0000-0000-0000-00000000c001','Further $300 refunded Feb 2028');
\echo '--- Feb 28 IRS report: expect FAIL submitting without the IRS confirmation; OK with it; FAIL changing after'
insert into irs_donor_reports (id,org_id,tax_year,donor_count,qualified_total_cents,generated_by) values ('00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-000000000001',2027,1,150000,'00000000-0000-0000-0000-0000000000a2');
insert into irs_donor_report_lines (report_id,donor_id,donor_number,donor_name,donor_address,qualified_cents,refunded_qualified_cents) values ('00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-0000000000d1',1,'Maya Reyes','{}',170000,20000);
update irs_donor_reports set status='submitted', submitted_by='00000000-0000-0000-0000-0000000000a1', submitted_at=now();
update irs_donor_reports set status='submitted', submitted_by='00000000-0000-0000-0000-0000000000a1', submitted_at=now(), irs_confirmation='SGO-2027-88412';
update irs_donor_reports set irs_confirmation='X';
update irs_donor_reports set qualified_total_cents=1;
update irs_donor_report_lines set qualified_cents=1;
delete from irs_donor_reports;
\echo '--- payout progress: $100,000 received in 2027 and $60,000 in 2028; $95,000 paid to schools so far'
insert into ledger_accounts (key,org_id,name,type,state) values
 ('asset:bank:25f:TN','00000000-0000-0000-0000-000000000001','Bank','asset','TN'),
 ('income:contributions:25f:TN','00000000-0000-0000-0000-000000000001','Contrib','income','TN'),
 ('liability:awards_payable:TN','00000000-0000-0000-0000-000000000001','Payable','liability','TN'),
 ('asset:clearing:disbursements','00000000-0000-0000-0000-000000000001','Clearing','asset',null);
create function post(k text, at text, src text, dr text, cr text, amt bigint) returns void language plpgsql as $$
declare e uuid := gen_random_uuid(); begin
 insert into journal_entries (id,org_id,occurred_at,memo,source_type,idempotency_key) values (e,'00000000-0000-0000-0000-000000000001',at::timestamptz,k,src,k);
 insert into postings (entry_id,account_key,debit_cents) values (e,dr,amt);
 insert into postings (entry_id,account_key,credit_cents) values (e,cr,amt); end $$;
select post('g27','2027-06-01 12:00Z','donation','asset:bank:25f:TN','income:contributions:25f:TN',10000000);
select post('g28','2028-06-01 12:00Z','donation','asset:bank:25f:TN','income:contributions:25f:TN',6000000);
select post('p1','2028-03-01 12:00Z','payment_sent','liability:awards_payable:TN','asset:clearing:disbursements',9500000);
select receipt_year, receipts_cents, required_cents, paid_toward_cents, still_to_pay_cents, pay_by, status from receipt_year_payout order by receipt_year;
\echo '--- annual certification: expect FAIL admin certifies; OK owner certifies; FAIL editing after'
insert into annual_certifications (id,org_id,tax_year,state,figures,generated_by) values ('00000000-0000-0000-0000-00000000ce01','00000000-0000-0000-0000-000000000001',2027,'TN','{"ratio":92.5}','00000000-0000-0000-0000-0000000000a2');
update annual_certifications set status='certified', certified_by='00000000-0000-0000-0000-0000000000a2', certified_at=now(), certification_statement='I certify';
update annual_certifications set status='certified', certified_by='00000000-0000-0000-0000-0000000000a1', certified_at=now(), certification_statement='I certify these figures are true and complete.';
update annual_certifications set figures='{"ratio":99}';
