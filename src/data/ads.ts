import type { DeviceAds, ScreenBanner } from "@/lib/screen-api/banners";
// 全屏广告显示时间
export const FULLSCREEN_IDLE_MS = 5 * 60 * 1000;
export const FULLSCREEN_IMAGE_MS = 8000;

export type AdMediaKind = "image" | "video";

export type KioskAdSlide = {
  id: string;
  src: string;
  mediaKind: AdMediaKind;
};

function isOpen(row: ScreenBanner): boolean {
  return (row.openDeviceConfig || "").toLowerCase() === "yes";
}

function mediaKind(displayForm?: string | null): AdMediaKind {
  return displayForm === "video_dynamic" ? "video" : "image";
}

function mediaSrcs(row: ScreenBanner): string[] {
  try {
    const root = JSON.parse(row.contentJson || "{}") as {
      items?: Array<{ imageUrl?: string; videoUrl?: string; url?: string; coverUrl?: string }>;
    };
    const items = (Array.isArray(root.items) ? root.items : [])
      .map((item) => (item.imageUrl || item.videoUrl || item.url || item.coverUrl || "").trim())
      .filter(Boolean);
    if (items.length) {
      return items;
    }
  } catch {
    /* 回落到封面 */
  }
  const fallback = (row.previewUrl || "").trim();
  return fallback ? [fallback] : [];
}

function listedSlot(slot: ScreenBanner | null | undefined, prefix: string): KioskAdSlide[] {
  if (!slot || !isOpen(slot)) {
    return [];
  }
  const kind = mediaKind(slot.displayForm);
  return mediaSrcs(slot).map((src, itemIndex) => ({
    id: `${slot.configId || prefix}-${itemIndex}`,
    src,
    mediaKind: kind,
  }));
}

/** 已上架 Banner。无配置时首页自行回落到系统默认轮播。 */
export function listedBannerAds(ads?: DeviceAds | null): KioskAdSlide[] {
  return listedSlot(ads?.banner, "banner");
}

/** 已上架全屏广告。未配置时不进入待机播放。 */
export function listedFullscreenAds(ads?: DeviceAds | null): KioskAdSlide[] {
  return listedSlot(ads?.fullscreen, "fullscreen");
}
