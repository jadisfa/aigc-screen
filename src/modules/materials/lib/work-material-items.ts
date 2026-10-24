export type WorkGeneratedItem = {
  kind?: string;
  url?: string;
  text?: string;
};

export function parseWorkItems(itemsJson: string | null | undefined): WorkGeneratedItem[] {
  if (!itemsJson) return [];
  try {
    const parsed = JSON.parse(itemsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function firstItemUrl(items: WorkGeneratedItem[], kind?: string): string {
  const match = items.find((item) => {
    const url = typeof item.url === "string" ? item.url.trim() : "";
    if (!url) return false;
    if (!kind) return true;
    const itemKind = typeof item.kind === "string" ? item.kind.trim().toLowerCase() : "";
    return !itemKind || itemKind === kind;
  });
  return typeof match?.url === "string" ? match.url.trim() : "";
}

/** 封面优先；没有封面时回退到 itemsJson 里对应类型的成片地址。 */
export function resolveWorkPreviewUrl(
  coverUrl: string | null | undefined,
  items: WorkGeneratedItem[],
  kind: "image" | "video",
): string {
  const cover = coverUrl?.trim();
  if (cover) return cover;
  return firstItemUrl(items, kind);
}

export function workImageUrls(items: WorkGeneratedItem[]): string[] {
  return items
    .filter((item): item is WorkGeneratedItem & { url: string } => {
      const url = typeof item.url === "string" ? item.url.trim() : "";
      if (!url) return false;
      const itemKind = typeof item.kind === "string" ? item.kind.trim().toLowerCase() : "";
      return !itemKind || itemKind === "image";
    })
    .map((item) => item.url.trim());
}
