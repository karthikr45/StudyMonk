import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128);

const academicYear = z
  .string()
  .regex(/^\d{4}-\d{4}$/, 'Academic year must look like 2025-2026');

// A "code" the admin can type however they like (e.g. "CBSE", "Math") — we
// slugify it: lowercase, spaces/symbols → dashes. So the admin never has to
// think about the format.
const codeField = z
  .string()
  .min(1, 'Code is required')
  .max(40)
  .transform((s) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
  )
  .refine((s) => s.length >= 2, 'Code must have at least 2 letters/numbers');

// ---- Auth -------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password,
  fullName: z.string().min(2).max(120),
  boardId: z.string().min(1),
  classId: z.string().min(1),
  academicYear,
  schoolName: z.string().min(2).max(160),
});

// ---- Catalog (SUPER_ADMIN) --------------------------------------------------

export const boardSchema = z.object({
  name: z.string().min(2).max(80),
  code: codeField,
  isActive: z.boolean().optional(),
});

export const classSchema = z.object({
  boardId: z.string().min(1),
  name: z.string().min(1).max(60),
  level: z.coerce.number().int().min(1).max(20),
  isActive: z.boolean().optional(),
});

export const subjectSchema = z.object({
  classId: z.string().min(1),
  name: z.string().min(1).max(80),
  code: codeField,
  isActive: z.boolean().optional(),
});

export const chapterSchema = z.object({
  subjectId: z.string().min(1),
  name: z.string().min(1).max(160),
  orderIndex: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const presignUploadSchema = z.object({
  chapterId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(160),
  fileSize: z.coerce.number().int().positive().max(1024 * 1024 * 1024), // <= 1 GB
});

export const materialSchema = z.object({
  chapterId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(['PDF', 'VIDEO', 'IMAGE', 'DOCUMENT', 'OTHER']).optional(),
  storageKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileSize: z.coerce.number().int().positive(),
  contentType: z.string().min(1).max(160),
});

// ---- Study groups (STUDENT) -------------------------------------------------

export const createGroupSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
});

export const postSchema = z.object({
  body: z.string().min(1).max(4000),
});

export const addMemberSchema = z.object({
  userId: z.string().min(1),
});

/** Normalize a school name for reliable matching (trim + collapse + lower). */
export function normalizeSchool(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
