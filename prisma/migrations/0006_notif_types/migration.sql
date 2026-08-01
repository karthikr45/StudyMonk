-- Add new notification types (enum values added in their own migration).
ALTER TYPE "NotificationType" ADD VALUE 'FILE';
ALTER TYPE "NotificationType" ADD VALUE 'CARD';
ALTER TYPE "NotificationType" ADD VALUE 'POLL';
