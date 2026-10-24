export type HandItem = {
  id: string;
  name: string;
  image: string;
  official: boolean;
  catalogId?: string;
  sortNo?: number | null;
};

export type OfficialHand = {
  id: string;
  name: string;
  image: string;
};

const HAND_KEY = "admin.hands";

export const HAND_LIMIT = 10;
export const OFFICIAL_PICK_LIMIT = 8;

const OFFICIAL_IMAGES = [
  "/static/admin/hand-grid.png",
  "/static/tryon/hand-1.png",
  "/static/tryon/hand-2.png",
  "/static/tryon/hand-3.png",
  "/static/tryon/hand-4.png",
  "/static/tryon/hand-5.png",
  "/static/tryon/hand-6.png",
  "/static/admin/hand-detail.png",
];

export const OFFICIAL_HANDS: OfficialHand[] = Array.from({ length: 12 }, (_, i) => ({
  id: `oh${i + 1}`,
  name: `官方手模${String(i + 1).padStart(2, "0")}`,
  image: OFFICIAL_IMAGES[i % OFFICIAL_IMAGES.length],
}));

const CUSTOM_IMAGES = [
  "/static/tryon/hand-picked.png",
  "/static/tryon/hand-1.png",
  "/static/tryon/hand-3.png",
  "/static/tryon/hand-5.png",
  "/static/admin/hand-detail.png",
];

export const DEFAULT_HANDS: HandItem[] = [
  ...OFFICIAL_HANDS.slice(0, 4).map((row) => ({
    id: `store-${row.id}`,
    name: row.name,
    image: row.image,
    official: true,
    catalogId: row.id,
  })),
  ...CUSTOM_IMAGES.map((image, i) => ({
    id: `c${i + 1}`,
    name: `手模${i + 1}`,
    image,
    official: false,
  })),
];

export function readHands(): HandItem[] {
  try {
    const raw = uni.getStorageSync(HAND_KEY);
    if (raw) {
      return JSON.parse(raw) as HandItem[];
    }
  } catch {
    /* seed */
  }
  writeHands(DEFAULT_HANDS);
  return DEFAULT_HANDS.slice();
}

export function writeHands(items: HandItem[]) {
  uni.setStorageSync(HAND_KEY, JSON.stringify(items));
}

export function findHand(id?: string) {
  return handCache.find((row) => row.id === id);
}

let handCache: HandItem[] = [];

export function cacheHands(items: HandItem[]) {
  handCache = items;
}

export function toHandItem(
  row: {
    configId?: string | null;
    materialId?: string;
    displayName?: string;
    assetUrl?: string;
    previewUrl?: string;
    sortNo?: number | null;
  },
  official: boolean,
): HandItem {
  const configId = row.configId || "";
  return {
    id: configId || row.materialId || "",
    name: row.displayName || (official ? "官方手模" : "自定义手模"),
    image: row.previewUrl || row.assetUrl || "/static/admin/hand-grid.png",
    official,
    catalogId: official ? row.materialId || configId : undefined,
    sortNo: row.sortNo,
  };
}

export function toSortedHandItems(list: {
  official?: Parameters<typeof toHandItem>[0][];
  custom?: Parameters<typeof toHandItem>[0][];
}): HandItem[] {
  return [
    ...(list.official || []).map((row) => toHandItem(row, true)),
    ...(list.custom || []).map((row) => toHandItem(row, false)),
  ].sort((a, b) => (a.sortNo ?? Number.MAX_SAFE_INTEGER) - (b.sortNo ?? Number.MAX_SAFE_INTEGER));
}

export function toOfficialHand(row: {
  configId?: string | null;
  materialId?: string;
  displayName?: string;
  assetUrl?: string;
  previewUrl?: string;
}): OfficialHand {
  return {
    id: row.materialId || row.configId || "",
    name: row.displayName || "官方手模",
    image: row.previewUrl || row.assetUrl || "/static/admin/hand-grid.png",
  };
}
