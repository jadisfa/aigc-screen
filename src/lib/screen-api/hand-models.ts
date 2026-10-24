import { screenRequest } from "@/lib/screen-http";

export type ScreenHandModel = {
  configId?: string | null;
  materialId?: string;
  displayName?: string;
  assetUrl?: string;
  previewUrl?: string;
  sortNo?: number | null;
};

export type ScreenHandModelList = {
  official?: ScreenHandModel[];
  custom?: ScreenHandModel[];
};

const admin = { requireAdmin: true as const };

export function fetchHandModels() {
  return screenRequest<ScreenHandModelList>("/api/screen/hand-models");
}

export function fetchOfficialHandLibrary() {
  return screenRequest<ScreenHandModel[]>("/api/screen/hand-models/official", admin);
}

export function bindOfficialHandModel(materialId: string) {
  return screenRequest<ScreenHandModel>("/api/screen/hand-models/official", {
    ...admin,
    method: "POST",
    data: { materialId },
  });
}

export function unbindOfficialHandModel(configId: string) {
  return screenRequest<void>(`/api/screen/hand-models/official/${encodeURIComponent(configId)}`, {
    ...admin,
    method: "DELETE",
  });
}

export function patchHandModel(configId: string, displayName: string) {
  return screenRequest<ScreenHandModel>(`/api/screen/hand-models/${encodeURIComponent(configId)}`, {
    ...admin,
    method: "PATCH",
    data: { displayName },
  });
}

export function sortHandModels(configIds: string[]) {
  return screenRequest<void>("/api/screen/hand-models/sort", {
    ...admin,
    method: "PUT",
    data: { configIds },
  });
}

export function deleteCustomHandModel(configId: string) {
  return screenRequest<void>(`/api/screen/hand-models/custom/${encodeURIComponent(configId)}`, {
    ...admin,
    method: "DELETE",
  });
}
