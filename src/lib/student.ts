import { prisma } from './prisma';
import { HttpError } from './http';

export interface StudentProfile {
  id: string;
  boardId: string;
  classId: string;
  academicYear: string;
  schoolName: string;
  schoolDisplay: string;
}

/**
 * Load the student's academic scope from their profile. Content and group
 * access are always derived from this — never from client-supplied params —
 * so a student can only ever reach their own board/class content.
 */
export async function studentProfile(userId: string): Promise<StudentProfile> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      boardId: true,
      classId: true,
      academicYear: true,
      schoolName: true,
      schoolDisplay: true,
    },
  });
  if (!u || !u.boardId || !u.classId || !u.academicYear || !u.schoolName) {
    throw new HttpError('Student profile is incomplete', 400, 'PROFILE_INCOMPLETE');
  }
  return {
    id: u.id,
    boardId: u.boardId,
    classId: u.classId,
    academicYear: u.academicYear,
    schoolName: u.schoolName,
    schoolDisplay: u.schoolDisplay ?? '',
  };
}
