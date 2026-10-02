// Signup policy: academic years roll over on April 1 in India.
// Keep the current year and four previous years available, newest first.
export function availableAcademicYears(now = new Date()): string[] {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')!.value);
  const month = Number(parts.find((p) => p.type === 'month')!.value);
  const currentStart = month >= 4 ? year : year - 1;
  return Array.from(
    { length: 5 },
    (_, index) => `${currentStart - index}-${currentStart - index + 1}`,
  );
}
export function isAvailableAcademicYear(
  value: string,
  now = new Date(),
): boolean {
  return availableAcademicYears(now).includes(value);
}
