export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { ok, handleError } from '@/lib/http';
export async function GET() {
  try {
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return ok({ schools });
  } catch (error) {
    return handleError(error);
  }
}
