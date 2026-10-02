import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availableAcademicYears,
  isAvailableAcademicYear,
} from '../src/lib/academicYears';
test('signup years are newest first with no future option', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  assert.deepEqual(availableAcademicYears(now), [
    '2026-2027',
    '2025-2026',
    '2024-2025',
    '2023-2024',
    '2022-2023',
  ]);
  for (const value of ['2027-2028', '2026-2028', '2021-2022', '2026', ''])
    assert.equal(isAvailableAcademicYear(value, now), false);
});
test('academic year changes at April 1 India time, not January 1', () => {
  assert.equal(
    availableAcademicYears(new Date('2027-01-01T00:00:00Z'))[0],
    '2026-2027',
  );
  assert.equal(
    availableAcademicYears(new Date('2027-03-31T18:29:59Z'))[0],
    '2026-2027',
  );
  assert.equal(
    availableAcademicYears(new Date('2027-03-31T18:30:00Z'))[0],
    '2027-2028',
  );
});

test('registration validation rejects future years even if the dropdown is bypassed', async () => {
  const { registerSchema } = await import('../src/lib/validation');
  const current = availableAcademicYears()[0];
  const next = Number(current.slice(0, 4)) + 1;
  const form = {
    email: 'student@example.test',
    password: 'TestPassword123',
    fullName: 'Test Student',
    boardId: 'board',
    classId: 'class',
    schoolId: 'school',
    academicYear: current,
  };
  assert.equal(registerSchema.safeParse(form).success, true);
  assert.equal(
    registerSchema.safeParse({ ...form, academicYear: `${next}-${next + 1}` })
      .success,
    false,
  );
});
