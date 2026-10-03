import { prisma } from './prisma';
import { HttpError } from './http';
export interface StudentProfile {
  id: string;
  enrollmentId: string;
  batchId: string;
  schoolId: string;
  boardId: string;
  classId: string;
  academicYear: string;
  schoolName: string;
  schoolDisplay: string;
}
/** Scope comes from an approved enrollment, never a mutable profile or client input. */
export async function studentProfile(userId: string): Promise<StudentProfile> {
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId: userId, status: 'ACTIVE', batch: { archivedAt: null } },
    include: { batch: { include: { school: true } } },
  });
  if (!enrollment)
    throw new HttpError(
      'Your enrollment needs admin approval, or your batch is archived. You can still view your learning history.',
      403,
      'ENROLLMENT_REQUIRED',
    );
  const b = enrollment.batch;
  return {
    id: userId,
    enrollmentId: enrollment.id,
    batchId: b.id,
    schoolId: b.schoolId,
    boardId: b.boardId,
    classId: b.classId,
    academicYear: b.academicYear,
    schoolName: b.school.normalizedName,
    schoolDisplay: b.school.name,
  };
}
