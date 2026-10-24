import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listModelHubAlerts } from "@/shared/api/model-hub/model-hub";
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
import { formatNumber } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { notify } from "@/shared/lib/notify";

function alertLevelTone(level: string): StatusBadgeTone {
  if (level === "高") return "danger";
  if (level === "中") return "warning";
  return "info";
}

function alertStatusTone(status: string): StatusBadgeTone {
  if (status === "已恢复") return "success";
  if (status === "处理中") return "info";
  return "warning";
}

export default function ModelHubAlertsPage() {
  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, changePageSize, rememberTotal } =
    usePagedListQuery();
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");

  const alertsQuery = useQuery({
    queryKey: ["modelhub", "alerts", pageNo, pageSize, type, status, keyword],
    queryFn: () =>
      listModelHubAlerts({
        pageNo,
        pageSize,
        total: getTotalParam(),
        keyword: keyword.trim() || undefined,
        type: type === "all" ? undefined : type,
        status: status === "all" ? undefined : status,
      }),
  });

  useEffect(() => {
    rememberTotal(alertsQuery.data?.page.total);
  }, [alertsQuery.data?.page.total, rememberTotal]);

  useEffect(() => {
    if (!alertsQuery.error) {
      return;
    }
    notify.error("加载失败", { description: resolveModelHubErrorMessage(alertsQuery.error, "告警中心加载失败") });
  }, [alertsQuery.error]);

  const summaryCards = useMemo(() => {
    const summary = alertsQuery.data?.summary;

    return [
      { value: formatNumber(summary?.totalCount), label: "告警总数", hint: "全量告警事件", badge: "AL", badgeClassName: "bg-blue-50 text-blue-600" },
      { value: formatNumber(summary?.openCount), label: "待处理", hint: "status != 已恢复", badge: "OP", badgeClassName: "bg-amber-50 text-amber-500" },
      { value: formatNumber(summary?.highPriorityCount), label: "高优先级", hint: "高等级告警", badge: "HI", badgeClassName: "bg-rose-50 text-rose-400" },
      { value: formatNumber(summary?.specialTopicCount), label: "重点专题", hint: "余额 / 安全专题", badge: "SP", badgeClassName: "bg-violet-50 text-violet-500" },
    ];
  }, [alertsQuery.data?.summary]);

  const page = alertsQuery.data?.page;
  const items = alertsQuery.data?.items ?? [];
  const total = page?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  const applyFilters = () => {
    setKeyword(keywordInput.trim());
    resetPage();
  };

  return (
    <PageShell>
      <PageHeader
        title="告警中心"
        actions={
          <Button
            variant="pageOutline"
            onClick={() => {
              void alertsQuery.refetch();
            }}
            disabled={alertsQuery.isFetching}
          >
            <RefreshCw className="w-4 h-4" />
            {alertsQuery.isFetching ? "刷新中..." : "刷新"}
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => (
          <div key={item.label} className="rounded-2xl border border-border/80 bg-card px-5 py-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[16px] font-semibold leading-none text-foreground">{item.value}</div>
                <div className="mt-3 text-sm font-medium text-foreground">{item.label}</div>
                <div className="mt-4 text-xs text-muted-foreground">{item.hint}</div>
              </div>
              <div className={`rounded-xl px-3 py-2 text-[15px] font-medium ${item.badgeClassName}`}>{item.badge}</div>
            </div>
          </div>
        ))}
      </div>

      <PageFilterBar>
          <div className="flex items-center gap-2">
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value);
                resetPage();
              }}
            >
              <SelectTrigger className="subpage-native-select w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                <SelectItem className="subpage-select-item" value="all">全部类型</SelectItem>
                <SelectItem className="subpage-select-item" value="quota">余额告警</SelectItem>
                <SelectItem className="subpage-select-item" value="security">安全告警</SelectItem>
                <SelectItem className="subpage-select-item" value="call">调用异常</SelectItem>
                <SelectItem className="subpage-select-item" value="log">日志异常</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                resetPage();
              }}
            >
              <SelectTrigger className="subpage-native-select w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                <SelectItem className="subpage-select-item" value="all">全部状态</SelectItem>
                <SelectItem className="subpage-select-item" value="open">待处理</SelectItem>
                <SelectItem className="subpage-select-item" value="processing">处理中</SelectItem>
                <SelectItem className="subpage-select-item" value="recovered">已恢复</SelectItem>
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
            placeholder="搜索告警内容 / 编号 / 责任域"
          />
          <Button variant="pageOutline" onClick={applyFilters} disabled={alertsQuery.isFetching}>
            搜索
          </Button>
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead>告警编号</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>等级</TableHead>
              <TableHead>告警内容</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>责任域</TableHead>
              <TableHead>时间</TableHead>
              <TableHead className="w-36">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length > 0 ? (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.id}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>
                    <StatusBadge tone={alertLevelTone(item.level)}>{item.level}</StatusBadge>
                  </TableCell>
                  <TableCell>{item.subject}</TableCell>
                  <TableCell>
                    <StatusBadge tone={alertStatusTone(item.status)}>{item.status}</StatusBadge>
                  </TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell>{formatDateTime(item.time)}</TableCell>
                  <TableCell className="text-muted-foreground">当前为只读告警视图</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  {alertsQuery.isLoading ? "加载中..." : "暂无告警事件"}
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
        disabled={alertsQuery.isFetching}
      />
    </PageShell>
  );
}
