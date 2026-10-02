export const dynamic = 'force-dynamic';
import { availableAcademicYears } from '@/lib/academicYears';
import { ok } from '@/lib/http';
export async function GET() {
  const years = availableAcademicYears();
  const response = ok({ years, current: years[0] });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
