export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError, HttpError } from '@/lib/http';
import { presignDownload } from '@/lib/r2';
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await guard(req, { role: 'STUDENT' });
    const group = await prisma.studyGroup.findFirst({
      where: { id: params.id, members: { some: { userId: user.id } } },
      include: { batch: true },
    });
    if (!group?.batchId) throw new HttpError('Archive unavailable', 404);
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: user.id,
        batchId: group.batchId,
        OR: [
          { status: { in: ['COMPLETED', 'GRADUATED'] } },
          { status: 'ACTIVE', batch: { archivedAt: { not: null } } },
        ],
      },
      orderBy: { startedAt: 'desc' },
    });
    if (
      !enrollment ||
      !(await prisma.groupMember.findFirst({
        where: {
          groupId: group.id,
          userId: user.id,
          enrollmentId: enrollment.id,
        },
      }))
    )
      throw new HttpError('Archive unavailable for this enrollment', 403);
    const cutoff = enrollment.endedAt ?? group.batch?.archivedAt ?? new Date();
    const resourceId = req.nextUrl.searchParams.get('resource');
    if (resourceId) {
      const resource = await prisma.groupResource.findFirst({
        where: {
          id: resourceId,
          groupId: group.id,
          createdAt: { lte: cutoff },
        },
      });
      if (!resource) throw new HttpError('Resource unavailable', 404);
      return ok({ url: await presignDownload(resource.storageKey, 300) });
    }
    const before = req.nextUrl.searchParams.get('before');
    const [posts, resources] = await Promise.all([
      prisma.groupPost.findMany({
        where: {
          groupId: group.id,
          createdAt: { lte: cutoff },
          OR: [{ editedAt: null }, { editedAt: { lte: cutoff } }],
          ...(before ? { id: { lt: before } } : {}),
        },
        orderBy: { id: 'desc' },
        take: 51,
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { fullName: true } },
        },
      }),
      prisma.groupResource.findMany({
        where: { groupId: group.id, createdAt: { lte: cutoff } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, fileName: true, fileSize: true },
      }),
    ]);
    return ok({
      name: group.name,
      posts: posts.slice(0, 50).reverse(),
      resources,
      nextCursor: posts.length > 50 ? posts[49].id : null,
      readOnly: true,
    });
  } catch (e) {
    return handleError(e);
  }
}
