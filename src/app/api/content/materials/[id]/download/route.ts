import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';
import { presignDownload } from '@/lib/r2';

// Issue a short-lived presigned download URL — access checked against the
// student's own class before signing.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const profile = await studentProfile(auth.id);

    const material = await prisma.studyMaterial.findFirst({
      where: {
        id: params.id,
        isActive: true,
        chapter: {
          isActive: true,
          subject: { classId: profile.classId, isActive: true },
        },
      },
      select: { id: true, storageKey: true, fileName: true },
    });
    if (!material) return fail('Material not available for your class', 403, 'FORBIDDEN');

    const url = await presignDownload(material.storageKey, 300);
    return ok({ url, fileName: material.fileName, expiresInSeconds: 300 });
  } catch (err) {
    return handleError(err);
  }
}
