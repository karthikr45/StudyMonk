-- Target section within a group for deep-linking, plus a lookup index.
ALTER TABLE "Notification" ADD COLUMN "tab" TEXT;
CREATE INDEX "Notification_userId_groupId_read_idx" ON "Notification"("userId", "groupId", "read");
