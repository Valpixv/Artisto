export function normalizeContactUrl(value: string) {
  const trimmed = value.trim().slice(0, 500);
  if (!trimmed) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return `mailto:${trimmed}`;
  try {
    const url = new URL(trimmed);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function coordinate(value: FormDataEntryValue | null, minimum: number, maximum: number) {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}
