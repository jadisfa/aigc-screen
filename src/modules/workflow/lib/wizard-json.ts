export function parseJsonText(input: string, label: string): { ok: true; value: unknown } | { ok: false; message: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, message: `${label} 不能为空` };
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (e) {
    return { ok: false, message: `${label} 不是合法 JSON: ${e instanceof Error ? e.message : "parse error"}` };
  }
}

export function normalizeJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

