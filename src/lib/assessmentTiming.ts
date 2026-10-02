/** A deadline is snapshotted when an attempt begins, not reset on resume. */
export function assessmentDeadline(
  start: Date,
  seconds: number | null,
  due: Date | null,
): Date | null {
  const times = [
    seconds == null ? null : start.getTime() + seconds * 1000,
    due?.getTime() ?? null,
  ].filter((value): value is number => value !== null);
  return times.length ? new Date(Math.min(...times)) : null;
}
export function hasExpired(deadline: Date | null, now = new Date()): boolean {
  return deadline !== null && now.getTime() >= deadline.getTime();
}
export function remainingSeconds(deadline: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));
}
