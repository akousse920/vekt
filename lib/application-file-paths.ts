export function applicationFilePaths(value: string, type: string): string[] {
  if (type === "FILE") return [value];
  if (type !== "FILES") return [];
  try {
    const paths: unknown = JSON.parse(value);
    return Array.isArray(paths) ? paths.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}
