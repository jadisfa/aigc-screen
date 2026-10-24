import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { notify } from "@/shared/lib/notify";
import ModelHubPoolEditorPage from "@/modules/modelhub/components/ModelHubPoolEditorPage";
import { GovernanceOrgFilters } from "@/modules/modelhub/components/GovernanceOrgFilters";
import { resolveModelHubErrorMessage } from "@/modules/modelhub/services/modelhubAdminUi";
import {
  getPoolRoutingModeLabel,
  loadPoolPageData,
  type PoolListItem,
} from "@/modules/modelhub/services/pools";
import { deleteModelHubPool } from "@/shared/api/model-hub/model-hub";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  StatusBadge,
  TableSurface,
} from "@/shared/components/page";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { useGovernanceScopeChoice } from "@/shared/hooks/use-governance-scope-choice";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

function toScopeTypeFilter(value: string): string | undefined {
  if (value === "平台") return "platform";
  if (value === "商户") return "merchant";
  if (value === "门店") return "store";
  return undefined;
}

export default function ModelHubPoolsPage() {
  const scopeChoice = useGovernanceScopeChoice({
    clearStoreWhenMerchantEmpty: true,
    requireCanChooseStore: false,
    onMerchantLoadError: (error) => notify.error(resolveModelHubErrorMessage(error, "商户列表加载失败")),
    onStoreLoadError: (error) => notify.error(resolveModelHubErrorMessage(error, "门店列表加载失败")),
  });
  const { activeScope } = scopeChoice;
  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, invalidateTotal, changePageSize, rememberTotal } =
    usePagedListQuery();

  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingPool, setEditingPool] = useState<PoolListItem | null>(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [ownerType, setOwnerType] = useState("all");
  const [deletingId, setDeletingId] = useState("");

  const listQuery = useQuery({
    queryKey: ["modelhub", "pools", activeScope, pageNo, pageSize, keyword, ownerType],
    queryFn: () =>
      loadPoolPageData({
        scope: activeScope,
        pageNo,
        pageSize,
        total: getTotalParam(),
        keyword: keyword.trim() || undefined,
        scopeType: toScopeTypeFilter(ownerType),
      }),
  });

  useEffect(() => {
    rememberTotal(listQuery.data?.page.total);
  }, [listQuery.data?.page.total, rememberTotal]);

  useEffect(() => {
    if (!listQuery.error) {
      return;
    }
    notify.error(resolveModelHubErrorMessage(listQuery.error, "模型池列表加载失败"));
  }, [listQuery.error]);

  const poolItems = listQuery.data?.pools ?? [];
  const total = listQuery.data?.page.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const pageLoading = listQuery.isFetching;

  const applyFilters = () => {
    setKeyword(keywordInput.trim());
    resetPage();
  };

  const reloadPageData = useCallback(async () => {
    await listQuery.refetch();
  }, [listQuery]);

  const openCreate = () => {
    setEditingPool(null);
    setView("create");
  };

  const closeEditor = () => {
    setView("list");
    setEditingPool(null);
  };

  const handleDelete = async (item: PoolListItem) => {
    if (!window.confirm(`确认删除模型池“${item.displayName}”吗？`)) {
      return;
    }
    setDeletingId(item.id);
    try {
      await deleteModelHubPool(item.id);
      notify.success("删除成功");
      invalidateTotal();
      await reloadPageData();
    } catch (error) {
      notify.error(resolveModelHubErrorMessage(error, "模型池删除失败"));
    } finally {
      setDeletingId("");
    }
  };

  if (view === "create" || view === "edit") {
    return (
      <ModelHubPoolEditorPage
        mode={view}
        editingId={editingPool?.id}
        initialScope={view === "edit" && editingPool ? editingPool : activeScope}
        onCancel={closeEditor}
        onSuccess={() => {
          invalidateTotal();
          void reloadPageData();
          closeEditor();
        }}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="模型池"
        actions={
          <>
            <Button variant="pageOutline" disabled={pageLoading} onClick={() => void reloadPageData()}>
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
            <Button variant="page" onClick={openCreate}>创建模型池</Button>
          </>
        }
      />

      <PageFilterBar>
          <GovernanceOrgFilters
            choice={scopeChoice}
            onScopeChange={resetPage}
            emptyValue="none"
            emptyMerchantLabel="全部范围"
            emptyStoreLabel="全部门店"
            hideWhenLocked
            disableStoreWhenNoMerchant
            triggerClassName="subpage-native-select w-52 h-9"
          />
          <Select value={ownerType} onValueChange={(value) => {
            setOwnerType(value);
            resetPage();
          }}>
            <SelectTrigger className="subpage-native-select w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value="all">全部</SelectItem>
              <SelectItem className="subpage-select-item" value="平台">平台</SelectItem>
              <SelectItem className="subpage-select-item" value="商户">商户</SelectItem>
              <SelectItem className="subpage-select-item" value="门店">门店</SelectItem>
            </SelectContent>
          </Select>
          <SearchField
            wrapClassName="!max-w-[420px] shrink-0"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyFilters();
              }
            }}
            placeholder="搜索模型池 / 编码 / 商户 / 门店"
          />
          <Button variant="pageOutline" onClick={applyFilters} disabled={pageLoading}>
            搜索
          </Button>
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead>模型池</TableHead>
              <TableHead>作用域</TableHead>
              <TableHead>路由模式</TableHead>
              <TableHead>候选模型</TableHead>
              <TableHead>启用状态</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className="w-36">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  正在加载模型池...
                </TableCell>
              </TableRow>
            ) : poolItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  暂无符合条件的模型池
                </TableCell>
              </TableRow>
            ) : (
              poolItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{item.displayName}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{item.poolCode}</div>
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
                          {item.merchantId ? (item.storeId ? "门店模型池" : "商户模型池") : "平台模型池"}
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
                  <TableCell>{getPoolRoutingModeLabel(item.routingMode)}</TableCell>
                  <TableCell>
                    <div className="flex max-w-[320px] flex-wrap items-center gap-y-1 text-[11px] text-foreground">
                      {item.candidateModels.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground">-</span>
                      ) : (
                        item.candidateModels.slice(0, 10).map((model, index, visibleModels) => (
                          <div key={model.id} className="inline-flex max-w-full items-center">
                            <div className="inline-flex max-w-full items-center gap-1.5">
                              <Avatar className="h-4 w-4 shrink-0 rounded-full">
                                <AvatarImage src={model.providerLogoUrl || undefined} alt={model.displayName} className="object-cover" />
                                <AvatarFallback className="text-[9px] font-medium">
                                  {model.displayName.slice(0, 1).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="break-all leading-5">{model.displayName}</span>
                            </div>
                            {index < visibleModels.length - 1 ? (
                              <span className="mx-[5px] shrink-0 text-muted-foreground">/</span>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={item.status === "启用" ? "success" : "neutral"}>
                      {item.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{item.updatedAt}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary"
                        title="编辑"
                        aria-label="编辑"
                        onClick={() => {
                          setEditingPool(item);
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
                          void handleDelete(item);
                        }}
                        disabled={deletingId === item.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
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
        disabled={pageLoading}
      />
    </PageShell>
  );
}
