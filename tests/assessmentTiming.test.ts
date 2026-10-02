import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessmentDeadline,
  hasExpired,
  remainingSeconds,
} from '../src/lib/assessmentTiming';

test('deadline respects the earlier of duration and due date', () => {
  const start = new Date('2026-10-02T10:00:00Z');
  assert.equal(
    assessmentDeadline(start, 600, null)?.toISOString(),
    '2026-10-02T10:10:00.000Z',
  );
  assert.equal(
    assessmentDeadline(
      start,
      600,
      new Date('2026-10-02T10:05:00Z'),
    )?.toISOString(),
    '2026-10-02T10:05:00.000Z',
  );
  assert.equal(assessmentDeadline(start, null, null), null);
});
test('deadline boundary expires exactly, while elapsed time survives reload', () => {
  const deadline = new Date('2026-10-02T10:10:00Z');
  assert.equal(
    hasExpired(deadline, new Date('2026-10-02T10:09:59.999Z')),
    false,
  );
  assert.equal(hasExpired(deadline, deadline), true);
  assert.equal(
    remainingSeconds(
      deadline.toISOString(),
      Date.parse('2026-10-02T10:07:00Z'),
    ),
    180,
  );
  assert.equal(
    remainingSeconds(
      deadline.toISOString(),
      Date.parse('2026-10-02T11:00:00Z'),
    ),
    0,
  );
});
