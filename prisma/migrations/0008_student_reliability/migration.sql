ALTER TABLE "Attempt" ADD COLUMN "deadlineAt" TIMESTAMP(3), ADD COLUMN "answerRevision" INTEGER NOT NULL DEFAULT 0;
UPDATE "Attempt" AS a SET "deadlineAt" = LEAST(
  CASE WHEN x."timeLimitSec" IS NOT NULL THEN a."startedAt" + x."timeLimitSec" * INTERVAL '1 second' END,
  x."dueAt"
) FROM "Assessment" AS x WHERE x.id = a."assessmentId";
CREATE TABLE "StudyDay" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  CONSTRAINT "StudyDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudyDay_userId_day_key" ON "StudyDay"("userId", "day");
ALTER TABLE "StudyDay" ADD CONSTRAINT "StudyDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "StudyDay" (id, "userId", day)
SELECT 'legacy-' || MIN(id), "userId", to_char("createdAt", 'YYYY-MM-DD') FROM "ChapterView"
GROUP BY "userId", to_char("createdAt", 'YYYY-MM-DD');
