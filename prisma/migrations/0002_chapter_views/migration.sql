-- CreateTable
CREATE TABLE "ChapterView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChapterView_chapterId_idx" ON "ChapterView"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterView_userId_chapterId_key" ON "ChapterView"("userId", "chapterId");

-- AddForeignKey
ALTER TABLE "ChapterView" ADD CONSTRAINT "ChapterView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterView" ADD CONSTRAINT "ChapterView_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

