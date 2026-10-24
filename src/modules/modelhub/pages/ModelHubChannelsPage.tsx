import { useQuery } from "@tanstack/react-query";
import { Pencil, RefreshCw, Trash2, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ModelHubChannelEditorPage from "@/modules/modelhub/components/ModelHubChannelEditorPage";
import { GovernanceOrgFilters } from "@/modules/modelhub/components/GovernanceOrgFilters";
import ChannelProtocolCatalogDialog from "@/modules/modelhub/components/channel-editor/ChannelProtocolCatalogDialog";
import ModelHubChannelQuotaEntriesPage from "@/modules/modelhub/components/ModelHubChannelQuotaEntriesPage";
import {
  formatChannelQuotaSummaryValue,
  getAuthModeLabel,
  getChannelStatusLabel,
  getChannelTypeLabel,
  getHealthStateLabel,
  type ChannelEditorValue,
  type ChannelModelCatalogItem,
  type ChannelQuotaAccountSummary,
  type ChannelQuotaAdjustmentValue,
  type ChannelQuotaLedgerListItem,
  type ProviderOption,
} from "@/modules/modelhub/types/channelManagementTypes";
import {
  createChannelQuotaAdjustment,
  loadChannelDetail,
  loadChannelEditorCatalog,
  loadChannelPageData,
  loadChannelQuotaDetail,
  saveChannel,
} from "@/modules/modelhub/services/channelManagementService";
import { resolveModelHubErrorMessage } from "@/modules/modelhub/services/modelhubAdminUi";
import { deleteModelHubChannel } from "@/shared/api/model-hub/model-hub";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { notify } from "@/shared/lib/notify";

function healthStateTone(healthState: string): StatusBadgeTone {
  if (healthState === "normal") return "success";
  if (healthState === "degraded") return "warning";
  return "danger";
}

function toChannelTypeFilter(value: string): string | undefined {
  if (value === "厂商直连") return "provider_direct";
  if (value === "聚合平台") return "api_aggregator";
  return undefined;
}

function toAuthModeFilter(value: string): string | undefined {
  if (value === "平台共享") return "shared";
  if (value === "商户 BYOK") return "byok";
  return undefined;
}

function toChannelStatusFilter(value: string): string | undefined {
  if (value === "启用") return "enabled";
  if (value === "停用") return "disabled";
  return undefined;
}

export default function ModelHubChannelsPage() {
  const scopeChoice = useGovernanceScopeChoice();
  const { activeScope } = scopeChoice;
  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, changePageSize, rememberTotal } =
    usePagedListQuery();
  const [view, setView] = useState<"list" | "create" | "edit" | "quota">("list");
  const [editingId, setEditingId] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [channelType, setChannelType] = useState("all");
  const [accessMode, setAccessMode] = useState("all");
  const [status, setStatus] = useState("all");
  const [editorInitialValue, setEditorInitialValue] = useState<ChannelEditorValue | null>(null);
  const [editorQuotaSummary, setEditorQuotaSummary] = useState<ChannelQuotaAccountSummary | null>(null);
  const [quotaSummary, setQuotaSummary] = useState<ChannelQuotaAccountSummary | null>(null);
  const [quotaEntries, setQuotaEntries] = useState<ChannelQuotaLedgerListItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [protocolCatalogOpen, setProtocolCatalogOpen] = useState(false);
  const [editorProviders, setEditorProviders] = useState<ProviderOption[]>([]);
  const [editorModelCatalog, setEditorModelCatalog] = useState<ChannelModelCatalogItem[]>([]);

  const pageQuery = useQuery({
    queryKey: ["modelhub", "channels", "page", activeScope, pageNo, pageSize, keyword, channelType, accessMode, status],
    queryFn: () =>
      loadChannelPageData({
        scope: activeScope,
        pageNo,
        pageSize,
        total: getTotalParam(),
        keyword: keyword.trim() || undefined,
        channelType: toChannelTypeFilter(channelType),
        authMode: toAuthModeFilter(accessMode),
        status: toChannelStatusFilter(status),
      }),
  });

  useEffect(() => {
    rememberTotal(pageQuery.data?.page.total);
  }, [pageQuery.data?.page.total, rememberTotal]);

  const applyFilters = () => {
    setKeyword(keywordInput.trim());
    resetPage();
  };

  useEffect(() => {
    if (!pageQuery.error) {
      return;
    }
    notify.error("加载失败", { description: resolveModelHubErrorMessage(pageQuery.error, "渠道列表加载失败") });
  }, [pageQuery.error]);

  const channelItems = pageQuery.data?.channels ?? [];
  const total = pageQuery.data?.page.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const providerOptions = editorProviders;
  const modelCatalog = editorModelCatalog;
  const sceneOptions = pageQuery.data?.scenes ?? [];
  const protocolOptions = pageQuery.data?.protocols ?? [];

  const currentChannel = useMemo(
    () => channelItems.find((item) => item.id === editingId) ?? null,
    [channelItems, editingId],
  );

  const ensureEditorCatalog = async () => {
    if (editorProviders.length > 0 && editorModelCatalog.length > 0) {
      return {
        providers: editorProviders,
        modelCatalog: editorModelCatalog,
      };
    }
    const catalog = await loadChannelEditorCatalog();
    setEditorProviders(catalog.providers);
    setEditorModelCatalog(catalog.modelCatalog);
    return catalog;
  };

  const openCreate = async () => {
    setEditingId("");
    setDetailLoading(true);
    try {
      await ensureEditorCatalog();
      setEditorInitialValue(null);
      setEditorQuotaSummary(null);
      setView("create");
    } catch (error) {
      notify.error("加载失败", { description: resolveModelHubErrorMessage(error, "渠道编辑目录加载失败") });
    } finally {
      setDetailLoading(false);
    }
  };

  const openEdit = async (id: string) => {
    setEditingId(id);
    setDetailLoading(true);
    try {
      const catalog = await ensureEditorCatalog();
      const detail = await loadChannelDetail(id, catalog.providers, catalog.modelCatalog);
      setEditorInitialValue(detail.editorValue);
      setEditorQuotaSummary(detail.quotaSummary);
      setView("edit");
    } catch (error) {
      notify.error("加载失败", { description: resolveModelHubErrorMessage(error, "渠道详情加载失败") });
    } finally {
      setDetailLoading(false);
    }
  };

  const openQuota = async (id: string) => {
    setEditingId(id);
    setDetailLoading(true);
    try {
      const detail = await loadChannelQuotaDetail(id);
      setQuotaSummary(detail.quotaSummary);
      setQuotaEntries(detail.ledgers);
      setView("quota");
    } catch (error) {
      notify.error("加载失败", { description: resolveModelHubErrorMessage(error, "额度台账加载失败") });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async (value: ChannelEditorValue) => {
    setSaving(true);
    try {
      const catalog = await ensureEditorCatalog();
      await saveChannel(view, value, catalog.modelCatalog);
      notify.success(view === "create" ? "创建成功" : "保存成功");
      await pageQuery.refetch();
      setView("list");
      setEditingId("");
      setEditorInitialValue(null);
      setEditorQuotaSummary(null);
    } catch (error) {
      notify.error("保存失败", { description: resolveModelHubErrorMessage(error, "渠道保存失败") });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateQuotaEntry = async (entry: ChannelQuotaAdjustmentValue) => {
    if (!editingId) {
      return;
    }
    setQuotaSaving(true);
    try {
      await createChannelQuotaAdjustment(editingId, entry);
      notify.success("额度调整成功");
      const detail = await loadChannelQuotaDetail(editingId);
      setQuotaSummary(detail.quotaSummary);
      setQuotaEntries(detail.ledgers);
      await pageQuery.refetch();
    } catch (error) {
      notify.error("提交失败", { description: resolveModelHubErrorMessage(error, "额度台账写入失败") });
    } finally {
      setQuotaSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const currentChannel = channelItems.find((item) => item.id === id);
    if (!currentChannel) {
      return;
    }
    if (!window.confirm(`确认删除渠道“${currentChannel.displayName}”吗？`)) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteModelHubChannel(id);
      notify.success("删除成功");
      await pageQuery.refetch();
    } catch (error) {
      notify.error("删除失败", { description: resolveModelHubErrorMessage(error, "渠道删除失败") });
    } finally {
      setDeletingId("");
    }
  };

  if (view === "quota" && currentChannel) {
    return (
      <ModelHubChannelQuotaEntriesPage
        channel={currentChannel}
        quotaSummary={quotaSummary}
        entries={quotaEntries}
        saving={quotaSaving}
        onBack={() => {
          setView("list");
        }}
        onCreateEntry={handleCreateQuotaEntry}
      />
    );
  }

  if (view === "create" || view === "edit") {
    if (view === "edit" && detailLoading) {
      return (
        <PageShell>
          <div className="py-16 text-center text-sm text-muted-foreground">正在加载渠道详情...</div>
        </PageShell>
      );
    }

    return (
      <ModelHubChannelEditorPage
        mode={view}
        initialValue={editorInitialValue}
        initialScope={view === "edit" && editorInitialValue ? editorInitialValue : activeScope}
        providerOptions={providerOptions}
        modelCatalog={modelCatalog}
        scenes={sceneOptions}
        protocols={protocolOptions}
        quotaSummary={editorQuotaSummary}
        saving={saving}
        onCancel={() => {
          setView("list");
          setEditingId("");
          setEditorInitialValue(null);
          setEditorQuotaSummary(null);
        }}
        onOpenQuota={view === "edit" ? () => void openQuota(editingId) : undefined}
        onSuccess={(value) => {
          void handleSave(value);
        }}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="渠道管理"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => {
              void pageQuery.refetch();
            }} disabled={pageQuery.isFetching || saving}>
              <RefreshCw className="w-4 h-4" />
              {pageQuery.isFetching ? "刷新中..." : "刷新"}
            </Button>
            <Button variant="pageOutline" onClick={() => setProtocolCatalogOpen(true)} disabled={pageQuery.isLoading}>
              接入协议
            </Button>
            <Button variant="page" onClick={() => void openCreate()} disabled={pageQuery.isLoading || detailLoading}>新增渠道</Button>
          </>
        }
      />

      <PageFilterBar>
          <GovernanceOrgFilters
            choice={scopeChoice}
            onScopeChange={resetPage}
          />

          <div className="flex items-center gap-2">
            <Select value={channelType} onValueChange={(value) => {
              setChannelType(value);
              resetPage();
            }}>
              <SelectTrigger className="subpage-native-select w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                <SelectItem className="subpage-select-item" value="all">全部</SelectItem>
                <SelectItem className="subpage-select-item" value="厂商直连">厂商直连</SelectItem>
                <SelectItem className="subpage-select-item" value="聚合平台">聚合平台</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Select value={accessMode} onValueChange={(value) => {
              setAccessMode(value);
              resetPage();
            }}>
              <SelectTrigger className="subpage-native-select w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                <SelectItem className="subpage-select-item" value="all">全部</SelectItem>
                <SelectItem className="subpage-select-item" value="平台共享">平台共享</SelectItem>
                <SelectItem className="subpage-select-item" value="商户 BYOK">商户 BYOK</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={(value) => {
              setStatus(value);
              resetPage();
            }}>
              <SelectTrigger className="subpage-native-select w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                <SelectItem className="subpage-select-item" value="all">全部</SelectItem>
                <SelectItem className="subpage-select-item" value="启用">启用</SelectItem>
                <SelectItem className="subpage-select-item" value="停用">停用</SelectItem>
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
            placeholder="搜索渠道名称  / 编号"
          />
          <Button variant="pageOutline" onClick={applyFilters} disabled={pageQuery.isFetching}>
            搜索
          </Button>
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">渠道名称</TableHead>
              <TableHead className="w-[120px]">作用域</TableHead>
              <TableHead className="w-[200px]">接入信息</TableHead>
              <TableHead className="min-w-[300px]">配置模型</TableHead>
              <TableHead className="w-[90px]">账户余额</TableHead>
              <TableHead className="w-[90px]">健康状态</TableHead>
              <TableHead className="w-[90px]">启用状态</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className="w-52">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageQuery.isLoading || detailLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  正在加载渠道...
                </TableCell>
              </TableRow>
            ) : channelItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  暂无符合条件的渠道
                </TableCell>
              </TableRow>
            ) : (
              channelItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 rounded-xl border border-border/60">
                        <AvatarImage src={item.iconUrl || undefined} alt={item.displayName} className="object-cover" />
                        <AvatarFallback className="text-[11px] font-medium">
                          {(item.displayName || "MH").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1 min-w-0">
                        <div className="font-medium text-foreground truncate">{item.displayName}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{item.channelCode}</div>
                      </div>
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
                          {item.merchantId ? (item.storeId ? "门店渠道" : "商户渠道") : "平台渠道"}
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
                    <div className="flex max-w-[240px] flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className="border-sky-200 bg-sky-50 text-[12px] font-normal text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300"
                      >
                        {getChannelTypeLabel(item.channelType)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-violet-200 bg-violet-50 text-[12px] font-normal text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300"
                      >
                        {getAuthModeLabel(item.authMode)}
                      </Badge>
                      {item.sceneChips.length === 0 ? (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-[12px] font-normal text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                        >
                          未配置场景
                        </Badge>
                      ) : (
                        item.sceneChips.map((chip) => (
                          <Badge
                            key={`${chip.sceneCode}:${chip.protocolCode}`}
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-[12px] font-normal text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                          >
                            {chip.sceneLabel} / {chip.protocolLabel}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-[320px] flex-wrap items-center gap-y-1 text-[11px] text-foreground">
                      {item.supportedModels.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground">-</span>
                      ) : (
                        item.supportedModels.slice(0, 10).map((model, index, visibleModels) => (
                          <div key={model.id} className="inline-flex max-w-full items-center">
                            <div className="inline-flex max-w-full items-center gap-1.5">
                              <Avatar className="h-4 w-4 shrink-0 rounded-full">
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
                    <div className="space-y-2">
                      <div className="font-medium text-foreground">{formatChannelQuotaSummaryValue(item.quotaSummary)}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={healthStateTone(item.healthState)}>
                      {getHealthStateLabel(item.healthState)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={item.status === "enabled" ? "success" : "neutral"}>
                      {getChannelStatusLabel(item.status)}
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
                          void openEdit(item.id);
                        }}
                        disabled={deletingId === item.id}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary"
                        title="额度台账"
                        aria-label="额度台账"
                        onClick={() => {
                          void openQuota(item.id);
                        }}
                        disabled={deletingId === item.id}
                      >
                        <Wallet className="h-4 w-4" />
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
        disabled={pageQuery.isFetching}
      />
      <ChannelProtocolCatalogDialog
        open={protocolCatalogOpen}
        onOpenChange={setProtocolCatalogOpen}
        onChanged={() => {
          void pageQuery.refetch();
        }}
      />
    </PageShell>
  );
}
