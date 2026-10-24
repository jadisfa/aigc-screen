import type { ParsedWorkflowNode } from "@/shared/api/workflow/workflow";
import {
  DEFAULT_TEMPLATE_ADAPTER_ID,
  DEFAULT_TEMPLATE_BIZ_CODE,
  getTemplateAdapter,
  type TemplateAdapterId,
  type TemplateFieldDef,
  type TemplateFieldType,
  type TemplateOutputType,
} from "@/modules/workflow/lib/template-adapter-catalog";
import { looksLikeComfyUiCanvasJson, type WorkflowExecution } from "@/modules/workflow/lib/workflow-exec";

export const TEMPLATE_INPUT_NODE_ID = "1";
export const TEMPLATE_OUTPUT_NODE_ID = "2";
export const TEMPLATE_EXEC_NODE_ID = "3";

export type TemplateGraphDoc = Record<string, TemplateGraphNode>;

export type TemplateGraphNode = {
  class_type: string;
  _meta?: { title?: string };
  inputs?: Record<string, unknown>;
  output?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

export type ParsedTemplateGraph = {
  adapterId: TemplateAdapterId;
  executionBackend: WorkflowExecution;
  fields: TemplateFieldDef[];
  webappId: string;
  accessPassword: string;
  bizCode: string;
  outputType: TemplateOutputType;
  doc: TemplateGraphDoc;
};

export type TemplateConfigJson = {
  executionBackend: WorkflowExecution;
  templateKind: TemplateAdapterId;
  rhWorkflowId?: string;
  accessPassword?: string;
  bizCode?: string;
  outputType: TemplateOutputType;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function schemaType(value: unknown): TemplateFieldType {
  const raw = asString(value).toLowerCase();
  if (raw === "number") return "number";
  if (raw === "boolean") return "boolean";
  return "string";
}

function coerceDefault(type: TemplateFieldType, value: unknown): string | number | boolean {
  if (value == null || value === "") return "";
  if (type === "boolean") return value === true || value === "true";
  if (type === "number") {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : "";
  }
  return String(value);
}

function fieldDefault(fields: TemplateFieldDef[], names: string[]): string {
  for (const name of names) {
    const hit = fields.find((item) => item.name.trim() === name);
    if (hit) return asString(hit.defaultValue);
  }
  return "";
}

function resolveBizCode(raw: string | undefined, adapterDefault?: string): string {
  return (raw ?? "").trim() || (adapterDefault ?? "").trim() || DEFAULT_TEMPLATE_BIZ_CODE;
}

export function buildTemplateGraph(input: {
  adapterId: TemplateAdapterId;
  fields: TemplateFieldDef[];
  webappId?: string;
  outputType: TemplateOutputType;
  bizCode?: string;
}): TemplateGraphDoc {
  const adapter = getTemplateAdapter(input.adapterId);
  if (!adapter) {
    throw new Error(`未知模板适配器: ${input.adapterId}`);
  }

  const inputs: Record<string, unknown> = {};
  const schema: Record<string, unknown> = {};
  const execInputs: Record<string, unknown> = {};

  for (const field of input.fields) {
    const name = field.name.trim();
    if (!name || name === "bizCode") continue;
    inputs[name] = field.defaultValue;
    schema[name] = {
      type: field.type,
      default: field.defaultValue,
      description: field.description ?? "",
      required: field.required,
      ...(field.vendor?.nodeId?.trim() && field.vendor?.fieldName?.trim()
        ? { vendor: { nodeId: field.vendor.nodeId.trim(), fieldName: field.vendor.fieldName.trim() } }
        : {}),
    };
    execInputs[name] = [TEMPLATE_INPUT_NODE_ID, name];
  }

  const bizCode =
    input.bizCode !== undefined ? input.bizCode.trim() : resolveBizCode(undefined, adapter.defaultBizCode);
  const execData: Record<string, unknown> = { type: adapter.id, bizCode };

  return {
    [TEMPLATE_INPUT_NODE_ID]: {
      class_type: "INPUT",
      _meta: { title: "开始" },
      inputs,
      output: { ...inputs },
      data: { schema },
    },
    [TEMPLATE_OUTPUT_NODE_ID]: {
      class_type: "OUTPUT",
      _meta: { title: "结束" },
      inputs: { output: [TEMPLATE_EXEC_NODE_ID, "data", "*"] },
      output: {},
      data: { schema: { output: { outputType: input.outputType } } },
    },
    [TEMPLATE_EXEC_NODE_ID]: {
      class_type: adapter.execClassType,
      _meta: { title: adapter.execTitle },
      inputs: execInputs,
      data: execData,
    },
  };
}

export function parseTemplateGraph(raw: unknown): { ok: true; value: ParsedTemplateGraph } | { ok: false; message: string } {
  if (looksLikeComfyUiCanvasJson(raw)) {
    return { ok: false, message: "这是 Comfy 画布 JSON，不是模板三节点文档" };
  }
  if (!isRecord(raw)) {
    return { ok: false, message: "模板 JSON 必须为对象" };
  }

  const keys = Object.keys(raw);
  if (keys.length !== 3) {
    return { ok: false, message: "模板必须恰好包含开始、执行、结束三个节点" };
  }

  const inputNode = raw[TEMPLATE_INPUT_NODE_ID];
  const outputNode = raw[TEMPLATE_OUTPUT_NODE_ID];
  const execNode = raw[TEMPLATE_EXEC_NODE_ID];
  if (!isRecord(inputNode) || !isRecord(outputNode) || !isRecord(execNode)) {
    return { ok: false, message: "模板节点 1/2/3 必须为对象" };
  }
  if (asString(inputNode.class_type) !== "INPUT") {
    return { ok: false, message: "节点 1 必须是 INPUT（开始）" };
  }
  if (asString(outputNode.class_type) !== "OUTPUT") {
    return { ok: false, message: "节点 2 必须是 OUTPUT（结束）" };
  }

  const execData = isRecord(execNode.data) ? execNode.data : {};
  const adapterId = asString(execData.type) as TemplateAdapterId;
  const adapter = getTemplateAdapter(adapterId);
  if (!adapter) {
    return { ok: false, message: `执行节点 data.type 无效: ${adapterId || "(空)"}` };
  }

  const schemaRoot = isRecord(inputNode.data) && isRecord(inputNode.data.schema) ? inputNode.data.schema : {};
  const inputValues = isRecord(inputNode.inputs) ? inputNode.inputs : {};
  const fields: TemplateFieldDef[] = [];
  const fieldNames = Object.keys(schemaRoot).length ? Object.keys(schemaRoot) : Object.keys(inputValues);
  for (const name of fieldNames) {
    if (name === "bizCode") continue;
    const schemaRaw = schemaRoot[name];
    const schema = isRecord(schemaRaw) ? schemaRaw : {};
    const type = schemaType(schema.type);
    const vendorRaw = isRecord(schema.vendor) ? schema.vendor : null;
    const vendorNodeId = vendorRaw ? asString(vendorRaw.nodeId) : "";
    const vendorFieldName = vendorRaw ? asString(vendorRaw.fieldName) : "";
    fields.push({
      name,
      type,
      defaultValue: coerceDefault(type, schema.default ?? inputValues[name]),
      required: schema.required === true,
      description: asString(schema.description),
      vendor: vendorNodeId && vendorFieldName ? { nodeId: vendorNodeId, fieldName: vendorFieldName } : undefined,
    });
  }

  const outputSchema = isRecord(outputNode.data) && isRecord(outputNode.data.schema) ? outputNode.data.schema : {};
  const outputField = isRecord(outputSchema.output) ? outputSchema.output : {};
  const outputTypeRaw = asString(outputField.outputType).toLowerCase();
  const outputType: TemplateOutputType =
    outputTypeRaw === "video" || outputTypeRaw === "audio" || outputTypeRaw === "image" || outputTypeRaw === "3d"
      ? outputTypeRaw
      : adapter.defaultOutputType;

  return {
    ok: true,
    value: {
      adapterId: adapter.id,
      executionBackend: adapter.executionBackend,
      fields,
      webappId: fieldDefault(fields, ["rhWorkflowId", "webappId"]) || asString(execData.webappId),
      accessPassword: "",
      bizCode: "bizCode" in execData ? asString(execData.bizCode) : resolveBizCode(undefined, adapter.defaultBizCode),
      outputType,
      doc: raw as TemplateGraphDoc,
    },
  };
}

export function deriveTemplateConfigJson(parsed: ParsedTemplateGraph): TemplateConfigJson {
  const config: TemplateConfigJson = {
    executionBackend: parsed.executionBackend,
    templateKind: parsed.adapterId,
    outputType: parsed.outputType,
  };
  if (parsed.bizCode) {
    config.bizCode = parsed.bizCode;
  }
  return config;
}

export function templateNodesForBuilder(parsed: ParsedTemplateGraph): ParsedWorkflowNode[] {
  const adapter = getTemplateAdapter(parsed.adapterId);
  return [
    { nodeId: TEMPLATE_INPUT_NODE_ID, label: "开始" },
    { nodeId: TEMPLATE_OUTPUT_NODE_ID, label: "结束" },
    { nodeId: TEMPLATE_EXEC_NODE_ID, label: adapter?.execTitle || "执行" },
  ];
}

export function isTemplateGraph(raw: unknown): boolean {
  return parseTemplateGraph(raw).ok;
}

export function defaultTemplateGraphText(adapterId: TemplateAdapterId = DEFAULT_TEMPLATE_ADAPTER_ID): string {
  const adapter = getTemplateAdapter(adapterId);
  if (!adapter) {
    throw new Error(`未知模板适配器: ${adapterId}`);
  }
  return JSON.stringify(
    buildTemplateGraph({
      adapterId: adapter.id,
      fields: adapter.defaultFields,
      outputType: adapter.defaultOutputType,
      bizCode: adapter.defaultBizCode,
    }),
    null,
    2,
  );
}
