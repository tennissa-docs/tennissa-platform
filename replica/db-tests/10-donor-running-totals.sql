\pset footer off
insert into orgs (id,name,ein,states) values ('00000000-0000-0000-0000-000000000001','T','12-3456789','{TN}');
insert into credit_caps values (2027,170000);
insert into donors (id,org_id,first_name,last_name,email,address,donor_number) values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000001','Maya','Reyes','m@x.org','{}',1);
insert into donations (id,org_id,donor_id,amount_cents,fee_cents,method,qualified_25f,state,tax_year,status,succeeded_at) values
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1',100000,800,'ach',true,'TN',2027,'succeeded','2027-03-01'),
 ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1',25000,755,'card',false,null,2027,'succeeded','2027-05-01');
insert into donation_refunds (org_id,donation_id,kind,amount_cents,refunded_at,counts_in_year,original_tax_year,was_qualified_25f,reason,refund_no,review_required,review_priority,review_status)
 values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','refund',20000,'2027-09-01',2027,2027,true,'x','RF-2027-0001',true,'normal','open');
select tax_year, gift_count, total_cents, qualified_cents, general_cents, refunded_cents, cap_cents, cap_remaining_cents from donor_annual_totals;
