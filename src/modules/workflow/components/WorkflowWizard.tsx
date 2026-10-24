import { useEffect, useMemo, useRef, useState } from "react";
import { PenLine, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { listWorkflowCates } from "@/shared/api/workflow/workflow-cate";
import { listWorkflowTags } from "@/shared/api/workflow/workflow-tag";
import { checkWorkflowCode } from "@/shared/api/workflow/workflow";
import { listAllComfyUIServersBasic } from "@/shared/api/comfyui/comfyui-server";
import { listMerchants } from "@/shared/api/ums/ums-merchant";
import { listStores } from "@/shared/api/ums/ums-store";
import { saveWorkflowDraft } from "@/shared/api/workflow/workflow-draft";
import { updateWorkflowVersion } from "@/shared/api/workflow/workflow-version";
import WorkflowWizardAdvancedConfigSection from "@/modules/workflow/components/wizard/WorkflowWizardAdvancedConfigSection";
import WorkflowWizardBasicConfigSection from "@/modules/workflow/components/wizard/WorkflowWizardBasicConfigSection";
import WorkflowWizardPageBuilderSection from "@/modules/workflow/components/wizard/WorkflowWizardPageBuilderSection";
import WorkflowWizardTemplateConfigSection from "@/modules/workflow/components/wizard/WorkflowWizardTemplateConfigSection";
import WorkflowWizardUploadSection from "@/modules/workflow/components/wizard/WorkflowWizardUploadSection";
import { createEmptyUiSchema, parseUiSchemaText } from "@/modules/workflow/components/pagebuilder/ui-schema";
import { formatParamValidationIssue, validateUiSchemaParamNames } from "@/modules/workflow/components/pagebuilder/param-utils";
import { useWorkflowJsonParser } from "@/modules/workflow/hooks/use-workflow-json-parser";
import { normalizeJsonText, parseJsonText } from "@/modules/workflow/lib/wizard-json";
import { DEFAULT_TEMPLATE_ADAPTER_ID, getTemplateAdapter } from "@/modules/workflow/lib/template-adapter-catalog";
import {
  buildTemplateGraph,
  defaultTemplateGraphText,
  deriveTemplateConfigJson,
  parseTemplateGraph,
  TEMPLATE_OUTPUT_NODE_ID,
  templateNodesForBuilder,
} from "@/modules/workflow/lib/template-graph";
import {
  engineTypeForPersist,
  inferCreateKind,
  looksLikeComfyUiCanvasJson,
  normalizeExecutionBackend,
  serverProviderForBackend,
  withExecutionConfig,
  type WorkflowAppCreateKind,
  type WorkflowExecution,
} from "@/modules/workflow/lib/workflow-exec";
import { resolveUserErrorMessage, resolveUserErrorNotice } from "@/shared/api/sys/error-message";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { notify } from "@/shared/lib/notify";

type WizardMode = "workflow" | "version";
type WorkflowPublishStatus = "online" | "offline";
type WorkflowScopeBinding = {
  scopeLevel: "merchant" | "store";
  merchantId?: string | null;
  storeId?: string | null;
};

export type WorkflowOutputType = "image" | "video" | "image_video" | "3d" | "text" | "audio";

export type WorkflowOutputNodeConfigRow = {
  rowId: string;
  nodeId: string;
  outputType: WorkflowOutputType;
  inputKey?: string;
};

export type WorkflowWizardResult = {
  workflowJson: unknown;
  workflowJsonText: string;
  uiSchema: unknown;
  versionNo: string;
  changelog: string;
  workflowId?: string;
  draftVersionId?: string;
  workflowPayload?: {
    code: string;
    type: string | null;
    cateId: string | null;
    title: string | null;
    coverUrl: string | null;
    iconUrl: string | null;
    description: string | null;
    detail: string | null;
    mcpDescription: string | null;
    timeoutSec: number | null;
    generateTimeSec: number | null;
    outputNodes: unknown;
    appClients: unknown;
    sortNo: number | null;
    price: number | null;
    status: WorkflowPublishStatus;
    tagIds: string[];
    scopeBindings: WorkflowScopeBinding[];
    comfyuiRels: { scopeType: "include" | "exclude"; serverId: string }[];
  };
};

export type WorkflowWizardInitial = Partial<{
  workflowJsonText: string;
  uiSchemaText: string;
  code: string;
  type: string | null;
  cateId: string | null;
  title: string | null;
  coverUrl: string | null;
  iconUrl: string | null;
  description: string | null;
  detail: string | null;
  mcpDescription: string | null;
  timeoutSec: number | null;
  generateTimeSec: number | null;
  outputNodes: unknown;
  appClients: unknown;
  sortNo: number | null;
  price: number | null;
  status: WorkflowPublishStatus;
  tagIds: string[];
  scopeBindings: WorkflowScopeBinding[];
  comfyuiRels: { scopeType: "include" | "exclude"; serverId: string }[];
  versionNo: string;
  changelog: string;
  executionBackend?: WorkflowExecution | null;
  rhWorkflowId?: string | null;
  accessPassword?: string | null;
  createKind?: WorkflowAppCreateKind | null;
}>;

function wizardSteps(isTemplateApp: boolean) {
  return [
    { num: 1, label: isTemplateApp ? "配置模板" : "上传工作流" },
    { num: 2, label: "应用配置" },
    { num: 3, label: "搭建页面" },
  ];
}

function parseUiSchemaForPersist(input: string): { ok: true; value: unknown } | { ok: false; message: string } {
  const parsed = parseJsonText(input, "ui_schema");
  if (parsed.ok === false) return parsed;
  let raw = parsed.value;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
      try {
        raw = JSON.parse(trimmed);
      } catch {
        return { ok: false, message: "ui_schema 是字符串，但其内容不是合法 JSON" };
      }
    }
  }
  if (Array.isArray(raw)) {
    return { ok: true, value: { version: 1, components: raw } };
  }
  if (!raw || typeof raw !== "object") {
    return { ok: false, message: "ui_schema 必须为对象或数组" };
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.components)) {
    return { ok: false, message: "ui_schema.components 必须为数组" };
  }
  const versionRaw = obj.version;
  const version =
    typeof versionRaw === "number"
      ? versionRaw
      : typeof versionRaw === "string" && versionRaw.trim()
        ? Number(versionRaw)
        : 1;
  if (!Number.isFinite(version)) {
    return { ok: false, message: "ui_schema.version 必须为数字" };
  }
  return {
    ok: true,
    value: {
      ...obj,
      version,
      components: obj.components,
    },
  };
}

function createRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeOutputType(v: unknown): WorkflowOutputType | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  if (t === "image" || t === "video" || t === "image_video" || t === "3d" || t === "text" || t === "audio") return t;
  if (t === "图片") return "image";
  if (t === "视频") return "video";
  if (t === "音频" || t === "声音" || t === "audio音频") return "audio";
  if (t === "图片+视频" || t === "图片视频" || t === "图文" || t === "图片或视频") return "image_video";
  if (t === "3D" || t === "3d" || t === "3D模型" || t === "3D类型") return "3d";
  if (t === "文本" || t === "文字" || t === "text文本") return "text";
  return null;
}

function tryParseOutputNodes(input: unknown): WorkflowOutputNodeConfigRow[] | null {
  if (!Array.isArray(input)) return null;
  const rows: WorkflowOutputNodeConfigRow[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const nodeIdRaw = typeof obj.nodeId === "string" ? obj.nodeId : typeof obj.node_id === "string" ? obj.node_id : null;
    const inputKeyRaw =
      typeof obj.inputKey === "string"
        ? obj.inputKey
        : typeof obj.input_key === "string"
          ? obj.input_key
          : typeof obj.nodeInputKey === "string"
            ? obj.nodeInputKey
            : typeof obj.node_input_key === "string"
              ? obj.node_input_key
              : null;
    const nodeLabelRaw = typeof obj.node === "string" ? obj.node : typeof obj.label === "string" ? obj.label : null;
    const nodeIdFromLabel = (() => {
      if (!nodeLabelRaw) return null;
      const m = /^\s*\[(.+?)\]/.exec(nodeLabelRaw);
      return m?.[1]?.trim() ? m[1].trim() : null;
    })();
    const legacySelectValue = (nodeIdRaw || "").trim();
    let nodeId = (nodeIdRaw || nodeIdFromLabel || "").trim();
    let inputKey = (inputKeyRaw || "").trim();
    if (legacySelectValue.startsWith("__input__")) {
      const m = /^__input__(.+?)__(.+)$/.exec(legacySelectValue);
      if (m) {
        nodeId = m[1]?.trim() || nodeId;
        inputKey = m[2]?.trim() || inputKey;
      }
    }
    const outputType = normalizeOutputType(obj.outputType ?? obj.output_type ?? obj.type) ?? "image";
    rows.push({ rowId: createRowId(), nodeId, outputType, inputKey: inputKey || undefined });
  }
  return rows.length ? rows : null;
}

function normalizeOutputNodesForPersist(rows: WorkflowOutputNodeConfigRow[]) {
  return rows
    .map((r) => ({
      nodeId: r.nodeId.trim(),
      outputType: r.outputType,
      inputKey: r.inputKey?.trim() || undefined,
    }))
    .filter((r) => r.nodeId)
    .map((r) => (r.inputKey ? r : { nodeId: r.nodeId, outputType: r.outputType }));
}

function tryParseStringArray(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const items = input
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x) => x);
  return items.length ? items : [];
}

export default function WorkflowWizard(props: {
  mode: WizardMode;
  initial?: WorkflowWizardInitial;
  workflowId?: string;
  initialDraftVersionId?: string | null;
  onCancel: () => void;
  onSubmit: (result: WorkflowWizardResult) => Promise<void>;
  submitLabel?: string;
  title?: string;
  extraHeaderActions?: React.ReactNode;
  forceNewVersionOnFirstSave?: boolean;
}) {
  const sessionScope = useSessionScope();
  const [step, setStep] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);

  const [draftWorkflowId, setDraftWorkflowId] = useState<string | null>(props.workflowId ?? null);
  const [draftVersionId, setDraftVersionId] = useState<string | null>(props.initialDraftVersionId ?? null);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitSaving, setExitSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const [createKind] = useState<WorkflowAppCreateKind>(() =>
    inferCreateKind({
      createKind: props.initial?.createKind,
      engineType: props.initial?.type,
      executionBackend: props.initial?.executionBackend,
    }),
  );
  const isTemplateApp = createKind === "template";

  const [workflowJsonText, setWorkflowJsonText] = useState(() => {
    if (props.initial?.workflowJsonText) return props.initial.workflowJsonText;
    return isTemplateApp ? defaultTemplateGraphText() : "";
  });
  const [uiSchemaText, setUiSchemaText] = useState(props.initial?.uiSchemaText ?? normalizeJsonText(createEmptyUiSchema()));

  const workflowParser = useWorkflowJsonParser(isTemplateApp ? "" : workflowJsonText);
  const templateParsed = useMemo(() => {
    if (!isTemplateApp) return null;
    const local = parseJsonText(workflowJsonText, "workflow JSON");
    if (!local.ok) return null;
    const parsed = parseTemplateGraph(local.value);
    return parsed.ok ? parsed.value : null;
  }, [isTemplateApp, workflowJsonText]);
  const templateRawJson = useMemo(() => {
    if (!isTemplateApp) return null;
    const local = parseJsonText(workflowJsonText, "workflow JSON");
    return local.ok ? local.value : null;
  }, [isTemplateApp, workflowJsonText]);
  const workflowJsonPreview = isTemplateApp ? templateRawJson : workflowParser.workflowJsonPreview;
  const rawJson = isTemplateApp ? templateRawJson : workflowParser.rawJson;
  const nodes = isTemplateApp ? (templateParsed ? templateNodesForBuilder(templateParsed) : []) : workflowParser.nodes;
  const workflowParseError = isTemplateApp ? null : workflowParser.parseError;
  const isParsingWorkflow = isTemplateApp ? false : workflowParser.isParsing;
  const parsedFromWorkflowText = isTemplateApp ? workflowJsonText : workflowParser.parsedFromText;

  const [versionNo, setVersionNo] = useState(props.initial?.versionNo ?? "v1");
  const [changelog, setChangelog] = useState(props.initial?.changelog ?? "");

  const [code, setCode] = useState(props.initial?.code ?? "");
  const [executionBackend, setExecutionBackend] = useState<WorkflowExecution>(() =>
    normalizeExecutionBackend(props.initial?.executionBackend ?? (isTemplateApp ? "template" : "comfyui")),
  );
  const [rhWorkflowId, setRhWorkflowId] = useState<string>(props.initial?.rhWorkflowId ?? "");
  const [accessPassword, setAccessPassword] = useState<string>(props.initial?.accessPassword ?? "");
  const [cateId, setCateId] = useState<string>(props.initial?.cateId ?? "");
  const [title, setTitle] = useState(props.initial?.title ?? "");
  const [coverUrl, setCoverUrl] = useState(props.initial?.coverUrl ?? "");
  const [iconUrl, setIconUrl] = useState(props.initial?.iconUrl ?? "");
  const [description, setDescription] = useState(props.initial?.description ?? "");
  const [detail, setDetail] = useState(props.initial?.detail ?? "");
  const [mcpDescription, setMcpDescription] = useState(props.initial?.mcpDescription ?? "");
  const [timeoutSec, setTimeoutSec] = useState<string>(() => {
    if (props.initial?.timeoutSec != null) return String(props.initial.timeoutSec);
    if (isTemplateApp) return String(getTemplateAdapter(DEFAULT_TEMPLATE_ADAPTER_ID)?.defaultTimeoutSec ?? 600);
    return "60";
  });
  const [generateTimeSec, setGenerateTimeSec] = useState<string>(props.initial?.generateTimeSec != null ? String(props.initial?.generateTimeSec) : "");
  const [sortNo, setSortNo] = useState<string>(props.initial?.sortNo != null ? String(props.initial?.sortNo) : "100");
  const [price, setPrice] = useState<string>(props.initial?.price != null ? String(props.initial?.price) : "");
  const [status, setStatus] = useState<WorkflowPublishStatus>(props.initial?.status === "online" ? "online" : "offline");

  const [outputNodes, setOutputNodes] = useState<WorkflowOutputNodeConfigRow[]>(() => {
    const parsed = tryParseOutputNodes(props.initial?.outputNodes);
    if (isTemplateApp) {
      return [
        {
          rowId: parsed?.[0]?.rowId ?? createRowId(),
          nodeId: TEMPLATE_OUTPUT_NODE_ID,
          inputKey: "output",
          outputType: parsed?.[0]?.outputType && parsed[0].outputType !== "image_video" ? parsed[0].outputType : "video",
        },
      ];
    }
    return parsed ?? [{ rowId: createRowId(), nodeId: "", outputType: "image" }];
  });
  const [appClients, setAppClients] = useState<string[]>(() => {
    const parsed = tryParseStringArray(props.initial?.appClients);
    return parsed ?? [];
  });
  const [tagIds, setTagIds] = useState<string[]>(props.initial?.tagIds ?? []);

  const [merchantIds, setMerchantIds] = useState<string[]>(() => {
    const items = (props.initial?.scopeBindings ?? [])
      .filter((s) => s.scopeLevel === "merchant")
      .map((s) => s.merchantId?.trim() || "")
      .filter((x) => x);
    return Array.from(new Set(items));
  });
  const [storeIds, setStoreIds] = useState<string[]>(() => {
    const items = (props.initial?.scopeBindings ?? [])
      .filter((s) => s.scopeLevel === "store")
      .map((s) => s.storeId?.trim() || "")
      .filter((x) => x);
    return Array.from(new Set(items));
  });

  const [includeServerIds, setIncludeServerIds] = useState<string[]>(() => {
    const items = (props.initial?.comfyuiRels ?? [])
      .filter((r) => r.scopeType === "include")
      .map((r) => r.serverId.trim())
      .filter((x) => x);
    return Array.from(new Set(items));
  });
  const [excludeServerIds, setExcludeServerIds] = useState<string[]>(() => {
    const items = (props.initial?.comfyuiRels ?? [])
      .filter((r) => r.scopeType === "exclude")
      .map((r) => r.serverId.trim())
      .filter((x) => x);
    return Array.from(new Set(items));
  });

  const [codeCheck, setCodeCheck] = useState<{ status: "idle" | "checking" | "available" | "unavailable" | "error"; message: string }>({
    status: "idle",
    message: "",
  });

  const cateQuery = useQuery({
    queryKey: ["workflowCatesAll", sessionScope.scope.queryScopeKey],
    queryFn: () => listWorkflowCates(),
    enabled: props.mode === "workflow",
  });

  const tagQuery = useQuery({
    queryKey: ["workflowTagsAll", sessionScope.scope.queryScopeKey],
    queryFn: () => listWorkflowTags({ pageNo: 1, pageSize: 200 }),
    enabled: props.mode === "workflow",
  });

  const merchantQuery = useQuery({
    queryKey: ["umsMerchantsAll", sessionScope.scope.queryScopeKey],
    queryFn: () => listMerchants({ pageNo: 1, pageSize: 200 }),
    enabled: props.mode === "workflow",
  });

  const storeQuery = useQuery({
    queryKey: ["umsStoresAll", sessionScope.scope.queryScopeKey],
    queryFn: () => listStores({ pageNo: 1, pageSize: 200 }),
    enabled: props.mode === "workflow",
  });

  const serverQuery = useQuery({
    queryKey: ["comfyuiServersAll", sessionScope.scope.queryScopeKey],
    queryFn: () => listAllComfyUIServersBasic(),
    enabled: props.mode === "workflow",
  });
  const filteredServers = useMemo(() => {
    const required = serverProviderForBackend(executionBackend);
    if (!required) return [];
    return (serverQuery.data ?? []).filter((s) => {
      const provider = String(s.provider || "self_hosted")
        .trim()
        .toLowerCase();
      return provider === required;
    });
  }, [executionBackend, serverQuery.data]);

  useEffect(() => {
    const allowed = new Set(filteredServers.map((s) => s.id));
    setIncludeServerIds((prev) => prev.filter((id) => allowed.has(id)));
    setExcludeServerIds((prev) => prev.filter((id) => allowed.has(id)));
  }, [filteredServers]);

  useEffect(() => {
    if (!isTemplateApp || !templateParsed) return;
    setExecutionBackend(templateParsed.executionBackend);
    setRhWorkflowId(templateParsed.webappId);
    setAccessPassword("");
    const mappedOutput: WorkflowOutputType = templateParsed.outputType;
    setOutputNodes((prev) => {
      const rowId = prev[0]?.rowId ?? createRowId();
      const current = prev[0];
      if (
        prev.length === 1 &&
        current?.nodeId === TEMPLATE_OUTPUT_NODE_ID &&
        current.inputKey === "output" &&
        current.outputType === mappedOutput
      ) {
        return prev;
      }
      return [{ rowId, nodeId: TEMPLATE_OUTPUT_NODE_ID, inputKey: "output", outputType: mappedOutput }];
    });
  }, [isTemplateApp, templateParsed]);

  useEffect(() => {
    setStep(1);
    setDraftWorkflowId(props.workflowId ?? null);
    setDraftVersionId(props.initialDraftVersionId ?? null);
  }, [props.initialDraftVersionId, props.mode, props.workflowId]);

  const snapshot = useMemo(() => {
    return JSON.stringify({
      workflowJsonText,
      uiSchemaText,
      versionNo,
      changelog,
      code,
      executionBackend,
      rhWorkflowId,
      accessPassword,
      cateId,
      title,
      coverUrl,
      iconUrl,
      description,
      detail,
      mcpDescription,
      timeoutSec,
      generateTimeSec,
      sortNo,
      price,
      status,
      outputNodes,
      appClients,
      tagIds,
      merchantIds,
      storeIds,
      includeServerIds,
      excludeServerIds,
    });
  }, [
    workflowJsonText,
    uiSchemaText,
    versionNo,
    changelog,
    code,
    executionBackend,
    rhWorkflowId,
    accessPassword,
    cateId,
    title,
    coverUrl,
    iconUrl,
    description,
    detail,
    mcpDescription,
    timeoutSec,
    generateTimeSec,
    sortNo,
    price,
    status,
    outputNodes,
    appClients,
    tagIds,
    merchantIds,
    storeIds,
    includeServerIds,
    excludeServerIds,
  ]);

  const lastSavedSnapshotRef = useRef<string>(snapshot);
  useEffect(() => {
    lastSavedSnapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (props.mode !== "workflow") return;
    const c = code.trim();
    if (!c) {
      setCodeCheck({ status: "idle", message: "" });
      return;
    }

    const timer = window.setTimeout(async () => {
      setCodeCheck({ status: "checking", message: "校验中..." });
      try {
        const r = await checkWorkflowCode({ code: c, excludeId: draftWorkflowId });
        setCodeCheck(
          r.available
            ? { status: "available", message: "可用" }
            : { status: "unavailable", message: "已被占用" }
        );
      } catch (e) {
        setCodeCheck({ status: "error", message: e instanceof Error ? e.message : "校验失败" });
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [code, draftWorkflowId, props.mode]);

  const ensureCodeAvailable = async () => {
    if (props.mode !== "workflow") return true;
    const c = code.trim();
    if (!c) return false;
    setCodeCheck({ status: "checking", message: "校验中..." });
    try {
      const r = await checkWorkflowCode({ code: c, excludeId: draftWorkflowId });
      setCodeCheck(
        r.available
          ? { status: "available", message: "可用" }
          : { status: "unavailable", message: "已被占用" }
      );
      if (!r.available) {
        setFormError("应用编码已被占用，请更换编码后重试");
        return false;
      }
      return true;
    } catch (e) {
      const msg = resolveUserErrorMessage(e, "code 校验失败");
      setFormError(msg);
      setCodeCheck({ status: "error", message: msg });
      return false;
    }
  };

  const validateStep1 = () => {
    const parsed = parseJsonText(workflowJsonText, "workflow JSON");
    if (parsed.ok === false) {
      setFormError(parsed.message);
      return false;
    }
    if (isTemplateApp) {
      const graph = parseTemplateGraph(parsed.value);
      if (graph.ok === false) {
        setFormError(graph.message);
        return false;
      }
      if (graph.value.fields.filter((field) => field.name.trim()).length === 0) {
        setFormError("请至少配置 1 个开始节点入参");
        return false;
      }
      setFormError(null);
      return true;
    }
    if (looksLikeComfyUiCanvasJson(parsed.value)) {
      setFormError("检测到 Comfy 画布 UI 格式 JSON。请改用「导出工作流 API / 保存为 API」格式后再上传");
      return false;
    }
    if (executionBackend === "runninghub" && !rhWorkflowId.trim()) {
      setFormError("RunningHub 应用请填写已发布模板 ID（rhWorkflowId）");
      return false;
    }
    if (isParsingWorkflow) {
      setFormError("正在解析 workflow JSON，请稍后再试");
      return false;
    }
    if (!rawJson || parsedFromWorkflowText !== workflowJsonText) {
      setFormError(workflowParseError || "workflow JSON 解析失败，请检查内容是否为工作流 API 导出格式");
      return false;
    }
    setFormError(null);
    return true;
  };

  const validateStep2 = () => {
    if (!versionNo.trim()) {
      setFormError("请输入版本号");
      return false;
    }
    if (props.mode === "version") {
      setFormError(null);
      return true;
    }
    if (!code.trim()) {
      setFormError("请输入 code");
      return false;
    }
    if (!title.trim()) {
      setFormError("请输入应用标题");
      return false;
    }
    if (!cateId.trim()) {
      setFormError("请选择分类");
      return false;
    }
    const timeoutNum = Number(timeoutSec);
    if (Number.isNaN(timeoutNum) || timeoutNum < 1) {
      setFormError("timeout 必须为正整数");
      return false;
    }
    const sortNum = Number(sortNo);
    if (Number.isNaN(sortNum) || sortNum < 0) {
      setFormError("sort 必须为非负整数");
      return false;
    }
    const normalizedOutputNodes = outputNodes.map((x) => ({ ...x, nodeId: x.nodeId.trim() }));
    if (normalizedOutputNodes.length === 0 || normalizedOutputNodes.every((x) => !x.nodeId)) {
      setFormError("请至少配置 1 个产出节点");
      return false;
    }
    if (normalizedOutputNodes.some((x) => x.nodeId && !(x.inputKey?.trim() || ""))) {
      setFormError("请为每个产出节点选择具体属性");
      return false;
    }
    if (appClients.length === 0) {
      setFormError("请选择所属应用端");
      return false;
    }
    if (executionBackend === "runninghub" && includeServerIds.every((x) => !String(x).trim())) {
      setFormError("RunningHub 应用请至少指定 1 台 RunningHub 服务器");
      return false;
    }
    setFormError(null);
    return true;
  };

  const validateStep3 = () => {
    const parsed = parseUiSchemaForPersist(uiSchemaText);
    if (parsed.ok === false) {
      setFormError(parsed.message);
      return false;
    }
    const schemaParsed = parseUiSchemaText(uiSchemaText);
    if (schemaParsed.ok === false) {
      setFormError(schemaParsed.message);
      return false;
    }
    const issues = validateUiSchemaParamNames(schemaParsed.value);
    if (issues.length > 0) {
      setFormError(formatParamValidationIssue(issues[0]));
      return false;
    }
    setFormError(null);
    return true;
  };

  const buildScopeBindingsForPersist = () => {
    const normMerchantIds = merchantIds.map((x) => x.trim()).filter((x) => x);
    const normStoreIds = storeIds.map((x) => x.trim()).filter((x) => x);
    return [
      ...normMerchantIds.map((merchantId) => ({ scopeLevel: "merchant" as const, merchantId, storeId: null })),
      ...normStoreIds.map((storeId) => ({ scopeLevel: "store" as const, merchantId: null, storeId })),
    ];
  };

  const buildComfyuiRelsForPersist = () => {
    const includeIds = includeServerIds.map((x) => x.trim()).filter((x) => x);
    const excludeIds = excludeServerIds.map((x) => x.trim()).filter((x) => x && !includeIds.includes(x));
    return [
      ...includeIds.map((serverId) => ({ scopeType: "include" as const, serverId })),
      ...excludeIds.map((serverId) => ({ scopeType: "exclude" as const, serverId })),
    ];
  };

  const normalizeWorkflowPayloadForPersist = (numbers: {
    timeoutNum: number;
    generateTimeSecNum: number | null;
    sortNum: number;
    priceNum: number | null;
  }) => {
    const normOutputNodes = normalizeOutputNodesForPersist(outputNodes);
    const scopeBindings = buildScopeBindingsForPersist();
    const comfyuiRels = buildComfyuiRelsForPersist();

    return {
      normOutputNodes,
      scopeBindings,
      comfyuiRels,
      workflowPayload: {
        code: code.trim(),
        // DB engine_type 枚举无 runninghub；执行后端写在 configJson.executionBackend
        type: engineTypeForPersist(executionBackend, createKind),
        cateId: cateId.trim() ? cateId.trim() : null,
        title: title.trim() ? title.trim() : null,
        coverUrl: coverUrl.trim() ? coverUrl.trim() : null,
        iconUrl: iconUrl.trim() ? iconUrl.trim() : null,
        description: description.trim() ? description.trim() : null,
        detail: detail.trim() ? detail.trim() : null,
        mcpDescription: mcpDescription.trim() ? mcpDescription.trim() : null,
        timeoutSec: Number.isNaN(numbers.timeoutNum) ? null : numbers.timeoutNum,
        generateTimeSec: numbers.generateTimeSecNum,
        outputNodes: normOutputNodes,
        appClients,
        sortNo: Number.isNaN(numbers.sortNum) ? null : numbers.sortNum,
        price: numbers.priceNum,
        status,
        tagIds,
        scopeBindings,
        comfyuiRels,
      },
    };
  };

  const buildConfigJson = (payload: Record<string, unknown>) => {
    const extras = isTemplateApp && templateParsed ? deriveTemplateConfigJson(templateParsed) : undefined;
    return withExecutionConfig(
      payload,
      extras?.executionBackend ?? executionBackend,
      extras?.rhWorkflowId ?? rhWorkflowId,
      extras?.accessPassword ?? accessPassword,
      extras,
    );
  };

  const parseWorkflowAndUiOrNull = () => {
    const wfParsed = parseJsonText(workflowJsonText, "workflow JSON");
    const uiParsed = parseUiSchemaForPersist(uiSchemaText);
    if (!wfParsed.ok || !uiParsed.ok) return null;
    return { workflowJson: wfParsed.value, uiSchema: uiParsed.value };
  };

  const parseNumbersOrNull = (opts: { strict: boolean }) => {
    const timeoutNum = Number(timeoutSec);
    const sortNum = Number(sortNo);

    const generateTimeSecNumRaw = generateTimeSec.trim() ? Number(generateTimeSec) : null;
    const generateTimeSecNum = generateTimeSecNumRaw != null && Number.isNaN(generateTimeSecNumRaw) ? null : generateTimeSecNumRaw;

    const priceNumRaw = price.trim() ? Number(price) : null;

    const priceNum = priceNumRaw != null && Number.isNaN(priceNumRaw) ? null : priceNumRaw;

    if (opts.strict) {
      if (priceNum != null && priceNum < 0) {
        setFormError("金额必须为非负整数，单位为分");
        return null;
      }
      if (priceNum != null && !Number.isInteger(priceNum)) {
        setFormError("金额必须为整数，单位为分");
        return null;
      }
    }

    return { timeoutNum, generateTimeSecNum, sortNum, priceNum };
  };

  const requireDraftIdsOrToast = () => {
    if (!draftWorkflowId || !draftVersionId) {
      setFormError("请先点击“下一步”生成草稿版本");
      return null;
    }
    return { draftWorkflowId, draftVersionId };
  };

  const submit = async () => {
    if (!validateStep1() || !validateStep2() || !validateStep3()) return;

    const parsed = parseWorkflowAndUiOrNull();
    if (!parsed) return;

    if (props.mode === "version") {
      await props.onSubmit({
        workflowJson: parsed.workflowJson,
        workflowJsonText,
        uiSchema: parsed.uiSchema,
        versionNo: versionNo.trim(),
        changelog: changelog.trim(),
      });
      return;
    }

    if (!(await ensureCodeAvailable())) return;

    const ids = requireDraftIdsOrToast();
    if (!ids) return;

    const numbers = parseNumbersOrNull({ strict: true });
    if (!numbers) return;

    const normalized = normalizeWorkflowPayloadForPersist(numbers);

    try {
      await updateWorkflowVersion(ids.draftVersionId, {
        changelog: changelog.trim() ? changelog.trim() : null,
        workflowJson: parsed.workflowJson,
        workflowJsonText,
        configJson: buildConfigJson({
            ...normalized.workflowPayload,
          }),
        inputSchema: {},
        outputSchema: {},
        uiSchema: parsed.uiSchema,
      });
      lastSavedSnapshotRef.current = snapshot;
    } catch (e) {
      const notice = resolveUserErrorNotice(e, "保存失败，请稍后重试", "保存失败");
      notify.error(notice.title, { description: notice.description });
      return;
    }

    await props.onSubmit({
      workflowJson: parsed.workflowJson,
      workflowJsonText,
      uiSchema: parsed.uiSchema,
      versionNo: versionNo.trim(),
      changelog: changelog.trim(),
      workflowId: ids.draftWorkflowId,
      draftVersionId: ids.draftVersionId,
      workflowPayload: normalized.workflowPayload,
    });
  };

  const firstSaveRef = useRef(true);

  const saveDraft = async (forceNewVersion = false, options?: { validateUiSchema?: boolean }) => {
    if (props.mode !== "workflow") return null;
    if (!validateStep1() || !validateStep2()) return null;
    if (options?.validateUiSchema && !validateStep3()) return null;
    if (!(await ensureCodeAvailable())) return null;
    const parsed = parseWorkflowAndUiOrNull();
    if (!parsed) return null;

    const numbers = parseNumbersOrNull({ strict: false });
    if (!numbers) return null;

    const normalized = normalizeWorkflowPayloadForPersist(numbers);

    const shouldForceNew = forceNewVersion || (firstSaveRef.current && props.forceNewVersionOnFirstSave);

    setSavingDraft(true);
    try {
      const r = await saveWorkflowDraft({
        workflowId: draftWorkflowId,
        draftVersionId: shouldForceNew ? null : draftVersionId,
        forceNewVersion: shouldForceNew ? true : undefined,
        workflow: {
          ...normalized.workflowPayload,
        },
        version: {
          changelog: changelog.trim() ? changelog.trim() : null,
          workflowJson: parsed.workflowJson,
          workflowJsonText,
          configJson: buildConfigJson({
              ...normalized.workflowPayload,
            }),
          inputSchema: {},
          outputSchema: {},
          uiSchema: parsed.uiSchema,
        },
      });

      setDraftWorkflowId(r.workflowId);
      setDraftVersionId(r.draftVersionId);
      setVersionNo(r.versionNo);
      lastSavedSnapshotRef.current = snapshot;
      firstSaveRef.current = false;
      return r;
    } catch (e) {
      const notice = resolveUserErrorNotice(e, "保存失败，请稍后重试", "保存失败");
      notify.error(notice.title, { description: notice.description });
      return null;
    } finally {
      setSavingDraft(false);
    }
  };

  const handleCancel = () => {
    const dirty = lastSavedSnapshotRef.current !== snapshot;
    if (!dirty) {
      props.onCancel();
      return;
    }
    setExitOpen(true);
  };

  const formatWorkflowJson = () => {
    const parsed = parseJsonText(workflowJsonText, "workflow JSON");
    if (parsed.ok === false) {
      setFormError(parsed.message);
      return;
    }
    setFormError(null);
    setWorkflowJsonText(normalizeJsonText(parsed.value));
  };

  const formatUiSchema = () => {
    const parsed = parseJsonText(uiSchemaText, "ui_schema");
    if (parsed.ok === false) {
      setFormError(parsed.message);
      return;
    }
    setFormError(null);
    setUiSchemaText(normalizeJsonText(parsed.value));
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="relative flex items-center mb-6 min-h-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="text-lg font-semibold text-foreground hover:opacity-80 transition-opacity"
          >
            {props.title || (props.mode === "workflow" ? "工作流封装应用" : "新增版本")}
          </button>
          <span className="text-muted-foreground text-lg">{props.mode}</span>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-8">
          {wizardSteps(isTemplateApp).map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                  step === s.num ? "bg-primary text-primary-foreground" : step > s.num ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s.num ? "✓" : s.num}
              </span>
              <span className={`text-sm ${step === s.num ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* <div className="ml-auto flex items-center gap-2">
          {props.extraHeaderActions}
          {step === 3 && (
            <>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => notify.success("自动参数", { description: "功能待实现" })}>
                <Zap className="w-4 h-4" />
                自动参数
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => notify.success("绘图测试", { description: "功能待实现" })}>
                <PenLine className="w-4 h-4" />
                绘图测试
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={formatUiSchema}>
                格式化 JSON
              </Button>
            </>
          )}
        </div> */}
      </div>

      {step === 1 &&
        (isTemplateApp ? (
          <WorkflowWizardTemplateConfigSection
            workflowJsonText={workflowJsonText}
            onWorkflowJsonTextChange={setWorkflowJsonText}
            onAdapterDefaultsApplied={(timeout) => setTimeoutSec(String(timeout))}
          />
        ) : (
          <WorkflowWizardUploadSection
            executionBackend={executionBackend}
            rhWorkflowId={rhWorkflowId}
            onRhWorkflowIdChange={setRhWorkflowId}
            accessPassword={accessPassword}
            onAccessPasswordChange={setAccessPassword}
            workflowJsonText={workflowJsonText}
            onWorkflowJsonTextChange={setWorkflowJsonText}
            onFormat={formatWorkflowJson}
            rawJson={rawJson ?? workflowJsonPreview}
            nodes={nodes}
            parseError={workflowParseError}
            isParsing={isParsingWorkflow}
          />
        ))}

      {step === 2 && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="w-full max-w-[1120px] mx-auto">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="inline-flex items-center rounded-full bg-muted/70 p-1 h-auto gap-1">
                <TabsTrigger
                  value="basic"
                  className="rounded-full px-8 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  基础配置
                </TabsTrigger>
                <TabsTrigger
                  value="advanced"
                  className="rounded-full px-8 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  高级配置
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="mt-6">
                <WorkflowWizardBasicConfigSection
                  mode={props.mode}
                  cates={cateQuery.data ?? []}
                  nodes={nodes}
                  rawJson={rawJson ?? workflowJsonPreview}
                  versionNo={versionNo}
                  onVersionNoChange={setVersionNo}
                  changelog={changelog}
                  onChangelogChange={setChangelog}
                  code={code}
                  onCodeChange={setCode}
                  codeCheck={props.mode === "workflow" ? codeCheck : undefined}
                  type={executionBackend}
                  onTypeChange={(next) => setExecutionBackend(normalizeExecutionBackend(next))}
                  typeLabelLocked
                  typeDisplayLabel={isTemplateApp ? "模板应用" : undefined}
                  outputLocked={isTemplateApp}
                  allowedOutputTypes={
                    isTemplateApp
                      ? (getTemplateAdapter(templateParsed?.adapterId ?? DEFAULT_TEMPLATE_ADAPTER_ID)?.allowedOutputTypes as WorkflowOutputType[] | undefined)
                      : undefined
                  }
                  cateId={cateId}
                  onCateIdChange={setCateId}
                  title={title}
                  onTitleChange={setTitle}
                  coverUrl={coverUrl}
                  onCoverUrlChange={setCoverUrl}
                  iconUrl={iconUrl}
                  onIconUrlChange={setIconUrl}
                  timeoutSec={timeoutSec}
                  onTimeoutSecChange={setTimeoutSec}
                  generateTimeSec={generateTimeSec}
                  onGenerateTimeSecChange={setGenerateTimeSec}
                  status={status}
                  onStatusChange={setStatus}
                  outputNodes={outputNodes}
                  onOutputNodesChange={(next) => {
                    setOutputNodes(next);
                    if (!isTemplateApp || !templateParsed) return;
                    const nextType = next[0]?.outputType;
                    if (nextType !== "image" && nextType !== "video" && nextType !== "audio" && nextType !== "3d") return;
                    if (nextType === templateParsed.outputType) return;
                    setWorkflowJsonText(
                      normalizeJsonText(
                        buildTemplateGraph({
                          adapterId: templateParsed.adapterId,
                          fields: templateParsed.fields,
                          webappId: templateParsed.webappId,
                          outputType: nextType,
                        }),
                      ),
                    );
                  }}
                />
              </TabsContent>

              <TabsContent value="advanced" className="mt-6">
                {props.mode === "version" ? (
                  <div className="text-sm text-muted-foreground">版本创建不需要高级配置。</div>
                ) : (
                  <WorkflowWizardAdvancedConfigSection
                    sortNo={sortNo}
                    onSortNoChange={setSortNo}
                    price={price}
                    onPriceChange={setPrice}
                    appClients={appClients}
                    onAppClientsChange={setAppClients}
                    tagIds={tagIds}
                    onTagIdsChange={setTagIds}
                    tags={tagQuery.data?.items ?? []}
                    merchants={merchantQuery.data?.items ?? []}
                    merchantIds={merchantIds}
                    onMerchantIdsChange={setMerchantIds}
                    stores={storeQuery.data?.items ?? []}
                    storeIds={storeIds}
                    onStoreIdsChange={setStoreIds}
                    servers={filteredServers}
                    includeServerIds={includeServerIds}
                    onIncludeServerIdsChange={setIncludeServerIds}
                    excludeServerIds={excludeServerIds}
                    onExcludeServerIdsChange={setExcludeServerIds}
                    requireIncludeServer={executionBackend === "runninghub"}
                    hideServerSelect={executionBackend === "template"}
                    serverSelectHint={
                      executionBackend === "template"
                        ? "模板应用走 LLM 模型平台，无需选择算力服务器（派单能力将在后续版本开放）"
                        : executionBackend === "runninghub"
                        ? filteredServers.length
                          ? "仅展示 RunningHub 服务器；请至少指定一台"
                          : "暂无 RunningHub 服务器，请先在服务器管理中新增并探活"
                        : "仅展示自建 ComfyUI 服务器"
                    }
                    mcpDescription={mcpDescription}
                    onMcpDescriptionChange={setMcpDescription}
                    description={description}
                    onDescriptionChange={setDescription}
                    detail={detail}
                    onDetailChange={setDetail}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <WorkflowWizardPageBuilderSection uiSchemaText={uiSchemaText} onUiSchemaTextChange={setUiSchemaText} nodes={nodes} rawJson={rawJson ?? workflowJsonPreview} />
        </div>
      )}

      <div className="w-full pt-4 border-border space-y-2">
        {formError ? <p className="text-sm text-destructive text-right">{formError}</p> : null}
        {step === 1 && (
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={handleCancel}>
              取消
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (isTemplateApp) {
                  if (!validateStep1()) return;
                  setStep(2);
                  return;
                }
                const localParsed = parseJsonText(workflowJsonText, "workflow JSON");
                if (localParsed.ok === false) {
                  setFormError(localParsed.message);
                  return;
                }

                if (rawJson && parsedFromWorkflowText === workflowJsonText) {
                  setFormError(null);
                  setStep(2);
                  return;
                }

                const r = await workflowParser.parseNow();
                if (r.ok === true) {
                  setFormError(null);
                  setStep(2);
                  return;
                }
                setFormError(r.message);
              }}
            >
              下一步
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setFormError(null);
                setStep(1);
              }}
            >
              上一步
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (!validateStep1() || !validateStep2()) return;
                if (props.mode === "workflow") {
                  const r = await saveDraft();
                  if (!r) return;
                  notify.success("草稿已保存");
                }
                setFormError(null);
                setStep(3);
              }}
            >
              {savingDraft ? "保存中..." : "下一步"}
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={handleCancel}>
              取消
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFormError(null);
                setStep(2);
              }}
            >
              上一步
            </Button>
            {props.mode === "workflow" && (
              <Button
                variant="outline"
                disabled={savingDraft}
                onClick={async () => {
                  const r = await saveDraft(false, { validateUiSchema: true });
                  if (!r) return;
                  notify.success("草稿已保存");
                  setFormError(null);
                }}
              >
                {savingDraft ? "保存中..." : "保存"}
              </Button>
            )}
            <Button onClick={submit}>{props.submitLabel || "确认"}</Button>
          </div>
        )}
      </div>

      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>是否保存？</AlertDialogTitle>
            <AlertDialogDescription>退出后将丢失未保存的修改。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={exitSaving}>继续编辑</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={exitSaving}
              onClick={() => {
                props.onCancel();
              }}
            >
              放弃并退出
            </AlertDialogAction>
            <AlertDialogAction
              disabled={exitSaving}
              onClick={async (e) => {
                e.preventDefault();
                setExitSaving(true);
                const r = await saveDraft(false, { validateUiSchema: true });
                setExitSaving(false);
                if (!r) return;
                setExitOpen(false);
                props.onCancel();
              }}
            >
              保存并退出
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
