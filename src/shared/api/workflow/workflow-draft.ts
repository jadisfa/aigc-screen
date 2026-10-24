import { apiFetch } from "@/shared/api/sys/http";

export type WorkflowDraftScopeBinding = {
  scopeLevel: "merchant" | "store";
  merchantId?: string | null;
  storeId?: string | null;
};
export type WorkflowDraftComfyuiRel = { scopeType: "include" | "exclude"; serverId: string };

export type SaveWorkflowDraftCommand = {
  workflowId?: string | null;
  draftVersionId?: string | null;
  forceNewVersion?: boolean | null;
  workflow?: {
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
    outputNodes?: unknown;
    appClients?: unknown;
    price?: number | null;
    sortNo?: number | null;
    status?: "online" | "offline" | string | null;
    tagIds?: string[];
    scopeBindings?: WorkflowDraftScopeBinding[];
    comfyuiRels?: WorkflowDraftComfyuiRel[];
  } | null;
  version: {
    changelog?: string | null;
    workflowJson: unknown;
    workflowJsonText?: string | null;
    configJson?: unknown;
    inputSchema?: unknown;
    outputSchema?: unknown;
    uiSchema?: unknown;
  };
};

export type SaveWorkflowDraftResult = {
  workflowId: string;
  draftVersionId: string;
  versionNo: string;
  versionSeq: number;
};

function toScopeBinding(binding: WorkflowDraftScopeBinding) {
  if (binding.scopeLevel === "store") {
    const storeId = binding.storeId?.trim();
    if (!storeId) return null;
    return {
      scopeLevel: "store" as const,
      merchantId: binding.merchantId?.trim() || null,
      storeId,
    };
  }
  const merchantId = binding.merchantId?.trim();
  if (!merchantId) return null;
  return {
    scopeLevel: "merchant" as const,
    merchantId,
    storeId: null,
  };
}

function toWorkflowDraftCommand(cmd: SaveWorkflowDraftCommand): SaveWorkflowDraftCommand {
  if (!cmd.workflow) {
    return cmd;
  }
  const rawStatus = typeof cmd.workflow.status === "string" ? cmd.workflow.status.trim().toLowerCase() : cmd.workflow.status;
  const scopeBindings = (cmd.workflow.scopeBindings ?? [])
    .map(toScopeBinding)
    .filter((item): item is WorkflowDraftScopeBinding => item != null);
  return {
    ...cmd,
    workflow: {
      ...cmd.workflow,
      status: rawStatus ?? null,
      scopeBindings: cmd.workflow.scopeBindings == null ? undefined : scopeBindings,
    },
  };
}

export async function saveWorkflowDraft(cmd: SaveWorkflowDraftCommand): Promise<SaveWorkflowDraftResult> {
  return apiFetch<SaveWorkflowDraftResult>("/api/admin/app/workflowDraft", {
    method: "POST",
    body: JSON.stringify(toWorkflowDraftCommand(cmd)),
  });
}
