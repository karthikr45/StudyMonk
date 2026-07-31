export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { subjectSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const classId = req.nextUrl.searchParams.get('classId') ?? undefined;
    const subjects = await prisma.subject.findMany({
      where: classId ? { classId } : undefined,
      orderBy: { name: 'asc' },
      include: {
        class: { select: { id: true, name: true, board: { select: { name: true } } } },
        _count: { select: { chapters: true } },
      },
    });
    return ok({ subjects });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const body = subjectSchema.parse(await req.json());
    const klass = await prisma.class.findUnique({ where: { id: body.classId } });
    if (!klass) return fail('Class not found', 422, 'CLASS_NOT_FOUND');
    const exists = await prisma.subject.findFirst({
      where: { classId: body.classId, code: body.code },
    });
    if (exists) return fail('Subject code already exists for this class', 409, 'DUPLICATE');
    const subject = await prisma.subject.create({ data: body });
    return ok({ subject }, 201);
  } catch (err) {
    return handleError(err);
  }
}