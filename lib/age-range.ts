/** A birth year alone gives two possible ages until the birthday is known. */
export function assessBirthYear(birthYear: number, minAge: number | null, maxAge: number | null, currentYear: number): "within" | "boundary" | "outside" {
  const youngest = currentYear - birthYear - 1;
  const oldest = currentYear - birthYear;
  if ((minAge !== null && oldest < minAge) || (maxAge !== null && youngest > maxAge)) return "outside";
  if ((minAge !== null && youngest < minAge) || (maxAge !== null && oldest > maxAge)) return "boundary";
  return "within";
}
