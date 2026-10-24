import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction, type WheelEvent } from "react";
import { type InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Calendar,
  Check,
  ChevronLeft,
  Edit3,
  ExternalLink,
  Filter,
  Image as ImageIcon,
  LayoutGrid,
  Layers,
  MessageSquare,
  MoreHorizontal,
  Maximize2,
  Pin,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  TerminalSquare,
  Trash2,
  Download,
  FileCode2,
  XCircle,
  ZoomIn,
  ZoomOut,
  FlipHorizontal,
  FlipVertical,
  RotateCcw as RotateLeft,
  X,
  ChevronsDown,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { HttpError } from "@/shared/api/sys/http";
import { resolveUserErrorMessage, resolveUserErrorNotice } from "@/shared/api/sys/error-message";
import { notify } from "@/shared/lib/notify";
import { listWorkflowCates } from "@/shared/api/workflow/workflow-cate";
import { getWorkflow, listWorkflows, type WorkflowCard } from "@/shared/api/workflow/workflow";
import { getWorkflowVersion, listWorkflowVersions } from "@/shared/api/workflow/workflow-version";
import {
  cancelTask,
  deleteDispatchSessionTask,
  dispatch,
  deleteSession,
  getDispatch,
  listAllDispatchSessionTasks,
  listDispatchEvents,
  listSessions,
  mergeAssetsStable,
  renameSession,
  type Dispatch as SchedulerDispatch,
  type DispatchTimelineItem,
  type SessionListItem,
  type SessionListPage,
  type TaskEvent,
} from "@/shared/api/sys/scheduler";
import { parseUiSchemaText, type UiSchemaV1 } from "@/modules/workflow/components/pagebuilder/ui-schema";
import { formatParamValidationIssue, validateUiSchemaParamNames } from "@/modules/workflow/components/pagebuilder/param-utils";
import {
  buildDispatchParams,
  prepareRuntimeValuesForDispatch,
} from "@/modules/workflow/components/pagebuilder/ui-component-registry";
import { parseExecutionConfig } from "@/modules/workflow/lib/workflow-exec";
import { applyFieldConstraintsToRuntimeValues } from "@/modules/workflow/runtime-model/constraints";
import { canonicalImageCount, runtimeValueSlot } from "@/modules/workflow/runtime-model/identity";
import { useSelectedRuntimeModel } from "@/modules/workflow/runtime-model/selected";
import { useDispatchStream } from "@/modules/workflow/hooks/use-dispatch-stream";
import { useAssetDownloader } from "@/modules/workflow/hooks/use-asset-downloader";
import { useSessionTimeline } from "@/modules/workflow/hooks/use-session-timeline";
import { formatDateTime } from "@/shared/lib/datetime";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";

import template1 from "@/assets/template-1.jpg";
import template8 from "@/assets/template-8.jpg";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";


import { isTerminalStatus, shouldStopAutoRefresh, getStatusBadgeVariant, safeJsonParse, toCompactJson, shouldEnableDebugLogs, debugLog, generateId32, isProbablyImageUrl, taskTime } from "../components/preview/utils";
import { RuntimeForm } from "../components/preview/RuntimeForm";
import { PreviewPane, type PreviewPaneHandle } from "../components/preview/PreviewPane";
import { useSessionScope } from "@/shared/hooks/use-session-scope";

function createLocalAppMeta(
  workflowId: string,
  workflowCoverUrl: string | null | undefined,
  workflowTitle: string | null | undefined,
  workflowSubtitle: string | null | undefined
) {
  return {
    id: workflowId,
    icon: workflowCoverUrl || null,
    title: workflowTitle || null,
    subtitle: workflowSubtitle || null,
  };
}

function createSubmittingLocalTimelineItem(args: {
  localTaskId: string;
  sessionId: string;
  taskName: string;
  prompt: string | null;
  inputJson: string | null;
  workflowId: string;
  workflowVersionId: string | null;
  workflowCoverUrl: string | null | undefined;
  workflowTitle: string | null | undefined;
  workflowSubtitle: string | null | undefined;
}): DispatchTimelineItem {
  return {
    taskId: args.localTaskId,
    sessionId: args.sessionId,
    taskName: args.taskName,
    status: "submitting",
    errorMessage: null,
    submittedAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    outputJson: null,
    inputJson: args.inputJson,
    prompt: args.prompt,
    appId: args.workflowId,
    workflowVersionId: args.workflowVersionId,
    app: createLocalAppMeta(args.workflowId, args.workflowCoverUrl, args.workflowTitle, args.workflowSubtitle),
    assets: [],
  };
}

function createAcceptedLocalTimelineItem(args: {
  taskId: string;
  sessionId: string;
  taskName: string;
  prompt: string | null;
  inputJson: string | null;
  workflowId: string;
  workflowVersionId: string;
  workflowCoverUrl: string | null | undefined;
  workflowTitle: string | null | undefined;
  workflowSubtitle: string | null | undefined;
}): DispatchTimelineItem {
  return {
    taskId: args.taskId,
    sessionId: args.sessionId,
    taskName: args.taskName,
    status: "queued",
    errorMessage: null,
    submittedAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    outputJson: null,
    inputJson: args.inputJson,
    prompt: args.prompt,
    appId: args.workflowId,
    workflowVersionId: args.workflowVersionId,
    app: createLocalAppMeta(args.workflowId, args.workflowCoverUrl, args.workflowTitle, args.workflowSubtitle),
    assets: [],
  };
}

function markLocalTimelineItemFailed(
  items: DispatchTimelineItem[],
  localTaskId: string,
  errorMessage: string
): DispatchTimelineItem[] {
  return items.map((item) => {
    if (item.taskId !== localTaskId) {
      return item;
    }
    return {
      ...item,
      status: "failed",
      errorMessage,
      finishedAt: new Date().toISOString(),
    };
  });
}

function syncDispatchDetailToLocalTimelineItems(
  items: DispatchTimelineItem[],
  activeTaskId: string,
  detail: SchedulerDispatch
): DispatchTimelineItem[] {
  return items.map((item) => {
    if (item.taskId !== activeTaskId) {
      return item;
    }
    return {
      ...item,
      taskName: detail.taskName || item.taskName,
      status: detail.status || item.status,
      errorMessage: detail.errorMessage ?? item.errorMessage ?? null,
      submittedAt: detail.submittedAt || item.submittedAt,
      startedAt: detail.startedAt || item.startedAt,
      finishedAt: detail.finishedAt || item.finishedAt,
      outputJson: detail.outputJson || item.outputJson,
      inputJson: detail.inputJson || item.inputJson,
      appId: detail.appId || item.appId,
      workflowVersionId: detail.workflowVersionId || item.workflowVersionId,
      assets: mergeAssetsStable(item.assets, detail.assets),
    };
  });
}

function prunePersistedLocalTimelineItems(
  items: DispatchTimelineItem[],
  persistedItems: DispatchTimelineItem[]
): DispatchTimelineItem[] {
  if (persistedItems.length === 0) {
    return items;
  }
  const persistedTaskIds = new Set(persistedItems.map((item) => item.taskId));
  return items.filter((item) => item.taskId.startsWith("local-") || !persistedTaskIds.has(item.taskId));
}

function mergeTimelineWithLocalItems(
  persistedItems: DispatchTimelineItem[],
  localItems: DispatchTimelineItem[]
): DispatchTimelineItem[] {
  if (localItems.length === 0) {
    return persistedItems;
  }
  const persistedTaskIds = new Set(persistedItems.map((item) => item.taskId));
  const extras = localItems.filter((item) => item.taskId.startsWith("local-") || !persistedTaskIds.has(item.taskId));
  return extras.length > 0 ? [...persistedItems, ...extras] : persistedItems;
}

type TimelineTimeRange = "" | "today" | "week" | "month";
type TimelineOutputType = "image" | "video" | "audio" | "3d" | "text";

const TIMELINE_OUTPUT_TYPE_OPTIONS: { value: TimelineOutputType; label: string }[] = [
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "audio", label: "音频" },
  { value: "3d", label: "3D" },
  { value: "text", label: "文本" },
];

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function matchesTimelineTimeRange(item: DispatchTimelineItem, range: TimelineTimeRange): boolean {
  if (!range) return true;
  const raw = taskTime(item);
  if (!raw) return false;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  if (range === "today") return t >= startOfLocalDay(new Date()).getTime();
  if (range === "week") return t >= now - 7 * 24 * 60 * 60 * 1000;
  if (range === "month") return t >= now - 30 * 24 * 60 * 60 * 1000;
  return true;
}

function collectTimelineOutputKinds(item: DispatchTimelineItem): Set<TimelineOutputType> {
  const kinds = new Set<TimelineOutputType>();
  for (const asset of item.assets || []) {
    const raw = String(asset.kind || "").trim().toLowerCase();
    if (raw === "image" || raw === "video" || raw === "audio" || raw === "3d" || raw === "text") {
      kinds.add(raw);
    } else if (raw === "copywriting") {
      kinds.add("text");
    }
    if (isProbablyImageUrl(asset.textContent || "")) {
      kinds.add("image");
    }
  }
  return kinds;
}

function matchesTimelineOutputTypes(item: DispatchTimelineItem, selected: TimelineOutputType[]): boolean {
  if (selected.length === 0) return true;
  const kinds = collectTimelineOutputKinds(item);
  return selected.some((type) => kinds.has(type));
}

function filterSessionTimelineItems(
  items: DispatchTimelineItem[],
  timeRange: TimelineTimeRange,
  outputTypes: TimelineOutputType[]
): DispatchTimelineItem[] {
  if (!timeRange && outputTypes.length === 0) return items;
  return items.filter(
    (item) => matchesTimelineTimeRange(item, timeRange) && matchesTimelineOutputTypes(item, outputTypes)
  );
}

export default function WorkflowAppPreviewPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const sessionScope = useSessionScope();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const workflowId = params.id || "";
  const versionIdParam = searchParams.get("versionId");
  const [versionsLastTotal, setVersionsLastTotal] = useState<number | undefined>(undefined);

  const workflowDetailQuery = useQuery({
    queryKey: ["workflowDetailForPreview", sessionScope.scope.queryScopeKey, workflowId],
    queryFn: () => getWorkflow(workflowId),
    enabled: !!workflowId,
  });

  const versionsQuery = useQuery({
    queryKey: ["workflowVersionsForPreview", sessionScope.scope.queryScopeKey, workflowId],
    queryFn: () => listWorkflowVersions({ workflowId, pageNo: 1, pageSize: 200, total: versionsLastTotal }),
    enabled: !!workflowId,
  });
  useEffect(() => {
    if (!workflowId) return;
    if (typeof versionsQuery.data?.page?.total !== "number") return;
    setVersionsLastTotal(versionsQuery.data.page.total);
  }, [versionsQuery.data?.page?.total, workflowId]);

  const catesQuery = useQuery({
    queryKey: ["workflowCatesForPreview", sessionScope.scope.queryScopeKey],
    queryFn: () => listWorkflowCates(),
  });

  const cates = useMemo(() => catesQuery.data || [], [catesQuery.data]);

  const currentCateId = workflowDetailQuery.data?.workflow?.cateId;
  const activeCate = cates.find(c => c.id === currentCateId);
  const activeTopCateId = activeCate?.level === 1 || !activeCate?.parentId ? activeCate?.id : activeCate?.parentId;

  const [selectedTopCateId, setSelectedTopCateId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTopCateId && !selectedTopCateId) {
      setSelectedTopCateId(activeTopCateId);
    }
  }, [activeTopCateId, selectedTopCateId]);

  const currentTopCateId = selectedTopCateId || activeTopCateId;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const workflowsQuery = useQuery({
    queryKey: ["workflows", "list", sessionScope.scope.queryScopeKey, currentTopCateId, cates.length],
    queryFn: async () => {
      if (!currentTopCateId) return [];
      const subCates = cates.filter((c) => c.parentId === currentTopCateId);
      const ids = [currentTopCateId, ...subCates.map((c) => c.id)];
      const results = await Promise.all(
        ids.map((id) =>
          listWorkflows({ pageNo: 1, pageSize: 200, cateId: id })
        )
      );
      const map = new Map<string, WorkflowCard>();
      for (const res of results) {
        for (const item of res.items) {
          map.set(item.id, item);
        }
      }
      return Array.from(map.values());
    },
    enabled: !!currentTopCateId && cates.length > 0,
  });

  const workflows = useMemo(() => workflowsQuery.data || [], [workflowsQuery.data]);
  const sessionsTotalRef = useRef<number | undefined>(undefined);
  const sessionListQuery = useInfiniteQuery<SessionListPage, Error>({
    queryKey: ["schedulerSessions", sessionScope.scope.queryScopeKey],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => listSessions({ pageNo: Number(pageParam || 1), pageSize: 20, total: sessionsTotalRef.current }),
    getNextPageParam: (lastPage) => {
      const page = lastPage.page;
      const hasMore = page.pageNo * page.pageSize < page.total;
      return hasMore ? page.pageNo + 1 : undefined;
    },
  });
  useEffect(() => {
    const last = sessionListQuery.data?.pages?.[sessionListQuery.data.pages.length - 1];
    if (!last) return;
    sessionsTotalRef.current = last.page?.total;
  }, [sessionListQuery.data?.pages]);
  const historySessions = useMemo<SessionListItem[]>(
    () => sessionListQuery.data?.pages.flatMap((p) => p.items) || [],
    [sessionListQuery.data?.pages]
  );

  const [currentSessionId, setCurrentSessionId] = useState<string>(generateId32());
  const currentSessionName = useMemo(() => {
    const s = historySessions.find((x) => x.sessionId === currentSessionId);
    return s?.sessionName || `会话 ${currentSessionId.slice(0, 8)}`;
  }, [historySessions, currentSessionId]);
  const dispatchTenantId = sessionScope.scope.scopeLevel === "GLOBAL"
    ? "GLOBAL"
    : (sessionScope.scope.storeId ?? sessionScope.scope.merchantId ?? null);

  const topAppsData = useMemo(() => {
    return cates
      .filter(c => c.level === 1 || !c.parentId)
      .sort((a, b) => (a.sortNo || 0) - (b.sortNo || 0))
      .map(c => ({
        id: c.id,
        name: c.name,
        img: c.iconUrl || template1,
        active: c.id === currentTopCateId,
      }));
  }, [cates, currentTopCateId]);

  const currentVersionMeta = useMemo(() => {
    const items = versionsQuery.data?.items ?? [];
    if (versionIdParam) {
      return items.find((v) => v.id === versionIdParam) || null;
    }
    const currentNo = workflowDetailQuery.data?.workflow?.currentVersionNo;
    if (!currentNo) return null;
    return items.find((v) => v.versionNo === currentNo) || null;
  }, [versionsQuery.data?.items, workflowDetailQuery.data?.workflow?.currentVersionNo, versionIdParam]);

  const currentVersionDetailQuery = useQuery({
    queryKey: ["workflowVersionDetailForPreview", sessionScope.scope.queryScopeKey, currentVersionMeta?.id],
    queryFn: () => getWorkflowVersion(currentVersionMeta!.id),
    enabled: !!currentVersionMeta?.id,
  });

  useEffect(() => {
    if (!workflowDetailQuery.isError) return;
    notify.fromError(workflowDetailQuery.error, "请求失败", "加载失败");
  }, [workflowDetailQuery.error, workflowDetailQuery.isError]);

  const workflowTitle = workflowDetailQuery.data?.workflow?.title || workflowDetailQuery.data?.workflow?.code || "应用预览";
  const workflowCoverUrl = workflowDetailQuery.data?.workflow?.iconUrl || workflowDetailQuery.data?.workflow?.coverUrl || template1;
  const workflowSubtitle = workflowDetailQuery.data?.workflow?.description || workflowDetailQuery.data?.workflow?.code || null;

  const [switcherSearch, setSwitcherSearch] = useState("");
  const [appliedSwitcherSearch, setAppliedSwitcherSearch] = useState("");
  const applySwitcherSearch = () => {
    const normalized = switcherSearch.trim();
    setSwitcherSearch(normalized);
    setAppliedSwitcherSearch(normalized);
  };
  const switcherFilteredWorkflows = useMemo(() => {
    if (!appliedSwitcherSearch.trim()) return workflows;
    const q = appliedSwitcherSearch.toLowerCase();
    return workflows.filter(w =>
      (w.title && w.title.toLowerCase().includes(q)) ||
      (w.description && w.description.toLowerCase().includes(q)) ||
      (w.code && w.code.toLowerCase().includes(q))
    );
  }, [workflows, appliedSwitcherSearch]);

  const uiSchemaText = currentVersionDetailQuery.data?.uiSchema?.trim() ? currentVersionDetailQuery.data.uiSchema : "";
  const parsedUiSchema = useMemo(() => {
    if (!uiSchemaText) return { ok: false as const, message: "当前版本未配置 ui_schema" };
    return parseUiSchemaText(uiSchemaText);
  }, [uiSchemaText]);

  const uiSchema: UiSchemaV1 | null = parsedUiSchema.ok ? parsedUiSchema.value : null;
  const uiSchemaStatusMessage = "message" in parsedUiSchema ? parsedUiSchema.message : "未解析到 ui_schema";
  const uiSchemaParamIssues = useMemo(() => validateUiSchemaParamNames(uiSchema), [uiSchema]);

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [localTimelineItems, setLocalTimelineItems] = useState<DispatchTimelineItem[]>([]);
  const previewPaneRef = useRef<PreviewPaneHandle | null>(null);
  const [timelineTimeRange, setTimelineTimeRange] = useState<TimelineTimeRange>("");
  const [timelineOutputTypes, setTimelineOutputTypes] = useState<TimelineOutputType[]>([]);
  const [filterSourceItems, setFilterSourceItems] = useState<DispatchTimelineItem[] | null>(null);
  const [filterSourceLoading, setFilterSourceLoading] = useState(false);
  const [filterReloadKey, setFilterReloadKey] = useState(0);

  const timelineFilterActive = !!timelineTimeRange || timelineOutputTypes.length > 0;
  const [showDebug, setShowDebug] = useState(false);
  const debugLogEnabled = shouldEnableDebugLogs(showDebug);
  const lastDebugSnapshotRef = useRef<{ taskId: string | null; status: string; progress: number | null; eventsLen: number; streamMode: string }>({
    taskId: null,
    status: "",
    progress: null,
    eventsLen: 0,
    streamMode: "idle",
  });

  const {
    detail: dispatchDetail,
    events: dispatchEvents,
    streamMode,
    streamHint,
    refreshByHttp,
    reset: resetDispatchStream,
  } = useDispatchStream({ taskId: activeTaskId, sessionId: currentSessionId });

  const {
    items: timelineItems,
    hasMore: timelineHasMore,
    loading: timelineLoading,
    refresh: refreshTimeline,
    loadMore: loadMoreTimeline,
    reset: resetTimeline,
  } = useSessionTimeline({
    sessionId: currentSessionId,
    pageSize: 10,
    onError: (e) => {
      notify.error("会话任务加载失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const resetPreviewPaneState = useCallback(() => {
    resetDispatchStream();
    resetTimeline();
    setActiveTaskId(null);
    setLocalTimelineItems([]);
    setTimelineTimeRange("");
    setTimelineOutputTypes([]);
    setFilterSourceItems(null);
  }, [resetDispatchStream, resetTimeline]);

  const switchToSession = useCallback((sessionId: string) => {
    if (sessionId === currentSessionId) {
      refreshTimeline().catch(() => void 0);
      return;
    }
    resetPreviewPaneState();
    setCurrentSessionId(sessionId);
  }, [currentSessionId, refreshTimeline, resetPreviewPaneState]);

  const startBlankSession = useCallback(() => {
    resetPreviewPaneState();
    setCurrentSessionId(generateId32());
  }, [resetPreviewPaneState]);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState<string>("");
  const openRenameDialog = useCallback((sessionId: string, sessionName: string | null | undefined) => {
    // 避免 DropdownMenu 与 Dialog 在同一事件栈切换导致的焦点/锁状态冲突
    window.requestAnimationFrame(() => {
      setEditingSessionId(sessionId);
      setEditingSessionName(sessionName || "");
    });
  }, []);

  const renameSessionMutation = useMutation({
    mutationFn: async (vars: { sessionId: string; sessionName: string }) => {
      const nextName = vars.sessionName.trim();
      if (!nextName) throw new Error("会话名称不能为空");
      const ok = await renameSession(vars.sessionId, nextName);
      if (!ok) throw new Error("重命名失败");
      return true;
    },
    onSuccess: async (_ok, vars) => {
      setEditingSessionId(null);
      setEditingSessionName("");
      sessionListQuery.refetch().catch(() => void 0);
      notify.success("重命名成功");
    },
    onError: (e) => {
      notify.error("重命名失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const ok = await deleteSession(sessionId);
      if (!ok) throw new Error("删除失败");
      return true;
    },
    onSuccess: async (_ok, sessionId) => {
      setEditingSessionId(null);
      setEditingSessionName("");
      await sessionListQuery.refetch();
      notify.success("删除成功");
      const data = queryClient.getQueryData<InfiniteData<SessionListPage>>(["schedulerSessions", sessionScope.scope.queryScopeKey]);
      const items = data?.pages.flatMap((p) => p.items) || [];
      if (currentSessionId === sessionId) {
        const next = items.find((x) => x.sessionId !== sessionId)?.sessionId;
        if (next) {
          switchToSession(next);
        } else {
          startBlankSession();
        }
      }
    },
    onError: (e) => {
      notify.error("删除失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const sessionsHasNextPage = sessionListQuery.hasNextPage;
  const sessionsFetchingNextPage = sessionListQuery.isFetchingNextPage;
  const fetchNextSessionsPage = sessionListQuery.fetchNextPage;
  const historySessionsScrollRef = useRef<HTMLDivElement | null>(null);
  const historySessionsLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const refetchSessionsRef = useRef(sessionListQuery.refetch);
  useEffect(() => {
    refetchSessionsRef.current = sessionListQuery.refetch;
  }, [sessionListQuery.refetch]);

  const loadMoreHistorySessions = useCallback(() => {
    if (!sessionsHasNextPage || sessionsFetchingNextPage) return;
    fetchNextSessionsPage().catch(() => void 0);
  }, [fetchNextSessionsPage, sessionsFetchingNextPage, sessionsHasNextPage]);

  const onHistorySessionsWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      const el = historySessionsScrollRef.current;
      if (!el) return;

      // 向下滚且已到底（或内容未溢出）时，用滚轮驱动翻页
      if (e.deltaY <= 0) return;
      const remain = el.scrollHeight - el.scrollTop - el.clientHeight;
      const cannotScrollFurther = remain <= 2 || el.scrollHeight <= el.clientHeight + 2;
      if (!cannotScrollFurther) return;
      if (!sessionsHasNextPage || sessionsFetchingNextPage) return;

      loadMoreHistorySessions();
    },
    [loadMoreHistorySessions, sessionsFetchingNextPage, sessionsHasNextPage],
  );

  useEffect(() => {
    const root = historySessionsScrollRef.current;
    const target = historySessionsLoadMoreRef.current;
    if (!root || !target || !sessionsHasNextPage) return;

    const tryLoadIfNearBottom = () => {
      if (!sessionsHasNextPage || sessionsFetchingNextPage) return;
      const remain = root.scrollHeight - root.scrollTop - root.clientHeight;
      if (remain <= 160 || root.scrollHeight <= root.clientHeight + 2) {
        loadMoreHistorySessions();
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreHistorySessions();
        }
      },
      {
        root,
        rootMargin: "160px 0px",
        threshold: 0,
      },
    );
    observer.observe(target);
    tryLoadIfNearBottom();
    return () => observer.disconnect();
  }, [loadMoreHistorySessions, sessionsFetchingNextPage, sessionsHasNextPage, historySessions.length, sidebarCollapsed]);

  const isTemplateApp = parseExecutionConfig(currentVersionDetailQuery.data?.configJson).executionBackend === "template";
  const selectedModel = useSelectedRuntimeModel(uiSchema, values);
  const expectedImageCount = canonicalImageCount(selectedModel.canonicalValues);
  const workflowAmountFen = useMemo(() => {
    const unitPrice = workflowDetailQuery.data?.workflow?.price || 0;
    return unitPrice * expectedImageCount;
  }, [expectedImageCount, workflowDetailQuery.data?.workflow?.price]);
  const llmAmountFen = isTemplateApp ? selectedModel.estimateFen : 0;
  const displayAmountFen = workflowAmountFen + llmAmountFen;
  const displayAmountYuan = (displayAmountFen / 100).toFixed(2);

  const runMutation = useMutation({
    mutationFn: async (vars: {
      localTaskId: string;
      sessionId: string;
      taskName: string;
      prompt: string | null;
      inputJson: string | null;
      expectedImageCount: number;
    }) => {
      if (!workflowId) {
        throw new Error("workflowId is required");
      }
      if (!currentVersionMeta?.id) {
        throw new Error("workflowVersionId is required");
      }
      if (uiSchemaParamIssues.length > 0) {
        throw new Error(formatParamValidationIssue(uiSchemaParamIssues[0]));
      }
      if (!dispatchTenantId) {
        throw new Error("当前未识别到登录租户信息，请刷新页面后重试");
      }

      const currentValues = { ...values };
      const compsToTranslate = uiSchema?.components.filter(
        (c) => c.ext?.enableAutoTranslate && typeof currentValues[runtimeValueSlot(c) || ""] === "string" && (currentValues[runtimeValueSlot(c) || ""] as string).trim() !== ""
      ) || [];

      if (compsToTranslate.length > 0) {
        notify.success("自动翻译中", { description: "正在翻译启用了自动翻译的组件..." });
        for (const c of compsToTranslate) {
          const key = runtimeValueSlot(c);
          if (!key) continue;
          const val = currentValues[key] as string;
          try {
            const translated = await translateText(val);
            currentValues[key] = translated;
          } catch (e: unknown) {
            console.error(`Auto translate failed for component ${c.id}:`, e);
            notify.error("自动翻译失败", { description: (e as Error).message || `组件 ${c.basic?.title || c.id} 翻译失败` });
            throw new Error(`自动翻译失败: ${c.basic?.title || c.id}`);
          }
        }
        setValues(currentValues);
      }

      const prepared = prepareRuntimeValuesForDispatch(uiSchema, currentValues);
      if (prepared.changed) {
        setValues(prepared.values);
      }
      const constrainedValues = applyFieldConstraintsToRuntimeValues(
        uiSchema?.components ?? [],
        prepared.values,
        selectedModel.fields,
      );
      if (constrainedValues !== prepared.values) {
        setValues(constrainedValues);
      }
      const params = buildDispatchParams(uiSchema, constrainedValues);

      // Extract prompt from TemplatePrompt and PositivePrompt
      let combinedPrompt = "";
      if (uiSchema?.components) {
        const prompts = uiSchema.components
          .filter((c) => c.type === "TemplatePrompt" || c.type === "PositivePrompt")
          .map((c) => {
            const key = runtimeValueSlot(c);
            return key ? (prepared.values[key] as string) || "" : "";
          })
          .filter(Boolean);
        combinedPrompt = prompts.join("\n").trim();
      }

      debugLog(debugLogEnabled, "dispatch.request", {
        workflowId,
        workflowVersionId: currentVersionMeta.id,
        sessionId: vars.sessionId,
        tenantId: dispatchTenantId,
        taskName: `${workflowTitle}`,
        mode: "preview",
        params,
        prompt: combinedPrompt,
      });
      const accepted = await dispatch({
        taskName: `${workflowTitle}`,
        mode: "preview",
        appId: workflowId,
        workflowVersionId: currentVersionMeta.id,
        tenantId: dispatchTenantId,
        sessionId: vars.sessionId,
        params,
        prompt: combinedPrompt,
        amount: workflowAmountFen,
        expectedImageCount,
      });
      return { kind: "dispatch" as const, taskId: accepted.taskId };
    },
    onMutate: (vars) => {
      setLocalTimelineItems((prev) => [
        ...prev.filter((item) => item.taskId !== vars.localTaskId),
        createSubmittingLocalTimelineItem({
          localTaskId: vars.localTaskId,
          sessionId: vars.sessionId,
          taskName: vars.taskName,
          prompt: vars.prompt,
          inputJson: vars.inputJson,
          workflowId,
          workflowVersionId: currentVersionMeta?.id ?? null,
          workflowCoverUrl,
          workflowTitle,
          workflowSubtitle,
        }),
      ]);
      return vars;
    },
    onSuccess: (r, vars) => {
      debugLog(debugLogEnabled, "dispatch.response.ok", {
        sessionId: vars.sessionId,
        taskId: r.taskId,
        kind: r.kind,
      });
      setActiveTaskId(r.taskId);
      setLocalTimelineItems((prev) => {
        return [
          ...prev.filter((item) => item.taskId !== vars.localTaskId && item.taskId !== r.taskId),
          createAcceptedLocalTimelineItem({
            taskId: r.taskId,
            sessionId: vars.sessionId,
            taskName: vars.taskName,
            prompt: vars.prompt,
            inputJson: vars.inputJson,
            workflowId,
            workflowVersionId: currentVersionMeta.id,
            workflowCoverUrl,
            workflowTitle,
            workflowSubtitle,
          }),
        ];
      });
      refreshTimeline().catch(() => void 0);
      sessionListQuery.refetch().catch(() => void 0);
      notify.success("已提交", { description: `任务已进入队列：${r.taskId}` });
    },
    onError: (e, vars) => {
      const notice = resolveUserErrorNotice(e, "请求失败", "提交失败");
      debugLog(debugLogEnabled, "dispatch.response.error", {
        sessionId: vars.sessionId,
        error: notice.description,
      });
      setLocalTimelineItems((prev) => markLocalTimelineItemFailed(prev, vars.localTaskId, notice.description));
      notify.fromError(e, "请求失败", "提交失败");
    },
  });

  const handleRunClick = useCallback(() => {
    if (!uiSchema || !currentVersionMeta?.id) {
      return;
    }
    const localTaskId = `local-${generateId32()}`;
    runMutation.mutate({
      localTaskId,
      sessionId: currentSessionId,
      taskName: workflowTitle,
      prompt: workflowSubtitle || null,
      inputJson: JSON.stringify({ expectedImageCount }),
      expectedImageCount,
    });
  }, [currentSessionId, currentVersionMeta?.id, expectedImageCount, runMutation, uiSchema, workflowSubtitle, workflowTitle]);

  useEffect(() => {
    const status = String(dispatchDetail?.status || "");
    const progress = typeof dispatchDetail?.progress === "number" ? dispatchDetail.progress : null;
    const eventsLen = dispatchEvents.length;
    const snapshot = {
      taskId: dispatchDetail?.taskId || activeTaskId || null,
      status,
      progress,
      eventsLen,
      streamMode,
    };
    const prev = lastDebugSnapshotRef.current;
    const changed = prev.taskId !== snapshot.taskId
      || prev.status !== snapshot.status
      || prev.progress !== snapshot.progress
      || prev.eventsLen !== snapshot.eventsLen
      || prev.streamMode !== snapshot.streamMode;
    if (!changed) return;
    lastDebugSnapshotRef.current = snapshot;
    debugLog(debugLogEnabled, "dispatch.stream.update", {
      sessionId: currentSessionId,
      ...snapshot,
      streamHint: streamHint || "",
      errorMessage: dispatchDetail?.errorMessage || "",
      eventTail: dispatchEvents.slice(-3).map((e) => ({
        eventType: e.eventType,
        createdAt: e.createdAt,
      })),
    });
  }, [
    activeTaskId,
    currentSessionId,
    debugLogEnabled,
    dispatchDetail?.errorMessage,
    dispatchDetail?.progress,
    dispatchDetail?.status,
    dispatchDetail?.taskId,
    dispatchEvents,
    streamHint,
    streamMode,
  ]);

  const timelineRefreshTaskRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeTaskId || dispatchDetail?.taskId !== activeTaskId) return;
    setLocalTimelineItems((prev) => syncDispatchDetailToLocalTimelineItems(prev, activeTaskId, dispatchDetail));
  }, [activeTaskId, dispatchDetail]);

  useEffect(() => {
    if (timelineItems.length === 0) return;
    setLocalTimelineItems((prev) => prunePersistedLocalTimelineItems(prev, timelineItems));
  }, [timelineItems]);

  const mergedTimelineItems = useMemo(() => {
    return mergeTimelineWithLocalItems(timelineItems, localTimelineItems);
  }, [localTimelineItems, timelineItems]);

  useEffect(() => {
    if (!timelineFilterActive || !currentSessionId) {
      setFilterSourceItems(null);
      setFilterSourceLoading(false);
      return;
    }
    let cancelled = false;
    setFilterSourceLoading(true);
    listAllDispatchSessionTasks(currentSessionId)
      .then((items) => {
        if (!cancelled) setFilterSourceItems(items);
      })
      .catch((e) => {
        if (cancelled) return;
        setFilterSourceItems(null);
        notify.error("筛选加载失败", { description: resolveUserErrorMessage(e, "请求失败") });
      })
      .finally(() => {
        if (!cancelled) setFilterSourceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentSessionId, filterReloadKey, timelineFilterActive]);

  const displayTimelineItems = useMemo(() => {
    const baseItems = timelineFilterActive
      ? mergeTimelineWithLocalItems(filterSourceItems ?? [], localTimelineItems)
      : mergedTimelineItems;
    return filterSessionTimelineItems(baseItems, timelineTimeRange, timelineOutputTypes);
  }, [
    filterSourceItems,
    localTimelineItems,
    mergedTimelineItems,
    timelineFilterActive,
    timelineOutputTypes,
    timelineTimeRange,
  ]);

  const resetTimelineFilters = useCallback(() => {
    setTimelineTimeRange("");
    setTimelineOutputTypes([]);
    setFilterSourceItems(null);
  }, []);

  const toggleTimelineOutputType = useCallback((type: TimelineOutputType) => {
    setTimelineOutputTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }, []);

  useEffect(() => {
    if (!activeTaskId) return;
    const timer = window.setTimeout(() => {
      refreshTimeline().catch(() => void 0);
      refetchSessionsRef.current().catch(() => void 0);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activeTaskId, refreshTimeline]);

  useEffect(() => {
    if (!activeTaskId || dispatchDetail?.taskId !== activeTaskId) return;
    const status = String(dispatchDetail?.status || "").toLowerCase();
    if (!["succeeded", "failed", "canceled"].includes(status)) return;
    const refreshKey = `${activeTaskId}:${status}`;
    if (timelineRefreshTaskRef.current === refreshKey) return;
    timelineRefreshTaskRef.current = refreshKey;
    refreshTimeline().catch(() => void 0);
    refetchSessionsRef.current().catch(() => void 0);
  }, [activeTaskId, dispatchDetail?.status, dispatchDetail?.taskId, refreshTimeline]);

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!activeTaskId) throw new Error("taskId is required");
      return cancelTask(activeTaskId);
    },
    onSuccess: async () => {
      notify.success("任务已取消");
      if (activeTaskId) {
        await refreshByHttp(activeTaskId);
      }
    },
    onError: (e) => {
      notify.error("取消失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const [deletingTimelineTaskId, setDeletingTimelineTaskId] = useState<string | null>(null);
  const [pendingDeleteTimelineTask, setPendingDeleteTimelineTask] = useState<{ sessionId: string; taskId: string } | null>(null);
  const [deleteTimelineTaskMode, setDeleteTimelineTaskMode] = useState<"taskOnly" | "taskAndWork">("taskOnly");
  const deleteTimelineTaskWorkMutation = useMutation({
    mutationFn: async (vars: { sessionId: string; taskId: string; deleteWorkMaterial: boolean }) => {
      const ok = await deleteDispatchSessionTask(vars);
      if (!ok) throw new Error("删除任务失败");
      return vars;
    },
    onMutate: (vars) => {
      setDeletingTimelineTaskId(vars.taskId);
    },
    onSuccess: async () => {
      notify.success("删除成功");
      await refreshTimeline();
      await sessionListQuery.refetch();
      setFilterReloadKey((k) => k + 1);
    },
    onError: (e) => {
      notify.error("删除失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
    onSettled: () => {
      setDeletingTimelineTaskId(null);
      setPendingDeleteTimelineTask(null);
      setDeleteTimelineTaskMode("taskOnly");
    },
  });

  const onDeleteTimelineTask = useCallback((taskId: string) => {
    setPendingDeleteTimelineTask({ sessionId: currentSessionId, taskId });
    setDeleteTimelineTaskMode("taskOnly");
  }, [currentSessionId]);

  const deleteFailedSessionTasksMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const tasks = await listAllDispatchSessionTasks(sessionId);
      const failed = tasks.filter((t) => t.status === "failed");
      const deletedTaskIds: string[] = [];
      for (const task of failed) {
        const ok = await deleteDispatchSessionTask({
          sessionId,
          taskId: task.taskId,
          deleteWorkMaterial: false,
        });
        if (ok) deletedTaskIds.push(task.taskId);
      }
      return { deleted: deletedTaskIds.length, deletedTaskIds };
    },
    onSuccess: async (result) => {
      const deletedSet = new Set(result.deletedTaskIds);
      setLocalTimelineItems((prev) => {
        for (const item of prev) {
          if (item.status === "failed") deletedSet.add(item.taskId);
        }
        return prev.filter((item) => item.status !== "failed");
      });
      for (const item of timelineItems) {
        if (item.status === "failed") deletedSet.add(item.taskId);
      }
      if (activeTaskId && deletedSet.has(activeTaskId)) {
        setActiveTaskId(null);
        resetDispatchStream();
      }
      await refreshTimeline();
      await sessionListQuery.refetch();
      setFilterReloadKey((k) => k + 1);
      notify.success("已删除失败任务", { description: result.deleted > 0 ? `共删除 ${result.deleted} 个失败任务` : "当前工作区没有失败任务" });
    },
    onError: (e) => {
      notify.error("删除失败任务失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const clearWorkspaceView = useCallback(() => {
    previewPaneRef.current?.clearViewport();
  }, []);

  const [refreshingSessionTasks, setRefreshingSessionTasks] = useState(false);
  const onRefreshSessionTasks = useCallback(async () => {
    if (refreshingSessionTasks) return;
    setRefreshingSessionTasks(true);
    try {
      await refreshTimeline();
      if (activeTaskId) {
        await refreshByHttp(activeTaskId);
      }
      setFilterReloadKey((k) => k + 1);
    } catch (e) {
      notify.error("刷新失败", { description: resolveUserErrorMessage(e, "请求失败") });
    } finally {
      setRefreshingSessionTasks(false);
    }
  }, [activeTaskId, refreshByHttp, refreshTimeline, refreshingSessionTasks]);

  const sessionTaskManageBusy =
    deleteFailedSessionTasksMutation.isPending ||
    refreshingSessionTasks;

  const loading = workflowDetailQuery.isLoading || versionsQuery.isLoading || (currentVersionMeta?.id ? currentVersionDetailQuery.isLoading : false);

  if (loading) return <div className="text-sm text-muted-foreground p-10">加载中...</div>;

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex flex-col">
      {/* Top app switcher bar */}
      <div className="h-14 border-b border-border bg-card/40 backdrop-blur flex items-center px-4 pl-8 gap-2 overflow-x-auto">
        {topAppsData.map((app) => (
          <button
            key={app.id}
            onClick={() => setSelectedTopCateId(app.id)}
            className={`flex items-center gap-2 px-3 h-9 rounded-full text-[13px] whitespace-nowrap transition-colors ${
              app.active
                ? "bg-gradient-to-r from-cyan-400 to-emerald-400 text-white shadow-sm"
                : "bg-muted/50 text-foreground hover:bg-muted"
            }`}
          >
            <img src={app.img} alt={app.name} className="w-5 h-5 rounded-full object-cover" />
            {app.name}
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0 min-w-0 p-3">
        {/* Left sidebar：展开为完整面板；收起为图标轨 */}
        <aside
          className={`h-full min-h-0 shrink-0 overflow-hidden border-r border-border bg-card/30 flex flex-col transition-[width] duration-300 ease-in-out ${
            sidebarCollapsed ? "w-[52px]" : "w-[230px]"
          }`}
        >
          {sidebarCollapsed ? (
            <div className="flex flex-1 min-h-0 flex-col items-center gap-1 py-2 px-1">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                title="展开侧栏"
                aria-label="展开侧栏"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
              <div className="w-6 h-px bg-border my-1" />
              <button
                type="button"
                onClick={startBlankSession}
                title="新建会话"
                aria-label="新建会话"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-muted/70 text-foreground hover:bg-muted transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                title="历史会话"
                aria-label="历史会话"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <div className="mt-auto pb-2">
                <img
                  src={workflowCoverUrl}
                  alt=""
                  className="h-8 w-8 rounded-md object-cover border border-border"
                  title={workflowTitle}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="h-12 border-b border-border flex items-center justify-between px-3 shrink-0">
                <div className="flex items-center gap-2 text-[14px] font-medium min-w-0">
                  <MessageSquare className="w-4 h-4 text-foreground shrink-0" />
                  <span className="truncate">历史会话</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={startBlankSession}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="新建会话"
                    aria-label="新建会话"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(true)}
                    title="收起侧栏"
                    aria-label="收起侧栏"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 flex flex-col">
                <div
                  ref={historySessionsScrollRef}
                  onWheel={onHistorySessionsWheel}
                  className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-0.5 px-2 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  {historySessions.map((session) => (
                    <div
                      key={session.sessionId}
                      className={`group w-full flex items-center gap-2 px-2 min-h-9 rounded-md text-[13px] text-left transition-colors ${
                        currentSessionId === session.sessionId
                          ? "bg-muted text-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted/60"
                      }`}
                      title={session.sessionName || session.sessionId}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          switchToSession(session.sessionId);
                        }}
                        className="flex items-center gap-2 min-w-0 flex-1 min-h-9 text-left"
                      >
                        <MessageSquare className="w-4 h-4 shrink-0 opacity-80" />
                        <span className="truncate flex-1">
                          {session.sessionName || `会话 ${session.sessionId.slice(0, 8)}`}
                        </span>
                      </button>

                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem
                              onSelect={() => {
                                openRenameDialog(session.sessionId, session.sessionName);
                              }}
                              className="gap-2 text-[13px] cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>重命名</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                const ok = window.confirm("确认删除该会话？删除后不可恢复。");
                                if (!ok) return;
                                deleteSessionMutation.mutate(session.sessionId);
                              }}
                              disabled={deleteSessionMutation.isPending}
                              className="gap-2 text-[13px] text-destructive focus:text-destructive cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>删除</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}

                  {sessionListQuery.isLoading && (
                    <div className="px-2 py-3 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground/70">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      会话加载中...
                    </div>
                  )}
                  {!sessionListQuery.isLoading && historySessions.length === 0 && (
                    <div className="px-2 py-3 text-center text-[12px] text-muted-foreground/50">暂无历史会话</div>
                  )}
                  {!sessionListQuery.isLoading && sessionsHasNextPage && historySessions.length > 0 && (
                    <div ref={historySessionsLoadMoreRef} className="pt-2 pb-2 mr-4">
                      <div className="rounded-md border border-dashed border-border/70 bg-card/90 px-3 py-2 text-center text-[12px] text-muted-foreground">
                        <span className="inline-flex items-center justify-center gap-1">
                          {sessionsFetchingNextPage ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ChevronsDown className="w-4 h-4 animate-bounce" />
                          )}
                          <span>{sessionsFetchingNextPage ? "加载更多会话..." : "继续向下滚动加载更多"}</span>
                        </span>
                      </div>
                    </div>
                  )}
                  {sessionsFetchingNextPage && historySessions.length === 0 && (
                    <div className="px-2 py-2 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground/70">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      加载更多会话...
                    </div>
                  )}
                  {!sessionListQuery.isLoading && !sessionsFetchingNextPage && !sessionsHasNextPage && historySessions.length > 0 && (
                    <div className="px-2 py-2 text-center text-[11px] text-muted-foreground/45">已加载全部会话</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <Dialog open={!!editingSessionId} onOpenChange={(open) => {
            if (!open) {
              setEditingSessionId(null);
              setEditingSessionName("");
            }
          }}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>重命名会话</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Input
                  value={editingSessionName}
                  onChange={(e) => setEditingSessionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editingSessionId && !renameSessionMutation.isPending) {
                      e.preventDefault();
                      renameSessionMutation.mutate({ sessionId: editingSessionId, sessionName: editingSessionName });
                    }
                  }}
                  placeholder="请输入会话名称"
                  disabled={renameSessionMutation.isPending}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={renameSessionMutation.isPending} onClick={() => {
                  setEditingSessionId(null);
                  setEditingSessionName("");
                }}>取消</Button>
                <Button type="button" onClick={() => {
                  if (editingSessionId && !renameSessionMutation.isPending) {
                    renameSessionMutation.mutate({ sessionId: editingSessionId, sessionName: editingSessionName });
                  }
                }} disabled={renameSessionMutation.isPending}>
                  {renameSessionMutation.isPending ? "保存中..." : "确认"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </aside>

        {/* Center config panel */}
        <section className="w-[400px] min-h-0 border-r border-border bg-background flex flex-col px-4">
          <div className="h-12 border-b border-border flex items-center justify-between px-4">
            <div className="flex items-center gap-2 text-[14px] font-medium min-w-0">
              <LayoutGrid className="w-4 h-4 text-foreground shrink-0" />
              <span className="truncate" title={workflowTitle}>{workflowTitle}</span>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground shrink-0 ml-2">
                  <RefreshCw className="w-3.5 h-3.5" />
                  应用切换
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[280px] p-0" sideOffset={8}>
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索应用名称/描述/标签，回车搜索"
                      value={switcherSearch}
                      onChange={(e) => setSwitcherSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applySwitcherSearch();
                        }
                      }}
                      className="h-8 w-full bg-transparent pl-8 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 border-none shadow-none"
                    />
                  </div>
                </div>
                <ScrollArea className="h-[300px]">
                  <div className="p-1">
                    {switcherFilteredWorkflows.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">未找到应用</div>
                    ) : (
                      switcherFilteredWorkflows.slice(0, 20).map((w) => (
                        <button
                          key={w.id}
                          onClick={() => navigate(`/app-preview/${w.id}`)}
                          className={`w-full flex items-center gap-3 rounded-sm px-2 py-1.5 text-left text-sm transition-colors ${
                            w.id === workflowId ? "bg-muted" : "hover:bg-muted/50"
                          }`}
                        >
                          <img src={w.coverUrl || w.iconUrl || template1} alt={w.title || w.code} className="h-6 w-6 rounded object-cover shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="block truncate font-normal">{w.title || w.code}</span>
                            {/*{w.description && <span className="truncate text-xs text-muted-foreground">{w.description}</span>}*/}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {!uiSchema && (
              <div className="text-sm text-muted-foreground">
                {uiSchemaStatusMessage}
              </div>
            )}
            {uiSchema && (
              <RuntimeForm
                schema={uiSchema}
                values={values}
                onValuesChange={setValues}
                fields={selectedModel.fields}
                modelCode={selectedModel.modelCode}
                fieldsReady={selectedModel.isReady}
              />
            )}
          </div>

          {/* Generate button */}
          <div className="p-4 border-t border-border">
            <button onClick={handleRunClick} disabled={!uiSchema || !currentVersionMeta?.id} className="w-full h-11 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium text-[14px] inline-flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50 shadow-sm">
              <Sparkles className="w-4 h-4" />
              生成（预估金额：{displayAmountYuan} 元）
            </button>
          </div>
        </section>

        {/* Right preview panel */}
        <section className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col bg-muted/10">
          <div className="h-12 flex items-center justify-end px-4 gap-1">
              <button
                onClick={() => setShowDebug(!showDebug)}
                className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-[13px] transition-colors ${
                  showDebug
                    ? "bg-primary/10 text-primary hover:bg-primary/20 font-medium"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <TerminalSquare className="w-3.5 h-3.5" />
                {/* {showDebug ? "" : ""} */}
              </button>

              {/* Task Management Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                    <Layers className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-40 p-1.5 space-y-0.5">
                  <button
                    type="button"
                    disabled={sessionTaskManageBusy}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-[13px] rounded-md bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    onClick={() => {
                      const ok = window.confirm("确认删除当前工作区下所有失败任务？仅删除任务信息，不删除作品素材。");
                      if (!ok) return;
                      deleteFailedSessionTasksMutation.mutate(currentSessionId);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleteFailedSessionTasksMutation.isPending ? "删除中..." : "删除失败任务"}
                  </button>
                  <button
                    type="button"
                    disabled={sessionTaskManageBusy}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-[13px] rounded-md bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    onClick={clearWorkspaceView}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    清空工作区
                  </button>
                  <button
                    type="button"
                    disabled={sessionTaskManageBusy}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-[13px] rounded-md bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    onClick={() => {
                      onRefreshSessionTasks().catch(() => void 0);
                    }}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingSessionTasks ? "animate-spin" : ""}`} />
                    {refreshingSessionTasks ? "刷新中..." : "刷新任务状态"}
                  </button>
                </PopoverContent>
              </Popover>

              {/* Filter Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                      timelineFilterActive
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                    }`}
                    title="筛选当前工作区任务"
                  >
                    <Filter className="w-4 h-4" />
                    {timelineFilterActive && (
                      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[240px] p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-medium text-[15px]">筛选</div>
                    <button
                      type="button"
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                      title="重置筛选"
                      disabled={!timelineFilterActive}
                      onClick={resetTimelineFilters}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <select
                        value={timelineTimeRange}
                        onChange={(e) => setTimelineTimeRange((e.target.value || "") as TimelineTimeRange)}
                        className="w-full h-9 pl-9 pr-8 rounded-md border border-transparent bg-muted/40 text-[13px] text-foreground appearance-none outline-none focus:border-border hover:bg-muted/60 transition-colors"
                      >
                        <option value="">选择时间</option>
                        <option value="today">今天</option>
                        <option value="week">最近7天</option>
                        <option value="month">最近30天</option>
                      </select>
                      <ChevronLeft className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none -rotate-90" />
                    </div>

                    <div>
                      <div className="text-[12px] text-muted-foreground mb-2.5">生成类型</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {TIMELINE_OUTPUT_TYPE_OPTIONS.map((type) => {
                          const active = timelineOutputTypes.includes(type.value);
                          return (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => toggleTimelineOutputType(type.value)}
                              className={`h-8 rounded-md text-[12px] transition-colors ${
                                active
                                  ? "bg-primary/15 text-primary font-medium"
                                  : "bg-muted/40 text-foreground/80 hover:bg-muted hover:text-foreground"
                              }`}
                            >
                              {type.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {timelineFilterActive && (
                      <div className="text-[12px] text-muted-foreground/80 leading-[1.6]">
                        {filterSourceLoading
                          ? "正在加载当前工作区任务…"
                          : `已匹配 ${displayTimelineItems.length} 条任务`}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
          </div>

          <PreviewPane
            ref={previewPaneRef}
            workflowTitle={workflowTitle}
            workflowCoverUrl={workflowCoverUrl}
            workflowSubtitle={workflowSubtitle}
            sessionName={currentSessionName}
            sessionId={currentSessionId}
            activeTaskId={activeTaskId}
            timelineItems={displayTimelineItems}
            timelineHasMore={timelineFilterActive ? false : timelineHasMore}
            timelineLoading={timelineLoading || (timelineFilterActive && filterSourceLoading)}
            onLoadMoreTimeline={() => {
              if (timelineFilterActive) return;
              if (timelineHasMore && !timelineLoading) {
                loadMoreTimeline().catch(() => void 0);
              }
            }}
            onDeleteTimelineTask={onDeleteTimelineTask}
            deletingTimelineTaskId={deletingTimelineTaskId}
            detail={dispatchDetail}
            events={dispatchEvents}
            streamMode={streamMode}
            streamHint={streamHint}
            cancelPending={cancelMutation.isPending}
            onCancel={() => cancelMutation.mutate()}
            showDebug={showDebug}
            generateTimeSec={workflowDetailQuery.data?.workflow?.generateTimeSec}
          />

          <Dialog open={!!pendingDeleteTimelineTask} onOpenChange={(open) => {
            if (!open) {
              setPendingDeleteTimelineTask(null);
              setDeleteTimelineTaskMode("taskOnly");
            }
          }}>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>删除会话任务</DialogTitle>
              </DialogHeader>
              <div className="py-2 space-y-3">
                <div className="text-sm text-muted-foreground">请选择删除范围：</div>
                <RadioGroup
                  value={deleteTimelineTaskMode}
                  onValueChange={(v) => setDeleteTimelineTaskMode(v === "taskAndWork" ? "taskAndWork" : "taskOnly")}
                  className="space-y-3"
                >
                  <label className="flex items-start gap-2 rounded-md border border-border p-3 cursor-pointer">
                    <RadioGroupItem value="taskOnly" className="mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium text-foreground">仅删除任务</div>
                      <div className="text-muted-foreground mt-1">仅删除任务信息，不删除作品素材。</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 rounded-md border border-border p-3 cursor-pointer">
                    <RadioGroupItem value="taskAndWork" className="mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium text-foreground">删除任务与作品</div>
                      <div className="text-muted-foreground mt-1">关联删除生成的作品信息。</div>
                    </div>
                  </label>
                </RadioGroup>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleteTimelineTaskWorkMutation.isPending}
                  onClick={() => {
                    setPendingDeleteTimelineTask(null);
                    setDeleteTimelineTaskMode("taskOnly");
                  }}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  disabled={deleteTimelineTaskWorkMutation.isPending || !pendingDeleteTimelineTask}
                  onClick={() => {
                    if (!pendingDeleteTimelineTask) return;
                    deleteTimelineTaskWorkMutation.mutate({
                      sessionId: pendingDeleteTimelineTask.sessionId,
                      taskId: pendingDeleteTimelineTask.taskId,
                      deleteWorkMaterial: deleteTimelineTaskMode === "taskAndWork",
                    });
                  }}
                >
                  {deleteTimelineTaskWorkMutation.isPending ? "删除中..." : "确认删除"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      </div>
    </div>
  );
}
