import type { ModelHubProtocolCatalogItem, ModelHubStatus } from "@/shared/api/model-hub/model-hub";

export const PROTOCOL_SCENE_OPTIONS = [
  { code: "chat", label: "对话" },
  { code: "embedding", label: "向量" },
  { code: "image_generation", label: "图像" },
  { code: "video_generation", label: "视频" },
  { code: "three_d_generation", label: "3D" },
  { code: "audio_synthesis", label: "语音合成" },
  { code: "audio_transcription", label: "语音识别" },
] as const;

export const PROTOCOL_INVOCATION_OPTIONS = [
  { value: "SYNC", label: "同步" },
  { value: "STREAM", label: "流式" },
  { value: "ASYNC_POLL", label: "异步轮询" },
] as const;

export const PROTOCOL_ASSET_TYPE_OPTIONS = [
  { value: "IMAGE", label: "图片", hint: "静态图 URL" },
  { value: "VIDEO", label: "视频", hint: "成片 / 预览视频 URL" },
  { value: "AUDIO", label: "音频", hint: "语音或配音 URL" },
  { value: "MODEL_3D", label: "3D 模型", hint: "网格或场景文件 URL" },
  { value: "TEXT", label: "文本", hint: "结果是一段文本而不是文件" },
  { value: "FILE", label: "文件", hint: "类型未知时的通用下载 URL" },
] as const;

export type ProtocolExtractForm = {
  taskIdPath: string;
  statusPath: string;
  progressPath: string;
  errorPath: string;
  statusMapping: string;
  assetType: string;
  assetUrlPath: string;
  jsonStringFields: string;
  successCode: string;
};

export type ProtocolEditorForm = {
  name: string;
  code: string;
  version: string;
  status: ModelHubStatus;
  sceneCodes: string[];
  invocation: string;
  authType: string;
  openaiCompatible: boolean;
  submitMethod: string;
  submitPath: string;
  submitBody: string;
  passthrough: boolean;
  submitExtract: ProtocolExtractForm;
  statusExtract: ProtocolExtractForm;
  statusMethod: string;
  statusEndpointPath: string;
  resultMethod: string;
  resultPath: string;
  cancelMethod: string;
  cancelPath: string;
  extrasJson: string;
};

export function emptyExtractForm(): ProtocolExtractForm {
  return {
    taskIdPath: "",
    statusPath: "",
    progressPath: "",
    errorPath: "",
    statusMapping: "",
    assetType: "FILE",
    assetUrlPath: "",
    jsonStringFields: "",
    successCode: "",
  };
}

export function extractHasContent(extract: ProtocolExtractForm): boolean {
  return Boolean(
    extract.taskIdPath.trim()
      || extract.statusPath.trim()
      || extract.progressPath.trim()
      || extract.errorPath.trim()
      || extract.statusMapping.trim()
      || extract.assetUrlPath.trim()
      || extract.jsonStringFields.trim()
      || extract.successCode.trim(),
  );
}

export function emptyProtocolForm(): ProtocolEditorForm {
  return {
    name: "",
    code: "",
    version: "v1",
    status: "enabled",
    sceneCodes: [],
    invocation: "SYNC",
    authType: "bearer",
    openaiCompatible: false,
    submitMethod: "POST",
    submitPath: "",
    submitBody: "",
    passthrough: true,
    submitExtract: emptyExtractForm(),
    statusExtract: emptyExtractForm(),
    statusMethod: "GET",
    statusEndpointPath: "",
    resultMethod: "GET",
    resultPath: "",
    cancelMethod: "POST",
    cancelPath: "",
    extrasJson: "",
  };
}

export function protocolFormFromItem(item: ModelHubProtocolCatalogItem): ProtocolEditorForm {
  const definition = item.definition || {};
  const auth = asRecord(definition.auth);
  const submit = asRecord(definition.submit);
  const submitResponse = asRecord(submit.response);
  const status = asRecord(definition.status);
  const statusResponse = asRecord(status.response);
  const result = asRecord(definition.result);
  const cancel = asRecord(definition.cancel);
  const extras = asRecord(definition.extras);
  const extrasCopy = { ...extras };
  const openaiCompatible = extrasCopy.openaiCompatible === true;
  delete extrasCopy.openaiCompatible;
  const submitExtract = extractFromResponse(submitResponse);
  const statusExtract = Object.keys(statusResponse).length > 0
    ? extractFromResponse(statusResponse)
    : { ...submitExtract };
  return {
    name: item.name || "",
    code: item.code || "",
    version: item.version || "v1",
    status: item.status === "disabled" ? "disabled" : "enabled",
    sceneCodes: Array.isArray(item.sceneCodes) ? [...item.sceneCodes] : stringList(definition.sceneCodes),
    invocation: item.invocationStyle || text(definition.invocation, "SYNC"),
    authType: text(auth.type, "bearer"),
    openaiCompatible,
    submitMethod: text(submit.method, "POST"),
    submitPath: text(submit.path, ""),
    submitBody: stringifyBody(submit.body),
    passthrough: submitResponse.passthrough === true,
    submitExtract,
    statusExtract,
    statusMethod: text(status.method, "GET"),
    statusEndpointPath: text(status.path, ""),
    resultMethod: text(result.method, "GET"),
    resultPath: text(result.path, ""),
    cancelMethod: text(cancel.method, "POST"),
    cancelPath: text(cancel.path, ""),
    extrasJson: Object.keys(extrasCopy).length > 0 ? JSON.stringify(extrasCopy, null, 2) : "",
  };
}

export function buildProtocolDefinition(form: ProtocolEditorForm): Record<string, unknown> {
  const asyncPoll = form.invocation === "ASYNC_POLL";
  const statusResponse = buildResponse(form.statusExtract, !asyncPoll && form.passthrough);
  const submitResponse = asyncPoll
    ? buildResponse(extractHasContent(form.submitExtract) ? form.submitExtract : form.statusExtract, false)
    : statusResponse;
  const submit: Record<string, unknown> = {
    method: form.submitMethod.trim() || "POST",
    path: form.submitPath.trim(),
  };
  const body = parseBody(form.submitBody);
  if (body !== undefined) {
    rejectWholeBodyDump(body);
    submit.body = body;
  }
  if (Object.keys(submitResponse).length > 0) {
    submit.response = submitResponse;
  }
  const definition: Record<string, unknown> = {
    transport: "HTTP",
    invocation: form.invocation,
    adapter: "CONFIG",
    sceneCodes: form.sceneCodes,
    auth: { type: form.authType || "bearer" },
    submit,
  };
  if (asyncPoll || form.statusEndpointPath.trim()) {
    const status: Record<string, unknown> = {
      method: form.statusMethod.trim() || "GET",
      path: form.statusEndpointPath.trim(),
    };
    if (Object.keys(statusResponse).length > 0) {
      status.response = statusResponse;
    }
    definition.status = status;
  }
  if (form.resultPath.trim()) {
    definition.result = {
      method: form.resultMethod.trim() || "GET",
      path: form.resultPath.trim(),
      response: statusResponse,
    };
  }
  if (form.cancelPath.trim()) {
    definition.cancel = {
      method: form.cancelMethod.trim() || "DELETE",
      path: form.cancelPath.trim(),
    };
  }
  const extras = parseExtras(form.extrasJson);
  if (form.openaiCompatible) {
    extras.openaiCompatible = true;
  }
  if (Object.keys(extras).length > 0) {
    definition.extras = extras;
  }
  return definition;
}

export function rejectWholeBodyDump(node: unknown): void {
  if (typeof node === "string") {
    if (/^\$\{\s*request\.(body|fields|parameters)\s*\}$/.test(node.trim())) {
      throw new Error("协议模板禁止整包代入 ${request.body} / ${request.fields}");
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach(rejectWholeBodyDump);
    return;
  }
  if (node && typeof node === "object") {
    Object.values(node as Record<string, unknown>).forEach(rejectWholeBodyDump);
  }
}

export const PROTOCOL_SUBMIT_PATH_HINT =
  "填渠道相对路径，会拼到渠道 endpoint 后面，不要写域名。以 /v1、/v3、/api/v1、/api/v3 开头时，会先去掉 endpoint 末尾的同款版本号再拼接，不会出现 /v1/api/v1。普通路径如 /images/generations 会在 endpoint 缺少版本时自动补 /v1。完整 http(s) 地址会覆盖 endpoint。";

export const PROTOCOL_SUBMIT_BODY_MANUAL = `请求体是发给渠道的 JSON 模板。创建类协议必须填写显式 object，不能留空（转写 multipart 的表单字段 map 除外）。

只做 \${a.b.c} 占位替换。禁止 \${request.body} / \${request.fields} 整包代入。右侧只引用入口契约键或渲染旗标。模板读 request.body（wire 副本），不要写 request.parameters。

常用占位：
  \${request.model}            路由后的渠道模型编码
  \${request.sceneCode}        场景，如 video_generation
  \${request.prompt}           文本提示词（含 extras.promptFlags 拼进后的最终 prompt）
  \${request.body.<契约键>}    收口后的标量，如 duration / aspect_ratio / n
  \${request.images}           参考图列表，项为 {url, role}
  \${request.inputUrls}        参考图地址列表
  \${request.hasImages}        是否带参考图
  \${request.hasMultipleImages} 组图（n>1）
  \${request.primaryImageUrl}  第一张参考图
  \${request.firstFrameUrl}    首帧，缺角色时回落第一张
  \${request.lastFrameUrl}     尾帧
  \${request.stream}           是否流式
  \${task.taskId}              仅查询/取消阶段有值
  \${item.url} / \${item.role} 仅 $forEach 循环内

模板指令：
  $includeIf   路径为空则整段省略；禁止套在 boolean 上（false 会被当成空）
  $forEach     按列表展开当前对象，如 request.images
  $spread      只合并已渲染的小对象，禁止 $spread request.body / request.fields

示例（火山视频）：
  {
    "model": "\${request.model}",
    "content": [
      {"$includeIf": "request.prompt", "type": "text", "text": "\${request.prompt}"},
      {"$forEach": "request.images", "type": "image_url", "image_url": {"url": "\${item.url}"}, "role": "\${item.role}"}
    ],
    "duration": "\${request.body.duration}",
    "ratio": "\${request.body.aspect_ratio}"
  }`;

export const PROTOCOL_EXTRAS_MANUAL = `extras 是协议级 JSON 补丁，不参与主表单字段。openaiCompatible 请用上方开关，保存时会自动写入。

已识别字段：
  poll.inline        true 时创建任务后在服务端同步轮询，直到成功/失败或超时
  poll.intervalMs    轮询间隔，毫秒，默认 2000
  poll.maxAttempts   最大轮询次数；<=0 或缺少 taskId 时不轮询
  imageSubmitPath    带参考图时改走的提交路径，如可灵图生视频
  requireNonEmpty    渲染后必须非空的 body 字段名列表，如 ["content"]
  valueMaps          契约值→厂商值，如 resolution.720p → 1280x720
  promptFlags        把契约键从 JSON 挪到 prompt 后缀，如 Seedance 1.x --duration
  content.method     下载成片的 HTTP 方法，默认 GET
  content.path       下载成片路径，可用 \${task.taskId}

示例：
  {"poll":{"inline":true,"intervalMs":2000,"maxAttempts":90},"requireNonEmpty":["content"]}`;

export function invocationLabel(value: string): string {
  return PROTOCOL_INVOCATION_OPTIONS.find((item) => item.value === value)?.label || value;
}

export function sceneLabels(sceneCodes: string[]): string {
  if (!sceneCodes.length) {
    return "全部场景";
  }
  return sceneCodes
    .map((code) => PROTOCOL_SCENE_OPTIONS.find((item) => item.code === code)?.label || code)
    .join(" / ");
}

function buildResponse(extract: ProtocolExtractForm, passthrough: boolean): Record<string, unknown> {
  if (passthrough) {
    return { passthrough: true };
  }
  const response: Record<string, unknown> = {};
  if (extract.taskIdPath.trim()) {
    response.taskId = { path: extract.taskIdPath.trim() };
  }
  const mapping = parseMapping(extract.statusMapping);
  if (extract.statusPath.trim()) {
    response.status = Object.keys(mapping).length > 0
      ? { path: extract.statusPath.trim(), mapping }
      : { path: extract.statusPath.trim() };
  }
  if (extract.progressPath.trim()) {
    response.progress = { path: extract.progressPath.trim() };
  }
  if (extract.errorPath.trim()) {
    response.error = extract.errorPath.trim();
  }
  if (extract.successCode.trim()) {
    response.successCode = extract.successCode.trim();
  }
  const jsonStringFields = extract.jsonStringFields
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (jsonStringFields.length > 0) {
    response.jsonStringFields = jsonStringFields;
  }
  if (extract.assetUrlPath.trim()) {
    response.assets = [{ type: extract.assetType.trim() || "FILE", url: { path: extract.assetUrlPath.trim() } }];
  }
  return response;
}

function extractFromResponse(response: Record<string, unknown>): ProtocolExtractForm {
  const firstAsset = firstAssetOf(response.assets);
  return {
    taskIdPath: readPath(response.taskId),
    statusPath: readPath(response.status),
    progressPath: readPath(response.progress),
    errorPath: text(response.error, text(response.errorMessage, "")),
    statusMapping: stringifyMapping(readMapping(response)),
    assetType: firstAsset.type,
    assetUrlPath: firstAsset.url,
    jsonStringFields: stringList(response.jsonStringFields).join("\n"),
    successCode: text(response.successCode, ""),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function text(value: unknown, fallback: string): string {
  if (value == null) {
    return fallback;
  }
  const next = String(value).trim();
  return next || fallback;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function readPath(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  const record = asRecord(value);
  return text(record.path, "");
}

function readMapping(response: Record<string, unknown>): Record<string, string> {
  const status = response.status;
  if (status && typeof status === "object" && !Array.isArray(status)) {
    return stringMap(asRecord(status).mapping);
  }
  return stringMap(response.mapping);
}

function stringMap(value: unknown): Record<string, string> {
  const record = asRecord(value);
  const out: Record<string, string> = {};
  Object.entries(record).forEach(([key, item]) => {
    if (item != null && String(item).trim()) {
      out[key] = String(item);
    }
  });
  return out;
}

function stringifyMapping(mapping: Record<string, string>): string {
  return Object.entries(mapping)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function parseMapping(textValue: string): Record<string, string> {
  const out: Record<string, string> = {};
  textValue.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    const index = trimmed.indexOf("=");
    if (index <= 0) {
      return;
    }
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && value) {
      out[key] = value;
    }
  });
  return out;
}

function firstAssetOf(value: unknown): { type: string; url: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { type: "FILE", url: "" };
  }
  const row = asRecord(value[0]);
  return { type: text(row.type, "FILE"), url: readPath(row.url) };
}

function stringifyBody(value: unknown): string {
  if (value == null || value === "") {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function parseBody(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function parseExtras(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    throw new Error("高级 extras 不是合法 JSON");
  }
}
