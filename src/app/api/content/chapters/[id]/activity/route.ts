import { NextRequest } from 'next/server';
import { guard } from '@/lib/auth';
import { studentProfile } from '@/lib/student';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await guard(req, { role: 'STUDENT' });
    const profile = await studentProfile(user.id);
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: params.id,
        isActive: true,
        subject: { classId: profile.classId, isActive: true },
      },
    });
    if (!chapter) return fail('Chapter unavailable', 404);
    const day = new Date().toISOString().slice(0, 10);
    await prisma.$transaction([
      prisma.enrollmentActivity.upsert({
        where: {
          enrollmentId_day: { enrollmentId: profile.enrollmentId, day },
        },
        update: {},
        create: { enrollmentId: profile.enrollmentId, day },
      }),
      prisma.chapterView.upsert({
        where: { userId_chapterId: { userId: user.id, chapterId: chapter.id } },
        update: {},
        create: { userId: user.id, chapterId: chapter.id },
      }),
      prisma.studyDay.upsert({
        where: { userId_day: { userId: user.id, day } },
        update: {},
        create: { userId: user.id, day },
      }),
    ]);
    return ok({ recorded: true });
  } catch (err) {
    return handleError(err);
  }
}
