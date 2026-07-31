import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Liveness + DB connectivity probe. Exempt from the API-key middleware.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ success: true, data: { status: 'ok', db: 'up' } });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Database unreachable', code: 'DB_DOWN' } },
      { status: 503 },
    );
  }
}
