export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { gradeAnswerSchema } from '@/lib/validation';
import { gradeAttempt } from '@/lib/manualGrading';
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    return ok({
      attempt: await gradeAttempt(
        params.id,
        gradeAnswerSchema.parse(await req.json()),
      ),
    });
  } catch (err) {
    return handleError(err);
  }
}
