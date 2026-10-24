export const INSPIRE_MODE_KEY = "kiosk.inspireMode";
export const INSPIRE_QUERY_KEY = "kiosk.inspireQuery";
export const INSPIRE_TAGS_KEY = "kiosk.inspireTags";
export const MAX_KEYWORD_COUNT = 6;

export type KeywordCategory = {
  title: string;
  tags: string[];
};

type DictionaryTag = {
  name?: string | null;
  groupName?: string | null;
  groupSortNo?: number | null;
  status?: string | null;
};

/** 按后台标签维度（中文名 + sortNo）分组，供灵感关键词选择。 */
export function keywordCategoriesFromTags(tags: DictionaryTag[] | null | undefined): KeywordCategory[] {
  const buckets = new Map<string, { title: string; sort: number; tags: string[]; seen: Set<string> }>();
  for (const tag of tags ?? []) {
    if ((tag.status ?? "active").trim().toLowerCase() === "disabled") {
      continue;
    }
    const name = (tag.name ?? "").trim();
    const title = (tag.groupName ?? "").trim();
    if (!name || !title) {
      continue;
    }
    const sort = tag.groupSortNo ?? Number.MAX_SAFE_INTEGER;
    let bucket = buckets.get(title);
    if (!bucket) {
      bucket = { title, sort, tags: [], seen: new Set() };
      buckets.set(title, bucket);
    }
    if (!bucket.seen.has(name)) {
      bucket.seen.add(name);
      bucket.tags.push(name);
    }
  }
  return [...buckets.values()]
    .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title, "zh"))
    .map((bucket) => ({ title: bucket.title, tags: bucket.tags }));
}
