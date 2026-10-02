export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { schoolSchema, normalizeSchool } from '@/lib/validation';
export async function GET(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    return ok({
      schools: await prisma.school.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, isActive: true },
      }),
    });
  } catch (error) {
    return handleError(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const { name } = schoolSchema.parse(await req.json());
    const existing = await prisma.school.findUnique({
      where: { normalizedName: normalizeSchool(name) },
    });
    if (existing)
      return fail('This school already exists', 409, 'DUPLICATE_SCHOOL');
    const school = await prisma.school.create({
      data: { name, normalizedName: normalizeSchool(name) },
      select: { id: true, name: true, isActive: true },
    });
    return ok({ school }, 201);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      return fail('This school already exists', 409, 'DUPLICATE_SCHOOL');
    return handleError(error);
  }
}
