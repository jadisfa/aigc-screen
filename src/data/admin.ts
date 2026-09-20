export type BannerKind = "image" | "video";
export type BannerStatus = "on" | "off";
export type BannerTab = "all" | "image" | "video";
export type LibraryBadge = "listed" | "stored" | "";

export type BannerItem = {
  id: string;
  title: string;
  image: string;
  kind: BannerKind;
  official: boolean;
  status: BannerStatus;
  createdAt: string;
};

export type LibraryPoster = {
  id: string;
  title: string;
  image: string;
  kind: BannerKind;
  badge: LibraryBadge;
};

export type StatusFilter = "all" | "on" | "off";

const BANNER_KEY = "admin.banners";
const LIBRARY_KEY = "admin.library";

export const ADMIN_POINTS = 1000;

export const DEFAULT_BANNERS: BannerItem[] = [
  {
    id: "b1",
    title: "嫩黄法式彩钻小花美甲",
    image: "/static/admin/thumb.png",
    kind: "image",
    official: true,
    status: "on",
    createdAt: "2026-06-19 14:45:35",
  },
  {
    id: "b2",
    title: "嫩黄法式彩钻小花美甲",
    image: "/static/admin/thumb.png",
    kind: "video",
    official: false,
    status: "off",
    createdAt: "2026-06-19 14:45:35",
  },
  {
    id: "b3",
    title: "嫩黄法式彩钻小花美甲",
    image: "/static/admin/thumb.png",
    kind: "video",
    official: false,
    status: "on",
    createdAt: "2026-06-19 14:45:35",
  },
  {
    id: "b4",
    title: "嫩黄法式彩钻小花美甲",
    image: "/static/admin/thumb.png",
    kind: "video",
    official: false,
    status: "on",
    createdAt: "2026-06-19 14:45:35",
  },
];

export const LIBRARY_POSTERS: LibraryPoster[] = [
  { id: "p1", title: "万圣节主题海报", image: "/static/admin/poster-1.png", kind: "image", badge: "" },
  { id: "p2", title: "top返场海报", image: "/static/admin/poster-2.png", kind: "image", badge: "listed" },
  { id: "p3", title: "高考主题海报", image: "/static/admin/poster-3.png", kind: "image", badge: "stored" },
  { id: "p4", title: "top返场海报", image: "/static/admin/poster-2.png", kind: "image", badge: "" },
  { id: "p5", title: "高考主题海报", image: "/static/admin/poster-3.png", kind: "image", badge: "" },
  { id: "p6", title: "万圣节主题海报", image: "/static/admin/poster-1.png", kind: "image", badge: "" },
  { id: "p7", title: "万圣节主题海报", image: "/static/admin/poster-1.png", kind: "image", badge: "" },
  { id: "p8", title: "top返场海报", image: "/static/admin/poster-2.png", kind: "image", badge: "" },
  { id: "p9", title: "高考主题海报", image: "/static/admin/poster-3.png", kind: "image", badge: "" },
];

export const LINK_OPTIONS = ["嫩黄法式彩钻小花美甲", "万圣节主题海报", "不跳转"];

export const ADMIN_TILES = [
  { id: "banner", label: "banner轮播管理", icon: "/static/admin/tile-banner.svg", action: "banner" as const },
  { id: "store", label: "门店信息设置", icon: "/static/admin/tile-store.svg", action: "store" as const },
  { id: "history", label: "查看生成历史", icon: "/static/admin/tile-history.svg", action: "history" as const },
  { id: "product", label: "商品管理", icon: "/static/admin/tile-product.svg", action: "product" as const },
  { id: "hand", label: "AI试甲-手模库管理", icon: "/static/admin/tile-hand.svg", action: "hand" as const },
  { id: "version", label: "版本信息", icon: "/static/admin/tile-version.svg", action: "version" as const },
];

export type AdminTileAction = (typeof ADMIN_TILES)[number]["action"];

export function readBanners(): BannerItem[] {
  try {
    const raw = uni.getStorageSync(BANNER_KEY);
    if (raw) {
      return JSON.parse(raw) as BannerItem[];
    }
  } catch {
    /* seed */
  }
  writeBanners(DEFAULT_BANNERS);
  return DEFAULT_BANNERS.slice();
}

export function writeBanners(items: BannerItem[]) {
  uni.setStorageSync(BANNER_KEY, JSON.stringify(items));
}

export function readLibrary(): LibraryPoster[] {
  try {
    const raw = uni.getStorageSync(LIBRARY_KEY);
    if (raw) {
      return JSON.parse(raw) as LibraryPoster[];
    }
  } catch {
    /* seed */
  }
  writeLibrary(LIBRARY_POSTERS);
  return LIBRARY_POSTERS.slice();
}

export function writeLibrary(items: LibraryPoster[]) {
  uni.setStorageSync(LIBRARY_KEY, JSON.stringify(items));
}

export function nowStamp(value?: string | null) {
  if (value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }
  }
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function badgeText(badge: LibraryBadge) {
  if (badge === "listed") {
    return "已上架";
  }
  if (badge === "stored") {
    return "已入库";
  }
  return "";
}

export function bannerKindFromForm(displayForm?: string | null): BannerKind {
  return displayForm === "video_dynamic" ? "video" : "image";
}

export function toBannerItem(row: {
  configId?: string | null;
  adName?: string;
  isCustom?: string;
  openDeviceConfig?: string | null;
  createdAt?: string | null;
  displayForm?: string;
  previewUrl?: string | null;
}): BannerItem {
  return {
    id: row.configId || "",
    title: row.adName || "未命名轮播",
    image: row.previewUrl || "/static/admin/thumb.png",
    kind: bannerKindFromForm(row.displayForm),
    official: row.isCustom !== "yes",
    status: row.openDeviceConfig === "yes" ? "on" : "off",
    createdAt: nowStamp(row.createdAt),
  };
}

export function toLibraryPoster(
  row: {
    libraryId?: string | null;
    adName?: string;
    displayForm?: string;
    previewUrl?: string | null;
  },
  deviceLibraryIds: Set<string>,
  listedLibraryIds: Set<string>,
): LibraryPoster {
  const id = row.libraryId || "";
  let badge: LibraryBadge = "";
  if (listedLibraryIds.has(id)) {
    badge = "listed";
  } else if (deviceLibraryIds.has(id)) {
    badge = "stored";
  }
  return {
    id,
    title: row.adName || "未命名海报",
    image: row.previewUrl || "/static/admin/poster-1.png",
    kind: bannerKindFromForm(row.displayForm),
    badge,
  };
}
