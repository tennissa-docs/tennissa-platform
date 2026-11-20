# Disaster recovery policy

*Draft for review. Owner: executive director; carried out by the technical lead.*

## Targets
- **Recovery point (most data that can be lost):** 5 minutes for the database (point-in-time recovery); 24 hours for anything only in the nightly copy.
- **Recovery time (how long until working again):** 8 hours for the full platform. Giving and family portals first, then payments.

## Backups
| what | how | kept |
| --- | --- | --- |
| Database | Supabase point-in-time recovery (continuous) | per Supabase plan (at least 7 days) |
| Database | nightly encrypted dump to the `financial-records` bucket (S3, Object Lock compliance mode), replicated to a second US region | nightly copies 90 days; **monthly copies permanently** |
| Financial files (receipts, ACH files, remittances, W-9s, invoices, proofs) | written once to the locked `financial-records` bucket, replicated | permanently |
| Applicant documents | locked `applicant-documents` bucket, encrypted per file | 5 years from decision |
| Encryption keys | cloud KMS with key rotation; key deletion disabled; second-region replica key | for as long as any data they protect |
| Code and configuration | GitHub repository; environment settings documented (never the secret values) | permanently |

## Quarterly restore drill
1. Restore the latest backup to **separate infrastructure** (a new Supabase project, never production).
2. Apply the current code and run `replica/ops/verify-integrity.sql`: trial balance zero, every entry balanced, every gift has a receipt and confirmation number, no over-refunds or over-payments, protections switched on, row level security on.
3. Compare row counts and checksums of the financial tables with production at the same point in time.
4. Open a sample of 10 receipts and 10 applicant documents from storage and decrypt them.
5. Record the drill in `restore_drills` (backup point, where restored, all check results, pass/fail, who did it). A failed drill is treated as a medium incident.

## When disaster happens
Follow the incident response policy; restore to a new project from the most recent good point; run the integrity check and the comparison; switch the app's database connection; confirm Stripe webhooks replay cleanly (they are idempotent); tell users what, if anything, they need to redo.
