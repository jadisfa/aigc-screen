import { KeyRound, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import ModelHubApiKeyEditorPage from "@/modules/modelhub/components/ModelHubApiKeyEditorPage";
import { GovernanceOrgFilters } from "@/modules/modelhub/components/GovernanceOrgFilters";
import { listApiKeysPage, revokeApiKey, deleteApiKey } from "@/modules/modelhub/services/apiKeyManagement";
import {
  API_KEY_BINDING_LABEL,
  buildScopeSummaryLines,
  formatApiKeyDate,
  getApiKeyStatusMeta,
  type ApiKeyBindingType,
  type ApiKeyListItem,
} from "@/modules/modelhub/types/apiKeyManagementTypes";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
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
import { useGovernanceScopeChoice } from "@/shared/hooks/use-governance-scope-choice";
import { formatNumber } from "@/shared/lib/format";
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
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { notify } from "@/shared/lib/notify";

function getBindingBadgeClass(bindingType: ApiKeyBindingType) {
  switch (bindingType) {
    case "merchant":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "store":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "user":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "platform":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

function apiKeyStatusTone(status: ApiKeyListItem["status"]): StatusBadgeTone {
  switch (status) {
    case "active":
      return "success";
    case "revoked":
      return "danger";
    case "expired":
      return "warning";
    case "disabled":
    default:
      return "neutral";
  }
}

export default function ModelHubApiKeysPage() {
  const scopeChoice = useGovernanceScopeChoice();
  const { activeScope } = scopeChoice;
  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, invalidateTotal, changePageSize, rememberTotal } =
    usePagedListQuery();
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingId, setEditingId] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [bindingType, setBindingType] = useState<"all" | ApiKeyBindingType>("all");
  const [revokingId, setRevokingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const apiKeyQuery = useQuery({
    queryKey: ["modelhub", "api-keys", activeScope, pageNo, pageSize, keyword, bindingType],
    queryFn: () =>
      listApiKeysPage({
        scope: activeScope,
        pageNo,
        pageSize,
        total: getTotalParam(),
        keyword: keyword.trim() || undefined,
        bindingType: bindingType === "all" ? undefined : bindingType,
      }),
    enabled: true,
  });

  useEffect(() => {
    rememberTotal(apiKeyQuery.data?.page.total);
  }, [apiKeyQuery.data?.page.total, rememberTotal]);

  const items = useMemo(() => apiKeyQuery.data?.items ?? [], [apiKeyQuery.data?.items]);
  const editingApiKey = useMemo(() => items.find((item) => item.id === editingId) ?? null, [editingId, items]);
  const total = apiKeyQuery.data?.page.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  const applyFilters = () => {
    setKeyword(keywordInput.trim());
    resetPage();
  };

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => revokeApiKey(id),
    onSuccess: async () => {
      notify.success("撤销成功", { description: "API Key 已撤销，后续请求将不再继续放行。" });
      setRevokingId("");
      await apiKeyQuery.refetch();
    },
    onError: (error) => {
      notify.error("撤销失败", { description: resolveUserErrorMessage(error, "API Key 撤销失败") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteApiKey(id),
    onSuccess: async () => {
      notify.success("删除成功");
      setDeletingId("");
      invalidateTotal();
      await apiKeyQuery.refetch();
    },
    onError: (error) => {
      notify.error("删除失败", { description: resolveUserErrorMessage(error, "API Key 删除失败") });
    },
  });

  const summaryCards = useMemo(() => {
    const summary = apiKeyQuery.data?.summary;
    return [
      { value: formatNumber(summary?.totalBusiness), label: "API Key", hint: "业务归属", badge: "BK", badgeClassName: "bg-blue-50 text-blue-600" },
      { value: formatNumber(summary?.activeBusiness), label: "生效中", hint: "可用", badge: "ON", badgeClassName: "bg-emerald-50 text-emerald-600" },
      { value: formatNumber(summary?.systemFallback), label: "默认治理", hint: "自动回落", badge: "DF", badgeClassName: "bg-violet-50 text-violet-600" },
      { value: formatNumber(summary?.customGuardrail), label: "自定义安全", hint: "显式挂载", badge: "GR", badgeClassName: "bg-cyan-50 text-cyan-600" },
      { value: formatNumber(summary?.legacyPlatform), label: "历史平台", hint: "只读", badge: "LG", badgeClassName: "bg-amber-50 text-amber-600" },
    ];
  }, [apiKeyQuery.data?.summary]);

  if (view === "create" || view === "edit") {
    return (
      <ModelHubApiKeyEditorPage
        mode={view}
        editingId={editingId}
        initialScope={view === "edit" && editingApiKey ? editingApiKey : activeScope}
        onCancel={() => {
          setView("list");
          setEditingId("");
        }}
        onSuccess={() => {
          void apiKeyQuery.refetch();
          setView("list");
          setEditingId("");
        }}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="API Key"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => {
              void apiKeyQuery.refetch();
            }}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
            <Button variant="page" onClick={() => setView("create")}>
              <KeyRound className="h-4 w-4" />
              创建API Key
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
            emptyValue="__all__"
            emptyMerchantLabel="全部商户"
            emptyStoreLabel="全部门店"
          />

          <div className="flex items-center gap-2">
            <Select value={bindingType} onValueChange={(value) => {
              setBindingType(value as "all" | ApiKeyBindingType);
              resetPage();
            }}>
              <SelectTrigger className="subpage-native-select h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                <SelectItem className="subpage-select-item" value="all">
                  全部
                </SelectItem>
                <SelectItem className="subpage-select-item" value="merchant">
                  商户
                </SelectItem>
                <SelectItem className="subpage-select-item" value="store">
                  门店
                </SelectItem>
                <SelectItem className="subpage-select-item" value="user">
                  主体
                </SelectItem>
                <SelectItem className="subpage-select-item" value="platform">
                  历史平台级
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <SearchField
            wrapClassName="!max-w-[460px] shrink-0"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyFilters();
              }
            }}
            placeholder="搜索 API Key名称"
          />
          <Button variant="pageOutline" onClick={applyFilters} disabled={apiKeyQuery.isFetching}>
            搜索
          </Button>
      </PageFilterBar>

      {apiKeyQuery.isLoading ? (
        <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">API Key 列表加载中...</div>
      ) : apiKeyQuery.isError ? (
        <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-destructive">
          {resolveUserErrorMessage(apiKeyQuery.error, "API Key 列表加载失败")}
        </div>
      ) : (
        <TableSurface>
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">API Key</TableHead>
                <TableHead className="w-[200px]">归属</TableHead>
                <TableHead >挂载路由策略</TableHead>
                <TableHead>安全规则</TableHead>
                <TableHead className="w-[100px]">状态</TableHead>
                <TableHead className="w-[120px]">有效期</TableHead>
                <TableHead className="w-80">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isLegacyPlatform = item.bindingType === "platform";
                const scopeLines = buildScopeSummaryLines(item);
                const displayScopeLines = scopeLines.length > 0 ? scopeLines : ["未绑定业务归属"];
                const routingLabel = item.effectiveRoutingProfile?.name ?? "系统默认路由";
                const routingSourceLabel = item.usesSystemDefaultRouting
                  ? "自动回落"
                  : "显式挂载";
                const guardrailLabel = item.effectiveGuardrails.length
                  ? item.effectiveGuardrails.map((guardrail) => guardrail.name).join("、")
                  : "系统治理规则";
                const guardrailSourceLabel = item.usesSystemBaselineGuardrail
                  ? "自动回落"
                  : "显式挂载";
                return (
                  <TableRow key={item.id}>
                    <TableCell className="w-[220px]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{item.keyName}</span>
                          {isLegacyPlatform ? <Badge variant="outline">历史平台级</Badge> : null}
                          {item.inherited ? <Badge variant="outline">继承自商户</Badge> : null}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">{item.keyPrefix}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Badge variant="outline" className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${getBindingBadgeClass(item.bindingType)}`}>
                          {API_KEY_BINDING_LABEL[item.bindingType]}
                        </Badge>
                        <div className="space-y-1 text-[12px] text-muted-foreground">
                          {displayScopeLines.map((line) => (
                            <div key={line}>{line}</div>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm text-foreground">{routingLabel}</div>
                        <div className="text-[12px] text-muted-foreground">
                          {routingSourceLabel}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm text-foreground">{guardrailLabel}</div>
                        <div className="text-[12px] text-muted-foreground">
                          {guardrailSourceLabel}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={apiKeyStatusTone(item.status)}>
                        {getApiKeyStatusMeta(item.status).label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{formatApiKeyDate(item.expiresAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          className="h-8 px-2 text-primary"
                          disabled={!item.editable && !isLegacyPlatform}
                          onClick={() => {
                            setEditingId(item.id);
                            setView("edit");
                          }}
                        >
                          {isLegacyPlatform ? "只读查看" : "编辑"}
                        </Button>
                        {item.status === "active" && !isLegacyPlatform ? (
                          <Button
                            variant="ghost"
                            className="h-8 px-2 text-destructive"
                            onClick={() => setRevokingId(item.id)}
                            disabled={revokeMutation.isPending || deleteMutation.isPending || !item.editable}
                          >
                            撤销
                          </Button>
                        ) : null}
                        {item.status === "revoked" && !isLegacyPlatform ? (
                          <Button
                            variant="ghost"
                            className="h-8 px-2 text-destructive"
                            onClick={() => setDeletingId(item.id)}
                            disabled={deleteMutation.isPending || revokeMutation.isPending || !item.editable}
                          >
                            删除
                          </Button>
                        ) : null}
                        {isLegacyPlatform ? (
                          <span className="px-2 text-xs text-muted-foreground">历史只读</span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!apiKeyQuery.isLoading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    暂无符合条件的 API Key
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableSurface>
      )}

      <CommonPaginationBar
        total={total}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={pageNo < totalPages}
        onPageNoChange={setPageNo}
        onPageSizeChange={changePageSize}
        disabled={apiKeyQuery.isFetching}
      />

      <AlertDialog open={Boolean(revokingId)} onOpenChange={(open) => (!open ? setRevokingId("") : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认撤销 API Key？</AlertDialogTitle>
            <AlertDialogDescription>
              撤销后该 API Key 将立即停止放行请求，但历史挂载的路由策略和安全规则仍保留为只读记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => revokeMutation.mutate(revokingId)}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? "撤销中..." : "确认撤销"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deletingId)} onOpenChange={(open) => (!open ? setDeletingId("") : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除 API Key？</AlertDialogTitle>
            <AlertDialogDescription>
              仅可删除已撤销的 API Key。删除后列表中不再展示，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
