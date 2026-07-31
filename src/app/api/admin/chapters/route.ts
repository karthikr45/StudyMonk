import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { chapterSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const subjectId = req.nextUrl.searchParams.get('subjectId') ?? undefined;
    const chapters = await prisma.chapter.findMany({
      where: subjectId ? { subjectId } : undefined,
      orderBy: [{ subjectId: 'asc' }, { orderIndex: 'asc' }],
      include: { _count: { select: { materials: true } } },
    });
    return ok({ chapters });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const body = chapterSchema.parse(await req.json());
    const subject = await prisma.subject.findUnique({ where: { id: body.subjectId } });
    if (!subject) return fail('Subject not found', 422, 'SUBJECT_NOT_FOUND');
    const chapter = await prisma.chapter.create({
      data: { ...body, orderIndex: body.orderIndex ?? 0 },
    });
    return ok({ chapter }, 201);
  } catch (err) {
    return handleError(err);
  }
}
