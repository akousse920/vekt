/** A date entered in Benin is inclusive through 23:59:59 local time (UTC+1). */
export function deadlineFromDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Date limite invalide.");
  const date = new Date(`${value}T23:59:59.999+01:00`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Date limite invalide.");
  return date;
}

export function isApplicationClosed(deadline: Date | null, now = new Date()): boolean {
  return deadline !== null && now.getTime() > deadline.getTime();
}
