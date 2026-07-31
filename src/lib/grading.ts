import type { QuestionType } from '@prisma/client';

export interface GradableQuestion {
  id: string;
  type: QuestionType;
  marks: number;
  numericAnswer: number | null;
  numericTolerance: number | null;
  options: { id: string; isCorrect: boolean }[];
}

export interface StudentAnswer {
  selectedOptionIds?: string[];
  textAnswer?: string | null;
  numericAnswer?: number | null;
}

export interface GradeResult {
  awardedMarks: number;
  isCorrect: boolean | null; // null = not auto-gradable (subjective)
  gradedBy: 'AUTO' | null; // null = needs review
  autoGradable: boolean;
}

/**
 * Deterministic grading for objective question types. Subjective types
 * (SHORT / LONG) return autoGradable=false and are queued for review
 * (or AI grading in Phase 2).
 */
export function gradeAnswer(q: GradableQuestion, a: StudentAnswer): GradeResult {
  switch (q.type) {
    case 'MCQ':
    case 'TRUE_FALSE': {
      const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id).sort();
      const picked = [...(a.selectedOptionIds ?? [])].sort();
      const isCorrect =
        correctIds.length > 0 &&
        picked.length === correctIds.length &&
        picked.every((id, i) => id === correctIds[i]);
      return { awardedMarks: isCorrect ? q.marks : 0, isCorrect, gradedBy: 'AUTO', autoGradable: true };
    }
    case 'NUMERIC': {
      if (q.numericAnswer == null || a.numericAnswer == null) {
        return { awardedMarks: 0, isCorrect: false, gradedBy: 'AUTO', autoGradable: true };
      }
      const tol = q.numericTolerance ?? 0;
      const isCorrect = Math.abs(a.numericAnswer - q.numericAnswer) <= tol;
      return { awardedMarks: isCorrect ? q.marks : 0, isCorrect, gradedBy: 'AUTO', autoGradable: true };
    }
    case 'SHORT':
    case 'LONG':
    default:
      // Subjective — leave for teacher/AI review.
      return { awardedMarks: 0, isCorrect: null, gradedBy: null, autoGradable: false };
  }
}
