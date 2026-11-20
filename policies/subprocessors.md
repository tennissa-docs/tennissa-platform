# Subprocessors

*Draft. Confirm plans, regions and certifications at signup; update this list before adding any provider.*

| provider | what it does | data it handles | region |
| --- | --- | --- | --- |
| Stripe | card and bank payments; holds TENNISSA's §25F and general accounts | donor name, email, payment details (TENNISSA never sees card numbers) | US |
| Supabase | database and sign-in | all platform records | US region (chosen at setup) |
| Vercel | hosts the application; web application firewall | requests in transit | US region (chosen at setup) |
| Amazon Web Services (S3, KMS) | locked file storage and encryption keys | encrypted documents and financial files | two US regions |
| Resend | sends email (sign-in links, receipts, reminders) | recipient name and email, message content | US |
| Inngest | runs scheduled and background jobs | record identifiers only | US |
| Sentry | error reports | technical details; configured to strip personal data | US |
| GitHub | code repository and automated checks | code only, never production data | US |
