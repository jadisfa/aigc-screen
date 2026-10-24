import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { notify } from "@/shared/lib/notify";
import ModelHubModelEditorPage from "@/modules/modelhub/components/ModelHubModelEditorPage";
import ModelHubVendorManagerPage from "@/modules/modelhub/components/ModelHubVendorManagerPage";
import {
  type CapabilityFilterValue,
} from "@/modules/modelhub/types/modelCapabilityMetadata";
import {
  deriveModelCapabilitySnapshot,
} from "@/modules/modelhub/types/capabilityRegistryFactory";
import {
  loadBaseModelListPageData,
  loadBaseModelVendorPageData,
  type BaseModelListItem,
  type BaseModelProviderItem,
} from "@/modules/modelhub/services/base-models";
import { resolveModelHubErrorMessage } from "@/modules/modelhub/services/modelhubAdminUi";
import { saveProvider, deleteProvider } from "@/modules/modelhub/services/providers";
import { deleteModelHubBaseModel } from "@/shared/api/model-hub/model-hub";
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
import { getDisplayFallback } from "@/shared/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

function toCapabilityDomainFilter(value: CapabilityFilterValue | "all"): string | undefined {
  if (value === "all") return undefined;
  if (value === "语言模型") return "language";
  if (value === "视觉模型") return "vision";
  if (value === "3D模型") return "three_d";
  if (value === "语音模型") return "speech";
  if (value === "向量模型") return "vector";
  if (value === "多模态模型") return "multimodal";
  return undefined;
}

export default function ModelHubModelsPage() {
  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, invalidateTotal, changePageSize, rememberTotal } =
    usePagedListQuery();
  const [view, setView] = useState<"list" | "create" | "edit" | "providers">("list");
  const [editingId, setEditingId] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [capability, setCapability] = useState<CapabilityFilterValue | "all">("all");
  const [vendorProviders, setVendorProviders] = useState<BaseModelProviderItem[]>([]);
  const [vendorModels, setVendorModels] = useState<BaseModelListItem[]>([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const listQuery = useQuery({
    queryKey: ["modelhub", "base-models", pageNo, pageSize, keyword, capability],
    queryFn: () =>
      loadBaseModelListPageData({
        pageNo,
        pageSize,
        total: getTotalParam(),
        keyword: keyword.trim() || undefined,
        capabilityDomain: toCapabilityDomainFilter(capability),
      }),
    enabled: view === "list" || view === "create" || view === "edit",
  });

  useEffect(() => {
    rememberTotal(listQuery.data?.page.total);
  }, [listQuery.data?.page.total, rememberTotal]);

  useEffect(() => {
    if (!listQuery.error) {
      return;
    }
    notify.error(resolveModelHubErrorMessage(listQuery.error, "基础模型列表加载失败"));
  }, [listQuery.error]);

  const providers = listQuery.data?.providers ?? [];
  const modelItems = listQuery.data?.models ?? [];
  const total = listQuery.data?.page.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const pageLoading = listQuery.isFetching;

  const applyFilters = () => {
    setKeyword(keywordInput.trim());
    resetPage();
  };

  const reloadList = useCallback(async () => {
    invalidateTotal();
    await listQuery.refetch();
  }, [invalidateTotal, listQuery]);

  const loadVendorData = useCallback(async () => {
    setVendorLoading(true);
    try {
      const data = await loadBaseModelVendorPageData();
      setVendorProviders(data.providers);
      setVendorModels(data.models);
    } catch (error) {
      notify.error(resolveModelHubErrorMessage(error, "厂商数据加载失败"));
    } finally {
      setVendorLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "providers") {
      void loadVendorData();
    }
  }, [loadVendorData, view]);

  const providerMap = useMemo(
    () =>
      providers.reduce<Record<string, BaseModelProviderItem>>((accumulator, item) => {
        accumulator[item.id] = item;
        return accumulator;
      }, {}),
    [providers],
  );

  const vendorListItems = useMemo(
    () =>
      vendorProviders.map((item) => ({
        ...item,
        modelCount: vendorModels.filter((model) => model.providerId === item.id).length,
      })),
    [vendorModels, vendorProviders],
  );

  const providerOptions = useMemo(
    () =>
      providers.map((item) => ({
        id: item.id,
        name: item.name,
        logoUrl: item.logoUrl,
        officialName: item.officialName,
      })),
    [providers],
  );

  const closeEditor = () => {
    setView("list");
    setEditingId("");
  };

  const handleDelete = async (id: string) => {
    const currentModel = modelItems.find((item) => item.id === id);
    if (!currentModel) {
      return;
    }
    if (!window.confirm(`确认删除基础模型“${currentModel.name}”吗？`)) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteModelHubBaseModel(id);
      notify.success("删除成功");
      await reloadList();
    } catch (error) {
      notify.error(resolveModelHubErrorMessage(error, "基础模型删除失败"));
    } finally {
      setDeletingId("");
    }
  };

  const openCreate = () => {
    setEditingId("");
    setView("create");
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setView("edit");
  };

  const handleEditorSuccess = async () => {
    try {
      await reloadList();
      closeEditor();
    } catch (error) {
      notify.error(resolveModelHubErrorMessage(error, "基础模型列表加载失败"));
    }
  };

  if (view === "providers") {
    return (
      <ModelHubVendorManagerPage
        items={vendorListItems}
        onBack={() => setView("list")}
        onSave={async (value) => {
          try {
            await saveProvider(value);
            notify.success(value.id ? "保存成功" : "创建成功");
            await reloadList();
            await loadVendorData();
          } catch (error) {
            notify.error(resolveModelHubErrorMessage(error, value.id ? "厂商更新失败" : "厂商创建失败"));
            throw error;
          }
        }}
        onDelete={async (id) => {
          try {
            await deleteProvider(id);
            notify.success("删除成功");
            await reloadList();
            await loadVendorData();
          } catch (error) {
            notify.error(resolveModelHubErrorMessage(error, "厂商删除失败"));
            throw error;
          }
        }}
      />
    );
  }

  if (view === "create" || view === "edit") {
    return (
      <ModelHubModelEditorPage
        mode={view}
        editingId={view === "edit" ? editingId : undefined}
        onCancel={closeEditor}
        onSuccess={() => {
          void handleEditorSuccess();
        }}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="基础模型"
        actions={
          <>
            <Button
              variant="pageOutline"
              disabled={pageLoading}
              onClick={() => {
                setKeywordInput("");
                const filtersChanged = keyword !== "" || capability !== "all";
                setKeyword("");
                setCapability("all");
                if (filtersChanged) {
                  resetPage();
                } else if (pageNo !== 1) {
                  setPageNo(1);
                }
                void listQuery.refetch();
              }}
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
            <Button variant="pageOutline" onClick={() => setView("providers")} disabled={vendorLoading}>
              厂商配置
            </Button>
            <Button variant="page" disabled={providerOptions.length === 0} onClick={openCreate}>
              新增基础模型
            </Button>
          </>
        }
      />

      <PageFilterBar>
        <div className="flex items-center gap-2">
          <Select value={capability} onValueChange={(value) => {
            setCapability(value as CapabilityFilterValue | "all");
            resetPage();
          }}>
            <SelectTrigger className="subpage-native-select w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value="all">模型类型</SelectItem>
              <SelectItem className="subpage-select-item" value="语言模型">语言模型</SelectItem>
              <SelectItem className="subpage-select-item" value="视觉模型">视觉模型</SelectItem>
              <SelectItem className="subpage-select-item" value="3D模型">3D模型</SelectItem>
              <SelectItem className="subpage-select-item" value="多模态模型">多模态模型</SelectItem>
              <SelectItem className="subpage-select-item" value="向量模型">向量模型</SelectItem>
              <SelectItem className="subpage-select-item" value="语音模型">语音模型</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <SearchField
          wrapClassName="!max-w-[520px] shrink-0"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              applyFilters();
            }
          }}
          placeholder="搜索模型名/编号/厂商"
        />
        <Button variant="pageOutline" onClick={applyFilters} disabled={pageLoading}>
          搜索
        </Button>
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead>模型信息</TableHead>
              <TableHead>模型厂商</TableHead>
              <TableHead>能力</TableHead>
              <TableHead>计费摘要</TableHead>
              <TableHead>上下文窗口</TableHead>
              <TableHead>关联模型池</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className="w-32">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                  正在加载基础模型...
                </TableCell>
              </TableRow>
            ) : modelItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                  暂无符合条件的基础模型
                </TableCell>
              </TableRow>
            ) : (
              modelItems.map((item) => {
                const capabilitySnapshot = deriveModelCapabilitySnapshot(
                  item.capabilities,
                  item.capabilityConfigs,
                );
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">{item.name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{item.code}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 rounded-md border border-border/70">
                          <AvatarImage src={providerMap[item.providerId]?.logoUrl || undefined} alt={providerMap[item.providerId]?.name || item.providerId} className="object-cover" />
                          <AvatarFallback className="rounded-md bg-primary/10 text-primary text-xs font-medium">
                            {getDisplayFallback(providerMap[item.providerId]?.name || item.providerId)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">{providerMap[item.providerId]?.name || "-"}</div>
                          <div className="text-[11px] text-muted-foreground">{providerMap[item.providerId]?.officialName || "未配置厂商编码"}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={capabilitySnapshot.capabilities.length === 0 ? "text-muted-foreground" : "text-foreground"}>
                        {capabilitySnapshot.capabilitySummary}
                      </div>
                    </TableCell>
                    <TableCell>{capabilitySnapshot.pricingSummary}</TableCell>
                    <TableCell>{item.contextWindow || "-"}</TableCell>
                    <TableCell>{item.pools}</TableCell>
                    <TableCell>
                      <StatusBadge tone={item.status === "启用" ? "success" : "neutral"}>{item.status}</StatusBadge>
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
                            openEdit(item.id);
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
        canNextPage={pageNo < totalPages}
        onPageNoChange={setPageNo}
        onPageSizeChange={changePageSize}
        disabled={pageLoading}
      />
    </PageShell>
  );
}
