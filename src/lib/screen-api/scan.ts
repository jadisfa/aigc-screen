import { screenRequest } from "@/lib/screen-http";

export type ScreenScanIssued = {
  sessionId: string;
  token?: string;
  h5Url?: string;
  deviceCode?: string;
  expiresAt?: string;
};

export type ScreenScanSession = {
  sessionId: string;
  kind?: string;
  status?: string;
  assetUrl?: string;
  rejectCode?: string;
  rejectMessage?: string;
  expireAt?: string;
};

const admin = { requireAdmin: true as const };

export function issueOutfitUpload() {
  return screenRequest<ScreenScanIssued>("/api/screen/outfit-uploads", { method: "POST" });
}

export function pollOutfitUpload(sessionId: string) {
  return screenRequest<ScreenScanSession>(`/api/screen/outfit-uploads/${encodeURIComponent(sessionId)}`);
}

export function cancelOutfitUpload(sessionId: string) {
  return screenRequest<ScreenScanSession>(`/api/screen/outfit-uploads/${encodeURIComponent(sessionId)}/cancel`, {
    method: "POST",
  });
}

export function issueBannerUpload() {
  return screenRequest<ScreenScanIssued>("/api/screen/banner-uploads", { ...admin, method: "POST" });
}

export function pollBannerUpload(sessionId: string) {
  return screenRequest<ScreenScanSession>(`/api/screen/banner-uploads/${encodeURIComponent(sessionId)}`, admin);
}

export function cancelBannerUpload(sessionId: string) {
  return screenRequest<ScreenScanSession>(`/api/screen/banner-uploads/${encodeURIComponent(sessionId)}/cancel`, {
    ...admin,
    method: "POST",
  });
}

export function issueHandModelUpload(saveAsCustom = false) {
  const query = saveAsCustom ? "?saveAsCustom=true" : "";
  return screenRequest<ScreenScanIssued>(`/api/screen/hand-model-uploads${query}`, { method: "POST" });
}

export function pollHandModelUpload(sessionId: string) {
  return screenRequest<ScreenScanSession>(`/api/screen/hand-model-uploads/${encodeURIComponent(sessionId)}`);
}

export function cancelHandModelUpload(sessionId: string) {
  return screenRequest<ScreenScanSession>(`/api/screen/hand-model-uploads/${encodeURIComponent(sessionId)}/cancel`, {
    method: "POST",
  });
}
