import { apiFetch } from "@/shared/api/sys/http";
import { getAccessToken } from "@/shared/api/auth/auth";
import { buildPageSearchParams } from "@/shared/api/sys/paging";
import { toWebSocketBaseUrl } from "@/shared/api/sys/api-base";

export type TaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export type TaskEventType =
  | "queued"
  | "claimed"
  | "running"
  | "progress"
  | "succeeded"
  | "failed"
  | "canceled"
  | "requeued"
  | "priority_updated";

/**
 * 任务事件类型展示文案（与后端 TaskEventType.wire 对齐）。
 */
export const TASK_EVENT_TYPE_LABELS: Record<TaskEventType, string> = {
  queued: "已入队",
  claimed: "已领取",
  running: "运行中",
  progress: "进度更新",
  succeeded: "已成功",
  failed: "已失败",
  canceled: "已取消",
  requeued: "重新入队",
  priority_updated: "优先级更新",
};

/**
 * 将任务事件类型转为中文展示文案；未知值回退原文。
 */
export function formatTaskEventType(value?: string | null): string {
  if (!value) {
    return "-";
  }
  const key = value.toLowerCase() as TaskEventType;
  return TASK_EVENT_TYPE_LABELS[key] || value;
}

/**
 * 任务终态集合。
 *
 * 说明：终态表示任务不再发生业务状态变更（不再排队/执行），前端可据此停止轮询或禁用操作按钮。
 */
export const TERMINAL_STATUSES: Set<TaskStatus> = new Set([
  "succeeded",
  "failed",
  "canceled",
]);

/**
 * 判断任务状态是否为终态。
 */
export function isTerminal(status: TaskStatus | string): boolean {
  return TERMINAL_STATUSES.has(status as TaskStatus);
}

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type Review =
  | "pending"
  | "passed"
  | "blocked"
  | "rejected"
  | string
  | null;

export type Server = {
  serverId: string;
  serverName: string;
  status: string;
  queueSize: number;
};

export type Task = {
  taskId: string;
  taskName: string | null;
  status: string;
  principalId?: string | null;
  ownerKind?: "user" | "device" | string | null;
  principalName: string | null;
  deviceCode?: string | null;
  principalAvatarUrl?: string | null;
  serverId?: string | null;
  serverName: string | null;
  workflowId?: string | null;
  workflowTitle?: string | null;
  workflowCode?: string | null;
  taskKind?: string | null;
  sourceType?: string | null;
  submittedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt?: string | null;
  generateTimeSec?: number | null;
  generateDurationMs?: number | null;
  taskDurationMs?: number | null;
  computeUnits: number;
  consumptionAmount?: number | string | null;
  inputJson?: string | null;
  outputJson?: string | null;
  errorMessage?: string | null;
  workType?: string | null;
  coverUrl?: string | null;
  itemsJson?: string | null;
  deletedAt?: string | null;
  assets?: Asset[] | null;
};

export type Asset = {
  assetId: string;
  kind: string;
  provider: string | null;
  textContent: string | null;
  reviewStatus: Review;
};

export type TaskDetail = {
  taskId: string;
  taskName: string | null;
  status: string;
  preview: boolean;
  priority: number;
  submittedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  computeUnits: number;
  errorMessage: string | null;
  inputJson?: string | null;
  outputJson?: string | null;
  assets: Asset[];
};

export type TaskEvent = {
  eventId?: string | null;
  eventType: string;
  detailJson: string | null;
  createdAt: string | null;
};

export type StandardTaskEventDetailJson = {
  eventType?: string | null;
  taskId?: string | null;
  stage?: string | null;
  message?: string | null;
  progress?: number | null;
  serverId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  payload?: unknown;
  occurredAt?: string | null;
};

/**
 * 解析 TaskEvent.detailJson（兼容非法 JSON 与字段缺失）。
 *
 * @param detailJson 后端事件明细 JSON 字符串
 * @returns 解析成功返回对象；无法解析返回 null
 */
export function parseTaskEventDetailJson(
  detailJson: string | null,
): StandardTaskEventDetailJson | null {
  if (!detailJson || !detailJson.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(detailJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;
    return parsed as StandardTaskEventDetailJson;
  } catch {
    return null;
  }
}

/**
 * 合并资产列表并保持稳定顺序（按 assetId 去重）。
 *
 * 用途：
 * - WebSocket 推送/轮询可能多次返回相同 assetId 的更新；
 * - 前端希望“同 assetId 覆盖内容，同时保持 UI 顺序稳定”，避免列表抖动。
 */
export function mergeAssetsStable(
  prev: Asset[] | null | undefined,
  incoming: Asset[] | null | undefined,
): Asset[] {
  const prevList = Array.isArray(prev) ? prev : [];
  const incomingList = Array.isArray(incoming) ? incoming : [];
  if (incomingList.length === 0) return prevList;
  if (prevList.length === 0) return incomingList;

  const byId = new Map<string, Asset>();
  const order: string[] = [];

  for (const a of prevList) {
    if (!a?.assetId) continue;
    if (!byId.has(a.assetId)) {
      order.push(a.assetId);
    }
    byId.set(a.assetId, a);
  }

  for (const a of incomingList) {
    if (!a?.assetId) continue;
    if (!byId.has(a.assetId)) {
      order.push(a.assetId);
    }
    byId.set(a.assetId, a);
  }

  const out: Asset[] = [];
  for (const id of order) {
    const a = byId.get(id);
    if (a) out.push(a);
  }
  return out;
}

export type DispatchRequest = {
  taskName?: string | null;
  mode?: string | null;
  appId: string;
  workflowVersionId: string;
  tenantId?: string | null;
  sessionId?: string | null;
  preferredServerId?: string | null;
  params?: Record<string, unknown> | null;
  prompt?: string | null;
  amount?: number | null;
  expectedImageCount?: number | null;
  [key: string]: any;
};

export type DispatchAccepted = {
  taskId: string;
  status: string;
  serverId: string;
  queuePosition: number;
  etaSeconds: number;
  computeUnits: number;
};

export type Dispatch = {
  taskId: string;
  sessionId: string | null;
  taskName: string | null;
  status: string;
  preview: boolean;
  priority: number;
  submittedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  computeUnits: number;
  errorMessage: string | null;
  errorCode?: string | null;
  outputJson: string | null;
  inputJson: string | null;
  appId: string | null;
  workflowVersionId: string | null;
  serverId: string | null;
  serverName: string | null;
  queuePosition: number;
  etaSeconds: number;
  progress: number;
  assets: Asset[];
};

export type AppMeta = {
  id: string;
  icon: string | null;
  title: string | null;
  subtitle: string | null;
};

export type DispatchTimelineItem = {
  taskId: string;
  sessionId: string | null;
  taskName: string | null;
  status: string;
  errorMessage?: string | null;
  submittedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  outputJson: string | null;
  inputJson: string | null;
  prompt: string | null;
  appId: string | null;
  workflowVersionId: string | null;
  app?: AppMeta | null;
  assets: Asset[];
};

export type DispatchTimelinePage = {
  pageNo: number;
  pageSize: number;
  hasMore: boolean;
  items: DispatchTimelineItem[];
};

export type SessionListItem = {
  sessionId: string;
  sessionName: string | null;
  ownerPrincipalId: string | null;
  merchantId: string | null;
  storeId: string | null;
  lastTaskAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SessionListPage = {
  page: PageResult;
  items: SessionListItem[];
};

export type SessionDetail = SessionListItem;

export type SchedulerServer = Server;
export type SchedulerTask = Task;
export type SchedulerTaskAsset = Asset;
export type SchedulerTaskDetail = TaskDetail;
export type SchedulerTaskEvent = TaskEvent;
export type SchedulerDispatchRequest = DispatchRequest;
export type SchedulerDispatchAccepted = DispatchAccepted;
export type SchedulerDispatchAsset = Asset;
export type SchedulerDispatchDetail = Dispatch;

export async function listServers(): Promise<{ items: Server[] }> {
  return apiFetch<{ items: Server[] }>("/api/scheduler/servers", { method: "GET" });
}

export type ListTasksParams = {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  status?: string;
  createdAtStart?: string;
  createdAtEnd?: string;
  assignedServerId?: string;
};

export async function listTasks(params: ListTasksParams): Promise<{ page: PageResult; items: Task[] }> {
  const qs = buildTaskListSearchParams(params);
  return apiFetch<{ page: PageResult; items: Task[] }>(`/api/scheduler/tasks?${qs.toString()}`, { method: "GET" });
}

export async function exportTasksCsv(params: ListTasksParams): Promise<string> {
  const qs = buildTaskListSearchParams(params);
  return apiFetch<string>(`/api/scheduler/tasks/export?${qs.toString()}`, { method: "GET" });
}

export async function deleteTask(taskId: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/scheduler/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
}

function buildTaskListSearchParams(params: ListTasksParams): URLSearchParams {
  const qs = buildPageSearchParams(params);
  if (params.keyword?.trim()) qs.set("keyword", params.keyword.trim());
  if (params.status?.trim() && params.status !== "all") qs.set("status", params.status.trim());
  if (params.createdAtStart?.trim()) qs.set("createdAtStart", params.createdAtStart.trim());
  if (params.createdAtEnd?.trim()) qs.set("createdAtEnd", params.createdAtEnd.trim());
  if (params.assignedServerId?.trim()) qs.set("assignedServerId", params.assignedServerId.trim());
  return qs;
}

export async function getTask(taskId: string): Promise<TaskDetail> {
  return apiFetch<TaskDetail>(`/api/scheduler/tasks/${encodeURIComponent(taskId)}`, { method: "GET" });
}

export async function listTaskEvents(taskId: string): Promise<TaskEvent[]> {
  return apiFetch<TaskEvent[]>(`/api/scheduler/tasks/${encodeURIComponent(taskId)}/events`, { method: "GET" });
}

export async function cancelTask(taskId: string): Promise<{ taskId: string; status: string }> {
  return apiFetch<{ taskId: string; status: string }>(`/api/scheduler/tasks/${encodeURIComponent(taskId)}/cancel`, { method: "POST" });
}

export async function reassignTask(taskId: string, serverId: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/scheduler/tasks/${encodeURIComponent(taskId)}/reassign`, {
    method: "POST",
    body: JSON.stringify({ serverId }),
  });
}

export async function createTask(
  request: CreateTaskRequest,
): Promise<TaskAccepted> {
  return apiFetch<TaskAccepted>("/api/scheduler/tasks", {
    method: "POST",
    body: JSON.stringify(request),
  });
}


export async function dispatch(
  request: DispatchRequest,
): Promise<DispatchAccepted> {
  return apiFetch<DispatchAccepted>("/api/scheduler/dispatch", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getDispatch(taskId: string): Promise<Dispatch> {
  return apiFetch<Dispatch>(
    `/api/scheduler/dispatch/${encodeURIComponent(taskId)}`,
    { method: "GET" },
  );
}

export async function listDispatchEvents(taskId: string): Promise<TaskEvent[]> {
  return apiFetch<TaskEvent[]>(
    `/api/scheduler/dispatch/${encodeURIComponent(taskId)}/events`,
    { method: "GET" },
  );
}

export async function listDispatchTimeline(params: {
  sessionId: string;
  pageNo: number;
  pageSize: number;
  total?: number;
}): Promise<DispatchTimelinePage> {
  const qs = buildPageSearchParams(params);
  return apiFetch<DispatchTimelinePage>(
    `/api/scheduler/dispatch/sessions/${encodeURIComponent(params.sessionId)}/tasks?${qs.toString()}`,
    { method: "GET" },
  );
}

export async function deleteDispatchSessionTask(params: {
  sessionId: string;
  taskId: string;
  deleteWorkMaterial?: boolean;
}): Promise<boolean> {
  const qs = new URLSearchParams({
    deleteWorkMaterial: params.deleteWorkMaterial ? "true" : "false",
  });
  return apiFetch<boolean>(
    `/api/scheduler/dispatch/sessions/${encodeURIComponent(params.sessionId)}/tasks/${encodeURIComponent(params.taskId)}?${qs.toString()}`,
    { method: "DELETE" },
  );
}

/**
 * 拉取会话下全部 timeline 任务（分页翻完）。
 *
 * 用于工作区批量操作（删除失败任务 / 清空工作区），避免仅处理当前已加载页。
 */
export async function listAllDispatchSessionTasks(sessionId: string): Promise<DispatchTimelineItem[]> {
  const pageSize = 100;
  const all: DispatchTimelineItem[] = [];
  let pageNo = 1;
  for (;;) {
    const page = await listDispatchTimeline({ sessionId, pageNo, pageSize });
    if (Array.isArray(page.items) && page.items.length > 0) {
      all.push(...page.items);
    }
    if (!page.hasMore || !page.items?.length) {
      break;
    }
    pageNo += 1;
  }
  return all;
}

export async function listSessions(params: { pageNo: number; pageSize: number; total?: number }): Promise<SessionListPage> {
  const qs = buildPageSearchParams(params);
  return apiFetch<SessionListPage>(`/api/scheduler/sessions?${qs.toString()}`, {
    method: "GET",
  });
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  return apiFetch<SessionDetail>(
    `/api/scheduler/sessions/${encodeURIComponent(sessionId)}`,
    { method: "GET" },
  );
}

export async function renameSession(
  sessionId: string,
  sessionName: string,
): Promise<boolean> {
  const res = await apiFetch<boolean>(
    `/api/scheduler/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ sessionName }),
    },
  );
  return !!res;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const res = await apiFetch<boolean>(
    `/api/scheduler/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  );
  return !!res;
}

/**
 * 生成调度 WebSocket dispatch 的连接 URL。
 *
 * 背景：
 * - 浏览器原生 WebSocket 握手不允许自定义 Header（无法带 Authorization）；
 * - 当前链路改为依赖网关/服务端确认的会话上下文，浏览器握手阶段仅透传 token。
 *
 * 注意：
 * - 这里将 token 拼到 URL 中仅用于浏览器握手阶段；作用域由服务端从会话中恢复。
 */
export function getDispatchWebSocketUrl(taskId: string, opts?: { lastEventId?: string | null }): string {
  const wsBase = toWebSocketBaseUrl();
  const qs = new URLSearchParams({ taskId });
  if (opts?.lastEventId && opts.lastEventId.trim()) {
    qs.set("lastEventId", opts.lastEventId.trim());
  }
  const token = getAccessToken();
  if (token && token.trim()) {
    qs.set("token", token.trim());
  }
  return `${wsBase}/api/scheduler/ws/dispatch?${qs.toString()}`;
}
