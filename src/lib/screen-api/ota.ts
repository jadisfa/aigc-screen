import { screenRequest } from "@/lib/screen-http";

export type ScreenOtaVersion = {
  versionName?: string;
  versionNo?: number | null;
  fileSize?: number | null;
  changelog?: string;
  accessUrl?: string;
  fileHash?: string;
  deviceType?: string;
  fileName?: string;
  upgradeKind?: "optional" | "force" | string | null;
};

const admin = { requireAdmin: true as const };

export function fetchOtaCurrent() {
  return screenRequest<ScreenOtaVersion>("/api/screen/ota/current", admin);
}

export function fetchOtaLatest(requireAdmin = false) {
  return screenRequest<ScreenOtaVersion>("/api/screen/ota/latest", {
    requireAdmin,
  });
}
