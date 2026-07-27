export function normalizeDisplayText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, 160);
  return normalized || fallback;
}

export function mergeAssetMetadata(
  existing: Record<string, string> | undefined,
  displayText: unknown,
  filename: string,
) {
  return {
    ...existing,
    originalName: existing?.originalName || filename,
    displayText: normalizeDisplayText(displayText, filename),
  };
}

