import { screenRequest } from "@/lib/screen-http-lite.js";

export function issueHandModelUpload(saveAsCustom = false) {
  const query = saveAsCustom ? "?saveAsCustom=true" : "";
  return screenRequest(`/api/screen/hand-model-uploads${query}`, { method: "POST" });
}

export function pollHandModelUpload(sessionId) {
  return screenRequest(`/api/screen/hand-model-uploads/${encodeURIComponent(sessionId)}`);
}

export function issueOutfitUpload() {
  return screenRequest("/api/screen/outfit-uploads", { method: "POST" });
}

export function pollOutfitUpload(sessionId) {
  return screenRequest(`/api/screen/outfit-uploads/${encodeURIComponent(sessionId)}`);
}

export function cancelOutfitUpload(sessionId) {
  return screenRequest(`/api/screen/outfit-uploads/${encodeURIComponent(sessionId)}/cancel`, {
    method: "POST",
  });
}

export function issueBannerUpload() {
  return screenRequest("/api/screen/banner-uploads", { ...admin, method: "POST" });
}

export function pollBannerUpload(sessionId) {
  return screenRequest(`/api/screen/banner-uploads/${encodeURIComponent(sessionId)}`, admin);
}


export function scanTransport(intent) {
  if (intent === "hand-admin") {
    return { issue: () => issueHandModelUpload(true), poll: pollHandModelUpload };
  }
  if (intent === "hand-model") {
    return { issue: () => issueHandModelUpload(false), poll: pollHandModelUpload };
  }
  if (intent === "banner") {
    return { issue: issueBannerUpload, poll: pollBannerUpload };
  }
  return { issue: issueOutfitUpload, poll: pollOutfitUpload };
}