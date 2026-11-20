# Security at TENNISSA

*Draft for review by TENNISSA leadership and counsel. Suitable as the public security page once facts are confirmed at launch.*

TENNISSA handles donors' gifts, families' financial documents and payments to schools. This page explains how that information is protected.

## Where data lives
- **United States only.** The application runs on Vercel in a US region; the database runs on Supabase in a US region; stored files are kept in Amazon S3 in two US regions.
- Our providers (Stripe, Vercel, Supabase, Amazon Web Services, Resend) are independently audited every year (SOC 2 Type II). See the subprocessor list.

## Encryption
- Every connection uses TLS 1.2 or higher.
- Everything stored is encrypted at rest (AES-256) by the database and storage providers.
- **Taxpayer ID and bank account numbers** are encrypted again by our application (AES-256-GCM) before they are stored. Screens show only the last four digits.
- **Family documents** (tax returns, W-2s, pay stubs, benefit letters) are each encrypted with their own key before upload, so the storage provider cannot read them and no single storage key unlocks them. Every time a document is opened, the opening is logged.

## Signing in
- People sign in with a one-time link sent to their email; there are no passwords to steal or reuse. A link works once and expires in 24 hours.
- Staff with access to money or family records (owners and administrators) also confirm each sign-in with an authenticator app.
- A session ends after **30 minutes** without activity.
- Every sign-in, sign-out, timeout and failed attempt is logged with its IP address. Repeated attempts are rate-limited.

## Who can see what
- Donors see only their own gifts and receipts; families only their own applications; schools only their own students and payments.
- Staff see what their role allows: owner, administrator, scholarship committee member, auditor. Auditors are read-only and their access ends on a set date.
- The running application's database login can read, add and update records, but **cannot delete records, change the database's structure, or switch off its protections.**

## Money
- **We never receive or store a card number or bank login.** Card and bank details go directly to Stripe, which is certified PCI DSS Level 1.
- TENNISSA's gifts are held in TENNISSA's own accounts. Payments to schools are sent by TENNISSA's own bank.
- New or changed bank details for a school or vendor are held until an owner approves them after a call-back to a known number; the approver must be a different person from whoever entered them.
- Nothing is paid without proof: enrollment and a tuition statement for schools, an invoice and proof of delivery for vendors.

## Records that cannot be altered
- Every donation, receipt, refund, award and payment is recorded in a ledger that the database will not let anyone edit or delete. Mistakes are corrected with new, visible entries.
- The audit log of changes and sign-ins cannot be edited or deleted.
- Financial files are kept in storage locked against deletion, even by our own administrators.

## Testing and monitoring
- Every change runs automated checks, including database protection tests, security headers, role isolation and money checks. Nothing reaches the live platform until it passes.
- The live site is scanned for vulnerabilities (OWASP ZAP) after every release and every week, signed in and signed out.
- A web application firewall blocks attack traffic before it reaches the application.
- Security updates to the software we depend on are flagged automatically.

## Backups and recovery
- The database is backed up continuously (point-in-time recovery) and nightly to locked storage in a second US region.
- Every quarter we rebuild the full database from a backup on separate infrastructure and check every financial record. The result of each drill is recorded.

## Privacy
- We never sell personal information, never use it for advertising, and never use it to market to students or families.
- If anyone gains unauthorized access to information we hold, we notify those affected **within 24 hours** of confirming it.
- Policies available on request: incident response, disaster recovery, data retention, privacy, staff access.

Security questions or concerns: security@[tennissa domain].
