import { prisma } from "@/lib/prisma";

export const DEFAULT_COMPANY_NAME = process.env.COMPANY_NAME?.trim() || "GRACE DIVINE";

export async function getCompanyName(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: "COMPANY_NAME" } });
  return setting?.value.trim() || DEFAULT_COMPANY_NAME;
}

export function getCompanyInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("fr") ?? "").join("");
}
export const PRIVACY_POLICY_VERSION = "2026-03-13";
