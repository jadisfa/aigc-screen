import { useQuery } from "@tanstack/react-query";
import { Copy, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getModelHubTrace, listModelHubCallLogs } from "@/shared/api/model-hub/model-hub";
import { resolveModelHubErrorMessage } from "@/modules/modelhub/services/modelhubAdminUi";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  StatusBadge,
  TableSurface,
  statusToneFromCode,
  type StatusBadgeTone,
} from "@/shared/components/page";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { formatDateTime } from "@/shared/lib/datetime";
import { formatCurrency, formatJson, formatLatency, formatNumber } from "@/shared/lib/format";
import { CONSOLE_ROUTES } from "@/shared/lib/permissions";
import { ROUTE_ENTRY_LABEL, ROUTE_ENTRY_ORDER } from "@/shared/lib/route-entry-dicts";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { notify } from "@/shared/lib/notify";

const SCENE_ALL = "all";

const CALL_LOG_STATUS_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "success", label: "成功" },
  { value: "failed", label: "失败" },
  { value: "pending", label: "处理中" },
  { value: "provider_error", label: "供应商异常" },
  { value: "budget_rejected", label: "预算拒绝" },
];

const ROUTE_OUTCOME_LABEL: Record<string, string> = {
  PRIMARY_POOL: "主池命中",
  FALLBACK_POOL: "回落默认池",
  DIRECT: "直连模型",
  NO_ROUTE: "无可用路由",
  BLOCKED_BY_GUARDRAIL: "安全拦截",
};

function toIsoOrUndefined(localValue: string) {
  const trimmed = localValue.trim();
  if (!trimmed) {
    return undefined;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

function toDatetimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultLogsStartedFromLocal() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  date.setHours(0, 0, 0, 0);
  return toDatetimeLocalValue(date);
}

function shortenId(value: string | null | undefined, head = 8, tail = 6) {
  if (!value || value === "-") {
    return "-";
  }
  if (value.length <= head + tail + 1) {
    return value;
  }
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function formatScene(scene: string | null | undefined) {
  if (!scene) {
    return "-";
  }
  return ROUTE_ENTRY_LABEL[scene as keyof typeof ROUTE_ENTRY_LABEL] || scene;
}

function formatRouteOutcome(outcome: string | null | undefined) {
  if (!outcome) {
    return "-";
  }
  return ROUTE_OUTCOME_LABEL[outcome] || outcome;
}

function shortenPath(path: string | null | undefined, max = 42) {
  if (!path) {
    return "-";
  }
  if (path.length <= max) {
    return path;
  }
  return `…${path.slice(-(max - 1))}`;
}

function formatCallerContext(item: {
  accessType?: string | null;
  apiKeyId?: string | null;
  apiKeyName?: string | null;
  apiKeyPrefix?: string | null;
  merchantName?: string | null;
  merchantId?: string | null;
  storeName?: string | null;
  storeId?: string | null;
}) {
  const isApiKey = (item.accessType || "").toUpperCase() === "API_KEY" || Boolean(item.apiKeyId);
  const keyLabel = item.apiKeyName || item.apiKeyPrefix || shortenId(item.apiKeyId);
  const merchant = item.merchantName?.trim() || shortenId(item.merchantId);
  if (isApiKey) {
    return {
      primary: `Key · ${keyLabel || "-"}`,
      secondary: item.merchantId ? `商户 ${merchant}` : "平台/未绑定商户",
    };
  }
  return {
    primary: "Session",
    secondary: item.merchantId ? `商户 ${merchant}` : "无商户上下文",
  };
}

function truncateText(value: string | null | undefined, max = 64) {
  if (!value) {
    return null;
  }
  const text = value.trim();
  if (!text) {
    return null;
  }
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function sectionTitle(title: string) {
  return <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>;
}

async function copyText(value: string | null | undefined, label: string) {
  if (!value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    notify.success("已复制", { description: label });
  } catch {
    notify.error("复制失败", { description: label });
  }
}

function renderKeyValue(label: string, value: string | number | boolean | null | undefined) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground break-all">{value === null || value === undefined || value === "" ? "-" : String(value)}</div>
    </div>
  );
}

function renderSpanPayload(raw: string | null | undefined) {
  if (!raw) {
    return <div className="text-sm text-muted-foreground">-</div>;
  }
  return (
    <pre className="overflow-x-auto rounded-md bg-muted/30 p-3 text-xs text-foreground whitespace-pre-wrap break-all">
      {formatJson(raw)}
    </pre>
  );
}

function getStatusLabel(status: string) {
  if (status === "succeeded" || status === "success") {
    return "成功";
  }
  if (status === "failed") {
    return "失败";
  }
  if (status === "blocked") {
    return "被拦截";
  }
  if (status === "running" || status === "pending") {
    return "处理中";
  }
  if (status === "provider_error") {
    return "供应商异常";
  }
  if (status === "budget_rejected") {
    return "预算拒绝";
  }
  return status || "未知";
}

function callLogStatusTone(status: string): StatusBadgeTone {
  if (status === "succeeded" || status === "success") {
    return "success";
  }
  if (status === "failed" || status === "provider_error" || status === "budget_rejected" || status === "blocked") {
    return "danger";
  }
  if (status === "running" || status === "pending") {
    return "warning";
  }
  return statusToneFromCode(status);
}

function routeOutcomeTone(outcome: string | null | undefined): StatusBadgeTone {
  if (outcome === "BLOCKED_BY_GUARDRAIL" || outcome === "NO_ROUTE") {
    return "danger";
  }
  if (outcome === "PRIMARY_POOL" || outcome === "DIRECT") {
    return "success";
  }
  return "neutral";
}

export default function ModelHubLogsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, changePageSize, rememberTotal } =
    usePagedListQuery();
  const initialTraceId = searchParams.get("traceId")?.trim() || null;
  const initialRequestId = searchParams.get("requestId")?.trim() || "";
  const [keywordInput, setKeywordInput] = useState(initialRequestId || initialTraceId || "");
  const [keyword, setKeyword] = useState(initialRequestId || initialTraceId || "");
  const [status, setStatus] = useState("all");
  const [sceneCode, setSceneCode] = useState(SCENE_ALL);
  const [startedFromInput, setStartedFromInput] = useState(defaultLogsStartedFromLocal);
  const [startedToInput, setStartedToInput] = useState("");
  const [startedFrom, setStartedFrom] = useState<string | undefined>(() => toIsoOrUndefined(defaultLogsStartedFromLocal()));
  const [startedTo, setStartedTo] = useState<string | undefined>(undefined);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(initialTraceId);

  const logsQuery = useQuery({
    queryKey: ["modelhub", "call-logs", pageNo, pageSize, status, sceneCode, keyword, startedFrom, startedTo],
    queryFn: () =>
      listModelHubCallLogs({
        pageNo,
        pageSize,
        total: getTotalParam(),
        keyword: keyword.trim() || undefined,
        status: status === "all" ? undefined : status,
        sceneCode: sceneCode === SCENE_ALL ? undefined : sceneCode,
        startedFrom,
        startedTo,
      }),
  });

  const traceQuery = useQuery({
    queryKey: ["modelhub", "trace-detail", activeTraceId],
    queryFn: () => getModelHubTrace(activeTraceId ?? ""),
    enabled: Boolean(activeTraceId),
  });

  useEffect(() => {
    rememberTotal(logsQuery.data?.page.total);
  }, [logsQuery.data?.page.total, rememberTotal]);

  useEffect(() => {
    const nextTraceId = searchParams.get("traceId")?.trim() || null;
    const nextRequestId = searchParams.get("requestId")?.trim() || "";
    if (nextTraceId) {
      setActiveTraceId(nextTraceId);
    }
    if (nextRequestId || nextTraceId) {
      const nextKeyword = nextRequestId || nextTraceId || "";
      setKeywordInput(nextKeyword);
      setKeyword(nextKeyword);
      resetPage();
    }
  }, [resetPage, searchParams]);

  useEffect(() => {
    if (activeTraceId || !initialRequestId || !logsQuery.data?.items?.length) {
      return;
    }
    const matched = logsQuery.data.items.find((item) => item.requestId === initialRequestId);
    if (matched?.traceId) {
      setActiveTraceId(matched.traceId);
    }
  }, [activeTraceId, initialRequestId, logsQuery.data?.items]);

  const closeTraceDetail = () => {
    setActiveTraceId(null);
    if (!searchParams.has("traceId") && !searchParams.has("requestId")) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("traceId");
    next.delete("requestId");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!logsQuery.error) {
      return;
    }
    notify.error("加载失败", { description: resolveModelHubErrorMessage(logsQuery.error, "调用日志加载失败") });
  }, [logsQuery.error]);

  useEffect(() => {
    if (!traceQuery.error) {
      return;
    }
    notify.error("详情加载失败", { description: resolveModelHubErrorMessage(traceQuery.error, "调用日志详情加载失败") });
  }, [traceQuery.error]);

  const items = logsQuery.data?.items ?? [];
  const total = logsQuery.data?.page.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  const applyFilters = () => {
    setKeyword(keywordInput.trim());
    setStartedFrom(toIsoOrUndefined(startedFromInput));
    setStartedTo(toIsoOrUndefined(startedToInput));
    resetPage();
  };

  const openConsumption = (requestId: string | null | undefined, traceId: string | null | undefined) => {
    const params = new URLSearchParams();
    if (requestId) {
      params.set("requestId", requestId);
    } else if (traceId) {
      params.set("traceId", traceId);
    }
    const qs = params.toString();
    navigate(qs ? `${CONSOLE_ROUTES.modelHubConsumptionRecords}?${qs}` : CONSOLE_ROUTES.modelHubConsumptionRecords);
  };

  return (
    <PageShell>
      <PageHeader
        title="调用日志"
        actions={
          <Button
            variant="pageOutline"
            onClick={() => {
              void logsQuery.refetch();
            }}
            disabled={logsQuery.isFetching}
          >
            <RefreshCw className="w-4 h-4" />
            {logsQuery.isFetching ? "刷新中..." : "刷新"}
          </Button>
        }
      />

      <PageFilterBar>
          <div className="flex items-center gap-2">
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                resetPage();
              }}
            >
              <SelectTrigger className="subpage-native-select w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                {CALL_LOG_STATUS_OPTIONS.map((item) => (
                  <SelectItem className="subpage-select-item" value={item.value} key={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={sceneCode}
              onValueChange={(value) => {
                setSceneCode(value);
                resetPage();
              }}
            >
              <SelectTrigger className="subpage-native-select w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                <SelectItem className="subpage-select-item" value={SCENE_ALL}>
                  全部场景
                </SelectItem>
                {ROUTE_ENTRY_ORDER.map((code) => (
                  <SelectItem className="subpage-select-item" value={code} key={code}>
                    {ROUTE_ENTRY_LABEL[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={startedFromInput}
              onChange={(event) => setStartedFromInput(event.target.value)}
              className="h-9 w-[190px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={startedToInput}
              onChange={(event) => setStartedToInput(event.target.value)}
              className="h-9 w-[190px]"
            />
          </div>
          <SearchField
            wrapClassName="!max-w-[360px] shrink-0"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyFilters();
              }
            }}
            placeholder="Request / Trace / 路径 / 错误信息"
          />
          <Button variant="pageOutline" onClick={applyFilters} disabled={logsQuery.isFetching}>
            搜索
          </Button>
      </PageFilterBar>

      <TableSurface>
        <Table className="min-w-[1080px] text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">时间</TableHead>
              <TableHead className="min-w-[180px]">结果</TableHead>
              <TableHead className="min-w-[200px]">Request / Trace</TableHead>
              <TableHead className="min-w-[160px]">请求</TableHead>
              <TableHead className="min-w-[140px]">渠道</TableHead>
              <TableHead className="whitespace-nowrap">耗时</TableHead>
              <TableHead className="min-w-[120px]">上下文</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length > 0 ? (
              items.map((item) => {
                const failureHint = truncateText(item.failureMessage, 72);
                const isFailure =
                  item.status === "failed" ||
                  item.status === "provider_error" ||
                  item.status === "budget_rejected" ||
                  item.status === "blocked";
                const context = formatCallerContext(item);
                return (
                  <TableRow key={item.traceId} className="cursor-pointer" onClick={() => setActiveTraceId(item.traceId)}>
                    <TableCell className="whitespace-nowrap align-top">{formatDateTime(item.startedAt)}</TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge tone={callLogStatusTone(item.status)}>{getStatusLabel(item.status)}</StatusBadge>
                        {item.routeOutcome ? (
                          <StatusBadge tone={routeOutcomeTone(item.routeOutcome)}>
                            {formatRouteOutcome(item.routeOutcome)}
                          </StatusBadge>
                        ) : null}
                        {item.stream ? (
                          <StatusBadge tone="neutral">stream</StatusBadge>
                        ) : null}
                      </div>
                      {isFailure && failureHint ? (
                        <div
                          className="mt-1.5 max-w-[260px] text-[12px] leading-snug text-destructive"
                          title={item.failureMessage || undefined}
                        >
                          {item.failureCode ? <span className="font-mono text-[11px]">{item.failureCode} · </span> : null}
                          {failureHint}
                        </div>
                      ) : (
                        <div className="mt-1.5 text-[12px] text-muted-foreground">{formatScene(item.sceneCode)}</div>
                      )}
                    </TableCell>
                    <TableCell className="align-top font-mono text-[11px]">
                      <div className="flex items-center gap-1" title={item.requestId || undefined}>
                        <span className="text-muted-foreground">req</span>
                        <span>{shortenId(item.requestId)}</span>
                        {item.requestId ? (
                          <button
                            type="button"
                            className="rounded p-0.5 hover:bg-muted"
                            onClick={(event) => {
                              event.stopPropagation();
                              void copyText(item.requestId, "Request ID");
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-muted-foreground" title={item.traceId}>
                        <span>trc</span>
                        <span>{shortenId(item.traceId)}</span>
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-muted"
                          onClick={(event) => {
                            event.stopPropagation();
                            void copyText(item.traceId, "Trace ID");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="font-mono text-[12px]" title={item.requestPath || undefined}>
                        {shortenPath(item.requestPath)}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{formatScene(item.sceneCode)}</div>
                    </TableCell>
                    <TableCell className="align-top min-w-[140px]">
                      <div className="truncate" title={item.providerCode || undefined}>
                        {item.providerCode || "-"}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={item.providerModelCode || undefined}>
                        {item.providerModelCode || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap align-top font-mono text-[12px]">
                      {formatLatency(item.startedAt, item.finishedAt)}
                    </TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground">
                      <div className="truncate text-foreground" title={context.primary}>
                        {context.primary}
                      </div>
                      <div className="mt-0.5 truncate" title={context.secondary}>
                        {context.secondary}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {logsQuery.isLoading ? "加载中..." : "暂无调用日志"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableSurface>

      <CommonPaginationBar
        total={total}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={pageNo < totalPages}
        onPageNoChange={setPageNo}
        onPageSizeChange={changePageSize}
        disabled={logsQuery.isFetching}
      />

      <Sheet open={Boolean(activeTraceId)} onOpenChange={(open) => !open && closeTraceDetail()}>
        <SheetContent side="right" className="w-[92vw] sm:max-w-3xl p-0">
          <div className="flex h-full min-h-0 flex-col">
            <SheetHeader className="border-b px-6 py-4">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div>
                  <SheetTitle>调用日志详情</SheetTitle>
                  <SheetDescription>
                    {traceQuery.data?.callLog.requestId || "-"} / {activeTraceId || "-"}
                  </SheetDescription>
                </div>
                {traceQuery.data?.callLog ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0"
                    onClick={() =>
                      openConsumption(traceQuery.data?.callLog.requestId, traceQuery.data?.callLog.traceId)
                    }
                  >
                    查看消费记录
                  </Button>
                ) : null}
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 px-6 py-4">
              <Tabs defaultValue="overview" className="flex h-full min-h-0 flex-col">
                <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0">
                  <TabsTrigger value="overview" className="rounded-b-none">概览</TabsTrigger>
                  <TabsTrigger value="route" className="rounded-b-none">路由解释</TabsTrigger>
                  <TabsTrigger value="spans" className="rounded-b-none">Trace Span</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-0 min-h-0 flex-1">
                  <ScrollArea className="h-[calc(100vh-180px)] pr-4">
                    {traceQuery.isLoading || !traceQuery.data ? (
                      <div className="py-6 text-sm text-muted-foreground">加载中...</div>
                    ) : (
                      <div className="space-y-6 py-4">
                        {(traceQuery.data.callLog.status === "failed" ||
                          traceQuery.data.callLog.status === "provider_error" ||
                          traceQuery.data.callLog.status === "budget_rejected" ||
                          traceQuery.data.callLog.status === "blocked") &&
                        (traceQuery.data.callLog.failureMessage || traceQuery.data.callLog.failureCode) ? (
                          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 space-y-1">
                            <div className="text-xs text-muted-foreground">执行失败</div>
                            <div className="text-sm text-foreground break-all">
                              {[traceQuery.data.callLog.failureCode, traceQuery.data.callLog.failureMessage]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                        ) : null}

                        <div className="space-y-3">
                          {sectionTitle("执行结果")}
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {renderKeyValue("状态", getStatusLabel(traceQuery.data.callLog.status))}
                            {renderKeyValue(
                              "耗时",
                              formatLatency(traceQuery.data.callLog.startedAt, traceQuery.data.callLog.finishedAt)
                            )}
                            {renderKeyValue("路由结果", formatRouteOutcome(traceQuery.data.callLog.routeOutcome))}
                            {renderKeyValue("流式", traceQuery.data.callLog.stream ? "是" : "否")}
                            {renderKeyValue("开始时间", formatDateTime(traceQuery.data.callLog.startedAt))}
                            {renderKeyValue("结束时间", formatDateTime(traceQuery.data.callLog.finishedAt))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {sectionTitle("请求定位")}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void copyText(traceQuery.data?.callLog.requestId, "Request ID")}
                            >
                              <Copy className="mr-1 h-3.5 w-3.5" />
                              复制 Request ID
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void copyText(traceQuery.data?.callLog.traceId, "Trace ID")}
                            >
                              <Copy className="mr-1 h-3.5 w-3.5" />
                              复制 Trace ID
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {renderKeyValue("请求ID", traceQuery.data.callLog.requestId)}
                            {renderKeyValue("Trace ID", traceQuery.data.callLog.traceId)}
                            {renderKeyValue("请求路径", traceQuery.data.callLog.requestPath)}
                            {renderKeyValue("场景", formatScene(traceQuery.data.callLog.sceneCode))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {sectionTitle("渠道与路由")}
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {renderKeyValue("供应商", traceQuery.data.callLog.providerCode)}
                            {renderKeyValue("模型", traceQuery.data.callLog.providerModelCode)}
                            {renderKeyValue("路由解释ID", traceQuery.data.callLog.routeExplainId)}
                            {renderKeyValue(
                              "入口",
                              (traceQuery.data.callLog.accessType || "").toUpperCase() === "API_KEY" ||
                                Boolean(traceQuery.data.callLog.apiKeyId)
                                ? `API Key · ${
                                    traceQuery.data.callLog.apiKeyName ||
                                    traceQuery.data.callLog.apiKeyPrefix ||
                                    shortenId(traceQuery.data.callLog.apiKeyId)
                                  }`
                                : "Session"
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {sectionTitle("关联上下文")}
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {renderKeyValue(
                              "商户",
                              traceQuery.data.callLog.merchantName || traceQuery.data.callLog.merchantId
                            )}
                            {renderKeyValue(
                              "门店",
                              traceQuery.data.callLog.storeName || traceQuery.data.callLog.storeId
                            )}
                            {renderKeyValue(
                              "用户",
                              traceQuery.data.callLog.principalName || traceQuery.data.callLog.principalId
                            )}
                            {renderKeyValue("应用ID", traceQuery.data.callLog.applicationId)}
                          </div>
                        </div>

                        <div className="space-y-3 rounded-md border border-dashed border-border/70 bg-muted/10 px-4 py-3">
                          {sectionTitle("计费摘要（详见消费页）")}
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {renderKeyValue("预估 Token", formatNumber(traceQuery.data.callLog.estimatedTotalTokens))}
                            {renderKeyValue(
                              "预估金额",
                              formatCurrency(traceQuery.data.callLog.estimatedAmount, traceQuery.data.callLog.currency)
                            )}
                            {renderKeyValue(
                              "实际金额",
                              formatCurrency(traceQuery.data.callLog.actualAmount, traceQuery.data.callLog.currency)
                            )}
                            {renderKeyValue("资金账户", traceQuery.data.callLog.fundAccountId)}
                          </div>
                        </div>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="route" className="mt-0 min-h-0 flex-1">
                  <ScrollArea className="h-[calc(100vh-180px)] pr-4">
                    {traceQuery.isLoading || !traceQuery.data ? (
                      <div className="py-6 text-sm text-muted-foreground">加载中...</div>
                    ) : !traceQuery.data.routeExplain ? (
                      <div className="py-6 text-sm text-muted-foreground">暂无路由解释</div>
                    ) : (
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          {renderKeyValue("解释ID", traceQuery.data.routeExplain.id)}
                          {renderKeyValue("场景", formatScene(traceQuery.data.routeExplain.sceneCode))}
                          {renderKeyValue("结果", formatRouteOutcome(traceQuery.data.routeExplain.outcome) === "-"
                            ? traceQuery.data.routeExplain.outcome
                            : formatRouteOutcome(traceQuery.data.routeExplain.outcome))}
                          {renderKeyValue("路由规则ID", traceQuery.data.routeExplain.routeRuleId)}
                          {renderKeyValue("路由编码", traceQuery.data.routeExplain.routeCode)}
                          {renderKeyValue("创建时间", formatDateTime(traceQuery.data.routeExplain.createdAt))}
                        </div>
                        {renderKeyValue("解释摘要", traceQuery.data.routeExplain.explainSummary)}
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">路由步骤</div>
                          <div className="space-y-2">
                            {traceQuery.data.routeExplain.steps.length > 0 ? (
                              traceQuery.data.routeExplain.steps.map((step, index) => (
                                <div key={`${index}-${step}`} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                                  {step}
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-muted-foreground">暂无步骤</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="spans" className="mt-0 min-h-0 flex-1">
                  <ScrollArea className="h-[calc(100vh-180px)] pr-4">
                    {traceQuery.isLoading || !traceQuery.data ? (
                      <div className="py-6 text-sm text-muted-foreground">加载中...</div>
                    ) : traceQuery.data.spans.length === 0 ? (
                      <div className="py-6 text-sm text-muted-foreground">暂无 Trace Span</div>
                    ) : (
                      <div className="space-y-4 py-4">
                        {traceQuery.data.spans.map((span) => (
                          <div key={`${span.spanType}-${span.spanSeq ?? "na"}`} className="rounded-lg border border-border/60 p-4 space-y-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <Badge variant="outline">{span.spanType}</Badge>
                              <span className="text-sm text-muted-foreground">Seq {span.spanSeq ?? "-"}</span>
                              <span className="text-sm text-muted-foreground">状态 {span.status || "-"}</span>
                              <span className="text-sm text-muted-foreground">耗时 {span.durationMs === null ? "-" : `${span.durationMs}ms`}</span>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              {renderKeyValue("开始时间", formatDateTime(span.startedAt))}
                              {renderKeyValue("结束时间", formatDateTime(span.endedAt))}
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">输入</div>
                              {renderSpanPayload(span.inputJson)}
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">输出</div>
                              {renderSpanPayload(span.outputJson)}
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">扩展信息</div>
                              {renderSpanPayload(span.extJson)}
                            </div>
                            {span.errorMessage ? (
                              <div className="space-y-2">
                                <div className="text-xs text-muted-foreground">错误信息</div>
                                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-foreground">
                                  {span.errorMessage}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
