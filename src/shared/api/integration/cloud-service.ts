import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type CloudService = {
  id: string;
  platformName: string;
  platformType: string;
  enabled: boolean;
  priority: number;
  serviceNames?: string | null;
  hasAuth: boolean;
  authMasked: string | null;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type CloudServiceItem = {
  id: string;
  cloudServiceId: string;
  serviceCode: string;
  serviceName: string;
  enabled: boolean;
  configJson: string;
  hasSecret: boolean;
  secretMasked: string | null;
  templateRels?: CloudServiceMessageTemplateRel[];
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type CloudServiceMessageTemplateRel = {
  id: string;
  cloudServiceItemId: string;
  serviceCode: string;
  templateCode: string;
  domesticMessageTemplateId: string | null;
  internationalMessageTemplateId: string | null;
  domesticSignName: string | null;
  internationalSignName: string | null;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type UpsertCloudServiceMessageTemplateRelCommand = {
  templateCode: string;
  domesticMessageTemplateId?: string | null;
  internationalMessageTemplateId?: string | null;
  domesticSignName?: string | null;
  internationalSignName?: string | null;
  enabled?: boolean | null;
};

export type CloudServiceDetail = {
  service: CloudService;
  items: CloudServiceItem[];
};

export type CreateCloudServiceCommand = {
  platformName: string;
  platformType: string;
  authJsonEnc?: string | null;
  enabled?: boolean | null;
  priority?: number | null;
};

export type UpdateCloudServiceCommand = {
  platformName?: string | null;
  platformType?: string | null;
  authJsonEnc?: string | null;
  clearAuth?: boolean | null;
  enabled?: boolean | null;
  priority?: number | null;
};

export type UpsertCloudServiceItemCommand = {
  serviceName?: string | null;
  enabled?: boolean | null;
  configJson?: string | null;
  secretJsonEnc?: string | null;
  clearSecret?: boolean | null;
  templateRels?: UpsertCloudServiceMessageTemplateRelCommand[] | null;
};

export async function listCloudServices(params: {
  pageNo: number;
  pageSize: number;
  total?: number;
  platformType?: string;
  keyword?: string;
  enabled?: boolean;
}): Promise<{ page: PageResult; items: CloudService[] }> {
  const qs = buildPageSearchParams(params);
  if (params.platformType) qs.set("platformType", params.platformType);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (typeof params.enabled === "boolean") qs.set("enabled", String(params.enabled));

  return apiFetch<{ page: PageResult; items: CloudService[] }>(`/api/admin/int/cloudService?${qs.toString()}`, { method: "GET" });
}

export async function getCloudService(id: string): Promise<CloudServiceDetail> {
  return apiFetch<CloudServiceDetail>(`/api/admin/int/cloudService/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function createCloudService(cmd: CreateCloudServiceCommand): Promise<string> {
  return apiFetch<string>("/api/admin/int/cloudService", { method: "POST", body: JSON.stringify(cmd) });
}

export async function updateCloudService(id: string, cmd: UpdateCloudServiceCommand): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/int/cloudService/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(cmd) });
}

export async function deleteCloudService(id: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/int/cloudService/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function setCloudServiceEnabled(id: string, enabled: boolean): Promise<boolean> {
  const qs = new URLSearchParams({ enabled: String(enabled) });
  return apiFetch<boolean>(`/api/admin/int/cloudService/${encodeURIComponent(id)}/enable?${qs.toString()}`, { method: "POST" });
}

export async function upsertCloudServiceItem(
  cloudServiceId: string,
  serviceCode: string,
  cmd: UpsertCloudServiceItemCommand
): Promise<boolean> {
  return apiFetch<boolean>(
    `/api/admin/int/cloudService/${encodeURIComponent(cloudServiceId)}/services/${encodeURIComponent(serviceCode)}`,
    { method: "PUT", body: JSON.stringify(cmd) }
  );
}
