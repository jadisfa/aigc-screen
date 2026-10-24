import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { resolvePagedTotal } from "@/shared/hooks/use-paged-total";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  TableSurface,
} from "@/shared/components/page";
import { DatePicker } from "@/shared/components/DatePicker";
import { UserSelect } from "@/shared/components/UserSelect";
import { formatDateTime } from "@/shared/lib/datetime";
import { getUserAvatarFallback, resolveUserAvatarUrl } from "@/shared/lib/user-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  AUDIT_OPERATION_OPTIONS,
  AUDIT_SOURCE_OPTIONS,
  listAudits,
  type AuditLog,
} from "@/shared/api/sys/logs";
import { notify } from "@/shared/lib/notify";

const ALL_FILTER_VALUE = "all";

type AuditFilters = {
  principalId: string;
  operationType: string;
  source: string;
  requestStart: string;
  requestEnd: string;
  keyword: string;
};

function createInitialFilters(): AuditFilters {
  return {
    principalId: "",
    operationType: ALL_FILTER_VALUE,
    source: ALL_FILTER_VALUE,
    requestStart: "",
    requestEnd: "",
    keyword: "",
  };
}

function isSameFilters(left: AuditFilters, right: AuditFilters) {
  return left.principalId === right.principalId
    && left.operationType === right.operationType
    && left.source === right.source
    && left.requestStart === right.requestStart
    && left.requestEnd === right.requestEnd
    && left.keyword === right.keyword;
}

function formatDuration(durationMs?: number | null) {
  if (durationMs == null || Number.isNaN(durationMs)) {
    return "-";
  }
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }
  const seconds = durationMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(seconds >= 10 ? 1 : 2)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  return `${minutes} min ${remainSeconds.toFixed(1)} s`;
}

function formatPrincipalIdTail(principalId?: string | null) {
  const value = (principalId || "").trim();
  if (!value) {
    return "-";
  }
  return value.length <= 8 ? value : value.slice(-8);
}

function getOperatorDisplayName(audit: AuditLog) {
  return audit.operatorNickname?.trim() || audit.operator?.trim() || "-";
}

export default function AuditLogPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<AuditFilters>(() => createInitialFilters());
  const [appliedFilters, setAppliedFilters] = useState<AuditFilters>(() => createInitialFilters());

  const load = useCallback(async (pageNo: number, pageSize: number, nextFilters: AuditFilters = appliedFilters, knownTotal?: number) => {
    setLoading(true);
    try {
      const res = await listAudits({
        principalId: nextFilters.principalId || undefined,
        operationType: nextFilters.operationType === ALL_FILTER_VALUE ? undefined : nextFilters.operationType,
        source: nextFilters.source === ALL_FILTER_VALUE ? undefined : nextFilters.source,
        requestStart: nextFilters.requestStart ? `${nextFilters.requestStart} 00:00:00` : undefined,
        requestEnd: nextFilters.requestEnd ? `${nextFilters.requestEnd} 23:59:59` : undefined,
        keyword: nextFilters.keyword.trim() || undefined,
        pageNo,
        pageSize,
        total: resolvePagedTotal(pageNo, knownTotal),
      });
      setItems(res.items || []);
      setTotal(res.page?.total || 0);
    } catch (e) {
      notify.error("加载失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void load(pageNo, pageSize, appliedFilters, total);
  }, [appliedFilters, load, pageNo, pageSize, total]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedFilters((current) => {
        const nextFilters = {
          ...filters,
          keyword: current.keyword,
        };
        return isSameFilters(current, nextFilters) ? current : nextFilters;
      });
      setPageNo((current) => (current === 1 ? current : 1));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [filters.principalId, filters.operationType, filters.source, filters.requestStart, filters.requestEnd]);

  const applyKeywordSearch = () => {
    const nextFilters = {
      ...filters,
      keyword: filters.keyword.trim(),
    };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPageNo(1);
  };

  const handleReset = () => {
    const nextFilters = createInitialFilters();
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPageNo(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canNextPage = pageNo < totalPages;

  return (
    <PageShell>
      <PageHeader
        title="审计日志"
        actions={
          <>
            <Button variant="pageOutline" onClick={handleReset} disabled={loading}>
              重置
            </Button>
            <Button variant="pageOutline" onClick={() => void load(pageNo, pageSize, appliedFilters, total)} disabled={loading}>
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
          </>
        }
      />

      <PageFilterBar>
          <Select
            value={filters.operationType}
            onValueChange={(value) => setFilters((current) => ({ ...current, operationType: value }))}
          >
            <SelectTrigger className="subpage-native-select w-[120px] h-9">
              <SelectValue placeholder="操作类型" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value={ALL_FILTER_VALUE}>操作类型</SelectItem>
              {AUDIT_OPERATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.source} onValueChange={(value) => setFilters((current) => ({ ...current, source: value }))}>
            <SelectTrigger className="subpage-native-select w-[120px] h-9">
              <SelectValue placeholder="客户端" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value={ALL_FILTER_VALUE}>客户端</SelectItem>
              {AUDIT_SOURCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DatePicker
            value={filters.requestStart}
            onChange={(value) => setFilters((current) => ({ ...current, requestStart: value }))}
            placeholder="开始日期"
            className="w-[150px]"
          />
          <DatePicker
            value={filters.requestEnd}
            onChange={(value) => setFilters((current) => ({ ...current, requestEnd: value }))}
            placeholder="结束日期"
            className="w-[150px]"
          />
          <UserSelect
            value={filters.principalId}
            onChange={(value) => setFilters((current) => ({ ...current, principalId: value }))}
            placeholder="操作人"
            className="w-[160px]"
          />
          <SearchField
            wrapClassName="!max-w-[360px] shrink-0"
            placeholder="搜索请求编号/请求 URL/客户 IP，回车搜索"
            value={filters.keyword}
            onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyKeywordSearch();
              }
            }}
          />
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">序号</TableHead>
              <TableHead className="min-w-[80px]">操作类型</TableHead>
              <TableHead className="min-w-[90px]">操作人</TableHead>
              <TableHead className="min-w-[120px]">客户端</TableHead>
              <TableHead className="min-w-[140px]">客户IP</TableHead>
              <TableHead className="min-w-[220px]">请求编号</TableHead>
              <TableHead className="min-w-[320px]">请求URL</TableHead>
              <TableHead className="min-w-[180px]">请求时间</TableHead>
              <TableHead className="min-w-[120px]">请求耗时</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                  加载中...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              items.map((a, index) => {
                const operatorDisplayName = getOperatorDisplayName(a);
                return (
                <TableRow key={a.auditId}>
                  <TableCell>{(pageNo - 1) * pageSize + index + 1}</TableCell>
                  <TableCell>{a.operationTypeLabel || a.operationType || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 min-w-[110px]">
                      <Avatar className="h-8 w-8 rounded-md shrink-0">
                        <AvatarImage
                          src={resolveUserAvatarUrl(a.operatorAvatarUrl, a.principalId || a.operator || "user", 64)}
                          alt={operatorDisplayName === "-" ? "用户头像" : operatorDisplayName}
                          className="object-cover"
                        />
                        <AvatarFallback className="rounded-md bg-primary/10 text-primary text-xs font-medium">
                          {getUserAvatarFallback(operatorDisplayName === "-" ? (a.principalId || "U") : operatorDisplayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 space-y-1">
                        <div className="truncate">{operatorDisplayName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {formatPrincipalIdTail(a.principalId)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{a.sourceLabel || a.source || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{a.sourceIp || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{a.traceId || "-"}</TableCell>
                  <TableCell className="font-mono text-xs break-all">{a.requestUrl || "-"}</TableCell>
                  <TableCell>{formatDateTime(a.requestAt)}</TableCell>
                  <TableCell>{formatDuration(a.requestDurationMs)}</TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableSurface>

      <CommonPaginationBar
        total={total}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={canNextPage}
        onPageNoChange={setPageNo}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPageNo(1);
        }}
        showLastButton={true}
        disabled={loading}
      />
    </PageShell>
  );
}
