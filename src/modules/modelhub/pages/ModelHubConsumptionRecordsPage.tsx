import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listModelHubConsumptionRecords } from "@/shared/api/model-hub/model-hub";
import { resolveModelHubErrorMessage } from "@/modules/modelhub/services/modelhubAdminUi";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  StatusBadge,
  TableSurface,
  type StatusBadgeTone,
} from "@/shared/components/page";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { formatDateTime } from "@/shared/lib/datetime";
import { formatCurrency, formatNumber } from "@/shared/lib/format";
import { CONSOLE_ROUTES } from "@/shared/lib/permissions";
import { ROUTE_ENTRY_LABEL } from "@/shared/lib/route-entry-dicts";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { notify } from "@/shared/lib/notify";

function consumptionStatusTone(status: string): StatusBadgeTone {
  if (status === "已结算" || status === "BYOK") return "success";
  if (status === "待补记") return "warning";
  return "neutral";
}

function formatScene(scene: string | null | undefined) {
  if (!scene || scene === "-") {
    return "-";
  }
  return ROUTE_ENTRY_LABEL[scene as keyof typeof ROUTE_ENTRY_LABEL] || scene;
}

function formatTokenTriple(input: number, output: number, total: number) {
  return `${formatNumber(input)} / ${formatNumber(output)} / ${formatNumber(total)}`;
}

function shortenId(value: string | null | undefined, head = 12, tail = 12) {
  if (!value || value === "-") {
    return "-";
  }
  if (value.length <= head + tail + 1) {
    return value;
  }
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function buildCallerSubjectLines(item: {
  merchantId?: string | null;
  merchantName?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  principalId?: string | null;
  principalName?: string | null;
}) {
  return [
    `商户： ${item.merchantId ? item.merchantName?.trim() || shortenId(item.merchantId) : "-"}`,
    `门店： ${item.storeId ? item.storeName?.trim() || shortenId(item.storeId) : "-"}`,
    `用户： ${item.principalId ? item.principalName?.trim() || shortenId(item.principalId) : "-"}`,
  ];
}

export default function ModelHubConsumptionRecordsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, changePageSize, rememberTotal } =
    usePagedListQuery();
  const initialKeyword =
    searchParams.get("requestId")?.trim() ||
    searchParams.get("traceId")?.trim() ||
    searchParams.get("keyword")?.trim() ||
    "";
  const [keywordInput, setKeywordInput] = useState(initialKeyword);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [status, setStatus] = useState("all");

  useEffect(() => {
    const nextKeyword =
      searchParams.get("requestId")?.trim() ||
      searchParams.get("traceId")?.trim() ||
      searchParams.get("keyword")?.trim() ||
      "";
    if (!nextKeyword) {
      return;
    }
    setKeywordInput(nextKeyword);
    setKeyword(nextKeyword);
    resetPage();
  }, [resetPage, searchParams]);

  const recordsQuery = useQuery({
    queryKey: ["modelhub", "consumption-records", pageNo, pageSize, status, keyword],
    queryFn: () =>
      listModelHubConsumptionRecords({
        pageNo,
        pageSize,
        total: getTotalParam(),
        keyword: keyword.trim() || undefined,
        status: status === "all" ? undefined : status,
      }),
  });

  useEffect(() => {
    rememberTotal(recordsQuery.data?.page.total);
  }, [recordsQuery.data?.page.total, rememberTotal]);

  useEffect(() => {
    if (!recordsQuery.error) {
      return;
    }
    notify.error("加载失败", { description: resolveModelHubErrorMessage(recordsQuery.error, "消费记录加载失败") });
  }, [recordsQuery.error]);

  const summaryCards = useMemo(() => {
    const summary = recordsQuery.data?.summary;

    return [
      { value: formatNumber(summary?.totalCount), label: "消费笔数", hint: "Token 消费明细", badge: "CR", badgeClassName: "bg-blue-50 text-blue-600" },
      {
        value: formatCurrency(summary?.totalAmount, summary?.currency),
        label: "累计金额",
        hint: "基于 Token 结算汇总",
        badge: "AM",
        badgeClassName: "bg-rose-50 text-rose-400",
      },
      {
        value: formatNumber((summary?.settledCount ?? 0) + (summary?.byokCount ?? 0)),
        label: "成功消费",
        hint: `已结算 ${formatNumber(summary?.settledCount)} / BYOK ${formatNumber(summary?.byokCount)}`,
        badge: "OK",
        badgeClassName: "bg-emerald-50 text-emerald-600",
      },
      { value: formatNumber(summary?.pendingCount), label: "待补记", hint: "结算异常待补记", badge: "ER", badgeClassName: "bg-amber-50 text-amber-500" },
    ];
  }, [recordsQuery.data?.summary]);

  const page = recordsQuery.data?.page;
  const items = recordsQuery.data?.items ?? [];
  const total = page?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  const applyFilters = () => {
    setKeyword(keywordInput.trim());
    resetPage();
  };

  const openCallLog = (traceId: string | null | undefined, requestId: string | null | undefined) => {
    const params = new URLSearchParams();
    if (traceId && traceId !== "-") {
      params.set("traceId", traceId);
    }
    if (requestId && requestId !== "-") {
      params.set("requestId", requestId);
    }
    const qs = params.toString();
    navigate(qs ? `${CONSOLE_ROUTES.modelHubLogs}?${qs}` : CONSOLE_ROUTES.modelHubLogs);
  };

  return (
    <PageShell>
      <PageHeader
        title="Token消费"
        actions={
          <Button
            variant="pageOutline"
            onClick={() => {
              void recordsQuery.refetch();
            }}
            disabled={recordsQuery.isFetching}
          >
            <RefreshCw className="w-4 h-4" />
            {recordsQuery.isFetching ? "刷新中..." : "刷新"}
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => (
          <Card key={item.label} className="rounded-2xl border border-border/80 bg-card shadow-none">
            <CardContent className="flex items-start justify-between px-5 py-5">
              <div>
                <div className="text-[16px] font-semibold leading-none text-foreground">{item.value}</div>
                <div className="mt-3 text-sm font-medium text-foreground">{item.label}</div>
                <div className="mt-4 text-xs text-muted-foreground">{item.hint}</div>
              </div>
              <div className={`rounded-xl px-3 py-2 text-[15px] font-medium ${item.badgeClassName}`}>{item.badge}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PageFilterBar>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground whitespace-nowrap">状态</span>
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
                <SelectItem className="subpage-select-item" value="all">全部</SelectItem>
                <SelectItem className="subpage-select-item" value="settled">已结算</SelectItem>
                <SelectItem className="subpage-select-item" value="pending">待补记</SelectItem>
                <SelectItem className="subpage-select-item" value="byok">BYOK</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SearchField
            wrapClassName="!max-w-[420px] shrink-0"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyFilters();
              }
            }}
            placeholder="搜索 Request / Trace / 模型 / 业务编码 / Key / 渠道"
          />
          <Button variant="pageOutline" onClick={applyFilters} disabled={recordsQuery.isFetching}>
            搜索
          </Button>
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">时间</TableHead>
              <TableHead className="whitespace-nowrap">调用主体</TableHead>
              <TableHead className="whitespace-nowrap">调用方式</TableHead>
              <TableHead>场景</TableHead>
              <TableHead className="whitespace-nowrap">渠道信息</TableHead>
              <TableHead className="whitespace-nowrap">金额 / Token</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-muted-foreground">Request / Trace</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length > 0 ? (
              items.map((item) => {
                const isApiKey = (item.accessType || "").toUpperCase() === "API_KEY";
                const accessCode = isApiKey ? item.apiKey : item.bizCode;
                return (
                  <TableRow key={item.id || item.requestId || item.traceId || `${item.time}-${item.model}`}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(item.time)}</TableCell>
                    <TableCell className="min-w-[140px] text-xs text-muted-foreground">
                      {buildCallerSubjectLines(item).map((line) => (
                        <div key={line} className="truncate gap-2" title={line}>
                          {line}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      <Badge variant={isApiKey ? "outline" : "secondary"}>
                        {isApiKey ? "API Key" : "业务编码"}
                      </Badge>
                      <div
                        className="mt-1 font-mono text-[11px] text-muted-foreground truncate max-w-[180px]"
                        title={accessCode || undefined}
                      >
                        {isApiKey ? shortenId(accessCode) : accessCode || "-"}
                      </div>
                    </TableCell>
                    <TableCell>{formatScene(item.scene)}</TableCell>
                    <TableCell className="min-w-[140px]">
                      <div className="truncate" title={item.channel || undefined}>
                        {item.channel || "-"}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground" title={item.model || undefined}>
                        {item.model || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div>{formatCurrency(item.amount, item.currency ?? undefined)}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        Token {formatTokenTriple(item.inputTokens ?? 0, item.outputTokens ?? 0, item.tokens ?? 0)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={consumptionStatusTone(item.status)}>{item.status}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground w-160">
                      <div className="font-mono text-[11px]" title={item.requestId || undefined}>
                        {shortenId(item.requestId)}
                      </div>
                      <div className="font-mono text-[11px]" title={item.traceId || undefined}>
                        {shortenId(item.traceId)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        disabled={!item.traceId && !item.requestId}
                        onClick={() => openCallLog(item.traceId, item.requestId)}
                      >
                        查看日志
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  {recordsQuery.isLoading ? "加载中..." : "暂无消费记录"}
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
        disabled={recordsQuery.isFetching}
      />
    </PageShell>
  );
}
