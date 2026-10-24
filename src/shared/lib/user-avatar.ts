function dicebearAvatarUrl(seed: string, size = 64): string {
  const s = (seed ?? "").trim() || "user";
  const qs = new URLSearchParams({
    seed: s,
    size: String(size),
  });
  return `https://api.dicebear.com/9.x/fun-emoji/svg?${qs.toString()}`;
}

export function normalizeAvatarUrl(value?: string | null): string {
  return (value || "").trim();
}

export function resolveUserAvatarUrl(value: string | null | undefined, seed: string, size = 64): string {
  return normalizeAvatarUrl(value) || dicebearAvatarUrl(seed || "user", size);
}

export function getUserAvatarFallback(name?: string | null, emptyFallback = "U"): string {
  const value = (name || "").trim();
  if (!value) return emptyFallback;
  const first = value.charAt(0);
  return /[\u4e00-\u9fa5]/.test(first) ? first : first.toUpperCase();
}
