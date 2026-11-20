# Incident response policy

*Draft for review by TENNISSA leadership and counsel. Owner: TENNISSA executive director. Reviewed at least yearly and after every incident.*

## Scope
Any event that may have exposed, altered, or made unavailable personal or financial information TENNISSA holds: unauthorized access, a lost device with access, a leaked key or password, suspicious payments or bank detail changes, a provider breach, or a serious outage.

## Roles
- **Incident lead:** the executive director (backup: board treasurer). Makes decisions and owns communication.
- **Technical lead:** the person or firm maintaining the platform. Investigates and contains.
- **Counsel:** advises on legal notice duties (state breach laws, IRS, state SGO program).

## Steps
1. **Report.** Anyone who suspects an incident tells the incident lead immediately (email security@ and phone). Do not investigate alone or delete anything.
2. **Contain (first hour).** Revoke affected sessions and keys; rotate secrets (database, Stripe, Resend, storage, encryption keys); suspend affected staff or school logins; freeze outgoing payment batches if money is involved; turn on firewall blocks.
3. **Assess (within 12 hours).** What happened, when, which records and people are affected, whether data was viewed, copied or changed. Use the audit log, sign-in log, document-open log, provider logs and the integrity check (`replica/ops/verify-integrity.sql`). Preserve evidence: logs are append-only; export copies to locked storage.
4. **Notify (within 24 hours of confirming).** Affected donors, families, schools and staff, by email, in plain language: what happened, what information, what we are doing, what they should do, who to contact. Notify regulators and others as counsel advises (state attorney general where required, the state SGO program, Stripe, the bank, insurers, law enforcement for fraud).
5. **Recover.** Fix the cause; restore from backup if records were damaged (see disaster recovery); confirm with the integrity check; resume payments only after an owner signs off.
6. **Review (within 2 weeks).** Written post-incident review: timeline, cause, impact, what worked, changes made. Stored permanently with the incident record.

## Severity
- **High:** personal or financial data exposed or changed; money moved wrongly; platform down during a giving or payment deadline. All steps, 24-hour notification.
- **Medium:** suspicious activity contained with no data exposure. Steps 1–3, 5–6; notify if assessment finds exposure.
- **Low:** blocked attempt, scanner finding. Log, fix, review monthly.

## Records
Each incident is recorded with its timeline, decisions, notices sent and review, and kept permanently.
