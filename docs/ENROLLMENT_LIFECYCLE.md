# Batch and enrollment rollout

A batch is identified by school, board, class, academic year and section. Its identity cannot be edited. Each student has at most one active enrollment and one pending request, enforced by database indexes. Signup requests require administrator approval before cohort content becomes available. Student academic-year choices stop at the current Indian academic year (April boundary); administrators can prepare the next year.

## Administrator workflows

Use **Batches & enrollments** to create batches, approve or reject requests, promote, repeat a year, transfer, graduate or withdraw students. Promotion/repetition requires the following academic year in the same school and board. Transfers occur within the same year. Finish any open attempts before changing enrollment; the admin finalization action submits saved answers. Every transition records its reason and actor. A batch cannot close while it has active or pending enrollments.

Promotion creates a new enrollment rather than overwriting history. Assessments and group access use the batch identifier; analytics use the enrollment identifier. Copy an assessment into a destination batch as a fresh draft, review it, and publish it. Submissions are never copied. Assessment content with attempts and referenced questions are protected; archive assessments instead of deleting them.

Students can open Learning history for their own submitted assessments. Completed/graduated enrollments retain read-only group messages and files up to their closing date. Transfers and withdrawals revoke former group access. Historical polls and flashcards remain stored but do not yet have a history viewer. Edited messages after the history cutoff are omitted; this is not a point-in-time snapshot system.

## Deployment order

1. Back up PostgreSQL and rehearse migration on a restored staging database. Stop application writes during deployment.
2. Deploy the code; run `npm run db:migrate`, `npx prisma generate`, and `npm run build`; restart the application.
3. Sign in as super admin and review migration records in Batches & enrollments before reopening student access.
4. Existing students with complete catalog profiles become **pending**, not automatically approved. Verify their school/class/year and approve or place them in the correct batch. Incomplete profiles require manual enrollment.
5. Legacy assessments are quarantined from current batch listings. Their submissions remain accessible to their owners through Learning history. Reconcile only when evidence shows every participant belongs to the selected batch; ambiguous/mixed records must remain unassigned. Copy templates for new teaching instead.
6. Verify unmapped historical group rosters before using the group reconciliation action. It creates completed historical memberships and archives the group; it does not grant active enrollment.
7. Smoke-test signup, approval, assessment submission, history, transfer, promotion and school catalog using separate student accounts.

The migration does not infer a historical assessment's year from a student's current profile. It cannot reconstruct records already deleted or question content changed before deployment. There is no automatic annual promotion. Existing school names remain database-managed.

## Validation and limits

The automated integration suite runs on a disposable local PostgreSQL-compatible PGlite database and checks approval, cohort isolation, promotion, transfer, graduation, unfinished-attempt handling, saved answers and historical access. PGlite serializes connections; this is not a production PostgreSQL concurrency or load test. Real storage downloads, external AI grading and the deployed application require environment smoke tests. Existing global super-admin authorization is retained; school-specific administrator roles are not introduced by this migration.

This release does not apply the migration to the running development or production database automatically.
