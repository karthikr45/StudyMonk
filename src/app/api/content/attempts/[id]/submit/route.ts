export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { submitAnswersSchema } from '@/lib/validation';
import { writeAttempt } from '@/lib/attemptWrites';
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await guard(req, { role: 'STUDENT' });
    const body = submitAnswersSchema.parse(await req.json());
    return ok(await writeAttempt(params.id, user.id, body, true));
  } catch (err) {
    return handleError(err);
  }
}
