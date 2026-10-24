import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";
import { resolveTenantScopeIds } from "@/shared/lib/scope-level";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type ScopeLevel = "global" | "merchant" | "store" | string;

export type ComfyUIServerProvider = "self_hosted" | "runninghub";

export type ComfyUIServer = {
  id: string;
  queueServerId: string;
  groupId: string | null;
  name: string;
  baseUrl: string;
  provider?: ComfyUIServerProvider | string | null;
  gpuCount: number;
  enabled: boolean;
  onlineStatus: string | null;
  loadStatus: string | null;
  tagsJson: string;
  hasAuth: boolean;
  authMasked: string | null;
  /** none | bearer | basic | unknown */
  authType?: string | null;
  queueSize: number;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};

type TenantScopeApiRow = {
  id: string;
  serverId: string;
  scopeLevel?: ScopeLevel | null;
  merchantId?: string | null;
  storeId?: string | null;
  tenantType?: "merchant" | "store" | string | null;
  tenantId?: string | null;
  createdAt?: string;
};

export type ComfyUIServerScopeBinding = {
  id: string;
  serverId: string;
  scopeLevel: ScopeLevel;
  merchantId: string | null;
  storeId: string | null;
  createdAt?: string;
};

export type AppScopeRow = {
  id: string;
  serverId: string;
  scopeType: "include" | "exclude" | string;
  appId: string;
  createdAt?: string;
};

export type ComfyUIServerDetail = {
  server: ComfyUIServer;
  scopeBindings: ComfyUIServerScopeBinding[];
  appScopes: AppScopeRow[];
};

export type ComfyUIServerScopeBindingCommand = {
  scopeLevel: "merchant" | "store";
  merchantId?: string | null;
  storeId?: string | null;
};

export type AppScopeCommand = {
  scopeType: "include" | "exclude";
  appId: string;
};

export type CreateComfyUIServerCommand = {
  groupId?: string | null;
  name: string;
  baseUrl: string;
  provider?: ComfyUIServerProvider | null;
  gpuCount?: number | null;
  authJsonEnc?: string | null;
  enabled?: boolean | null;
  tagsJson?: string | null;
  scopeBindings?: ComfyUIServerScopeBindingCommand[] | null;
  appScopes?: AppScopeCommand[] | null;
};

export type UpdateComfyUIServerCommand = {
  groupId?: string | null;
  clearGroup?: boolean | null;
  name?: string | null;
  baseUrl?: string | null;
  provider?: ComfyUIServerProvider | null;
  gpuCount?: number | null;
  authJsonEnc?: string | null;
  clearAuth?: boolean | null;
  enabled?: boolean | null;
  onlineStatus?: string | null;
  loadStatus?: string | null;
  tagsJson?: string | null;
  scopeBindings?: ComfyUIServerScopeBindingCommand[] | null;
  appScopes?: AppScopeCommand[] | null;
};

function normalizeScopeBinding(row: TenantScopeApiRow): ComfyUIServerScopeBinding | null {
  const resolved = resolveTenantScopeIds(row);
  // ComfyUI 服务器绑定尚未使用 GLOBAL 作用域。
  if (!resolved || resolved.scopeLevel === "global") {
    return null;
  }
  return {
    id: row.id,
    serverId: row.serverId,
    scopeLevel: resolved.scopeLevel,
    merchantId: resolved.merchantId,
    storeId: resolved.storeId,
    createdAt: row.createdAt,
  };
}

function normalizeScopeBindings(rows: TenantScopeApiRow[] | null | undefined): ComfyUIServerScopeBinding[] {
  return (rows ?? []).map(normalizeScopeBinding).filter((item): item is ComfyUIServerScopeBinding => item != null);
}

export type ComfyUIServerCheckResult = {
  onlineStatus: string;
  loadStatus: string;
  checkedAt?: string;
  errorMessage?: string | null;
};

export async function listComfyUIServers(params: {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  enabled?: boolean;
  groupId?: string;
}): Promise<{ page: PageResult; items: ComfyUIServer[] }> {
  const qs = buildPageSearchParams(params);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (typeof params.enabled === "boolean") qs.set("enabled", String(params.enabled));
  if (params.groupId) qs.set("groupId", params.groupId);

  return apiFetch<{ page: PageResult; items: ComfyUIServer[] }>(`/api/admin/int/comfyUIServer?${qs.toString()}`, { method: "GET" });
}

export async function listAllComfyUIServersBasic(): Promise<ComfyUIServer[]> {
  return apiFetch<ComfyUIServer[]>(`/api/admin/int/comfyUIServer/all`, { method: "GET" });
}

export async function getComfyUIServer(id: string): Promise<ComfyUIServerDetail> {
  const data = await apiFetch<{
    server: ComfyUIServer;
    tenantScopes?: TenantScopeApiRow[] | null;
    scopeBindings?: TenantScopeApiRow[] | null;
    appScopes?: AppScopeRow[] | null;
  }>(`/api/admin/int/comfyUIServer/${encodeURIComponent(id)}`, { method: "GET" });
  return {
    server: data.server,
    scopeBindings: normalizeScopeBindings(data.scopeBindings ?? data.tenantScopes),
    appScopes: data.appScopes ?? [],
  };
}

export async function createComfyUIServer(cmd: CreateComfyUIServerCommand): Promise<string> {
  return apiFetch<string>("/api/admin/int/comfyUIServer", { method: "POST", body: JSON.stringify(cmd) });
}

export async function updateComfyUIServer(id: string, cmd: UpdateComfyUIServerCommand): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/int/comfyUIServer/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(cmd),
  });
}

export async function deleteComfyUIServer(id: string, options?: { force?: boolean }): Promise<boolean> {
  const query = new URLSearchParams();
  if (options?.force) {
    query.set("force", "true");
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiFetch<boolean>(`/api/admin/int/comfyUIServer/${encodeURIComponent(id)}${suffix}`, { method: "DELETE" });
}

export async function setComfyUIServerEnabled(id: string, enabled: boolean): Promise<boolean> {
  const qs = new URLSearchParams({ enabled: String(enabled) });
  return apiFetch<boolean>(`/api/admin/int/comfyUIServer/${encodeURIComponent(id)}/enable?${qs.toString()}`, { method: "POST" });
}

export async function stopComfyUIServer(id: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/int/comfyUIServer/${encodeURIComponent(id)}/stop`, { method: "POST" });
}

export async function checkComfyUIServer(id: string): Promise<ComfyUIServerCheckResult> {
  return apiFetch<ComfyUIServerCheckResult>(`/api/admin/int/comfyUIServer/${encodeURIComponent(id)}/check`, { method: "POST" });
}

export async function checkComfyUIServerBaseUrl(params: {
  baseUrl: string;
  excludeId?: string | null;
}): Promise<{ available: boolean }> {
  const qs = new URLSearchParams({ baseUrl: params.baseUrl });
  if (params.excludeId) qs.set("excludeId", params.excludeId);
  return apiFetch<{ available: boolean }>(`/api/admin/int/comfyUIServer/checkBaseUrl?${qs.toString()}`, { method: "GET" });
}

export async function setAllComfyUIServerEnabled(enabled: boolean): Promise<boolean> {
  const qs = new URLSearchParams({ enabled: String(enabled) });
  return apiFetch<boolean>(`/api/admin/int/comfyUIServer/enableAll?${qs.toString()}`, { method: "POST" });
}

export async function stopAllComfyUIServer(): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/int/comfyUIServer/stopAll`, { method: "POST" });
}
