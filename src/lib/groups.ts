import { prisma } from './prisma';
import { HttpError } from './http';
import type { StudentProfile } from './student';

/** Fetch a group and assert the student's profile matches its key. */
export async function getEligibleGroup(groupId: string, p: StudentProfile) {
  const group = await prisma.studyGroup.findFirst({
    where: { id: groupId, isActive: true },
  });
  if (!group) throw new HttpError('Group not found', 404, 'GROUP_NOT_FOUND');
  const matches =
    group.boardId === p.boardId &&
    group.classId === p.classId &&
    group.academicYear === p.academicYear &&
    group.schoolName === p.schoolName;
  if (!matches) {
    throw new HttpError(
      'This group is not for your school, class or academic year',
      403,
      'SCOPE_MISMATCH',
    );
  }
  return group;
}

export async function requireMembership(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!member) throw new HttpError('You are not a member of this group', 403, 'NOT_MEMBER');
  return member;
}

/** Require the caller to be an OWNER of the group. */
export async function requireOwner(groupId: string, userId: string) {
  const member = await requireMembership(groupId, userId);
  if (member.role !== 'OWNER') {
    throw new HttpError('Only the group owner can do this', 403, 'NOT_OWNER');
  }
  return member;
}
