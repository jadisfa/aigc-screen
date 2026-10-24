import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";
import { resolveTenantScopeIds } from "@/shared/lib/scope-level";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type WorkflowLifecycleStatus = "online" | "offline" | string;
export type WorkflowPublishStatus = "online" | "offline";
export type ScopeLevel = "global" | "merchant" | "store" | string;

type WorkflowCardApiRow = {
  id: string;
  code: string;
  type: string;
  cateId: string | null;
  cateName: string | null;
  title: string | null;
  name: string | null;
  coverUrl: string | null;
  iconUrl: string | null;
  description: string | null;
  timeoutSec: number | null;
  generateTimeSec: number | null;
  price: number | null;
  sortNo: number | null;
  status?: "online" | "offline" | string | null;
  currentVersionNo: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  tagIds?: string[] | null;
};

export type WorkflowCard = WorkflowCardApiRow & {
  status: WorkflowLifecycleStatus;
};

export type WorkflowDetailRow = WorkflowCard & {
  detail: string | null;
  mcpDescription: string | null;
  outputNodesJson: string | null;
  appClientsJson: string | null;
};

type TenantScopeApiRow = {
  id: string;
  workflowId: string;
  scopeLevel?: ScopeLevel | null;
  merchantId?: string | null;
  storeId?: string | null;
  tenantType?: "merchant" | "store" | string | null;
  tenantId?: string | null;
  createdAt: string | null;
};

export type WorkflowScopeBinding = {
  id: string;
  workflowId: string;
  scopeLevel: ScopeLevel;
  merchantId: string | null;
  storeId: string | null;
  createdAt: string | null;
};

export type ComfyuiRelRow = {
  id: string;
  serverId: string;
  scopeType: "include" | "exclude" | string;
  appId: string;
  createdAt: string | null;
};

export type WorkflowDetail = {
  workflow: WorkflowDetailRow;
  tagIds: string[];
  scopeBindings: WorkflowScopeBinding[];
  comfyuiRels: ComfyuiRelRow[];
};

type WorkflowDetailApiResponse = WorkflowDetailRow & {
  tagIds?: string[] | null;
  scopeBindings?: TenantScopeApiRow[] | null;
  comfyuiRels?: ComfyuiRelRow[] | null;
};

export type WorkflowScopeBindingCommand = {
  scopeLevel: "merchant" | "store";
  merchantId?: string | null;
  storeId?: string | null;
};

export type ComfyuiRelCommand = {
  serverId: string;
  scopeType: "include" | "exclude";
};

export type CreateWorkflowCommand = {
  code: string;
  type?: string | null;
  cateId?: string | null;
  title?: string | null;
  coverUrl?: string | null;
  iconUrl?: string | null;
  description?: string | null;
  detail?: string | null;
  mcpDescription?: string | null;
  timeoutSec?: number | null;
  generateTimeSec?: number | null;
  outputNodes?: unknown;
  appClients?: unknown;
  price?: number | null;
  sortNo?: number | null;
  status?: WorkflowPublishStatus | null;
  currentVersionNo?: string | null;
  tagIds?: string[] | null;
  scopeBindings?: WorkflowScopeBindingCommand[] | null;
  comfyuiRels?: ComfyuiRelCommand[] | null;
};

export type UpdateWorkflowCommand = {
  code?: string | null;
  type?: string | null;
  cateId?: string | null;
  title?: string | null;
  coverUrl?: string | null;
  iconUrl?: string | null;
  description?: string | null;
  detail?: string | null;
  mcpDescription?: string | null;
  timeoutSec?: number | null;
  generateTimeSec?: number | null;
  outputNodes?: unknown;
  appClients?: unknown;
  price?: number | null;
  sortNo?: number | null;
  status?: WorkflowPublishStatus | null;
  currentVersionNo?: string | null;
  tagIds?: string[] | null;
  scopeBindings?: WorkflowScopeBindingCommand[] | null;
  comfyuiRels?: ComfyuiRelCommand[] | null;
};

function normalizeWorkflowStatus(
  status: string | null | undefined,
): WorkflowLifecycleStatus {
  const normalized = (status || "").trim().toLowerCase();
  if (normalized === "online" || normalized === "offline") {
    return normalized;
  }
  return normalized || "offline";
}

function normalizeWorkflowCard(row: WorkflowCardApiRow): WorkflowCard {
  return {
    ...row,
    status: normalizeWorkflowStatus(row.status),
  };
}

function normalizeScopeBinding(row: TenantScopeApiRow): WorkflowScopeBinding | null {
  const resolved = resolveTenantScopeIds(row);
  if (!resolved) {
    return null;
  }
  return {
    id: row.id,
    workflowId: row.workflowId,
    scopeLevel: resolved.scopeLevel,
    merchantId: resolved.merchantId,
    storeId: resolved.storeId,
    createdAt: row.createdAt,
  };
}

function normalizeScopeBindings(
  rows: TenantScopeApiRow[] | null | undefined,
): WorkflowScopeBinding[] {
  return (rows ?? [])
    .map(normalizeScopeBinding)
    .filter((item): item is WorkflowScopeBinding => item != null);
}

export type WorkflowListParams = {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  // When only cateId is provided, backend expands it to the parent category plus its children.
  cateId?: string;
  // When subCateId is provided, backend filters by the specific child category only.
  subCateId?: string;
  tagId?: string;
  status?: string;
  type?: string;
};

function buildWorkflowListSearchParams(
  params: WorkflowListParams,
): URLSearchParams {
  const qs = buildPageSearchParams(params);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.cateId) qs.set("cateId", params.cateId);
  if (params.subCateId) qs.set("subCateId", params.subCateId);
  if (params.tagId) qs.set("tagId", params.tagId);
  if (params.status) qs.set("status", params.status);
  if (params.type) qs.set("type", params.type);
  return qs;
}

export async function listWorkflows(
  params: WorkflowListParams,
): Promise<{ page: PageResult; items: WorkflowCard[] }> {
  const qs = buildWorkflowListSearchParams(params);
  const data = await apiFetch<{
    page: PageResult;
    items: WorkflowCardApiRow[];
  }>(`/api/admin/app/workflow?${qs.toString()}`, { method: "GET" });
  return {
    page: data.page,
    items: (data.items ?? []).map(normalizeWorkflowCard),
  };
}

export async function searchWorkflowsByKeyword(
  params: WorkflowListParams,
): Promise<{ page: PageResult; items: WorkflowCard[] }> {
  const qs = buildWorkflowListSearchParams(params);
  const data = await apiFetch<{
    page: PageResult;
    items: WorkflowCardApiRow[];
  }>(`/api/admin/app/workflow/searchByKeyword?${qs.toString()}`, {
    method: "GET",
  });
  return {
    page: data.page,
    items: (data.items ?? []).map(normalizeWorkflowCard),
  };
}

export async function getWorkflow(id: string): Promise<WorkflowDetail> {
  const data = await apiFetch<WorkflowDetailApiResponse>(
    `/api/admin/app/workflow/${encodeURIComponent(id)}`,
    { method: "GET" },
  );
  return {
    workflow: normalizeWorkflowCard(data) as WorkflowDetailRow,
    tagIds: data.tagIds ?? [],
    scopeBindings: normalizeScopeBindings(data.scopeBindings),
    comfyuiRels: data.comfyuiRels ?? [],
  };
}

export async function listWorkflowLoraModels(workflowId: string): Promise<string[]> {
  const qs = new URLSearchParams({ workflowId });
  return apiFetch<string[]>(`/api/admin/app/workflow/loraModels?${qs.toString()}`, { method: "GET" });
}

export async function createWorkflow(cmd: CreateWorkflowCommand): Promise<string> {
  return apiFetch<string>("/api/admin/app/workflow", { method: "POST", body: JSON.stringify(cmd) });
}

export async function updateWorkflow(id: string, cmd: UpdateWorkflowCommand): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/app/workflow/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(cmd),
  });
}


export async function checkWorkflowCode(params: {
  code: string;
  excludeId?: string | null;
}): Promise<{ available: boolean }> {
  const qs = new URLSearchParams({ code: params.code });
  if (params.excludeId) qs.set("excludeId", params.excludeId);
  return apiFetch<{ available: boolean }>(
    `/api/admin/app/workflow/checkCode?${qs.toString()}`,
    { method: "GET" },
  );
}

export async function setWorkflowStatus(
  id: string,
  status: "online" | "offline",
): Promise<boolean> {
  const qs = new URLSearchParams({ status });
  return apiFetch<boolean>(
    `/api/admin/app/workflow/${encodeURIComponent(id)}/status?${qs.toString()}`,
    { method: "POST" },
  );
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  return apiFetch<boolean>(
    `/api/admin/app/workflow/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function listDeletedWorkflows(params: {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  cateId?: string;
  subCateId?: string;
  type?: string;
}): Promise<{ page: PageResult; items: WorkflowCard[] }> {
  const qs = buildPageSearchParams(params);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.cateId) qs.set("cateId", params.cateId);
  if (params.subCateId) qs.set("subCateId", params.subCateId);
  if (params.type) qs.set("type", params.type);
  const data = await apiFetch<{ page: PageResult; items: WorkflowCardApiRow[] }>(
    `/api/admin/app/workflow/deleted?${qs.toString()}`,
    { method: "GET" },
  );
  return { page: data.page, items: (data.items ?? []).map(normalizeWorkflowCard) };
}

export async function restoreWorkflow(id: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/app/workflow/${encodeURIComponent(id)}/restore`, { method: "POST" });
}

export type ParsedWorkflowNode = {
  nodeId: string;
  label: string;
};

export type ParseWorkflowJsonResult = {
  rawJson: unknown;
  nodes: ParsedWorkflowNode[];
};

export async function parseWorkflowJson(
  rawJsonText: string,
): Promise<ParseWorkflowJsonResult> {
  return apiFetch<ParseWorkflowJsonResult>(
    "/api/admin/app/workflow/parseJson",
    {
      method: "POST",
      body: JSON.stringify({ rawJsonText }),
    },
  );
}

export function extractNodeInputs(
  rawJson: unknown,
): Map<string, Array<{ key: string }>> {
  const map = new Map<string, Array<{ key: string }>>();
  if (!rawJson || typeof rawJson !== "object" || Array.isArray(rawJson))
    return map;

  const root = rawJson as Record<string, unknown>;

  const parseMap = (obj: Record<string, unknown>) => {
    for (const [nodeId, nodeRaw] of Object.entries(obj)) {
      if (!nodeRaw || typeof nodeRaw !== "object" || Array.isArray(nodeRaw))
        continue;
      const inputsRaw = (nodeRaw as Record<string, unknown>).inputs;
      if (
        !inputsRaw ||
        typeof inputsRaw !== "object" ||
        Array.isArray(inputsRaw)
      )
        continue;
      const inputEntries = Object.entries(
        inputsRaw as Record<string, unknown>,
      ).map(([k]) => ({ key: k }));
      if (inputEntries.length > 0) map.set(nodeId, inputEntries);
    }
  };

  // Format 1: { nodes: [...] } or { nodes: {...} }
  if (root.nodes) {
    if (Array.isArray(root.nodes)) {
      for (let i = 0; i < root.nodes.length; i++) {
        const nodeRaw = root.nodes[i];
        if (!nodeRaw || typeof nodeRaw !== "object" || Array.isArray(nodeRaw))
          continue;
        const idNode = (nodeRaw as Record<string, unknown>).id;
        const nodeId = idNode != null ? String(idNode) : String(i);
        const inputsRaw = (nodeRaw as Record<string, unknown>).inputs;
        if (
          !inputsRaw ||
          typeof inputsRaw !== "object" ||
          Array.isArray(inputsRaw)
        )
          continue;
        const inputEntries = Object.entries(
          inputsRaw as Record<string, unknown>,
        ).map(([k]) => ({ key: k }));
        if (inputEntries.length > 0) map.set(nodeId, inputEntries);
      }
      return map;
    } else if (typeof root.nodes === "object") {
      parseMap(root.nodes as Record<string, unknown>);
      return map;
    }
  }

  // Format 2: { prompt: {...} }
  if (
    root.prompt &&
    typeof root.prompt === "object" &&
    !Array.isArray(root.prompt)
  ) {
    parseMap(root.prompt as Record<string, unknown>);
    return map;
  }

  // Format 3: top-level map {...}
  parseMap(root);
  return map;
}

//  通过应用id获取应用配置信息
export async function getWorkflowConfigById(params: { appId: string, currentVersionNo:string }) {
  const qs = new URLSearchParams({ appId: params.appId, currentVersionNo: params.currentVersionNo });
  return apiFetch<{
    workflow: WorkflowCardApiRow;
    version: WorkflowVersionDetail;
  }>(`/api/admin/app/workflow/runtime-detail/by-app?${qs.toString()}`, {
    method: "GET",
  });
}

//  通过应用版本id获取应用配置信息
export async function getWorkflowConfigByVersionId(params: { id: string }) {
  const qs = new URLSearchParams({ workflowVersionId: params.id });
  return apiFetch<{
    workflow: WorkflowCardApiRow;
    version: WorkflowVersionDetail;
  }>(`/api/admin/app/workflow/runtime-detail/by-version?${qs.toString()}`, {
    method: "GET",
  });
}
