// Employment screening rules must be tied to job requirements rather than
// protected personal characteristics. This is a focused guard for direct
// questions; a human still needs to review the content of every offer.
export function isSensitiveScreeningQuestion(text: string): boolean {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(age|naissance|sexe|race|ethni\w*|religion|syndicat|opinion\s+politique)\b/.test(normalized)
    || /\b(plus|moins)\s+de\s+(?:1[5-9]|[2-9]\d)\s*ans\b/.test(normalized);
}
