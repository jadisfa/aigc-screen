import { screenRequest } from "@/lib/screen-http";
import type { ScreenGeneration } from "@/lib/screen-api/generations";

export type ScreenExperienceTag = {
  code?: string;
  name?: string;
  group?: string;
  confidence?: number;
};

export type ScreenExperienceProduct = {
  productId: string;
  productCode?: string;
  productName?: string;
  coverImageUrl?: string;
  retailPrice?: number | string | null;
  tagCodes?: string[];
};

export type ScreenExperience = {
  id: string;
  status?: string;
  scene?: "outfit" | "keyword" | string;
  outfitUploadId?: string;
  keyword?: string;
  tags?: ScreenExperienceTag[];
  matchedProducts?: ScreenExperienceProduct[];
  allowReselect?: boolean;
  analyzeTaskId?: string;
  tryonTaskId?: string;
  failCount?: number;
  /** 用户上传的穿搭原图；关键词场景为空。 */
  sourceImageUrl?: string;
};

export type ScreenDispatchAccepted = {
  taskId: string;
  status?: string;
  queuePosition?: number;
  etaSeconds?: number;
  computeUnits?: number;
};

export function createExperience(body: {
  scene: "outfit" | "keyword" | "catalog";
  outfitUploadId?: string;
  keyword?: string;
}) {
  return screenRequest<ScreenExperience>("/api/screen/experiences", {
    method: "POST",
    data: body,
  });
}

export async function fetchCurrentExperience() {
  const data = await screenRequest<ScreenExperience | null | undefined>("/api/screen/experiences/current");
  return data ?? null;
}

export function fetchExperience(id: string) {
  return screenRequest<ScreenExperience>(`/api/screen/experiences/${encodeURIComponent(id)}`);
}

export function abandonExperience(id: string) {
  return screenRequest<ScreenExperience>(`/api/screen/experiences/${encodeURIComponent(id)}/abandon`, {
    method: "POST",
    data: {},
  });
}

export function dispatchOutfitTag(experienceId: string) {
  return screenRequest<ScreenDispatchAccepted>(
    `/api/screen/experiences/${encodeURIComponent(experienceId)}/outfit-tag`,
    { method: "POST", data: {} },
  );
}

export function completeOutfitTag(experienceId: string, taskId: string) {
  return screenRequest<ScreenExperience>(
    `/api/screen/experiences/${encodeURIComponent(experienceId)}/outfit-tag/complete`,
    { method: "POST", data: { taskId } },
  );
}

export function rematchExperience(experienceId: string, tagCodes: string[]) {
  return screenRequest<ScreenExperience>(
    `/api/screen/experiences/${encodeURIComponent(experienceId)}/rematch`,
    { method: "POST", data: { tagCodes } },
  );
}

export function dispatchTryOn(
  experienceId: string,
  body: { imageUrl: string; productId?: string; productImageUrl?: string },
) {
  return screenRequest<ScreenDispatchAccepted>(
    `/api/screen/experiences/${encodeURIComponent(experienceId)}/try-on`,
    { method: "POST", data: body },
  );
}

export function completeTryOn(
  experienceId: string,
  body: { tryonTaskId: string; productId?: string; stockKind?: string },
) {
  return screenRequest<ScreenGeneration>(`/api/screen/experiences/${encodeURIComponent(experienceId)}/complete`, {
    method: "POST",
    data: body,
  });
}

export function shareTryOnResult(taskId: string) {
  return screenRequest<{ taskId: string; h5Url: string }>(
    `/api/screen/try-on-results/${encodeURIComponent(taskId)}/share`,
  );
}
