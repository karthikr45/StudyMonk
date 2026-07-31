import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { registerSchema, normalizeSchool } from '@/lib/validation';
import { hashPassword } from '@/lib/password';
import { issueSession, setRefreshCookie, setAccessCookie } from '@/lib/session';

// Public bootstrap route — student self-registration. Board/class are validated
// against the DB so nothing is trusted blindly.
export async function POST(req: NextRequest) {
  try {
    const body = registerSchema.parse(await req.json());

    // Board + class must exist and be active (no hardcoded catalog).
    const [board, klass] = await Promise.all([
      prisma.board.findFirst({ where: { id: body.boardId, isActive: true } }),
      prisma.class.findFirst({ where: { id: body.classId, isActive: true } }),
    ]);
    if (!board) return fail('Selected board not found', 422, 'BOARD_NOT_FOUND');
    if (!klass || klass.boardId !== board.id) {
      return fail('Selected class is not valid for this board', 422, 'CLASS_INVALID');
    }

    const existing = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (existing) return fail('Email already registered', 409, 'EMAIL_TAKEN');

    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash: await hashPassword(body.password),
        fullName: body.fullName,
        role: 'STUDENT',
        boardId: board.id,
        classId: klass.id,
        academicYear: body.academicYear,
        schoolName: normalizeSchool(body.schoolName),
        schoolDisplay: body.schoolName.trim(),
      },
    });

    const { accessToken, refreshToken } = await issueSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      userAgent: req.headers.get('user-agent'),
      ipAddress: req.headers.get('x-forwarded-for'),
    });

    const res = ok(
      {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      },
      201,
    );
    setRefreshCookie(res, refreshToken);
    setAccessCookie(res, accessToken);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
