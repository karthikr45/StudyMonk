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

// ---- Assessment engine -----------------------------------------------------

export const questionTypeEnum = z.enum(['MCQ', 'TRUE_FALSE', 'NUMERIC', 'SHORT', 'LONG']);
export const difficultyEnum = z.enum(['EASY', 'MEDIUM', 'HARD']);

export const optionSchema = z.object({
  text: z.string().min(1).max(1000),
  isCorrect: z.boolean().default(false),
  order: z.coerce.number().int().min(0).optional(),
});

export const questionSchema = z
  .object({
    subjectId: z.string().min(1),
    chapterId: z.string().min(1).nullable().optional(),
    type: questionTypeEnum,
    difficulty: difficultyEnum.optional(),
    marks: z.coerce.number().int().min(1).max(100).default(1),
    prompt: z.string().min(3).max(4000),
    explanation: z.string().max(4000).optional(),
    options: z.array(optionSchema).max(8).optional(),
    modelAnswer: z.string().max(8000).optional(),
    rubric: z.string().max(4000).optional(),
    numericAnswer: z.coerce.number().optional(),
    numericTolerance: z.coerce.number().min(0).optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'MCQ' || v.type === 'TRUE_FALSE') {
      const opts = v.options ?? [];
      if (opts.length < 2)
        ctx.addIssue({ code: 'custom', message: 'Add at least 2 options', path: ['options'] });
      if (!opts.some((o) => o.isCorrect))
        ctx.addIssue({ code: 'custom', message: 'Mark one option correct', path: ['options'] });
    }
    if (v.type === 'NUMERIC' && v.numericAnswer === undefined)
      ctx.addIssue({ code: 'custom', message: 'Provide the numeric answer', path: ['numericAnswer'] });
  });

export const assessmentTypeEnum = z.enum(['DAILY', 'QUIZ', 'ASSIGNMENT', 'EXAM']);

export const assessmentSchema = z.object({
  type: assessmentTypeEnum,
  subjectId: z.string().min(1),
  chapterId: z.string().min(1).nullable().optional(),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  timeLimitSec: z.coerce.number().int().min(30).max(4 * 3600).nullable().optional(),
  questionIds: z.array(z.string().min(1)).min(1, 'Add at least one question').max(100),
});

export const submitAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedOptionIds: z.array(z.string().min(1)).optional(),
        textAnswer: z.string().max(20000).optional(),
        numericAnswer: z.coerce.number().nullable().optional(),
      }),
    )
    .max(200),
});

export const generateSchema = z.object({
  subjectId: z.string().min(1),
  chapterId: z.string().min(1).nullable().optional(),
  difficulty: difficultyEnum.default('MEDIUM'),
  counts: z
    .object({
      MCQ: z.coerce.number().int().min(0).max(20).optional(),
      TRUE_FALSE: z.coerce.number().int().min(0).max(20).optional(),
      NUMERIC: z.coerce.number().int().min(0).max(20).optional(),
      SHORT: z.coerce.number().int().min(0).max(20).optional(),
      LONG: z.coerce.number().int().min(0).max(20).optional(),
    })
    .refine((c) => Object.values(c).reduce((n, v) => n + (v ?? 0), 0) > 0, 'Request at least one question')
    .refine((c) => Object.values(c).reduce((n, v) => n + (v ?? 0), 0) <= 25, 'At most 25 questions per generation'),
});

export const gradeAnswerSchema = z.object({
  answers: z
    .array(
      z.object({
        answerId: z.string().min(1),
        awardedMarks: z.coerce.number().min(0),
        feedback: z.string().max(4000).optional(),
      }),
    )
    .min(1),
  publishResults: z.boolean().optional(),
});

/** Normalize a school name for reliable matching (trim + collapse + lower). */
export function normalizeSchool(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
