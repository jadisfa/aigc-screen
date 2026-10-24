import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { usePersistedViewMode } from "@/shared/hooks/use-persisted-view-mode";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, Eye, EyeOff, FileText, Fingerprint, Images, LayoutGrid, List, Play, RefreshCw, Trash2 } from "lucide-react";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
} from "@/shared/components/page";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { formatDateTime } from "@/shared/lib/datetime";
import { formatOwnerLabel } from "@/shared/lib/owner-display";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import MaterialAuditDialog from "@/modules/materials/components/MaterialAuditDialog";
import { ImageViewerDialog } from "@/modules/workflow/components/preview/ImageViewerDialog";
import { MaterialMediaPreviewDialog } from "@/modules/materials/components/MaterialMediaPreviewDialog";
import { DatePicker } from "@/shared/components/DatePicker";
import {
  auditWorkMaterial,
  deleteWorkMaterial,
  listWorkMaterials,
  publishWorkMaterial,
  type WorkMaterialSummary,
} from "@/shared/api/materials/materials-work";
import { UserSelect } from "@/shared/components/UserSelect";
import WorkMaterialVerifyDialog from "@/modules/materials/components/WorkMaterialVerifyDialog";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import {
  materialAuditBadgeVariant,
  materialAuditLabel,
  materialPublishBadgeVariant,
  materialPublishLabel,
  type MaterialAuditFilter,
  type MaterialPublishFilter,
  type MaterialPublishStatus,
} from "@/modules/materials/lib/material-governance";
import {
  firstItemUrl,
  parseWorkItems,
  resolveWorkPreviewUrl,
  type WorkGeneratedItem,
} from "@/modules/materials/lib/work-material-items";
import { WorkMaterialListTable } from "@/modules/materials/components/WorkMaterialListTable";
import { notify } from "@/shared/lib/notify";

export default function WorkMaterialsManagementPage() {
  const queryClient = useQueryClient();

  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, invalidateTotal, changePageSize, rememberTotal } =
    usePagedListQuery(48);

  const [workType, setWorkType] = useState<"all" | "image" | "video" | "copywriting">("all");
  const [auditStatus, setAuditStatus] = useState<MaterialAuditFilter>("all");
  const [publishStatus, setPublishStatus] = useState<MaterialPublishFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [ownerPrincipalId, setOwnerPrincipalId] = useState("");
  const [createdAtStart, setCreatedAtStart] = useState("");
  const [createdAtEnd, setCreatedAtEnd] = useState("");
  const [viewMode, setViewMode] = usePersistedViewMode("work_materials", "card");

  const applyKeywordSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
    resetPage();
  };

  const listQuery = useQuery({
    queryKey: ["materialsWork", pageNo, pageSize, workType, auditStatus, publishStatus, appliedKeyword, ownerPrincipalId, createdAtStart, createdAtEnd],
    queryFn: () =>
      listWorkMaterials({
        pageNo,
        pageSize,
        total: getTotalParam(),
        workType: workType === "all" ? undefined : workType,
        auditStatus: auditStatus === "all" ? undefined : auditStatus,
        publishStatus: publishStatus === "all" ? undefined : publishStatus,
        keyword: appliedKeyword.trim() ? appliedKeyword.trim() : undefined,
        ownerPrincipalId: ownerPrincipalId || undefined,
        createdAtStart: createdAtStart ? `${createdAtStart} 00:00:00` : undefined,
        createdAtEnd: createdAtEnd ? `${createdAtEnd} 23:59:59` : undefined,
        includeTaskExecutionInfo: true,
      }),
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    rememberTotal(listQuery.data?.page?.total);
  }, [listQuery.data?.page?.total, rememberTotal]);

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const total = listQuery.data?.page?.total ?? 0;
  const totalPages = useMemo(() => {
    if (total <= 0) return 0;
    return Math.ceil(total / pageSize);
  }, [pageSize, total]);

  useEffect(() => {
    if (listQuery.isFetching && !listQuery.data) {
      return;
    }
    if (totalPages === 0) {
      if (pageNo !== 1) setPageNo(1);
      return;
    }
    if (pageNo > totalPages) setPageNo(totalPages);
  }, [listQuery.data, listQuery.isFetching, pageNo, totalPages]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["materialsWork"] });
  };

  const auditMutation = useMutation({
    mutationFn: (p: { id: string; status: "approved" | "rejected"; reason?: string }) => auditWorkMaterial(p.id, { status: p.status, reason: p.reason }),
    onSuccess: async (_data, p) => {
      notify.success(p.status === "approved" ? "审核成功" : "已驳回");
      await refresh();
    },
    onError: (e) => {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (p: { id: string; status: MaterialPublishStatus }) => publishWorkMaterial(p.id, p.status),
    onSuccess: async (_data, p) => {
      notify.success(p.status === "online" ? "上架成功" : "下线成功");
      await refresh();
    },
    onError: (e) => {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => Promise.all(ids.map((id) => deleteWorkMaterial(id))),
    onSuccess: async () => {
      notify.success("删除成功");
      invalidateTotal();
      await refresh();
      resetBatchSelection();
    },
    onError: (e) => {
      notify.error("删除失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  type BatchActionMode = "audit" | "publishOnline" | "publishOffline" | "delete" | null;
  const [batchActionMode, setBatchActionMode] = useState<BatchActionMode>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const selectedList = useMemo(() => Object.keys(selectedIds).filter((id) => selectedIds[id]), [selectedIds]);
  const selectedCount = selectedList.length;
  const selectingBatch = batchActionMode != null;

  const resetBatchSelection = () => {
    setBatchActionMode(null);
    setSelectedIds({});
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => ({ ...prev, [id]: checked }));
  };

  const allVisibleSelected = items.length > 0 && items.every((item) => selectedIds[item.id]);
  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds({});
      return;
    }
    setSelectedIds(Object.fromEntries(items.map((item) => [item.id, true])));
  };

  useEffect(() => {
    const visibleIds = new Set(items.map((item) => item.id));
    setSelectedIds((prev) => {
      const next = Object.fromEntries(Object.entries(prev).filter(([id, checked]) => checked && visibleIds.has(id)));
      const prevCheckedIds = Object.keys(prev).filter((id) => prev[id]);
      const nextCheckedIds = Object.keys(next);
      if (prevCheckedIds.length === nextCheckedIds.length && prevCheckedIds.every((id) => next[id])) return prev;
      return next;
    });
  }, [items]);

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditTarget, setAuditTarget] = useState<WorkMaterialSummary | null>(null);
  const [auditDecision, setAuditDecision] = useState<"approved" | "rejected">("approved");
  const [auditReason, setAuditReason] = useState("");
  const [batchAuditIds, setBatchAuditIds] = useState<string[]>([]);

  const openAudit = (row: WorkMaterialSummary) => {
    setAuditTarget(row);
    setBatchAuditIds([row.id]);
    setAuditDecision("approved");
    setAuditReason("");
    setAuditOpen(true);
  };

  const openBatchAudit = () => {
    setBatchAuditIds(selectedList);
    setAuditTarget(null);
    setAuditDecision("approved");
    setAuditReason("");
    setAuditOpen(true);
  };

  const batchAuditMutation = useMutation({
    mutationFn: async (p: { ids: string[]; status: "approved" | "rejected"; reason?: string }) => {
      await Promise.all(p.ids.map((id) => auditWorkMaterial(id, { status: p.status, reason: p.reason })));
    },
    onSuccess: async (_data, p) => {
      notify.success(p.status === "approved" ? "审核成功" : "已驳回");
      await refresh();
      resetBatchSelection();
    },
    onError: (e) => {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const submitAudit = () => {
    if (batchAuditIds.length === 0) return;
    const reason = auditReason.trim() ? auditReason.trim() : undefined;
    if (batchAuditIds.length === 1 && auditTarget) {
      auditMutation.mutate({ id: auditTarget.id, status: auditDecision, reason });
    } else {
      batchAuditMutation.mutate({ ids: batchAuditIds, status: auditDecision, reason });
    }
    setAuditOpen(false);
  };

  const batchPublishMutation = useMutation({
    mutationFn: async (payload: { ids: string[]; status: MaterialPublishStatus }) => {
      await Promise.all(payload.ids.map((id) => publishWorkMaterial(id, payload.status)));
    },
    onSuccess: async (_data, payload) => {
      notify.success(payload.status === "online" ? "上架成功" : "下线成功");
      await refresh();
      resetBatchSelection();
    },
    onError: (e) => {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const runBatchPublish = (status: MaterialPublishStatus) => {
    if (selectedList.length === 0) return;
    if (status === "online") {
      const invalidCount = items.filter((item) => selectedIds[item.id] && item.auditStatus !== "approved").length;
      if (invalidCount > 0) {
        notify.error("操作失败", { description: "所选作品中包含未审核通过项，无法批量上架" });
        return;
      }
    }
    batchPublishMutation.mutate({ ids: selectedList, status });
  };

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const openDelete = (ids: string[]) => {
    setDeleteIds(ids);
    setDeleteOpen(true);
  };

  const [verifyOpen, setVerifyOpen] = useState(false);

  const confirmDelete = () => {
    if (deleteIds.length === 0) return;
    deleteMutation.mutate(deleteIds);
    setDeleteOpen(false);
  };

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewGallery, setPreviewGallery] = useState<{ src: string }[]>([]);
  const [previewVideo, setPreviewVideo] = useState<{ url: string; title?: string } | null>(null);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTarget, setGalleryTarget] = useState<WorkMaterialSummary | null>(null);
  const openGallery = (row: WorkMaterialSummary) => {
    setGalleryTarget(row);
    setGalleryOpen(true);
  };

  const galleryItems = useMemo(() => parseWorkItems(galleryTarget?.itemsJson), [galleryTarget?.itemsJson]);

  const pageFrom = useMemo(() => {
    if (total === 0) return 0;
    return (pageNo - 1) * pageSize + 1;
  }, [pageNo, pageSize, total]);

  const pageTo = useMemo(() => {
    if (total === 0) return 0;
    return Math.min(pageNo * pageSize, total);
  }, [pageNo, pageSize, total]);

  const canNextPage = useMemo(() => {
    if (total <= 0) return false;
    return pageNo * pageSize < total;
  }, [pageNo, pageSize, total]);

  return (
    <PageShell className={viewMode === "list" ? "flex flex-col overflow-hidden" : undefined}>
      <PageHeader
        className={viewMode === "list" ? "shrink-0" : undefined}
        title="作品管理"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => refresh()} disabled={listQuery.isFetching}>
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
            <Button
              variant="pageOutline"
              onClick={() => {
                if (batchActionMode !== "audit") {
                  setBatchActionMode("audit");
                  setSelectedIds({});
                  return;
                }
                if (selectedCount === 0) return;
                openBatchAudit();
              }}
              disabled={auditMutation.isPending || batchAuditMutation.isPending || (batchActionMode !== "audit" && items.length === 0)}
            >
              <CheckCircle2 className="w-4 h-4" />
              {batchActionMode !== "audit" ? "批量审核" : selectedCount > 0 ? `审核(${selectedCount})` : "请选择"}
            </Button>
            <Button
              variant="pageOutline"
              onClick={() => {
                if (batchActionMode !== "publishOnline") {
                  setBatchActionMode("publishOnline");
                  setSelectedIds({});
                  return;
                }
                if (selectedCount === 0) return;
                runBatchPublish("online");
              }}
              disabled={publishMutation.isPending || batchPublishMutation.isPending || (batchActionMode !== "publishOnline" && items.length === 0)}
            >
              <Eye className="w-4 h-4" />
              {batchActionMode !== "publishOnline" ? "批量上架" : selectedCount > 0 ? `上架(${selectedCount})` : "请选择"}
            </Button>
            <Button
              variant="pageOutline"
              onClick={() => {
                if (batchActionMode !== "publishOffline") {
                  setBatchActionMode("publishOffline");
                  setSelectedIds({});
                  return;
                }
                if (selectedCount === 0) return;
                runBatchPublish("offline");
              }}
              disabled={publishMutation.isPending || batchPublishMutation.isPending || (batchActionMode !== "publishOffline" && items.length === 0)}
            >
              <EyeOff className="w-4 h-4" />
              {batchActionMode !== "publishOffline" ? "批量下架" : selectedCount > 0 ? `下架(${selectedCount})` : "请选择"}
            </Button>
            <Button variant="pageOutline" onClick={() => setVerifyOpen(true)}>
              <Fingerprint className="w-4 h-4" />
              验签
            </Button>
            <Button
              variant="pageOutline"
              className="!border-destructive !text-destructive hover:!bg-destructive/10"
              onClick={() => {
                if (batchActionMode !== "delete") {
                  setBatchActionMode("delete");
                  setSelectedIds({});
                  return;
                }
                if (selectedCount === 0) return;
                openDelete(selectedList);
              }}
              disabled={deleteMutation.isPending || (batchActionMode !== "delete" && items.length === 0)}
            >
              <Trash2 className="w-4 h-4" />
              {batchActionMode !== "delete" ? "批量删除" : selectedCount > 0 ? `删除(${selectedCount})` : "请选择"}
            </Button>
            {selectingBatch && (
              <>
                <Button
                  variant="pageOutline"
                  onClick={toggleSelectAllVisible}
                  disabled={
                    items.length === 0 ||
                    deleteMutation.isPending ||
                    auditMutation.isPending ||
                    batchAuditMutation.isPending ||
                    publishMutation.isPending ||
                    batchPublishMutation.isPending
                  }
                >
                  {allVisibleSelected ? "取消全选" : "全选"}
                </Button>
                <Button
                  variant="pageOutline"
                  onClick={resetBatchSelection}
                  disabled={
                    deleteMutation.isPending ||
                    auditMutation.isPending ||
                    batchAuditMutation.isPending ||
                    publishMutation.isPending ||
                    batchPublishMutation.isPending
                  }
                >
                  取消
                </Button>
              </>
            )}
          </>
        }
      />

      <PageFilterBar
        className={`flex-wrap${viewMode === "list" ? " shrink-0" : ""}`}
        end={
          <div className="flex flex-col items-center gap-0.5">
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => {
                if (v === "card" || v === "list") setViewMode(v);
              }}
              variant="outline"
              size="sm"
              className="bg-background"
            >
              <ToggleGroupItem value="card" aria-label="卡片" title="卡片" className="h-8 w-8 px-0">
                <LayoutGrid className="w-4 h-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="列表" title="列表" className="h-8 w-8 px-0">
                <List className="w-4 h-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        }
      >
        <Select
          value={workType}
          onValueChange={(v) => {
            setWorkType(v as "all" | "image" | "video" | "copywriting");
            resetPage();
          }}
        >
          <SelectTrigger className="subpage-native-select w-[160px]">
            <SelectValue placeholder="作品类型"/>
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value="all">
              作品类型: 全部
            </SelectItem>
            <SelectItem className="subpage-select-item" value="image">
              图片
            </SelectItem>
            <SelectItem className="subpage-select-item" value="video">
              视频
            </SelectItem>
            <SelectItem className="subpage-select-item" value="copywriting">
              文案
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={auditStatus}
          onValueChange={(v) => {
            setAuditStatus(v as MaterialAuditFilter);
            resetPage();
          }}
        >
          <SelectTrigger className="subpage-native-select w-[160px]">
            <SelectValue placeholder="审核状态"/>
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value="all">
              审核状态: 全部
            </SelectItem>
            <SelectItem className="subpage-select-item" value="pending">
              待审核
            </SelectItem>
            <SelectItem className="subpage-select-item" value="approved">
              已通过
            </SelectItem>
            <SelectItem className="subpage-select-item" value="rejected">
              已拒绝
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={publishStatus}
          onValueChange={(v) => {
            setPublishStatus(v as MaterialPublishFilter);
            resetPage();
          }}
        >
          <SelectTrigger className="subpage-native-select w-[160px]">
            <SelectValue placeholder="发布状态"/>
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value="all">
              发布状态: 全部
            </SelectItem>
            <SelectItem className="subpage-select-item" value="offline">
              下架
            </SelectItem>
            <SelectItem className="subpage-select-item" value="online">
              上架
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <DatePicker
            value={createdAtStart}
            onChange={(val) => {
              setCreatedAtStart(val);
              resetPage();
            }}
            placeholder="开始时间"
            className="w-[150px] h-9 bg-background"
          />
          <span className="text-muted-foreground">-</span>
          <DatePicker
            value={createdAtEnd}
            onChange={(val) => {
              setCreatedAtEnd(val);
              resetPage();
            }}
            placeholder="结束时间"
            className="w-[150px] h-9 bg-background"
          />
        </div>

        <UserSelect
          value={ownerPrincipalId}
          onChange={(val) => {
            setOwnerPrincipalId(val);
            resetPage();
          }}
          className="w-[160px] h-9 bg-background"
          placeholder="所属用户"
        />

        <SearchField
          wrapClassName="!max-w-[280px]"
          placeholder="文件名/参数，回车搜索"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyKeywordSearch();
            }
          }}
        />
      </PageFilterBar>

      {viewMode === "card" ? (
        <div className="grid [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] gap-5 max-[768px]:grid-cols-1">
          {items.map((row) => (
            <WorkMaterialCard
              key={row.id}
              item={row}
              onAudit={() => openAudit(row)}
              onTogglePublish={() => publishMutation.mutate({ id: row.id, status: row.publishStatus === "online" ? "offline" : "online" })}
              onDelete={() => openDelete([row.id])}
              onViewGallery={() => openGallery(row)}
              onViewImage={(url) => {
                setPreviewGallery([{ src: url }]);
                setPreviewImageUrl(url);
              }}
              onViewVideo={(url) => setPreviewVideo({ url, title: formatOwnerLabel(row) === "-" ? row.id : formatOwnerLabel(row) })}
              selectable={selectingBatch}
              checked={!!selectedIds[row.id]}
              onCheckedChange={(checked) => toggleOne(row.id, checked)}
              disabledAudit={auditMutation.isPending || batchAuditMutation.isPending}
              disabledPublish={publishMutation.isPending || batchPublishMutation.isPending || row.auditStatus !== "approved"}
              disabledDelete={deleteMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <WorkMaterialListTable
            items={items}
            loading={listQuery.isLoading}
            selectable={selectingBatch}
            selectedIds={selectedIds}
            onCheckedChange={toggleOne}
            onAudit={openAudit}
            onTogglePublish={(row) => publishMutation.mutate({ id: row.id, status: row.publishStatus === "online" ? "offline" : "online" })}
            onDelete={(row) => openDelete([row.id])}
            onViewGallery={openGallery}
            onViewImage={(row, url) => {
              const images = parseWorkItems(row.itemsJson)
                .filter((item) => (item.kind === "image" || row.workType === "image") && !!item.url)
                .map((item) => ({ src: item.url as string }));
              setPreviewGallery(images.length > 0 ? images : [{ src: url }]);
              setPreviewImageUrl(url);
            }}
            onViewVideo={(row, url) => setPreviewVideo({ url, title: formatOwnerLabel(row) === "-" ? row.id : formatOwnerLabel(row) })}
            disabledAudit={auditMutation.isPending || batchAuditMutation.isPending}
            disabledPublish={(row) => publishMutation.isPending || batchPublishMutation.isPending || row.auditStatus !== "approved"}
            disabledDelete={deleteMutation.isPending}
          />
        </div>
      )}

      {!listQuery.isLoading && items.length === 0 && viewMode === "card" && (
        <div className="text-center py-20 text-muted-foreground">暂无作品</div>
      )}

      <CommonPaginationBar
        className={viewMode === "list" ? "shrink-0" : undefined}
        total={total || items.length}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={canNextPage}
        onPageNoChange={setPageNo}
        pageSizeOptions={[12, 24, 48]}
        showPageSizeSelect={true}
        onPageSizeChange={changePageSize}
      />

      <MaterialAuditDialog
        open={auditOpen}
        onOpenChange={(open) => {
          setAuditOpen(open);
          if (!open) {
            setAuditTarget(null);
            setBatchAuditIds([]);
          }
        }}
        title={batchAuditIds.length > 1 ? "批量审核作品" : "审核作品"}
        targetId={batchAuditIds.length > 1 ? `已选择 ${batchAuditIds.length} 项` : auditTarget?.id}
        decision={auditDecision}
        onDecisionChange={setAuditDecision}
        reason={auditReason}
        onReasonChange={setAuditReason}
        onSubmit={submitAudit}
        submitting={auditMutation.isPending || batchAuditMutation.isPending}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteIds([]);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteIds.length > 1 ? (
                <>
                  确定要删除已选择的 <span className="font-mono">{deleteIds.length}</span> 个作品吗？此操作不可撤销。
                </>
              ) : (
                <>
                  确定要删除作品「<span className="font-mono">{deleteIds[0] || "-"}</span>」吗？此操作不可撤销。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WorkMaterialVerifyDialog open={verifyOpen} onOpenChange={setVerifyOpen} />

      <Dialog
        open={galleryOpen}
        onOpenChange={(open) => {
          setGalleryOpen(open);
          if (!open) setGalleryTarget(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>生成内容详情</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {galleryItems.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">暂无生成内容</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {galleryItems.map((item, idx) => (
                  <div key={idx} className="rounded-lg overflow-hidden border bg-muted aspect-[4/3] flex items-center justify-center relative group">
                    {item.kind === "image" || galleryTarget?.workType === "image" ? (
                      <img
                        src={item.url || ""}
                        alt="生成图片"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        loading="lazy"
                        onClick={() => {
                          const images = galleryItems
                            .filter((g) => (g.kind === "image" || galleryTarget?.workType === "image") && !!g.url)
                            .map((g) => ({ src: g.url as string }));
                          setPreviewGallery(images);
                          setPreviewImageUrl(item.url || null);
                        }}
                      />
                    ) : item.kind === "video" || galleryTarget?.workType === "video" ? (
                      <video src={item.url || ""} className="w-full h-full object-cover" controls preload="metadata" />
                    ) : (
                      <div className="p-4 text-sm whitespace-pre-wrap overflow-y-auto w-full h-full break-all bg-card">
                        {item.url || item.text || JSON.stringify(item)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ImageViewerDialog
        previewImageUrl={previewImageUrl}
        gallery={previewGallery}
        onClose={() => {
          setPreviewImageUrl(null);
          setPreviewGallery([]);
        }}
      />
      <MaterialMediaPreviewDialog
        preview={previewVideo ? { type: "video", url: previewVideo.url, title: previewVideo.title } : null}
        onClose={() => setPreviewVideo(null)}
      />
    </PageShell>
  );
}

function WorkMaterialCard(props: {
  item: WorkMaterialSummary;
  onAudit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
  onViewGallery: () => void;
  onViewImage?: (url: string) => void;
  onViewVideo?: (url: string) => void;
  selectable: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabledAudit: boolean;
  disabledPublish: boolean;
  disabledDelete: boolean;
}) {
  const isVideo = props.item.workType === "video";
  const isImage = props.item.workType === "image";
  const isCopywriting = props.item.workType === "copywriting";

  const publishBtnLabel = props.item.publishStatus === "online" ? "下架" : "上架";

  const parsedItems = useMemo(() => parseWorkItems(props.item.itemsJson), [props.item.itemsJson]);
  const itemsCount = Array.isArray(parsedItems) ? parsedItems.length : 0;
  const videoUrl = isVideo ? firstItemUrl(parsedItems, "video") : "";
  const coverUrl = isVideo ? props.item.coverUrl?.trim() || "" : "";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null);
  const [slideDirection, setSlideDirection] = useState<"prev" | "next" | null>(null);
  const [isSliding, setIsSliding] = useState(false);
  const slideRafRef = useRef<number | null>(null);

  const carouselUrls = useMemo(() => {
    if (isImage && itemsCount > 1) {
      return parsedItems
        .filter((item): item is WorkGeneratedItem & { url: string } => !!item.url && (item.kind === "image" || !item.kind))
        .map((item) => item.url);
    }
    return [];
  }, [isImage, itemsCount, parsedItems]);

  const hasCarousel = carouselUrls.length > 1;
  const currentImageUrl = hasCarousel
    ? carouselUrls[currentIndex]
    : resolveWorkPreviewUrl(props.item.coverUrl, parsedItems, "image");
  const incomingImageUrl = incomingIndex !== null ? carouselUrls[incomingIndex] : null;

  const [isHovering, setIsHovering] = useState(false);

  const startSlide = useCallback((nextIndex: number, direction: "prev" | "next") => {
    if (!hasCarousel || nextIndex === currentIndex || isSliding) return;
    if (slideRafRef.current !== null) {
      window.cancelAnimationFrame(slideRafRef.current);
    }

    setIncomingIndex(nextIndex);
    setSlideDirection(direction);
    setIsSliding(false);

    slideRafRef.current = window.requestAnimationFrame(() => {
      slideRafRef.current = window.requestAnimationFrame(() => {
        setIsSliding(true);
      });
    });
  }, [currentIndex, hasCarousel, isSliding]);

  useEffect(() => {
    if (currentIndex < carouselUrls.length) return;
    setCurrentIndex(0);
    setIncomingIndex(null);
    setSlideDirection(null);
    setIsSliding(false);
  }, [carouselUrls.length, currentIndex]);

  useEffect(() => {
    if (!hasCarousel || isHovering || isSliding) return;
    const timer = setInterval(() => {
      startSlide(currentIndex < carouselUrls.length - 1 ? currentIndex + 1 : 0, "next");
    }, 3000);
    return () => clearInterval(timer);
  }, [carouselUrls.length, currentIndex, hasCarousel, isHovering, isSliding, startSlide]);

  useEffect(() => {
    return () => {
      if (slideRafRef.current !== null) {
        window.cancelAnimationFrame(slideRafRef.current);
      }
    };
  }, []);

  return (
    <div
      className="rounded-lg border bg-card overflow-hidden group hover:shadow-md hover:border-primary/35 transition-all"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        className={`relative aspect-[4/3] overflow-hidden bg-muted flex items-center justify-center group/cover ${isImage || itemsCount > 1 || (isVideo && videoUrl) ? "cursor-pointer" : ""}`}
        onClick={() => {
          if (itemsCount > 1) {
            props.onViewGallery();
            return;
          }
          if (isImage && currentImageUrl) {
            props.onViewImage?.(currentImageUrl);
            return;
          }
          if (isVideo && videoUrl) {
            props.onViewVideo?.(videoUrl);
          }
        }}
      >
        {isImage && currentImageUrl ? (
          <>
            {hasCarousel && incomingImageUrl && slideDirection ? (
              <>
                <div
                  className="absolute inset-0 will-change-transform"
                  style={{
                    transform: isSliding
                      ? slideDirection === "next"
                        ? "translateX(-100%)"
                        : "translateX(100%)"
                      : "translateX(0%)",
                    transition: "transform 320ms ease-out"
                  }}
                >
                  <img
                    src={currentImageUrl}
                    alt={props.item.id}
                    className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <div
                  className="absolute inset-0 will-change-transform"
                  style={{
                    transform: isSliding
                      ? "translateX(0%)"
                      : slideDirection === "next"
                        ? "translateX(100%)"
                        : "translateX(-100%)",
                    transition: "transform 320ms ease-out"
                  }}
                  onTransitionEnd={(e) => {
                    if (e.target !== e.currentTarget || incomingIndex === null) return;
                    slideRafRef.current = null;
                    setCurrentIndex(incomingIndex);
                    setIncomingIndex(null);
                    setSlideDirection(null);
                    setIsSliding(false);
                  }}
                >
                  <img
                    src={incomingImageUrl}
                    alt={props.item.id}
                    className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              </>
            ) : (
              <img
                src={currentImageUrl}
                alt={props.item.id}
                className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            )}
            {hasCarousel && (
              <>
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity hover:bg-black/70"
                  onClick={(e) => {
                    e.stopPropagation();
                    startSlide(currentIndex > 0 ? currentIndex - 1 : carouselUrls.length - 1, "prev");
                  }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity hover:bg-black/70"
                  onClick={(e) => {
                    e.stopPropagation();
                    startSlide(currentIndex < carouselUrls.length - 1 ? currentIndex + 1 : 0, "next");
                  }}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
                  {carouselUrls.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentIndex ? "bg-white scale-125" : "bg-white/50"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : isVideo && (coverUrl || videoUrl) ? (
          <>
            {coverUrl ? (
              <img src={coverUrl} alt={props.item.id} className="w-full h-full object-cover" />
            ) : (
              <video src={videoUrl} className="w-full h-full object-cover" muted preload="metadata" playsInline />
            )}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-background/70 border border-border flex items-center justify-center">
                <Play className="w-5 h-5 text-foreground" />
              </div>
            </div>
          </>
        ) : isVideo ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Play className="w-7 h-7" />
            <span className="text-xs">视频</span>
          </div>
        ) : isCopywriting ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileText className="w-7 h-7" />
            <span className="text-xs">文案</span>
          </div>
        ) : (
          <div className="w-full h-full" />
        )}

        <div className="absolute top-2 left-2 flex items-center gap-2">
          {props.selectable && (
            <div
              className="rounded-md bg-background/90 p-1"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Checkbox checked={props.checked} onCheckedChange={(v) => props.onCheckedChange(v === true)} aria-label="选择" />
            </div>
          )}
          <Badge variant={materialAuditBadgeVariant(props.item.auditStatus)}>{materialAuditLabel(props.item.auditStatus)}</Badge>
          <Badge variant={materialPublishBadgeVariant(props.item.publishStatus)}>{materialPublishLabel(props.item.publishStatus)}</Badge>
        </div>
        {itemsCount > 0 && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="bg-black/50 text-white hover:bg-black/50 border-none px-1.5">{itemsCount} P</Badge>
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        <div className="space-y-1">
          {/*<p className="text-[12px] text-muted-foreground">*/}
          {/*  ID：<span className="font-mono text-foreground">{props.item.id}</span>*/}
          {/*</p>*/}
          <p
            className="text-[13px] text-muted-foreground truncate flex justify-between items-center gap-3"
            title={formatOwnerLabel(props.item)}
          >
            <span className="truncate">{formatOwnerLabel(props.item)}</span>
            <span className="font-mono flex-shrink-0">{formatDateTime(props.item.createdAt)}</span>
          </p>
        </div>

        <div className="flex items-center justify-end gap-1 pt-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={props.onAudit} disabled={props.disabledAudit} title="审核">
            <CheckCircle2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={props.onTogglePublish}
            disabled={props.disabledPublish}
            title={props.disabledPublish ? "需先通过审核" : publishBtnLabel}
          >
            {props.item.publishStatus === "online" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10"
            onClick={props.onDelete}
            disabled={props.disabledDelete}
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
