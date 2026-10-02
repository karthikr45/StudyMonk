CREATE TABLE "School" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "School_normalizedName_key" ON "School"("normalizedName");
ALTER TABLE "User" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Initial catalog data. Signup and admin screens always read the database.
INSERT INTO "School" ("id", "name", "normalizedName", "updatedAt")
VALUES ('school_tnr_excelencia', 'TNR Excelencia', 'tnr excelencia', CURRENT_TIMESTAMP);

-- Link matching existing students without assigning unrelated schools.
UPDATE "User" SET "schoolId" = s."id", "schoolName" = s."normalizedName", "schoolDisplay" = s."name"
FROM "School" s
WHERE LOWER(REGEXP_REPLACE(TRIM(COALESCE("User"."schoolName", "User"."schoolDisplay", '')), '\s+', ' ', 'g')) = s."normalizedName";
