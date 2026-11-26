/** A birth year alone gives two possible ages until the birthday is known. */
export function assessBirthYear(birthYear: number, minAge: number | null, maxAge: number | null, currentYear: number): "within" | "boundary" | "outside" {
  const youngest = currentYear - birthYear - 1;
  const oldest = currentYear - birthYear;
  if ((minAge !== null && oldest < minAge) || (maxAge !== null && youngest > maxAge)) return "outside";
  if ((minAge !== null && youngest < minAge) || (maxAge !== null && oldest > maxAge)) return "boundary";
  return "within";
}

/** Dates are interpreted in Benin's local calendar (UTC+1, no DST). */
export function beninToday(now = new Date()): string {
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function ageOnDate(birthDate: string, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const parsed = new Date(`${birthDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birthDate || birthDate > today) return null;
  const [year, month, day] = birthDate.split("-").map(Number);
  const [currentYear, currentMonth, currentDay] = today.split("-").map(Number);
  const age = currentYear - year - (currentMonth < month || (currentMonth === month && currentDay < day) ? 1 : 0);
  return age >= 0 && age <= 120 ? age : null;
}
