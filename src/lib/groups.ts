import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { HttpError } from './http';
import { guard } from './auth';
import { studentProfile, type StudentProfile } from './student';

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

/** Guard + scope + membership in one call for group collaboration routes. */
export async function requireGroupMember(req: NextRequest, groupId: string) {
  const auth = await guard(req, { role: 'STUDENT' });
  const p = await studentProfile(auth.id);
  const group = await getEligibleGroup(groupId, p);
  await requireMembership(groupId, auth.id);
  return { auth, group };
}

/**
 * Notify every group member except the actor that something new happened in a
 * section (file shared, deck created, poll posted, …). Best-effort.
 */
export async function notifyGroupMembers(opts: {
  groupId: string;
  groupName: string;
  actorId: string;
  type: 'FILE' | 'CARD' | 'POLL' | 'MENTION' | 'REPLY';
  tab: string;
  excerpt?: string;
}) {
  const [members, actor] = await Promise.all([
    prisma.groupMember.findMany({
      where: { groupId: opts.groupId, userId: { not: opts.actorId } },
      select: { userId: true },
    }),
    prisma.user.findUnique({ where: { id: opts.actorId }, select: { fullName: true } }),
  ]);
  if (members.length === 0) return;
  await prisma.notification.createMany({
    data: members.map((m) => ({
      userId: m.userId,
      type: opts.type,
      actorName: actor?.fullName ?? 'A classmate',
      groupId: opts.groupId,
      groupName: opts.groupName,
      tab: opts.tab,
      excerpt: opts.excerpt,
    })),
  });
}

/** Require the caller to be an OWNER of the group. */
export async function requireOwner(groupId: string, userId: string) {
  const member = await requireMembership(groupId, userId);
  if (member.role !== 'OWNER') {
    throw new HttpError('Only the group owner can do this', 403, 'NOT_OWNER');
  }
  return member;
}
