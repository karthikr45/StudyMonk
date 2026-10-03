export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { questionEditSchema } from '@/lib/validation';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    if (
      await prisma.assessmentQuestion.count({
        where: { questionId: params.id },
      })
    )
      return fail(
        'This question is used in an assessment. Create a new question to preserve existing records.',
        409,
        'QUESTION_IN_USE',
      );
    const { options, type, ...rest } = questionEditSchema.parse(
      await req.json(),
    );
    const objective = type === 'MCQ' || type === 'TRUE_FALSE';

    // Replace options when the caller sends a fresh set, or wipe them when the
    // question is being converted to a written/numeric type that has none.
    const replaceOptions =
      options !== undefined || (type !== undefined && !objective);

    const question = await prisma.$transaction(async (tx) => {
      if (replaceOptions) {
        await tx.questionOption.deleteMany({
          where: { questionId: params.id },
        });
      }
      return tx.question.update({
        where: { id: params.id },
        data: {
          ...rest,
          ...(type ? { type } : {}),
          ...(objective && options
            ? {
                options: {
                  create: options.map((o, i) => ({
                    text: o.text,
                    isCorrect: o.isCorrect,
                    order: o.order ?? i,
                  })),
                },
              }
            : {}),
        },
        include: { options: { orderBy: { order: 'asc' } } },
      });
    });
    return ok({ question });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    if (
      await prisma.assessmentQuestion.count({
        where: { questionId: params.id },
      })
    )
      return fail(
        'This question is used in an assessment. Create a new question to preserve existing records.',
        409,
        'QUESTION_IN_USE',
      );
    await prisma.question.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
