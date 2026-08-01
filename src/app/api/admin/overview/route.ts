export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';

// A single, picker-free snapshot of everything the SuperAdmin has built:
// every assessment (with its live status, attempts and how many answers are
// waiting to be graded), plus question-bank and grading totals. This is what
// the admin lands on so nothing is buried behind Board → Class → Subject.
export async function GET(_req: NextRequest) {
  try {
    await guard(_req, { role: 'SUPER_ADMIN' });

    const [assessments, needsReviewGroups, totalQuestions, draftQuestions, totalAttempts] = await Promise.all([
      prisma.assessment.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          chapter: { select: { name: true } },
          subject: { select: { name: true, class: { select: { name: true, board: { select: { name: true } } } } } },
          _count: { select: { questions: true, attempts: true } },
        },
      }),
      // Answers submitted but not yet graded → the admin's grading queue.
      prisma.attempt.groupBy({
        by: ['assessmentId'],
        where: { status: 'NEEDS_REVIEW' },
        _count: { _all: true },
      }),
      prisma.question.count(),
      prisma.question.count({ where: { status: 'DRAFT' } }),
      prisma.attempt.count({ where: { status: { in: ['SUBMITTED', 'GRADED', 'NEEDS_REVIEW'] } } }),
    ]);

    const reviewByAssessment = new Map(needsReviewGroups.map((g) => [g.assessmentId, g._count._all]));

    const rows = assessments.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      status: a.status,
      resultsPublished: a.resultsPublished,
      totalMarks: a.totalMarks,
      timeLimitSec: a.timeLimitSec,
      subjectName: a.subject.name,
      className: a.subject.class.name,
      boardName: a.subject.class.board.name,
      chapterName: a.chapter?.name ?? null,
      questionCount: a._count.questions,
      attemptCount: a._count.attempts,
      needsReview: reviewByAssessment.get(a.id) ?? 0,
    }));

    const totals = {
      assessments: assessments.length,
      published: assessments.filter((a) => a.status === 'PUBLISHED').length,
      drafts: assessments.filter((a) => a.status !== 'PUBLISHED').length,
      questions: totalQuestions,
      draftQuestions,
      attempts: totalAttempts,
      needsReview: needsReviewGroups.reduce((n, g) => n + g._count._all, 0),
    };

    return ok({ totals, assessments: rows });
  } catch (err) {
    return handleError(err);
  }
}
