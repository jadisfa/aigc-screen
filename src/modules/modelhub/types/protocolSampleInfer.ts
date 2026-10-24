import {
  emptyExtractForm,
  extractHasContent,
  PROTOCOL_SCENE_OPTIONS,
  type ProtocolEditorForm,
  type ProtocolExtractForm,
} from "@/modules/modelhub/types/protocolCatalogTypes";

export type ProtocolSampleField = "submitRequest" | "submitResponse" | "pollRequest" | "pollResponse";

export type ProtocolSampleInput = Record<ProtocolSampleField, string> & {
  sceneCode: string;
};

export type ProtocolInferWarning = {
  code: string;
  message: string;
};

export type ProtocolInferSummaryItem = {
  label: string;
  value: string;
};

export type ProtocolInferResult = {
  ok: boolean;
  error?: string;
  fieldErrors: Partial<Record<ProtocolSampleField | "sceneCode", string>>;
  patch: Partial<ProtocolEditorForm>;
  warnings: ProtocolInferWarning[];
  summary: ProtocolInferSummaryItem[];
};

const TASK_PLACEHOLDER = "${task.taskId}";
const HTTP_URL = /^https?:\/\//i;
const SKIP_BODY_KEYS = new Set(["callbackurl", "callback_url", "call_back_url"]);
const LITERAL_BODY_KEYS = new Set(["type", "object", "role", "kind", "mimetype", "mediatype"]);

/** 渠道字段名（去大小写/下划线）→ 平台规范占位。渠道 JSON 的键保持原样。 */
const BODY_PLACEHOLDERS: Record<string, string> = {
  model: "${request.model}",
  modelname: "${request.model}",
  modelid: "${request.model}",
  prompt: "${request.prompt}",
  text: "${request.prompt}",
  duration: "${request.body.duration}",
  seconds: "${request.body.duration}",
  ratio: "${request.body.aspect_ratio}",
  aspectratio: "${request.body.aspect_ratio}",
  resolution: "${request.body.resolution}",
  size: "${request.body.size}",
  quality: "${request.body.quality}",
  n: "${request.body.n}",
  imagecount: "${request.body.n}",
  seed: "${request.body.seed}",
  watermark: "${request.body.watermark}",
  fps: "${request.body.framepersecond}",
  framepersecond: "${request.body.framepersecond}",
  camerafixed: "${request.body.camerafixed}",
  generateaudio: "${request.body.generate_audio}",
  firstframe: "${request.firstFrameUrl}",
  firstframeurl: "${request.firstFrameUrl}",
  lastframe: "${request.lastFrameUrl}",
  lastframeurl: "${request.lastFrameUrl}",
  image: "${request.primaryImageUrl}",
  imageurl: "${request.primaryImageUrl}",
  images: "${request.inputUrls}",
};

const STATUS_TOKEN: Record<string, string> = {
  queued: "QUEUED",
  waiting: "QUEUED",
  wait: "QUEUED",
  queuing: "QUEUED",
  pending: "QUEUED",
  submitted: "QUEUED",
  processing: "PROCESSING",
  running: "PROCESSING",
  run: "PROCESSING",
  generating: "PROCESSING",
  in_progress: "PROCESSING",
  succeeded: "SUCCEEDED",
  succeed: "SUCCEEDED",
  success: "SUCCEEDED",
  completed: "SUCCEEDED",
  done: "SUCCEEDED",
  failed: "FAILED",
  fail: "FAILED",
  failure: "FAILED",
  error: "FAILED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
  "200": "QUEUED",
  "0": "QUEUED",
};

const SCENE_LABEL: Record<string, string> = Object.fromEntries(
  PROTOCOL_SCENE_OPTIONS.map((item) => [item.code, item.label]),
);

type ParsedHttp = {
  method: string;
  url: string;
  path: string;
  host: string;
  body: unknown;
  authType: string;
};

type JsonLeaf = {
  path: string;
  key: string;
  value: unknown;
  depth: number;
  jsonString?: boolean;
};

export function emptyProtocolSampleInput(): ProtocolSampleInput {
  return {
    sceneCode: "video_generation",
    submitRequest: "",
    submitResponse: "",
    pollRequest: "",
    pollResponse: "",
  };
}

export function inferProtocolFromSamples(input: ProtocolSampleInput): ProtocolInferResult {
  const fieldErrors: Partial<Record<ProtocolSampleField | "sceneCode", string>> = {};
  const warnings: ProtocolInferWarning[] = [];
  if (!input.sceneCode.trim()) {
    fieldErrors.sceneCode = "请选择协议场景";
  }
  const submitParsed = parseHttpSample(input.submitRequest, "POST");
  if (!input.submitRequest.trim()) {
    fieldErrors.submitRequest = "请粘贴任务请求（curl 或 URL + JSON）";
  } else if (submitParsed.error) {
    fieldErrors.submitRequest = submitParsed.error;
  }
  const submitJson = parseJsonSample(input.submitResponse);
  if (input.submitResponse.trim() && submitJson.error) {
    fieldErrors.submitResponse = submitJson.error;
  }
  const pollParsed = parseHttpSample(input.pollRequest, "GET");
  if (input.pollRequest.trim() && pollParsed.error) {
    fieldErrors.pollRequest = pollParsed.error;
  }
  const pollJson = parseJsonSample(input.pollResponse);
  if (input.pollResponse.trim() && pollJson.error) {
    fieldErrors.pollResponse = pollJson.error;
  }
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "请先修正场景和样例格式",
      fieldErrors,
      patch: {},
      warnings: [],
      summary: [],
    };
  }

  const submit = submitParsed.value;
  const poll = input.pollRequest.trim() ? pollParsed.value : null;
  const submitBody = submit.body ?? extractJsonValue(input.submitRequest);
  const submitWalk = walkJson(submitJson.value);
  const pollWalk = walkJson(pollJson.value);
  const asyncPoll = Boolean(poll || pollWalk.leaves.length > 0);
  const envelope = isInputEnvelope(submitBody);
  const submitExtract = inferExtract(submitWalk, { includeAssets: false, fallbackCodeAsStatus: true });
  const statusExtract = inferExtract(pollWalk.leaves.length > 0 ? pollWalk : submitWalk, {
    includeAssets: true,
    fallbackCodeAsStatus: false,
  });
  mergeStatusMapping(statusExtract, submitExtract);
  const assetCandidates = uniqueUrlLeaves(pollWalk.leaves.length > 0 ? pollWalk.leaves : submitWalk.leaves);
  if (assetCandidates.length > 1) {
    warnings.push({
      code: "multiple-urls",
      message: `发现 ${assetCandidates.length} 处结果地址，已选用 ${statusExtract.assetUrlPath || "第一项"}`,
    });
  }
  if (submit.path.includes("/v1/v1") || (poll?.path || "").includes("/v1/v1")) {
    warnings.push({
      code: "double-version",
      message: "路径含 /v1/v1，请核对渠道 endpoint 是否已经带了版本号",
    });
  }
  if (asyncPoll && !submitExtract.taskIdPath) {
    warnings.push({
      code: "missing-submit-task-id",
      message: "任务返回未识别到任务 ID，请核对「结果返回」样例",
    });
  }
  if (envelope) {
    warnings.push({
      code: "input-envelope",
      message: "已识别 model + input 结构，已按渠道 input 字段逐项映射",
    });
  }

  const pollPath = poll?.path || (asyncPoll ? guessPollPath(submit.path) : "");
  if (asyncPoll && !poll?.path && pollPath) {
    warnings.push({
      code: "guessed-poll-path",
      message: "未提供状态查询请求，已按任务路径推测查询地址",
    });
  }
  if (asyncPoll && !statusExtract.assetUrlPath) {
    warnings.push({
      code: "missing-asset-url",
      message: "轮询回包未识别到结果地址，若成片走独立下载接口请在 extras 中补路径",
    });
  }

  const patch: Partial<ProtocolEditorForm> = {
    invocation: asyncPoll ? "ASYNC_POLL" : "SYNC",
    passthrough: !asyncPoll && !extractHasContent(statusExtract),
    openaiCompatible: false,
    authType: pickAuthType(submit.authType, poll?.authType),
    submitMethod: submit.method || "POST",
    submitPath: submit.path,
    submitBody: submitBody == null ? "" : stringifyTemplate(toBodyTemplate(submitBody, input.sceneCode)),
    submitExtract: asyncPoll ? submitExtract : emptyExtractForm(),
    statusExtract: {
      ...statusExtract,
      assetType: statusExtract.assetType || inferAssetType(input.sceneCode, statusExtract.assetUrlPath, pollWalk.leaves),
    },
    statusMethod: poll?.method || "GET",
    statusEndpointPath: pollPath,
    extrasJson: asyncPoll ? JSON.stringify({ poll: { inline: true, intervalMs: 2000, maxAttempts: 90 } }, null, 2) : "",
    sceneCodes: [input.sceneCode],
  };
  const identity = inferIdentity(submit.host, input.sceneCode);
  if (identity.code) {
    patch.code = identity.code;
  }
  if (identity.name) {
    patch.name = identity.name;
  }

  return {
    ok: true,
    fieldErrors: {},
    patch,
    warnings,
    summary: buildSummary(patch, warnings.length),
  };
}

export function applyProtocolInferPatch(form: ProtocolEditorForm, patch: Partial<ProtocolEditorForm>): ProtocolEditorForm {
  return {
    ...form,
    ...patch,
    name: form.name.trim() ? form.name : patch.name || form.name,
    code: form.code.trim() ? form.code : patch.code || form.code,
    extrasJson: form.extrasJson.trim() ? form.extrasJson : patch.extrasJson || "",
    sceneCodes: patch.sceneCodes?.length ? patch.sceneCodes : form.sceneCodes,
    submitExtract: patch.submitExtract || form.submitExtract,
    statusExtract: patch.statusExtract || form.statusExtract,
  };
}

function parseHttpSample(raw: string, fallbackMethod: string): { value: ParsedHttp; error?: string } {
  const empty: ParsedHttp = { method: fallbackMethod, url: "", path: "", host: "", body: undefined, authType: "bearer" };
  const text = normalizeShell(raw);
  if (!text) {
    return { value: empty };
  }
  const methodMatch = text.match(/-(?:X|-request)\s+([A-Za-z]+)/i)
    || text.match(/^(GET|POST|PUT|PATCH|DELETE)\s+/i);
  let method = methodMatch ? methodMatch[1].toUpperCase() : "";
  const urlMatch = text.match(/https?:\/\/[^\s'"\\]+/i);
  const url = urlMatch ? urlMatch[0].replace(/[),;]+$/, "") : "";
  if (!method) {
    method = hasDataFlag(text) ? "POST" : fallbackMethod;
  }
  const headers = parseHeaders(text);
  const authType = inferAuthType(headers);
  const dataText = extractDataPayload(text);
  const body = dataText ? parseJsonValue(dataText).value : extractJsonValue(text);
  if (!url && body == null) {
    return { value: empty, error: "无法识别 URL 或 JSON 请求体" };
  }
  if (!url) {
    return { value: { method, url: "", path: "", host: "", body, authType } };
  }
  try {
    const parsed = new URL(url);
    return {
      value: {
        method,
        url,
        path: templatizePath(`${parsed.pathname}${parsed.search}`),
        host: parsed.hostname.replace(/^www\./, ""),
        body,
        authType,
      },
    };
  } catch {
    return { value: empty, error: "URL 无法解析" };
  }
}

function parseJsonSample(raw: string): { value: unknown; error?: string } {
  const text = raw.trim();
  if (!text) {
    return { value: undefined };
  }
  return parseJsonValue(text);
}

function parseJsonValue(raw: string): { value: unknown; error?: string } {
  const extracted = extractJsonSnippet(raw);
  if (!extracted) {
    return { value: undefined, error: "未找到 JSON" };
  }
  try {
    return { value: JSON.parse(extracted) };
  } catch {
    return { value: undefined, error: "不是合法 JSON" };
  }
}

function extractJsonValue(raw: string): unknown {
  return parseJsonValue(raw).value;
}

function normalizeShell(text: string): string {
  return text.replace(/\\\r?\n/g, " ").replace(/\u00a0/g, " ").trim();
}

function hasDataFlag(text: string): boolean {
  return /(?:^|\s)(?:-d|--data(?:-raw|-binary)?|--json)\s+/i.test(text);
}

function extractDataPayload(text: string): string {
  const match = text.match(/(?:^|\s)(?:-d|--data(?:-raw|-binary)?|--json)\s+/i);
  if (!match || match.index == null) {
    return "";
  }
  return readNextArg(text.slice(match.index + match[0].length));
}

function readNextArg(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  const quote = trimmed[0];
  if (quote === "'" || quote === "\"") {
    let end = 1;
    while (end < trimmed.length) {
      if (trimmed[end] === quote && trimmed[end - 1] !== "\\") {
        break;
      }
      end += 1;
    }
    return trimmed.slice(1, end);
  }
  const json = extractJsonSnippet(trimmed);
  if (json) {
    return json;
  }
  return trimmed.split(/\s+/, 1)[0] || "";
}

function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const pattern = /(?:^|\s)(?:-H|--header)\s+/gi;
  let match = pattern.exec(text);
  while (match) {
    const raw = readNextArg(text.slice(match.index + match[0].length));
    const index = raw.indexOf(":");
    if (index > 0) {
      headers[raw.slice(0, index).trim().toLowerCase()] = raw.slice(index + 1).trim();
    }
    match = pattern.exec(text);
  }
  return headers;
}

function inferAuthType(headers: Record<string, string>): string {
  const names = Object.keys(headers).join(" ");
  const authorization = Object.entries(headers).find(([key]) => /authorization|api-key|token/i.test(key))?.[1] || "";
  if (/dashscope/i.test(`${names} ${authorization}`)) {
    return "dashscope_async";
  }
  return "bearer";
}

function pickAuthType(submitAuth?: string, pollAuth?: string): string {
  const candidates = [submitAuth, pollAuth].filter((item): item is string => Boolean(item));
  return candidates.find((item) => item !== "bearer") || candidates[0] || "bearer";
}

function extractJsonSnippet(text: string): string {
  const start = text.search(/[{[]/);
  if (start < 0) {
    return "";
  }
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return "";
}

function templatizePath(path: string): string {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    decoded = path;
  }
  return decoded
    .replace(/%7B(?:task[_-]?id|id|taskId)%7D/gi, TASK_PLACEHOLDER)
    .replace(/\{(?:task[_-]?id|id|taskId)\}/gi, TASK_PLACEHOLDER)
    .replace(/:(?:task[_-]?id|id|taskId)\b/gi, TASK_PLACEHOLDER)
    .replace(/<(?:task[_-]?id|id|taskId)>/gi, TASK_PLACEHOLDER)
    .replace(/([?&](?:task[_-]?id|taskId|id)=)[^&]*/gi, `$1${TASK_PLACEHOLDER}`);
}

function walkJson(value: unknown): { leaves: JsonLeaf[]; jsonStringFields: string[] } {
  const jsonStringFields: string[] = [];
  const leaves = collectLeaves(value, "", 0, jsonStringFields);
  return { leaves, jsonStringFields };
}

function collectLeaves(value: unknown, prefix: string, depth: number, jsonStringFields: string[]): JsonLeaf[] {
  if (value == null) {
    return [];
  }
  if (typeof value === "string" && looksJsonObject(value)) {
    jsonStringFields.push(jsonPath(prefix));
    try {
      return collectLeaves(JSON.parse(value), prefix, depth, jsonStringFields);
    } catch {
      return [{ path: jsonPath(prefix), key: leafName(prefix), value, depth }];
    }
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [];
    }
    const path = jsonPath(prefix);
    if (value.every((item) => typeof item !== "object" || item == null)) {
      return [{ path, key: leafName(prefix), value, depth }];
    }
    const indexPrefix = prefix ? `${prefix}[0]` : "[0]";
    return collectLeaves(value[0], indexPrefix, depth + 1, jsonStringFields);
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => (
      collectLeaves(item, prefix ? `${prefix}.${key}` : key, depth + 1, jsonStringFields)
    ));
  }
  return [{ path: jsonPath(prefix), key: leafName(prefix), value, depth }];
}

function jsonPath(prefix: string): string {
  return prefix ? `$.${prefix}` : "$";
}

function lastKey(prefix: string): string {
  const parts = prefix.split(".");
  return parts[parts.length - 1] || "";
}

function leafName(prefix: string): string {
  return lastKey(prefix).replace(/\[\d+\]/g, "");
}

function normalizeFieldKey(key: string): string {
  return key.toLowerCase().replace(/[_-\s]/g, "");
}

function inferExtract(
  walked: { leaves: JsonLeaf[]; jsonStringFields: string[] },
  options: { includeAssets: boolean; fallbackCodeAsStatus: boolean },
): ProtocolExtractForm {
  const extract = emptyExtractForm();
  const leaves = walked.leaves;
  const taskId = pickBest(leaves, scoreTaskId);
  const status = pickBest(leaves, scoreStatus) || (options.fallbackCodeAsStatus ? pickBest(leaves, scoreAckCode) : null);
  const progress = pickBest(leaves, scoreProgress);
  const error = pickBest(leaves, scoreError);
  const successCode = pickBest(leaves, scoreSuccessCode);
  if (taskId) {
    extract.taskIdPath = taskId.path;
  }
  if (status) {
    extract.statusPath = status.path;
  }
  const mappings = new Map<string, string>();
  leaves.forEach((leaf) => {
    if (scoreStatus(leaf) <= 0 && !(options.fallbackCodeAsStatus && scoreAckCode(leaf) > 0 && leaf.path === status?.path)) {
      return;
    }
    parseMappingLines(mappingFromValue(leaf.value, leaf.key)).forEach((item) => mappings.set(item.key, item.value));
  });
  if (status && mappings.size === 0) {
    parseMappingLines(mappingFromValue(status.value, status.key)).forEach((item) => mappings.set(item.key, item.value));
  }
  extract.statusMapping = [...mappings.entries()].map(([key, value]) => `${key}=${value}`).join("\n");
  if (progress) {
    extract.progressPath = progress.path;
  }
  if (error) {
    extract.errorPath = error.path;
  }
  if (successCode) {
    extract.successCode = successCode.path;
  }
  if (walked.jsonStringFields.length > 0) {
    extract.jsonStringFields = [...new Set(walked.jsonStringFields)].join("\n");
  }
  if (options.includeAssets) {
    const asset = pickBest(leaves, scoreAssetUrl);
    if (asset) {
      extract.assetUrlPath = asset.path;
      extract.assetType = inferAssetType("", asset.path, leaves);
    }
  }
  return extract;
}

function pickBest(leaves: JsonLeaf[], score: (leaf: JsonLeaf) => number): JsonLeaf | null {
  let best: JsonLeaf | null = null;
  let bestScore = 0;
  leaves.forEach((leaf) => {
    const next = score(leaf);
    if (next > bestScore) {
      best = leaf;
      bestScore = next;
    }
  });
  return bestScore > 0 ? best : null;
}

function scoreTaskId(leaf: JsonLeaf): number {
  const key = normalizeFieldKey(leaf.key);
  const text = String(leaf.value ?? "");
  if (["requestid", "model", "object", "code", "message", "msg"].includes(key)) {
    return 0;
  }
  let score = 0;
  if (key === "taskid" || key === "jobid") {
    score += 24;
  } else if (key === "id") {
    score += /^(task|job|tsk)[_-]/i.test(text) ? 18 : 8;
  }
  if (/^(task|job|tsk)[_-]/i.test(text)) {
    score += 4;
  }
  return Math.max(0, score - leaf.depth);
}

function scoreStatus(leaf: JsonLeaf): number {
  const key = normalizeFieldKey(leaf.key);
  if (key === "status" || key === "taskstatus") {
    return 20 - leaf.depth;
  }
  if (key === "state") {
    return 18 - leaf.depth;
  }
  if (key === "successflag") {
    return 12 - leaf.depth;
  }
  return 0;
}

function scoreAckCode(leaf: JsonLeaf): number {
  if (leaf.key.toLowerCase() !== "code") {
    return 0;
  }
  const text = String(leaf.value ?? "").toLowerCase();
  if (["200", "0", "success", "ok"].includes(text)) {
    return 16 - leaf.depth;
  }
  return 0;
}

function scoreProgress(leaf: JsonLeaf): number {
  const key = normalizeFieldKey(leaf.key);
  if (key === "progress" || key === "percent") {
    return 16 - leaf.depth;
  }
  return 0;
}

function scoreError(leaf: JsonLeaf): number {
  const key = normalizeFieldKey(leaf.key);
  if (["failreason", "failmsg", "errormessage", "error"].includes(key)) {
    return 18 - leaf.depth;
  }
  if (key === "msg" || key === "message") {
    return 4 - leaf.depth;
  }
  return 0;
}

function scoreSuccessCode(leaf: JsonLeaf): number {
  if (leaf.key.toLowerCase() !== "code") {
    return 0;
  }
  const text = String(leaf.value ?? "").toLowerCase();
  if (["success", "ok", "0", "200"].includes(text)) {
    return 14 - leaf.depth;
  }
  return 0;
}

function scoreAssetUrl(leaf: JsonLeaf): number {
  const key = leaf.key.toLowerCase();
  const values = flattenStrings(leaf.value);
  const hasUrl = values.some((item) => HTTP_URL.test(item) || looksMediaPath(item));
  if (!hasUrl && !/url/i.test(key)) {
    return 0;
  }
  let score = hasUrl ? 10 : 0;
  if (key.includes("result")) {
    score += 8;
  }
  if (key === "video_url" || key.includes("video")) {
    score += 6;
  }
  if (key.includes("url")) {
    score += 5;
  }
  if (values.some((item) => /\.(mp4|webm|mov|png|jpe?g|webp|mp3|wav)(\?|$)/i.test(item))) {
    score += 4;
  }
  if (key.includes("first") || key.includes("last") || key.includes("frame")) {
    score -= 8;
  }
  return Math.max(0, score - leaf.depth);
}

function flattenStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenStrings(item));
  }
  return [];
}

function uniqueUrlLeaves(leaves: JsonLeaf[]): JsonLeaf[] {
  return leaves.filter((leaf) => scoreAssetUrl(leaf) > 0);
}

function inferAssetType(sceneCode: string, path: string, leaves: JsonLeaf[]): string {
  if (sceneCode === "video_generation") {
    return "VIDEO";
  }
  if (sceneCode === "image_generation") {
    return "IMAGE";
  }
  if (sceneCode === "audio_synthesis" || sceneCode === "audio_transcription") {
    return "AUDIO";
  }
  const haystack = `${path} ${leaves.map((leaf) => String(leaf.value ?? "")).join(" ")}`.toLowerCase();
  if (haystack.includes("video") || /\.mp4|\.webm|\.mov/.test(haystack)) {
    return "VIDEO";
  }
  if (haystack.includes("audio") || /\.mp3|\.wav/.test(haystack)) {
    return "AUDIO";
  }
  if (haystack.includes("image") || /\.png|\.jpe?g|\.webp/.test(haystack)) {
    return "IMAGE";
  }
  return "FILE";
}

function mappingFromValue(value: unknown, key = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  if (normalizeFieldKey(key) === "successflag") {
    const flag: Record<string, string> = { "0": "PROCESSING", "1": "SUCCEEDED", "2": "FAILED", "3": "FAILED" };
    return flag[raw] ? `${raw}=${flag[raw]}` : "";
  }
  const mapped = STATUS_TOKEN[raw.toLowerCase()] || STATUS_TOKEN[raw.toLowerCase().replace(/-/g, "_")];
  return mapped ? `${raw}=${mapped}` : "";
}

function mergeStatusMapping(target: ProtocolExtractForm, source: ProtocolExtractForm): void {
  const merged = new Map<string, string>();
  parseMappingLines(source.statusMapping).forEach((item) => merged.set(item.key, item.value));
  parseMappingLines(target.statusMapping).forEach((item) => merged.set(item.key, item.value));
  target.statusMapping = [...merged.entries()].map(([key, value]) => `${key}=${value}`).join("\n");
}

function parseMappingLines(text: string): Array<{ key: string; value: string }> {
  return text.split("\n").flatMap((line) => {
    const index = line.indexOf("=");
    if (index <= 0) {
      return [];
    }
    return [{ key: line.slice(0, index).trim(), value: line.slice(index + 1).trim() }];
  }).filter((item) => item.key && item.value);
}

function isInputEnvelope(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }
  const record = body as Record<string, unknown>;
  return typeof record.input === "object" && record.input != null && !Array.isArray(record.input);
}

function placeholderForKey(key: string, sceneCode: string): string | undefined {
  const norm = normalizeFieldKey(key);
  if (sceneCode === "video_generation" && norm === "size") {
    return "${request.body.resolution}";
  }
  return BODY_PLACEHOLDERS[norm];
}

function fieldPlaceholder(key: string, sceneCode: string): string {
  return placeholderForKey(key, sceneCode) || `\${request.body.${key}}`;
}

function looksTypedContentItem(item: unknown): item is Record<string, unknown> {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return false;
  }
  const record = item as Record<string, unknown>;
  const type = String(record.type ?? "").toLowerCase();
  return type === "text" || type === "image_url" || type === "image"
    || "text" in record
    || "image_url" in record;
}

function looksTypedContentArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.some((item) => looksTypedContentItem(item));
}

function toContentArrayTemplate(items: unknown[], sceneCode: string): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  items.forEach((item) => {
    if (!looksTypedContentItem(item)) {
      out.push(toBodyTemplate(item, sceneCode));
      return;
    }
    const type = String(item.type ?? "");
    const typeKey = type.toLowerCase() || ("text" in item ? "text" : "image_url");
    if (seen.has(typeKey)) {
      return;
    }
    seen.add(typeKey);
    if (typeKey === "text" || ("text" in item && typeKey !== "image_url" && typeKey !== "image")) {
      out.push({
        $includeIf: "request.prompt",
        type: type || "text",
        text: "${request.prompt}",
      });
      return;
    }
    const row: Record<string, unknown> = {
      $forEach: "request.images",
      type: type || "image_url",
    };
    if (item.image_url && typeof item.image_url === "object") {
      row.image_url = { url: "${item.url}" };
    } else if ("url" in item) {
      row.url = "${item.url}";
    } else {
      row.image_url = { url: "${item.url}" };
    }
    if ("role" in item) {
      row.role = "${item.role}";
    }
    out.push(row);
  });
  return out;
}

function toBodyTemplate(value: unknown, sceneCode: string, fieldKey?: string): unknown {
  if (looksTypedContentArray(value)) {
    return toContentArrayTemplate(value, sceneCode);
  }
  if (Array.isArray(value)) {
    if (fieldKey) {
      return fieldPlaceholder(fieldKey, sceneCode);
    }
    return value.map((item) => toBodyTemplate(item, sceneCode));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (SKIP_BODY_KEYS.has(key.toLowerCase())) {
        return;
      }
      if (LITERAL_BODY_KEYS.has(normalizeFieldKey(key)) && typeof item === "string") {
        out[key] = item;
        return;
      }
      out[key] = toBodyTemplate(item, sceneCode, key);
    });
    return out;
  }
  return fieldKey ? fieldPlaceholder(fieldKey, sceneCode) : value;
}

function stringifyTemplate(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function inferIdentity(host: string, sceneCode: string): { code: string; name: string } {
  if (!host || /^\d/.test(host)) {
    return { code: "", name: "" };
  }
  const vendor = host.split(".")[0].replace(/[^a-z0-9-]/gi, "").toLowerCase();
  if (!vendor) {
    return { code: "", name: "" };
  }
  const sceneShort = sceneCode.replace(/_generation|_synthesis|_transcription/g, "").replace(/_/g, "-");
  const titleVendor = vendor.charAt(0).toUpperCase() + vendor.slice(1);
  const sceneLabel = SCENE_LABEL[sceneCode] || "通用";
  return {
    code: sceneShort ? `${vendor}-${sceneShort}` : vendor,
    name: `${titleVendor} ${sceneLabel}`,
  };
}

function guessPollPath(submitPath: string): string {
  if (!submitPath) {
    return "";
  }
  if (submitPath.includes(TASK_PLACEHOLDER)) {
    return submitPath;
  }
  return `${submitPath.replace(/\/$/, "")}/${TASK_PLACEHOLDER}`;
}

function looksJsonObject(value: string): boolean {
  const trimmed = value.trim();
  return (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"));
}

function looksMediaPath(value: string): boolean {
  return /\.(mp4|webm|mov|png|jpe?g|webp|mp3|wav|glb|gltf)(\?|$)/i.test(value);
}

function buildSummary(patch: Partial<ProtocolEditorForm>, warningCount: number): ProtocolInferSummaryItem[] {
  const items: ProtocolInferSummaryItem[] = [
    { label: "调用", value: patch.invocation === "ASYNC_POLL" ? "异步轮询" : "同步" },
    { label: "场景", value: (patch.sceneCodes || []).map((code) => SCENE_LABEL[code] || code).join(" / ") || "未指定" },
    { label: "提交", value: `${patch.submitMethod || "POST"} ${patch.submitPath || "-"}` },
  ];
  if (patch.invocation === "ASYNC_POLL") {
    items.push({ label: "查询", value: `${patch.statusMethod || "GET"} ${patch.statusEndpointPath || "-"}` });
    items.push({ label: "任务 ID", value: patch.submitExtract?.taskIdPath || "-" });
    items.push({ label: "轮询状态", value: patch.statusExtract?.statusPath || "-" });
    items.push({ label: "成片", value: patch.statusExtract?.assetUrlPath || "-" });
  } else {
    items.push({ label: "结果", value: patch.statusExtract?.assetUrlPath || patch.statusExtract?.taskIdPath || "-" });
  }
  if (warningCount > 0) {
    items.push({ label: "待核对", value: `${warningCount} 项` });
  }
  return items;
}
