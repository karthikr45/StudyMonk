CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING','ACTIVE','COMPLETED','TRANSFERRED','GRADUATED','WITHDRAWN','REJECTED');
CREATE TABLE "Batch" ("id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "boardId" TEXT NOT NULL REFERENCES "Board"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "classId" TEXT NOT NULL REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "academicYear" TEXT NOT NULL, "section" TEXT NOT NULL DEFAULT '', "label" TEXT NOT NULL, "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "Batch_schoolId_boardId_classId_academicYear_section_key" ON "Batch"("schoolId","boardId","classId","academicYear","section");
CREATE TABLE "Enrollment" ("id" TEXT PRIMARY KEY, "studentId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "batchId" TEXT NOT NULL REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING', "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "endedAt" TIMESTAMP(3), "approvedById" TEXT);
CREATE INDEX "Enrollment_studentId_status_idx" ON "Enrollment"("studentId","status");
CREATE INDEX "Enrollment_batchId_status_idx" ON "Enrollment"("batchId","status");
CREATE UNIQUE INDEX "Enrollment_one_active_student" ON "Enrollment"("studentId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "Enrollment_one_pending_student" ON "Enrollment"("studentId") WHERE "status" = 'PENDING';
CREATE TABLE "EnrollmentAudit" ("id" TEXT PRIMARY KEY, "actorId" TEXT NOT NULL, "studentId" TEXT, "action" TEXT NOT NULL, "details" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
ALTER TABLE "StudyGroup" ADD COLUMN "batchId" TEXT REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD COLUMN "batchId" TEXT REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE, ADD COLUMN "legacyUnscoped" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Attempt" ADD COLUMN "enrollmentId" TEXT REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Current profile is evidence for an enrollment request, not proof of school membership.
INSERT INTO "Batch" ("id","schoolId","boardId","classId","academicYear","label")
SELECT 'batch_' || md5(u."schoolId" || ':' || u."boardId" || ':' || u."classId" || ':' || u."academicYear"), u."schoolId",u."boardId",u."classId",u."academicYear",s."name" || ' · ' || c."name" || ' · ' || u."academicYear"
FROM "User" u JOIN "School" s ON s."id"=u."schoolId" JOIN "Class" c ON c."id"=u."classId" AND c."boardId"=u."boardId"
WHERE u."role"='STUDENT' AND u."academicYear" IS NOT NULL GROUP BY u."schoolId",u."boardId",u."classId",u."academicYear",s."name",c."name";
INSERT INTO "Enrollment" ("id","studentId","batchId","status") SELECT 'enrollment_' || u."id",u."id",b."id",'PENDING' FROM "User" u JOIN "Batch" b ON b."schoolId"=u."schoolId" AND b."classId"=u."classId" AND b."boardId"=u."boardId" AND b."academicYear"=u."academicYear" WHERE u."role"='STUDENT';
UPDATE "StudyGroup" g SET "batchId"=b."id" FROM "Batch" b JOIN "School" s ON s."id"=b."schoolId" WHERE g."boardId"=b."boardId" AND g."classId"=b."classId" AND g."academicYear"=b."academicYear" AND g."schoolName"=s."normalizedName";
-- Never infer an old submission's school/year from today's mutable profile.
UPDATE "Assessment" SET "legacyUnscoped"=true;
-- Protect history from catalog cascades and accidental hard deletion.
ALTER TABLE "Attempt" DROP CONSTRAINT "Attempt_assessmentId_fkey", ADD CONSTRAINT "Attempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attempt" DROP CONSTRAINT "Attempt_studentId_fkey", ADD CONSTRAINT "Attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttemptAnswer" DROP CONSTRAINT "AttemptAnswer_questionId_fkey", ADD CONSTRAINT "AttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GroupMember" ADD COLUMN "enrollmentId" TEXT REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
UPDATE "GroupMember" m SET "enrollmentId"=e."id" FROM "Enrollment" e JOIN "StudyGroup" g ON g."batchId"=e."batchId" WHERE m."userId"=e."studentId" AND m."groupId"=g."id";
-- Once referenced by an assessment, question content is immutable. Create a new version instead.
CREATE FUNCTION protect_assessment_question() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "AssessmentQuestion" WHERE "questionId"=OLD."id") THEN RAISE EXCEPTION 'Question is used in an assessment; create a new version'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER immutable_used_question BEFORE UPDATE OR DELETE ON "Question" FOR EACH ROW EXECUTE FUNCTION protect_assessment_question();
CREATE FUNCTION protect_question_option() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q TEXT;
BEGIN
 q=CASE WHEN TG_OP='INSERT' THEN NEW."questionId" ELSE OLD."questionId" END;
 IF EXISTS (SELECT 1 FROM "AssessmentQuestion" WHERE "questionId"=q) THEN RAISE EXCEPTION 'Question options are frozen for assessment history'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER immutable_used_options BEFORE INSERT OR UPDATE OR DELETE ON "QuestionOption" FOR EACH ROW EXECUTE FUNCTION protect_question_option();
CREATE FUNCTION protect_batch_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW."schoolId",NEW."boardId",NEW."classId",NEW."academicYear",NEW."section") IS DISTINCT FROM (OLD."schoolId",OLD."boardId",OLD."classId",OLD."academicYear",OLD."section") THEN RAISE EXCEPTION 'Batch identity is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_batch BEFORE UPDATE ON "Batch" FOR EACH ROW EXECUTE FUNCTION protect_batch_identity();

CREATE TABLE "EnrollmentActivity" ("id" TEXT PRIMARY KEY, "enrollmentId" TEXT NOT NULL REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE, "day" TEXT NOT NULL);
CREATE UNIQUE INDEX "EnrollmentActivity_enrollmentId_day_key" ON "EnrollmentActivity"("enrollmentId","day");
