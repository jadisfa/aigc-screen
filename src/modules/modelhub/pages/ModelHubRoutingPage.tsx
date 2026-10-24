import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import ModelHubRoutingEditorPage from "@/modules/modelhub/components/ModelHubRoutingEditorPage";
import { GovernanceOrgFilters } from "@/modules/modelhub/components/GovernanceOrgFilters";
import { deleteRoutingProfile, listRoutingProfilesPage } from "@/modules/modelhub/services/routingProfiles";
import {
  buildChannelPolicySummary,
  buildEntrySummary,
  getRoutingStatusMeta,
  REGION_LABEL,
  TENANT_LABEL,
  type RoutingProfileStatus,
} from "@/modules/modelhub/types/routingManagementTypes";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  StatusBadge,
  TableSurface,
  statusToneFromCode,
} from "@/shared/components/page";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { useGovernanceScopeChoice } from "@/shared/hooks/use-governance-scope-choice";
import { formatNumber } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { notify } from "@/shared/lib/notify";

export default function ModelHubRoutingPage() {
  const scopeChoice = useGovernanceScopeChoice();
  const { canChooseMerchant, activeScope, isPlatformScoped } = scopeChoice;
  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, changePageSize, rememberTotal } =
    usePagedListQuery();
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingId, setEditingId] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<"all" | RoutingProfileStatus>("all");
  const [defaultFilter, setDefaultFilter] = useState<"all" | "default" | "custom">("all");
  const [deletingId, setDeletingId] = useState("");

  const scopeReady = isPlatformScoped || !canChooseMerchant || Boolean(activeScope.merchantId?.trim());

  const listQuery = useQuery({
    queryKey: ["modelhub", "routing-profiles", activeScope, pageNo, pageSize, keyword, status, defaultFilter],
    queryFn: () =>
      listRoutingProfilesPage({
        scope: activeScope,
        pageNo,
        pageSize,
        total: getTotalParam(),
        keyword: keyword.trim() || undefined,
        status: status === "all" ? undefined : status,
        isSystemDefault:
          defaultFilter === "default" ? true : defaultFilter === "custom" ? false : undefined,
      }),
    enabled: scopeReady,
  });

  useEffect(() => {
    rememberTotal(listQuery.data?.page.total);
  }, [listQuery.data?.page.total, rememberTotal]);

  const applyFilters = () => {
    setKeyword(keywordInput.trim());
    resetPage();
  };

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const total = listQuery.data?.page.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const editingProfile = useMemo(() => items.find((item) => item.id === editingId) ?? null, [editingId, items]);

  const summaryCards = useMemo(() => {
    const summary = listQuery.data?.summary;
    return [
      { value: formatNumber(summary?.totalCount), label: "路由策略", hint: "策略资源总数", badge: "RT", badgeClassName: "bg-blue-50 text-blue-600" },
      { value: formatNumber(summary?.enabledCount), label: "启用策略", hint: "当前可参与命中", badge: "ON", badgeClassName: "bg-emerald-50 text-emerald-600" },
      { value: formatNumber(summary?.tenantCoverageCount), label: "适用租户", hint: "平台 / 商户 / C 端", badge: "TG", badgeClassName: "bg-amber-50 text-amber-600" },
      { value: formatNumber(summary?.fallbackCount), label: "带回落", hint: "未命中回落系统默认", badge: "FB", badgeClassName: "bg-violet-50 text-violet-600" },
    ];
  }, [listQuery.data?.summary]);

  const handleDelete = async (id: string) => {
    const currentItem = items.find((item) => item.id === id);
    if (!currentItem) {
      return;
    }
    if (!window.confirm(`确认删除路由策略“${currentItem.name}”吗？`)) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteRoutingProfile(id, activeScope);
      notify.success("删除成功");
      await listQuery.refetch();
    } catch (error) {
      notify.error("删除失败", { description: resolveUserErrorMessage(error, "路由策略删除失败") });
    } finally {
      setDeletingId("");
    }
  };

  if (view === "create" || view === "edit") {
    return (
      <ModelHubRoutingEditorPage
        mode={view}
        editingId={editingId}
        initialScope={view === "edit" && editingProfile ? editingProfile : activeScope}
        onCancel={() => {
          setView("list");
          setEditingId("");
        }}
        onSuccess={() => {
          setView("list");
          setEditingId("");
          void listQuery.refetch();
        }}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="路由管理"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => {
              void listQuery.refetch();
            }} disabled={listQuery.isFetching}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
            <Button variant="page" onClick={() => setView("create")}>
              新增路由策略
            </Button>
          </>
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
          <GovernanceOrgFilters
            choice={scopeChoice}
            onScopeChange={resetPage}
            emptyMerchantLabel="全部"
            emptyStoreLabel="目标门店"
          />
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={(value) => {
              setStatus(value as "all" | RoutingProfileStatus);
              resetPage();
            }}>
              <SelectTrigger className="subpage-native-select h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                <SelectItem className="subpage-select-item" value="all">
                  状态
                </SelectItem>
                <SelectItem className="subpage-select-item" value="enabled">
                  启用
                </SelectItem>
                <SelectItem className="subpage-select-item" value="disabled">
                  停用
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Select value={defaultFilter} onValueChange={(value) => {
              setDefaultFilter(value as "all" | "default" | "custom");
              resetPage();
            }}>
              <SelectTrigger className="subpage-native-select h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                <SelectItem className="subpage-select-item" value="all">
                  默认策略
                </SelectItem>
                <SelectItem className="subpage-select-item" value="default">
                  系统默认
                </SelectItem>
                <SelectItem className="subpage-select-item" value="custom">
                  其他策略
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SearchField
            wrapClassName="!max-w-[320px] shrink-0"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyFilters();
              }
            }}
            placeholder="搜索策略名称 / 编码 "
          />
          <Button variant="pageOutline" onClick={applyFilters} disabled={listQuery.isFetching}>
            搜索
          </Button>
      </PageFilterBar>

      {listQuery.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {resolveUserErrorMessage(listQuery.error, "路由策略列表加载失败")}
        </div>
      ) : null}

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">策略名称</TableHead>
              <TableHead className="w-[120px]">作用域</TableHead>
              <TableHead className="w-[160px]">适用租户</TableHead>
              <TableHead className="w-[140px]">适用区域</TableHead>
              <TableHead className="w-[280px]">入口映射摘要</TableHead>
              <TableHead className="w-[120px]">渠道选择</TableHead>
              <TableHead className="w-[80px]">挂载数</TableHead>
              <TableHead className="w-[120px]">默认行为</TableHead>
              <TableHead className="w-[80px]">状态</TableHead>
              <TableHead className="w-36">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const statusMeta = getRoutingStatusMeta(item.status);
              const fallbackTarget =
                item.defaultBehavior.fallbackPoolLabel || item.defaultBehavior.fallbackPoolCode || item.defaultBehavior.fallbackPoolId;
              const defaultBehaviorSummary =
                item.defaultBehavior.unmatchedBehavior === "fallback_to_system_default"
                  ? "未命中时回落到指定模型池"
                  : "未命中时直接拒绝请求";

              return (
              <TableRow key={item.id}>
                <TableCell className="w-[220px]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{item.name}</span>
                      {item.isSystemDefault ? <Badge variant="outline">系统默认</Badge> : null}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">{item.code}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-2">
                    <div>
                      <Badge
                        variant="outline"
                        className={
                          item.merchantId
                            ? item.storeId
                              ? "rounded-md border-fuchsia-200 bg-fuchsia-50 px-2.5 py-0.5 text-[12px] font-medium text-fuchsia-700 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/30 dark:text-fuchsia-300"
                              : "rounded-md border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[12px] font-medium text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300"
                            : "rounded-md border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[12px] font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                        }
                      >
                        {item.merchantId ? (item.storeId ? "门店策略" : "商户策略") : "平台策略"}
                      </Badge>
                    </div>
                    {item.merchantId ? (
                      <div className="space-y-1 font-mono text-[11px] text-muted-foreground">
                        <div>{item.merchantId}</div>
                        {item.storeId ? <div>{item.storeId}</div> : null}
                      </div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-[180px] flex-wrap gap-1.5">
                    {item.applicableTenantLevels.map((tenantLevel) => (
                      <Badge
                        key={tenantLevel}
                        variant="outline"
                        className="border-sky-200 bg-sky-50 text-[12px] font-normal text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300"
                      >
                        {TENANT_LABEL[tenantLevel]}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-[160px] flex-wrap gap-1.5">
                    {item.applicableRegions.map((regionLevel) => (
                      <Badge
                        key={regionLevel}
                        variant="outline"
                        className="border-amber-200 bg-amber-50 text-[12px] font-normal text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                      >
                        {REGION_LABEL[regionLevel]}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="max-w-[240px] text-[12px] leading-5 text-foreground">
                    {buildEntrySummary(item.entries)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="max-w-[220px] text-[12px] leading-5 text-muted-foreground">
                    {buildChannelPolicySummary(item.entries)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="inline-flex min-w-10 items-center justify-center rounded-md bg-muted px-2 py-1 text-[12px] font-semibold text-foreground">
                    {item.attachCount}
                  </div>
                </TableCell>
                <TableCell>
                  {item.defaultBehavior.unmatchedBehavior === "fallback_to_system_default" ? (
                    <div className="space-y-1">
                      {/* <Badge
                        variant="outline"
                        className="border-violet-200 bg-violet-50 text-[12px] font-medium text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300"
                      >
                        未命中回落
                      </Badge> */}
                      <div className="max-w-[220px] text-[11px] text-muted-foreground">{defaultBehaviorSummary}</div>
                      <div className="max-w-[220px] text-[11px] text-foreground">
                        目标池：{fallbackTarget}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <StatusBadge tone="danger">未命中拒绝</StatusBadge>
                      <div className="max-w-[220px] text-[11px] text-muted-foreground">{defaultBehaviorSummary}</div>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={statusToneFromCode(item.status)}>{statusMeta.label}</StatusBadge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary"
                      title="编辑"
                      aria-label="编辑"
                      onClick={() => {
                        setEditingId(item.id);
                        setView("edit");
                      }}
                      disabled={deletingId === item.id}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-rose-600 hover:text-rose-700"
                      title="删除"
                      aria-label="删除"
                      onClick={() => {
                        void handleDelete(item.id);
                      }}
                      disabled={deletingId === item.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )})}
            {!listQuery.isLoading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  {scopeReady ? "暂无符合条件的路由策略" : "请先选择目标商户"}
                </TableCell>
              </TableRow>
            ) : null}
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
        disabled={listQuery.isFetching}
      />
    </PageShell>
  );
}
