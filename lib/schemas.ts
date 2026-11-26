import { z } from "zod";
import { deadlineFromDateOnly } from "./application-deadline";

export const candidateApplicationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
});

export const reviewDecisionSchema = z.object({
  decision: z.enum(["ACCEPT", "SHORTLIST", "REJECT"]),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const jobSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().min(1, "Description is required"),
  location: z.string().optional(),
  customPrompt: z.string().optional(),
  threshold: z.number().int().min(0).max(100).optional(),
  notifyOnApplication: z.boolean().optional(),
  applicationDeadlineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => { try { deadlineFromDateOnly(value); return true; } catch { return false; } }, "Date limite invalide").nullable().optional(),
});

export const candidateAnswersSchema = z
  .array(
    z.union([
      z.object({ questionId: z.string().cuid(), optionIds: z.array(z.string().cuid()).min(1).max(10), text: z.never().optional() }),
      z.object({ questionId: z.string().cuid(), text: z.string().trim().min(1).max(2000), optionIds: z.never().optional() }),
    ]),
  )
  .max(20);

export type CandidateApplicationInput = z.infer<typeof candidateApplicationSchema>;
export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type JobInput = z.infer<typeof jobSchema>;
