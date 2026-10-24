import { screenRequest } from "@/lib/screen-http";

export type ScreenBanner = {
  configId?: string | null;
  libraryId?: string | null;
  storeAdId?: string | null;
  adCode?: string;
  adName?: string;
  adCategory?: string;
  displayForm?: string;
  isCustom?: string;
  contentJson?: string;
  openDeviceConfig?: string | null;
  createdAt?: string | null;
  sortNo?: number | null;
  previewUrl?: string | null;
};

export type DeviceAds = {
  banner?: ScreenBanner | null;
  fullscreen?: ScreenBanner | null;
};

const admin = { requireAdmin: true as const };

export function fetchDeviceBanners() {
  return screenRequest<DeviceAds>("/api/screen/banners/device");
}

export function asBannerList(ads?: DeviceAds | null): ScreenBanner[] {
  return ads?.banner ? [ads.banner] : [];
}

export function bannerLibraryMarks(ads?: DeviceAds | null) {
  const stored = new Set<string>();
  const listed = new Set<string>();
  const libraryId = ads?.banner?.libraryId;
  if (libraryId) {
    stored.add(libraryId);
    if ((ads?.banner?.openDeviceConfig || "").toLowerCase() === "yes") {
      listed.add(libraryId);
    }
  }
  return { stored, listed };
}

export function bannerCatalogLibraryMarks(catalog?: ScreenBanner[] | null) {
  const stored = new Set<string>();
  const listed = new Set<string>();
  for (const row of catalog || []) {
    const libraryId = (row.libraryId || "").trim();
    if (!libraryId) {
      continue;
    }
    stored.add(libraryId);
    if (row.configId && (row.openDeviceConfig || "").toLowerCase() === "yes") {
      listed.add(libraryId);
    }
  }
  return { stored, listed };
}

export function fetchBannerCatalog() {
  return screenRequest<ScreenBanner[]>("/api/screen/banners/catalog", admin);
}

export function applyBannerCatalog(storeAdId: string, openDeviceConfig: "yes" | "no") {
  return screenRequest<ScreenBanner>("/api/screen/banners/catalog/apply", {
    ...admin,
    method: "POST",
    data: { storeAdId, openDeviceConfig },
  });
}

export function patchBannerCatalog(
  storeAdId: string,
  data: {
    openDeviceConfig?: "yes" | "no";
    adName?: string;
    assetUrl?: string;
    linkUrl?: string;
    displayForm?: string;
    assetUrls?: string[];
  },
) {
  return screenRequest<ScreenBanner>(`/api/screen/banners/catalog/${encodeURIComponent(storeAdId)}`, {
    ...admin,
    method: "PATCH",
    data,
  });
}

export function deleteBannerCatalog(storeAdId: string) {
  return screenRequest<void>(`/api/screen/banners/catalog/${encodeURIComponent(storeAdId)}`, {
    ...admin,
    method: "DELETE",
  });
}

export function fetchOfficialBanners(displayForm?: string) {
  const query = displayForm ? `?displayForm=${encodeURIComponent(displayForm)}` : "";
  return screenRequest<ScreenBanner[]>(`/api/screen/banners/official${query}`, admin);
}

export function bindOfficialBanner(libraryId: string, openDeviceConfig: "yes" | "no") {
  return screenRequest<ScreenBanner>("/api/screen/banners/device", {
    ...admin,
    method: "POST",
    data: { libraryId, openDeviceConfig },
  });
}

export function createCustomBanner(data: {
  assetUrls: string[];
  linkUrl?: string;
  displayForm?: string;
  openDeviceConfig?: "yes" | "no";
}) {
  return screenRequest<ScreenBanner>("/api/screen/banners/device/custom", {
    ...admin,
    method: "POST",
    data,
  });
}

export function patchDeviceBanner(
  configId: string,
  data: {
    openDeviceConfig?: "yes" | "no";
    adName?: string;
    assetUrl?: string;
    linkUrl?: string;
    displayForm?: string;
  },
) {
  return screenRequest<ScreenBanner>(`/api/screen/banners/device/${encodeURIComponent(configId)}`, {
    ...admin,
    method: "PATCH",
    data,
  });
}

export function deleteDeviceBanner(configId: string) {
  return screenRequest<void>(`/api/screen/banners/device/${encodeURIComponent(configId)}`, {
    ...admin,
    method: "DELETE",
  });
}
