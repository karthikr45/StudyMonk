export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, handleError } from '@/lib/http';
import { requireGroupMember } from '@/lib/groups';
import { groupResourceSchema } from '@/lib/validation';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireGroupMember(req, params.id);
    const resources = await prisma.groupResource.findMany({
      where: { groupId: params.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, fileName: true, fileSize: true, contentType: true, createdAt: true,
        uploader: { select: { id: true, fullName: true } },
      },
    });
    return ok({ resources });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { auth } = await requireGroupMember(req, params.id);
    const body = groupResourceSchema.parse(await req.json());
    const resource = await prisma.groupResource.create({
      data: { groupId: params.id, uploaderId: auth.id, ...body },
      select: { id: true, title: true, fileName: true, fileSize: true, createdAt: true },
    });
    return ok({ resource }, 201);
  } catch (err) {
    return handleError(err);
  }
}
