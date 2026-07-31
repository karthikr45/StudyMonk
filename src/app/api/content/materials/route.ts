import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';

// Materials in a chapter — only if that chapter's subject is in the student's
// own class. Returns metadata only; downloads go through the signed-URL route.
export async function GET(req: NextRequest) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const profile = await studentProfile(auth.id);
    const chapterId = req.nextUrl.searchParams.get('chapterId');
    if (!chapterId) return fail('chapterId is required', 400, 'CHAPTER_ID_REQUIRED');

    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        isActive: true,
        subject: { classId: profile.classId, isActive: true },
      },
      select: { id: true },
    });
    if (!chapter) return fail('Chapter not available for your class', 403, 'FORBIDDEN');

    const materials = await prisma.studyMaterial.findMany({
      where: { chapterId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        fileName: true,
        fileSize: true,
        contentType: true,
        createdAt: true,
      },
    });
    return ok({ materials });
  } catch (err) {
    return handleError(err);
  }
}
