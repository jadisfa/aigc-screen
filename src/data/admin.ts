export type BannerKind = "image" | "video";
export type BannerStatus = "on" | "off";
export type BannerTab = "home" | "screen";
// export type BannerTab = "all" | "image" | "video";
export type LibraryBadge = "listed" | "stored" | "";

export type BannerItem = {
  id: string;
  title: string;
  image: string;
  kind: BannerKind;
  official: boolean;
  status: BannerStatus;
  createdAt: string;
  sortNo?: number | null;
  libraryId?: string | null;
  storeAdId?: string | null;
  configId?: string | null;
  inUse?: boolean;
  contentJson?: string | null;
  link?: string;
  poster?: string;
  previewUrl?: string
};

export type LibraryMedia = {
  src: string;
  cover: string;
  link: string;
};

export type LibraryPoster = {
  id: string;
  title: string;
  image: string;
  images: LibraryMedia[];
  kind: BannerKind;
  badge: LibraryBadge;
  link: string;
};

export type StatusFilter = "all" | "on" | "off";

const BANNER_KEY = "admin.banners";
const LIBRARY_KEY = "admin.library";

export const ADMIN_POINTS = 1000;
export const BANNER_MEDIA_LIMIT = 5;

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
  { id: "p1", title: "万圣节主题海报", image: "/static/admin/poster-1.png", images: [{ src: "/static/admin/poster-1.png", cover: "/static/admin/poster-1.png", link: "" }], kind: "image", badge: "", link: "不跳转" },
  { id: "p2", title: "top返场海报", image: "/static/admin/poster-2.png", images: [{ src: "/static/admin/poster-2.png", cover: "/static/admin/poster-2.png", link: "" }], kind: "image", badge: "listed", link: "不跳转" },
  { id: "p3", title: "高考主题海报", image: "/static/admin/poster-3.png", images: [{ src: "/static/admin/poster-3.png", cover: "/static/admin/poster-3.png", link: "" }], kind: "image", badge: "stored", link: "不跳转" },
];

export const LINK_OPTIONS = ["嫩黄法式彩钻小花美甲", "万圣节主题海报", "不跳转"];

export const ADMIN_TILES = [
  { id: "banner", label: "广告物料管理", icon: "/static/admin/tile-banner.svg", action: "banner" as const },
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

export function isCustomBanner(row: { isCustom?: string | null; libraryId?: string | null }): boolean {
  const flag = (row.isCustom || "").trim().toLowerCase();
  if (flag === "yes" || flag === "true" || flag === "1") {
    return true;
  }
  if (flag === "no" || flag === "false" || flag === "0") {
    return false;
  }
  return !(row.libraryId || "").trim();
}

export function bannerLinkFromContent(contentJson?: string | null): string {
  try {
    const root = JSON.parse(contentJson || "{}") as {
      items?: Array<{ linkUrl?: string; link?: string }>;
      linkUrl?: string;
      link?: string;
    };
    const item = Array.isArray(root.items) ? root.items[0] : root;
    const link = (item?.linkUrl || item?.link || "").trim();
    return link || "不跳转";
  } catch {
    return "不跳转";
  }
}

export function toBannerItem(row: {
  configId?: string | null;
  libraryId?: string | null;
  storeAdId?: string | null;
  adName?: string;
  isCustom?: string;
  openDeviceConfig?: string | null;
  createdAt?: string | null;
  displayForm?: string;
  previewUrl?: string | null;
  sortNo?: number | null;
  contentJson?: string | null;
  poster?: string
}): BannerItem {
  const storeAdId = (row.storeAdId || "").trim() || null;
  const configId = (row.configId || "").trim() || null;
  return {
    id: storeAdId || configId || "",
    title: row.adName || "未命名轮播",
    image: row.previewUrl || "/static/admin/thumb.png",
    kind: bannerKindFromForm(row.displayForm),
    official: !isCustomBanner(row),
    status: row.openDeviceConfig === "yes" ? "on" : "off",
    createdAt: nowStamp(row.createdAt),
    sortNo: row.sortNo,
    libraryId: row.libraryId,
    storeAdId,
    configId,
    inUse: Boolean(storeAdId && configId),
    contentJson: row.contentJson,
    link: bannerLinkFromContent(row.contentJson),
	poster: row.poster
  };
}

const VIDEO_FILE = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;

function isVideoUrl(value: string) {
  return value.startsWith("data:video") || VIDEO_FILE.test(value);
}

function stillUrl(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const value = (candidate || "").trim();
    if (value && !isVideoUrl(value)) {
      return value;
    }
  }
  return "";
}

function readContentMedia(
  item: { imageUrl?: string; videoUrl?: string; url?: string; coverUrl?: string; linkUrl?: string; link?: string },
  kind?: BannerKind,
): LibraryMedia | null {
  const imageUrl = (item.imageUrl || "").trim();
  const videoUrl = (item.videoUrl || "").trim();
  const url = (item.url || "").trim();
  const coverUrl = (item.coverUrl || "").trim();
  const link = (item.linkUrl || item.link || "").trim();
  const video = kind === "video" || Boolean(videoUrl) || isVideoUrl(url) || isVideoUrl(imageUrl);
  if (video && kind !== "image") {
    const src = videoUrl || (isVideoUrl(url) ? url : "") || (isVideoUrl(imageUrl) ? imageUrl : "") || url || imageUrl;
    if (!src) {
      return null;
    }
    const cover = stillUrl(coverUrl, imageUrl, url);
    return { src, cover: cover === src ? "" : cover, link };
  }
  const src = imageUrl || url || coverUrl || videoUrl;
  if (!src) {
    return null;
  }
  return { src, cover: stillUrl(src, coverUrl) || (isVideoUrl(src) ? "" : src), link };
}

export function libraryMediaFromContent(
  contentJson?: string | null,
  previewUrl?: string | null,
  kind?: BannerKind,
): LibraryMedia[] {
  try {
    const root = JSON.parse(contentJson || "{}") as {
      items?: Array<{ imageUrl?: string; videoUrl?: string; url?: string; coverUrl?: string; linkUrl?: string; link?: string }>;
    };
    const media = (Array.isArray(root.items) ? root.items : [])
      .map((item) => readContentMedia(item, kind))
      .filter((item): item is LibraryMedia => item != null);
    if (media.length) {
      return media;
    }
  } catch {
    /* 回落到封面 */
  }
  const fallback = (previewUrl || "").trim();
  if (!fallback) {
    return [];
  }
  const video = kind === "video" || isVideoUrl(fallback);
  return [{ src: fallback, cover: video ? "" : fallback, link: "" }];
}

export function mediaShot(
  contentJson?: string | null,
  previewUrl?: string | null,
  kind?: BannerKind,
): { src: string; cover: string } {
  const first = libraryMediaFromContent(contentJson, previewUrl, kind)[0];
  if (!first) {
    return { src: "", cover: "" };
  }
  return { src: first.src, cover: first.cover };
}

export function toLibraryPoster(
  row: {
    libraryId?: string | null;
    adName?: string;
    displayForm?: string;
    previewUrl?: string | null;
    contentJson?: string | null;
  },
  deviceLibraryIds: Set<string>,
  listedLibraryIds: Set<string>,
): LibraryPoster {
  const id = row.libraryId || "";
  const kind = bannerKindFromForm(row.displayForm);
  const images = libraryMediaFromContent(row.contentJson, row.previewUrl, kind);
  let badge: LibraryBadge = "";
  if (listedLibraryIds.has(id)) {
    badge = "listed";
  } else if (deviceLibraryIds.has(id)) {
    badge = "stored";
  }
  return {
    id,
    title: row.adName || "未命名海报",
    image: images[0]?.cover || images[0]?.src || row.previewUrl || "/static/admin/poster-1.png",
    images,
    kind,
    badge,
    link: images.find((item) => item.link)?.link || bannerLinkFromContent(row.contentJson),
  };
}
