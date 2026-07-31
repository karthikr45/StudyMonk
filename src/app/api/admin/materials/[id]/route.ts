import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { deleteObject } from '@/lib/r2';

// Hard-delete a material and remove the underlying R2 object.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const material = await prisma.studyMaterial.findUnique({
      where: { id: params.id },
    });
    if (!material) return fail('Material not found', 404, 'NOT_FOUND');

    // Best-effort object removal; DB record removal is authoritative.
    try {
      await deleteObject(material.storageKey);
    } catch (e) {
      console.error('Failed to delete R2 object', material.storageKey, e);
    }

    await prisma.studyMaterial.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
