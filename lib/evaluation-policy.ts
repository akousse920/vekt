import { EmailType } from "@/generated/client";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { meetsThreshold } from "@/lib/scoring";

export async function readAutoRejectSetting(): Promise<boolean> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "AUTO_REJECT_BELOW_THRESHOLD" },
    });
    return setting?.value === "true";
  } catch (error) {
    logger.warn({ error }, "Auto-reject setting unreadable, defaulting to human review");
    return false;
  }
}

export function evaluationEmailTypeFor(
  score: number,
  threshold: number,
  autoRejectEnabled: boolean,
): EmailType | null {
  if (meetsThreshold(score, threshold)) return EmailType.SHORTLISTED;
  return autoRejectEnabled ? EmailType.REJECTED : null;
}
