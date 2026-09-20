import { screenRequest } from "@/lib/screen-http";

export type ScreenBanner = {
  configId?: string | null;
  libraryId?: string | null;
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

const admin = { requireAdmin: true as const };

export function fetchDeviceBanners() {
  return screenRequest<ScreenBanner[]>("/api/screen/banners/device");
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

export function patchDeviceBanner(configId: string, data: { openDeviceConfig?: "yes" | "no"; pin?: boolean }) {
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
