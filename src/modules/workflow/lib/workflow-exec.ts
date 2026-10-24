export type WorkflowExecution = "comfyui" | "runninghub" | "template";

export type WorkflowAppCreateKind = "comfyui" | "runninghub" | "template";

export function normalizeExecutionBackend(raw: unknown): WorkflowExecution {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (value === "runninghub") return "runninghub";
  if (value === "template") return "template";
  return "comfyui";
}

export function normalizeCreateKind(raw: unknown): WorkflowAppCreateKind {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (value === "runninghub") return "runninghub";
  if (value === "template") return "template";
  return "comfyui";
}

export function inferCreateKind(input: {
  createKind?: string | null;
  engineType?: string | null;
  executionBackend?: string | null;
}): WorkflowAppCreateKind {
  const kind = String(input.createKind ?? "").trim();
  if (kind) return normalizeCreateKind(kind);
  if (String(input.engineType ?? "").trim().toLowerCase() === "flow") return "template";
  const backend = String(input.executionBackend ?? "").trim().toLowerCase();
  if (backend === "runninghub") return "runninghub";
  if (backend === "template") return "template";
  return "comfyui";
}

export function createKindLabel(kind: WorkflowAppCreateKind): string {
  if (kind === "runninghub") return "RunningHub";
  if (kind === "template") return "模板应用";
  return "ComfyUI";
}

/** 与 int_comfyui_server.provider 对齐。模板应用无需 GPU/RH 槽位。 */
export function serverProviderForBackend(backend: WorkflowExecution): "self_hosted" | "runninghub" | null {
  if (backend === "runninghub") return "runninghub";
  if (backend === "template") return null;
  return "self_hosted";
}

export function executionBackendLabel(backend: WorkflowExecution): string {
  if (backend === "runninghub") return "RunningHub";
  if (backend === "template") return "模板应用";
  return "ComfyUI";
}

/** DB engine_type 仅支持 comfyui/agent/flow；自定义 RH 仍写 comfyui，模板应用写 flow。 */
export function engineTypeForPersist(
  backend: WorkflowExecution,
  createKind?: WorkflowAppCreateKind,
): "comfyui" | "flow" {
  if (createKind === "template" || backend === "template") return "flow";
  return "comfyui";
}

function textConfigValue(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (raw != null && (typeof raw === "number" || typeof raw === "boolean")) return String(raw).trim();
  return "";
}

export type ExecutionConfigExtras = {
  templateKind?: string;
  bizCode?: string;
  outputType?: string;
};

export function parseExecutionConfig(configJson: unknown): {
  executionBackend: WorkflowExecution;
  rhWorkflowId: string;
  accessPassword: string;
  templateKind: string;
  bizCode: string;
  outputType: string;
} {
  let obj: Record<string, unknown> | null = null;
  if (typeof configJson === "string" && configJson.trim()) {
    try {
      const parsed = JSON.parse(configJson) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      obj = null;
    }
  } else if (configJson && typeof configJson === "object" && !Array.isArray(configJson)) {
    obj = configJson as Record<string, unknown>;
  }

  return {
    executionBackend: normalizeExecutionBackend(obj?.executionBackend),
    rhWorkflowId: textConfigValue(obj?.rhWorkflowId),
    accessPassword: textConfigValue(obj?.accessPassword),
    templateKind: textConfigValue(obj?.templateKind),
    bizCode: textConfigValue(obj?.bizCode),
    outputType: textConfigValue(obj?.outputType),
  };
}

export function withExecutionConfig(
  base: Record<string, unknown>,
  executionBackend: WorkflowExecution,
  rhWorkflowId: string,
  accessPassword = "",
  extras?: ExecutionConfigExtras,
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...base,
    executionBackend,
  };
  // 历史字段清理：不再读写 rhRunKind
  delete next.rhRunKind;
  if (executionBackend === "runninghub") {
    next.rhWorkflowId = rhWorkflowId.trim();
    const password = accessPassword.trim();
    if (password) {
      next.accessPassword = password;
    } else {
      delete next.accessPassword;
    }
    delete next.bizCode;
  } else if (executionBackend === "template") {
    delete next.rhWorkflowId;
    delete next.accessPassword;
    const bizCode = (extras?.bizCode ?? "").trim();
    if (bizCode) next.bizCode = bizCode;
    else delete next.bizCode;
  } else {
    delete next.rhWorkflowId;
    delete next.accessPassword;
    delete next.bizCode;
  }

  const templateKind = (extras?.templateKind ?? "").trim();
  if (templateKind) next.templateKind = templateKind;
  else delete next.templateKind;

  const outputType = (extras?.outputType ?? "").trim();
  if (outputType) next.outputType = outputType;
  else delete next.outputType;

  return next;
}

/** 粗检：画布 UI 格式（nodes 为数组且元素含 widgets_values）不可用于字段绑定。 */
export function looksLikeComfyUiCanvasJson(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const nodes = (raw as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return false;
  const first = nodes[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return false;
  return "widgets_values" in (first as object) || Array.isArray((first as { inputs?: unknown }).inputs);
}
