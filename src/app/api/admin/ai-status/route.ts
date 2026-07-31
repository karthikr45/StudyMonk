export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { aiProvider } from '@/lib/ai/provider';

// Whether AI generation/grading is configured (drives the admin UI).
export async function GET(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const p = aiProvider();
    return ok({ enabled: p.enabled, provider: p.name });
  } catch (err) {
    return handleError(err);
  }
}
