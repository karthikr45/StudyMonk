import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

// Use a disposable database only. This suite creates and removes its own fixtures.
test(
  'student API: saved answers, deadlines, activity, pagination, notifications and quiz integrity',
  { skip: !process.env.STUDYMONK_TEST_DATABASE_URL },
  async (t) => {
    const url = new URL(process.env.STUDYMONK_TEST_DATABASE_URL!);
    assert.ok(
      ['127.0.0.1', 'localhost'].includes(url.hostname),
      'Integration tests require a local disposable database',
    );
    process.env.DATABASE_URL = url.toString();
    process.env.JWT_ACCESS_SECRET =
      'test-only-access-secret-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET =
      'test-only-refresh-secret-at-least-32-characters';
    process.env.API_GATEWAY_KEY = 'test-only-gateway-key';
    Object.assign(process.env, {
      R2_ACCOUNT_ID: 'test',
      R2_ACCESS_KEY_ID: 'test',
      R2_SECRET_ACCESS_KEY: 'test',
      R2_BUCKET_NAME: 'test',
      R2_ENDPOINT: 'https://example.invalid',
      AI_PROVIDER: 'none',
    });
    const { prisma } = await import('../src/lib/prisma');
    const { writeAttempt } = await import('../src/lib/attemptWrites');
    const { signAccessToken } = await import('../src/lib/jwt');
    const prefix = `test-${Date.now()}`;
    const board = await prisma.board.create({
      data: { name: prefix, code: prefix },
    });
    const klass = await prisma.class.create({
      data: { boardId: board.id, name: 'Class 10', level: 10 },
    });
    const subject = await prisma.subject.create({
      data: { classId: klass.id, name: 'Math', code: 'math' },
    });
    const chapter = await prisma.chapter.create({
      data: { subjectId: subject.id, name: 'Numbers' },
    });
    const user = await prisma.user.create({
      data: {
        email: `${prefix}@example.test`,
        fullName: 'Test Student',
        passwordHash: 'unused',
        role: 'STUDENT',
        boardId: board.id,
        classId: klass.id,
        schoolName: 'test',
        academicYear: '2026-2027',
      },
    });
    const school = await prisma.school.create({
      data: { name: prefix, normalizedName: prefix },
    });
    const batch = await prisma.batch.create({
      data: {
        schoolId: school.id,
        boardId: board.id,
        classId: klass.id,
        academicYear: '2026-2027',
        label: prefix,
      },
    });
    const enrollment = await prisma.enrollment.create({
      data: { studentId: user.id, batchId: batch.id, status: 'ACTIVE' },
    });
    const question = await prisma.question.create({
      data: {
        subjectId: subject.id,
        type: 'NUMERIC',
        prompt: '2+2',
        numericAnswer: 4,
        marks: 2,
      },
    });
    const assessment = await prisma.assessment.create({
      data: {
        subjectId: subject.id,
        title: 'Math test',
        batchId: batch.id,
        type: 'QUIZ',
        status: 'PUBLISHED',
        totalMarks: 2,
        timeLimitSec: 600,
        questions: { create: { questionId: question.id, marks: 2 } },
      },
    });
    const token = await signAccessToken({
      sub: user.id,
      role: 'STUDENT',
      email: user.email,
    });
    const request = (path: string, body?: unknown) =>
      new NextRequest(`http://localhost${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'x-api-key': process.env.API_GATEWAY_KEY!,
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    let groupId = '';
    try {
      const { POST: start } =
        await import('../src/app/api/content/assessments/[id]/start/route');
      const startBody = await (
        await start(request('/start', {}), { params: { id: assessment.id } })
      ).json();
      const attemptId = startBody.data.attemptId;
      await t.test(
        'refresh rotation permits only one replacement session',
        async () => {
          const { issueSession, rotateSession } =
            await import('../src/lib/session');
          const { hashRefreshToken } = await import('../src/lib/jwt');
          const input = { userId: user.id, email: user.email, role: user.role };
          const original = await issueSession(input);
          const session = await prisma.session.findUniqueOrThrow({
            where: {
              refreshTokenHash: hashRefreshToken(original.refreshToken),
            },
          });
          const results = await Promise.allSettled([
            rotateSession(session.id, input),
            rotateSession(session.id, input),
          ]);
          assert.equal(
            results.filter((r) => r.status === 'fulfilled').length,
            1,
          );
          assert.equal(
            await prisma.session.count({
              where: { userId: user.id, revokedAt: null },
            }),
            1,
          );
        },
      );
      await t.test(
        'manual grading rejects work that is still in progress',
        async () => {
          const { gradeAttempt } = await import('../src/lib/manualGrading');
          await assert.rejects(
            gradeAttempt(attemptId, {
              answers: [{ answerId: 'invalid', awardedMarks: 1 }],
            }),
            /Submit the attempt/,
          );
        },
      );
      await t.test(
        'resource registration rejects another upload namespace before contacting storage',
        async () => {
          const { verifyUploadedObject } = await import('../src/lib/r2');
          await assert.rejects(
            verifyUploadedObject(
              'groups/other/file.pdf',
              `groups/local/${user.id}`,
              10,
              'application/pdf',
            ),
            /does not belong/,
          );
        },
      );
      await t.test(
        'shared rate limiter blocks requests beyond the limit',
        async () => {
          const { consumeRateLimit } = await import('../src/lib/rateLimit');
          await consumeRateLimit(prefix, 'fixture', 1);
          await assert.rejects(
            consumeRateLimit(prefix, 'fixture', 1),
            /Too many requests/,
          );
        },
      );
      await t.test(
        'school catalog is database-backed and only admins can add schools',
        async () => {
          const { GET: catalog } =
            await import('../src/app/api/catalog/schools/route');
          const { POST: addSchool } =
            await import('../src/app/api/admin/schools/route');
          const { POST: register } =
            await import('../src/app/api/auth/register/route');
          const initial = (await (await catalog()).json()).data.schools;
          assert.ok(
            initial.some(
              (school: { name: string }) => school.name === 'TNR Excelencia',
            ),
          );
          assert.equal(
            (await addSchool(request('/schools', { name: `${prefix} School` })))
              .status,
            403,
          );
          let schoolId = '';
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { role: 'SUPER_ADMIN' },
            });
            const created = await addSchool(
              request('/schools', { name: `  ${prefix}   School  ` }),
            );
            assert.equal(created.status, 201);
            const school = (await created.json()).data.school;
            schoolId = school.id;
            assert.equal(school.name, `${prefix} School`);
            assert.equal(
              (
                await addSchool(
                  request('/schools', {
                    name: `${prefix.toUpperCase()} SCHOOL`,
                  }),
                )
              ).status,
              409,
            );
            assert.ok(
              (await (await catalog()).json()).data.schools.some(
                (s: { id: string }) => s.id === schoolId,
              ),
            );
            const body = {
              email: `${prefix}-registered@example.test`,
              password: 'TestOnlyPassword-2026',
              fullName: 'School Test Student',
              boardId: board.id,
              classId: klass.id,
              academicYear: '2026-2027',
              schoolId,
            };
            assert.equal(
              (
                await register(
                  request('/register', { ...body, schoolId: 'missing' }),
                )
              ).status,
              422,
            );
            await prisma.school.update({
              where: { id: schoolId },
              data: { isActive: false },
            });
            assert.ok(
              !(await (await catalog()).json()).data.schools.some(
                (s: { id: string }) => s.id === schoolId,
              ),
            );
            assert.equal(
              (await register(request('/register', body))).status,
              422,
            );
            await prisma.school.update({
              where: { id: schoolId },
              data: { isActive: true },
            });
            assert.equal(
              (
                await register(
                  request('/register', {
                    ...body,
                    schoolName: 'Untrusted name',
                  }),
                )
              ).status,
              201,
            );
            const registered = await prisma.user.findUniqueOrThrow({
              where: { email: body.email },
            });
            assert.equal(registered.schoolId, schoolId);
            assert.equal(registered.schoolDisplay, school.name);
            assert.equal(registered.schoolName, school.name.toLowerCase());
          } finally {
            await prisma.enrollment.deleteMany({
              where: {
                student: { email: `${prefix}-registered@example.test` },
              },
            });
            if (schoolId)
              await prisma.batch.deleteMany({ where: { schoolId } });
            await prisma.user.deleteMany({
              where: { email: `${prefix}-registered@example.test` },
            });
            await prisma.user.update({
              where: { id: user.id },
              data: { role: 'STUDENT' },
            });
            if (schoolId)
              await prisma.school.delete({ where: { id: schoolId } });
          }
        },
      );
      await t.test('resume retains deadline and revision', async () => {
        const resumed = await (
          await start(request('/start', {}), { params: { id: assessment.id } })
        ).json();
        assert.equal(resumed.data.attemptId, attemptId);
        assert.equal(resumed.data.deadlineAt, startBody.data.deadlineAt);
        assert.equal(resumed.data.revision, 0);
      });
      await t.test(
        'only one concurrent revision succeeds; another user cannot write',
        async () => {
          const payload = {
            revision: 0,
            answers: [{ questionId: question.id, numericAnswer: 4 }],
          };
          const saves = await Promise.allSettled([
            writeAttempt(attemptId, user.id, payload, false),
            writeAttempt(attemptId, user.id, payload, false),
          ]);
          assert.equal(saves.filter((r) => r.status === 'fulfilled').length, 1);
          const failed = saves.find(
            (r) => r.status === 'rejected',
          ) as PromiseRejectedResult;
          assert.equal(failed.reason.code, 'REVISION_CONFLICT');
          await assert.rejects(
            writeAttempt(attemptId, 'another-user', payload, false),
            (e: any) => e.code === 'NOT_FOUND',
          );
        },
      );
      await t.test(
        'late writes fail and expiry submission grades server-saved answers only',
        async () => {
          await prisma.attempt.update({
            where: { id: attemptId },
            data: { deadlineAt: new Date(Date.now() - 1000) },
          });
          const late = {
            revision: 1,
            answers: [{ questionId: question.id, numericAnswer: 9 }],
          };
          await assert.rejects(
            writeAttempt(attemptId, user.id, late, false),
            (e: any) => e.code === 'DEADLINE_PASSED',
          );
          const result = await writeAttempt(attemptId, user.id, late, true);
          assert.equal(result.deadlinePassed, true);
          assert.equal(
            (
              await prisma.attempt.findUniqueOrThrow({
                where: { id: attemptId },
              })
            ).score,
            2,
          );
          assert.equal(
            (await writeAttempt(attemptId, user.id, late, true)).submitted,
            true,
          );
          await assert.rejects(
            writeAttempt(attemptId, user.id, late, false),
            (e: any) => e.code === 'NOT_IN_PROGRESS',
          );
        },
      );
      await t.test(
        'released numeric results include the expected answer',
        async () => {
          const { GET } =
            await import('../src/app/api/content/attempts/[id]/result/route');
          const body = await (
            await GET(request('/result'), { params: { id: attemptId } })
          ).json();
          assert.equal(body.data.questions[0].numericAnswer, 4);
        },
      );
      await t.test(
        'opening a chapter records one daily activity despite repeated calls',
        async () => {
          const { POST } =
            await import('../src/app/api/content/chapters/[id]/activity/route');
          for (let i = 0; i < 2; i++)
            assert.equal(
              (
                await POST(request('/activity', {}), {
                  params: { id: chapter.id },
                })
              ).status,
              200,
            );
          assert.equal(
            await prisma.studyDay.count({ where: { userId: user.id } }),
            1,
          );
          assert.equal(
            await prisma.chapterView.count({ where: { userId: user.id } }),
            1,
          );
        },
      );
      const group = await prisma.studyGroup.create({
        data: {
          name: 'Test group',
          batchId: batch.id,
          boardId: board.id,
          classId: klass.id,
          schoolName: school.normalizedName,
          academicYear: '2026-2027',
          createdById: user.id,
          members: {
            create: {
              userId: user.id,
              enrollmentId: enrollment.id,
              role: 'OWNER',
            },
          },
        },
      });
      groupId = group.id;
      await t.test(
        'latest messages survive beyond 200 posts and older pages do not overlap',
        async () => {
          await prisma.groupPost.createMany({
            data: Array.from({ length: 205 }, (_, i) => ({
              id: `${prefix}-post-${String(i).padStart(3, '0')}`,
              groupId,
              authorId: user.id,
              body: `Message ${i}`,
              mentionIds: [],
              createdAt: new Date(1700000000000 + i * 1000),
            })),
          });
          const { GET } = await import('../src/app/api/groups/[id]/route');
          const first = await (
            await GET(request('/group'), { params: { id: groupId } })
          ).json();
          assert.equal(first.data.posts.length, 50);
          assert.equal(first.data.posts.at(-1).body, 'Message 204');
          const second = await (
            await GET(request(`/group?before=${first.data.nextCursor}`), {
              params: { id: groupId },
            })
          ).json();
          assert.equal(second.data.posts.at(-1).body, 'Message 154');
          assert.equal(
            new Set(
              [...first.data.posts, ...second.data.posts].map((p: any) => p.id),
            ).size,
            100,
          );
        },
      );
      await t.test(
        'reading a notification does not clear unrelated notifications',
        async () => {
          const note = await prisma.notification.create({
            data: { userId: user.id, actorName: 'Peer', type: 'FILE' },
          });
          await prisma.notification.create({
            data: { userId: user.id, actorName: 'Peer', type: 'CARD' },
          });
          const { POST } = await import('../src/app/api/notifications/route');
          assert.equal(
            (await POST(request('/notifications', { id: note.id }))).status,
            200,
          );
          assert.equal(
            await prisma.notification.count({
              where: { userId: user.id, read: false },
            }),
            1,
          );
        },
      );
      await t.test(
        'quiz answers cannot change after revealing the solution',
        async () => {
          const poll = await prisma.groupPoll.create({
            data: {
              groupId,
              createdById: user.id,
              type: 'QUIZ',
              question: 'Choose',
              options: {
                create: [{ text: 'A', isCorrect: true }, { text: 'B' }],
              },
            },
            include: { options: true },
          });
          const { POST } =
            await import('../src/app/api/groups/[id]/polls/[pid]/vote/route');
          assert.equal(
            (
              await POST(request('/vote', { optionId: poll.options[0].id }), {
                params: { id: groupId, pid: poll.id },
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await POST(request('/vote', { optionId: poll.options[1].id }), {
                params: { id: groupId, pid: poll.id },
              })
            ).status,
            409,
          );
        },
      );
      await t.test(
        'batch lifecycle isolates years, sections, approvals, promotion and transfers',
        async () => {
          const { studentProfile } = await import('../src/lib/student');
          const { transitionEnrollment } =
            await import('../src/lib/enrollments');
          const { getEligibleGroup } = await import('../src/lib/groups');
          const { studentAssessment } = await import('../src/lib/assessment');
          const { GET: history } =
            await import('../src/app/api/content/history/route');
          const { GET: archive } =
            await import('../src/app/api/content/history/groups/[id]/route');
          await prisma.enrollment.update({
            where: { id: enrollment.id },
            data: { status: 'PENDING' },
          });
          await assert.rejects(studentProfile(user.id), /approval/);
          const approval = {
            studentId: user.id,
            enrollmentId: enrollment.id,
            action: 'APPROVE' as const,
            reason: 'Verified school roster',
          };
          const results = await Promise.allSettled([
            transitionEnrollment(user.id, approval),
            transitionEnrollment(user.id, approval),
          ]);
          assert.equal(
            results.filter((r) => r.status === 'fulfilled').length,
            1,
          );
          const other = await prisma.batch.create({
            data: {
              schoolId: school.id,
              boardId: board.id,
              classId: klass.id,
              academicYear: '2026-2027',
              section: 'B',
              label: 'Other section',
            },
          });
          const wrong = await prisma.assessment.create({
            data: {
              batchId: other.id,
              subjectId: subject.id,
              title: 'Other batch',
              type: 'QUIZ',
              status: 'PUBLISHED',
            },
          });
          await assert.rejects(
            studentAssessment(wrong.id, await studentProfile(user.id)),
            /not available/,
          );
          const nextClass = await prisma.class.create({
            data: { boardId: board.id, name: 'Class 11', level: 11 },
          });
          const next = await prisma.batch.create({
            data: {
              schoolId: school.id,
              boardId: board.id,
              classId: nextClass.id,
              academicYear: '2027-2028',
              label: 'Next year',
            },
          });
          await assert.rejects(
            transitionEnrollment(user.id, {
              studentId: user.id,
              enrollmentId: enrollment.id,
              action: 'PROMOTE',
              targetBatchId: other.id,
              reason: 'Invalid same-year promotion',
            }),
            /next academic year/,
          );
          const unfinishedAssessment = await prisma.assessment.create({
            data: {
              batchId: batch.id,
              subjectId: subject.id,
              title: 'Unfinished work',
              type: 'QUIZ',
              status: 'PUBLISHED',
              totalMarks: 2,
              questions: { create: { questionId: question.id, marks: 2 } },
            },
          });
          const unfinished = await prisma.attempt.create({
            data: {
              assessmentId: unfinishedAssessment.id,
              studentId: user.id,
              enrollmentId: enrollment.id,
              status: 'IN_PROGRESS',
              maxScore: 2,
            },
          });
          await assert.rejects(
            transitionEnrollment(user.id, {
              studentId: user.id,
              enrollmentId: enrollment.id,
              action: 'PROMOTE',
              targetBatchId: next.id,
              reason: 'Try before finishing',
            }),
            /Finalize open attempts/,
          );
          await writeAttempt(
            unfinished.id,
            user.id,
            {
              revision: 0,
              answers: [{ questionId: question.id, numericAnswer: 4 }],
            },
            true,
            true,
          );
          assert.equal(
            (
              await prisma.attempt.findUniqueOrThrow({
                where: { id: unfinished.id },
              })
            ).score,
            0,
            'admin finalization must not accept new answers',
          );
          const future = await transitionEnrollment(user.id, {
            studentId: user.id,
            enrollmentId: enrollment.id,
            action: 'PROMOTE',
            targetBatchId: next.id,
            reason: 'School confirmed promotion',
          });
          assert.equal((await studentProfile(user.id)).batchId, next.id);
          await assert.rejects(
            getEligibleGroup(groupId, await studentProfile(user.id)),
            /not for your/,
          );
          assert.equal(
            (await archive(request('/archive'), { params: { id: groupId } }))
              .status,
            200,
          );
          assert.ok(
            (
              await (await history(request('/history'))).json()
            ).data.attempts.some((a: { id: string }) => a.id === attemptId),
          );
          const transferSchool = await prisma.school.create({
            data: {
              name: `${prefix} destination`,
              normalizedName: `${prefix} destination`,
            },
          });
          const newSection = await prisma.batch.create({
            data: {
              schoolId: transferSchool.id,
              boardId: board.id,
              classId: nextClass.id,
              academicYear: '2027-2028',
              section: 'B',
              label: 'Transfer destination',
            },
          });
          const oldGroup = await prisma.studyGroup.create({
            data: {
              batchId: next.id,
              name: 'Prior transfer group',
              boardId: board.id,
              classId: nextClass.id,
              schoolName: prefix,
              academicYear: '2027-2028',
              createdById: user.id,
              members: {
                create: {
                  userId: user.id,
                  enrollmentId: future!.id,
                  role: 'OWNER',
                },
              },
            },
          });
          try {
            const transferred = await transitionEnrollment(user.id, {
              studentId: user.id,
              enrollmentId: future!.id,
              action: 'TRANSFER',
              targetBatchId: newSection.id,
              reason: 'Verified section transfer',
            });
            assert.equal(
              (
                await archive(request('/archive'), {
                  params: { id: oldGroup.id },
                })
              ).status,
              403,
            );
            await transitionEnrollment(user.id, {
              studentId: user.id,
              enrollmentId: transferred!.id,
              action: 'GRADUATE',
              reason: 'School confirmed completion',
            });
            await assert.rejects(studentProfile(user.id), /approval/);
            assert.equal(
              await prisma.enrollment.count({
                where: { studentId: user.id, status: 'ACTIVE' },
              }),
              0,
            );
          } finally {
            await prisma.studyGroup.delete({ where: { id: oldGroup.id } });
          }
        },
      );
    } finally {
      if (groupId) await prisma.studyGroup.delete({ where: { id: groupId } });
      await prisma.attempt.deleteMany({ where: { studentId: user.id } });
      await prisma.enrollment.deleteMany({ where: { studentId: user.id } });
      await prisma.assessment.deleteMany({
        where: { subject: { class: { boardId: board.id } } },
      });
      await prisma.batch.deleteMany({ where: { boardId: board.id } });
      await prisma.school.deleteMany({
        where: { normalizedName: { startsWith: prefix } },
      });
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.board.delete({ where: { id: board.id } });
      await prisma.$disconnect();
    }
  },
);
