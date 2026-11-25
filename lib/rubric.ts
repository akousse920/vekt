export type RubricCriterionInput = {
  id: string;
  label: string;
  weight: number;
  required: boolean;
  order: number;
};

export type RubricScoreInput = {
  criterionId: string;
  score: number;
  evidence: string;
};

export function scoreWeightedRubric(
  rubric: RubricCriterionInput[],
  scores: RubricScoreInput[] | undefined,
): { score: number; breakdown: RubricScoreInput[]; reviewReasons: string[] } {
  if (rubric.length === 0) throw new Error("A rubric is required");
  if (rubric.reduce((total, item) => total + item.weight, 0) !== 100) {
    throw new Error("Rubric weights must total 100");
  }
  if (!Array.isArray(scores) || scores.length !== rubric.length) {
    throw new Error("AI did not score every rubric criterion");
  }
  const byId = new Map<string, RubricScoreInput>();
  for (const item of scores) {
    if (
      typeof item?.criterionId !== "string" ||
      typeof item.score !== "number" ||
      !Number.isFinite(item.score) ||
      item.score < 0 || item.score > 100 ||
      typeof item.evidence !== "string" || !item.evidence.trim() ||
      byId.has(item.criterionId)
    ) throw new Error("AI returned an invalid rubric score");
    byId.set(item.criterionId, item);
  }
  let weighted = 0;
  const breakdown: RubricScoreInput[] = [];
  const reviewReasons: string[] = [];
  for (const criterion of rubric) {
    const item = byId.get(criterion.id);
    if (!item) throw new Error(`AI omitted criterion ${criterion.id}`);
    weighted += item.score * criterion.weight / 100;
    breakdown.push(item);
    if (criterion.required && item.score < 50) {
      reviewReasons.push(`Compétence obligatoire à revoir : ${criterion.label} (${item.score}/100).`);
    }
  }
  return { score: Math.round(weighted), breakdown, reviewReasons };
}
