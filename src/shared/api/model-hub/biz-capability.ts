import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";
import { MODEL_HUB_ADMIN_API_PREFIX } from "@/shared/api/model-hub/model-hub";
import type { RouteEntryCode } from "@/shared/lib/route-entry-dicts";

export type BizCapability = {
  id: string;
  bizCode: string;
  bizName: string;
  sceneCode: RouteEntryCode | string;
  defaultPrompt: string | null;
  allowedModelIds: string[];
  allowedModelNames?: string[];
  remark: string | null;
  enabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type CreateBizCapabilityCommand = {
  bizCode: string;
  bizName: string;
  sceneCode: string;
  defaultPrompt?: string | null;
  allowedModelIds?: string[];
  remark?: string | null;
  enabled?: boolean;
};

export type UpdateBizCapabilityCommand = {
  bizName?: string;
  sceneCode?: string | null;
  defaultPrompt?: string | null;
  allowedModelIds?: string[];
  remark?: string | null;
  enabled?: boolean;
};

export type ListBizCapabilitiesParams = {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  sceneCode?: string;
};

export type BizCapabilityPageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type BizCapabilityDataset = {
  page: BizCapabilityPageResult;
  items: BizCapability[];
};

function path(suffix = ""): string {
  return `${MODEL_HUB_ADMIN_API_PREFIX}/biz-capabilities${suffix}`;
}

export async function listBizCapabilities(
  params: ListBizCapabilitiesParams
): Promise<BizCapabilityDataset> {
  const qs = buildPageSearchParams(params);
  if (params.keyword?.trim()) {
    qs.set("keyword", params.keyword.trim());
  }
  if (params.sceneCode?.trim()) {
    qs.set("sceneCode", params.sceneCode.trim());
  }
  return apiFetch<BizCapabilityDataset>(`${path()}?${qs.toString()}`, { method: "GET" });
}

export async function getBizCapability(bizCode: string): Promise<BizCapability> {
  return apiFetch<BizCapability>(path(`/${encodeURIComponent(bizCode)}`), { method: "GET" });
}

export async function createBizCapability(cmd: CreateBizCapabilityCommand): Promise<string> {
  return apiFetch<string>(path(), { method: "POST", body: JSON.stringify(cmd) });
}

export async function updateBizCapability(
  bizCode: string,
  cmd: UpdateBizCapabilityCommand
): Promise<boolean> {
  return apiFetch<boolean>(path(`/${encodeURIComponent(bizCode)}`), {
    method: "PUT",
    body: JSON.stringify(cmd),
  });
}

export async function deleteBizCapability(id: string): Promise<boolean> {
  return apiFetch<boolean>(path(`/${encodeURIComponent(id)}`), { method: "DELETE" });
}
