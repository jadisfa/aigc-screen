import { useEffect, useMemo, useState } from "react";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Pencil, RefreshCw, Tags, Trash2, Upload } from "lucide-react";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
} from "@/shared/components/page";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
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
import { Checkbox } from "@/shared/ui/checkbox";
import { Textarea } from "@/shared/ui/textarea";
import {
  auditModelMaterial,
  deleteModelMaterials,
  listModelMaterials,
  publishModelMaterial,
  updateModelMaterialMetadata,
  uploadModelMaterialForm,
  type ModelMaterial,
} from "@/shared/api/materials/materials-model";
import { listMaterialCategories, listMaterialTags } from "@/shared/api/materials/materials-taxonomy";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import MaterialCategoryManagerDialog from "@/modules/materials/components/MaterialCategoryManagerDialog";
import MaterialTagManagerDialog from "@/modules/materials/components/MaterialTagManagerDialog";
import MaterialAuditDialog from "@/modules/materials/components/MaterialAuditDialog";
import ModelMaterialUploadDialog from "@/modules/materials/components/ModelMaterialUploadDialog";
import { MaterialMediaPreviewDialog } from "@/modules/materials/components/MaterialMediaPreviewDialog";
import {
  materialAuditBadgeVariant,
  materialAuditLabel,
  materialPublishBadgeVariant,
  materialPublishLabel,
  type MaterialAuditFilter,
  type MaterialCategoryType,
  type MaterialPublishFilter,
  type MaterialPublishStatus,
} from "@/modules/materials/lib/material-governance";
import { formatDateTime } from "@/shared/lib/datetime";
import { useHashedUploadFiles, type HashedUploadFileState } from "@/modules/materials/hooks/use-hashed-upload-files";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { getSessionScopeReadyError, useSessionScope, withSessionScope } from "@/shared/hooks/use-session-scope";
import { notify } from "@/shared/lib/notify";

function safeParseTags(tagsJson: string | null | undefined): string[] {
  if (!tagsJson) return [];
  try {
    const v = JSON.parse(tagsJson);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function resolveTagNames(tagIds: string[], tagNameById: Record<string, string>): string[] {
  return tagIds.map((tagId) => tagNameById[tagId] || tagId);
}

function ModelMaterialCard(props: {
  item: ModelMaterial;
  tagNameById: Record<string, string>;
  selectable: boolean;
  checked: boolean;
  disabledAudit: boolean;
  disabledPublish: boolean;
  disabledDelete: boolean;
  disabledRename: boolean;
  onCheckedChange: (checked: boolean) => void;
  onAudit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
  onRename: () => void;
  onPreview: (url: string, title: string) => void;
}) {
  const tags = resolveTagNames(safeParseTags(props.item.tagsJson), props.tagNameById);
  const preview = props.item.previewUrl || props.item.assetUrl;
  const canOnline = props.item.auditStatus === "approved";
  const nextPublish = props.item.publishStatus === "online" ? "offline" : "online";
  const materialTitle = props.item.materialName?.trim() || props.item.id;
  const materialDescription = props.item.materialDescription?.trim() || "";
  const publishBtnLabel = nextPublish === "online" ? "上架" : "下架";

  return (
    <div className="rounded-lg border bg-card overflow-hidden group hover:shadow-md hover:border-primary/35 transition-all">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted flex items-center justify-center">
        <button type="button" className="block h-full w-full" onClick={() => props.onPreview(preview, materialTitle)} title="点击放大预览">
          <img
            src={preview}
            alt={materialTitle}
            className="w-full h-full cursor-zoom-in object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </button>
        {props.selectable && (
          <div className="absolute top-2 left-2 z-10 rounded-md bg-background/90 p-1" onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={props.checked} onCheckedChange={(v) => props.onCheckedChange(v === true)} aria-label="选择" />
          </div>
        )}
        <div className={`absolute top-2 z-10 flex items-center gap-2 ${props.selectable ? "left-12" : "left-2"}`}>
          <Badge variant={materialAuditBadgeVariant(props.item.auditStatus)}>{materialAuditLabel(props.item.auditStatus)}</Badge>
          <Badge variant={materialPublishBadgeVariant(props.item.publishStatus)}>{materialPublishLabel(props.item.publishStatus)}</Badge>
        </div>
        <div className="absolute bottom-2 right-2 z-10 max-w-[45%] rounded-md bg-background/90 px-2 py-1 text-[12px] text-muted-foreground backdrop-blur-sm">
          <p className="truncate">{props.item.materialCategoryName || "未分类"}</p>
        </div>
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-background/90 hover:bg-background"
            onClick={props.onAudit}
            disabled={props.disabledAudit}
            title="审核"
          >
            <CheckCircle2 className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-8 px-2.5 bg-background/90 hover:bg-background"
            onClick={props.onTogglePublish}
            disabled={props.disabledPublish || (nextPublish === "online" && !canOnline)}
            title={publishBtnLabel}
          >
            {publishBtnLabel}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-background/90 hover:bg-background"
            onClick={props.onDelete}
            disabled={props.disabledDelete}
            title="删除"
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>
      <div className="p-4 space-y-1.5">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-sm font-medium text-foreground line-clamp-1">{materialTitle}</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={props.onRename}
              disabled={props.disabledRename}
              title="修改名称和描述"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[12px] text-muted-foreground line-clamp-2">{materialDescription || "暂无描述"}</p>
        </div>
        {tags.length ? (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 8).map((t) => (
              <span key={t} className="text-[12px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">-</p>
        )}
        <p className="text-[12px] text-muted-foreground">{formatDateTime(props.item.createdAt)}</p>
      </div>
    </div>
  );
}

export default function ModelMaterialsManagementPage() {
  const queryClient = useQueryClient();
  const sessionScope = useSessionScope();

  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, invalidateTotal, changePageSize, rememberTotal } =
    usePagedListQuery(48);

  const [categoryTypes, setCategoryTypes] = useState<MaterialCategoryType[]>([]);
  const [auditStatus, setAuditStatus] = useState<MaterialAuditFilter>("all");
  const [publishStatus, setPublishStatus] = useState<MaterialPublishFilter>("all");
  const [keyword, setKeyword] = useState<string>("");
  const [appliedKeyword, setAppliedKeyword] = useState<string>("");
  const [tagId, setTagId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("all");

  const applyKeywordSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
    resetPage();
  };

  const categoriesQuery = useQuery({
    queryKey: ["materialCategories", "model", sessionScope.scope.queryScopeKey],
    queryFn: () => listMaterialCategories({ materialType: "model" }),
  });

  const categories = categoriesQuery.data ?? [];

  const tagsQuery = useQuery({
    queryKey: ["materialTags", "model", sessionScope.scope.queryScopeKey, categoryId],
    queryFn: () =>
      listMaterialTags({
        materialType: "model",
        categoryId: categoryId === "all" ? undefined : categoryId,
        pageNo: 1,
        pageSize: 200,
      }),
  });

  const tagOptions = useMemo(() => tagsQuery.data?.items ?? [], [tagsQuery.data?.items]);
  const tagNameById = useMemo(() => Object.fromEntries(tagOptions.map((t) => [t.id, t.name])), [tagOptions]);

  const params = useMemo(() => {
    return {
      pageNo,
      pageSize,
      categoryTypes: categoryTypes.length ? categoryTypes : undefined,
      auditStatus: auditStatus === "all" ? undefined : auditStatus,
      publishStatus: publishStatus === "all" ? undefined : publishStatus,
      keyword: appliedKeyword.trim() ? appliedKeyword.trim() : undefined,
      tagId: tagId.trim() ? tagId.trim() : undefined,
      tagName: tagId.trim() ? tagNameById[tagId] : undefined,
      categoryId: categoryId === "all" ? undefined : categoryId,
    };
  }, [auditStatus, categoryId, categoryTypes, appliedKeyword, pageNo, pageSize, publishStatus, tagId, tagNameById]);

  const listQuery = useQuery({
    queryKey: ["materialsModel", sessionScope.scope.queryScopeKey, params],
    queryFn: () => listModelMaterials({ ...params, total: getTotalParam() }),
  });

  useEffect(() => {
    rememberTotal(listQuery.data?.page?.total);
  }, [listQuery.data?.page?.total, rememberTotal]);

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.page?.total ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canNextPage = pageNo < totalPages;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["materialsModel"] }),
      queryClient.invalidateQueries({ queryKey: ["materialCategories", "model"] }),
      queryClient.invalidateQueries({ queryKey: ["materialTags", "model"] }),
    ]);
  };

  const auditMutation = useMutation({
    mutationFn: (p: { id: string; status: "approved" | "rejected"; reason?: string }) => auditModelMaterial(p.id, { status: p.status, reason: p.reason }),
    onSuccess: async (_data, p) => {
      notify.success(p.status === "approved" ? "审核成功" : "已驳回");
      await refresh();
    },
    onError: (e) => {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (p: { id: string; status: MaterialPublishStatus }) => publishModelMaterial(p.id, p.status),
    onSuccess: async (_data, p) => {
      notify.success(p.status === "online" ? "上架成功" : "下线成功");
      await refresh();
    },
    onError: (e) => {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteModelMaterials(ids),
    onSuccess: async () => {
      notify.success("删除成功");
      invalidateTotal();
      await refresh();
      setSelectedIds({});
      setBatchActionMode(null);
    },
    onError: (e) => {
      notify.error("删除失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const updateMetadataMutation = useMutation({
    mutationFn: (payload: { id: string; materialName: string; materialDescription?: string }) =>
      updateModelMaterialMetadata(payload.id, {
        materialName: payload.materialName,
        materialDescription: payload.materialDescription,
      }),
    onSuccess: async () => {
      notify.success("修改成功");
      await refresh();
      setEditOpen(false);
      setEditTarget(null);
      setEditMaterialName("");
      setEditMaterialDescription("");
      setEditFormError(null);
    },
    onError: (e) => {
      notify.error("修改失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const [batchActionMode, setBatchActionMode] = useState<"delete" | "audit" | "publish" | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const selectedList = useMemo(() => Object.keys(selectedIds).filter((k) => selectedIds[k]), [selectedIds]);
  const selectedCount = selectedList.length;
  const selectingBatch = batchActionMode !== null;
  const allVisibleSelected = items.length > 0 && items.every((item) => !!selectedIds[item.id]);

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

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => ({ ...prev, [id]: checked }));
  };

  const toggleSelectAllVisible = () => {
    if (items.length === 0) return;
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = { ...prev };
        items.forEach((item) => {
          delete next[item.id];
        });
        return next;
      }
      const next = { ...prev };
      items.forEach((item) => {
        next[item.id] = true;
      });
      return next;
    });
  };

  const resetBatchSelection = () => {
    setBatchActionMode(null);
    setSelectedIds({});
  };

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditTarget, setAuditTarget] = useState<ModelMaterial | null>(null);
  const [auditDecision, setAuditDecision] = useState<"approved" | "rejected">("approved");
  const [auditReason, setAuditReason] = useState("");
  const [batchAuditIds, setBatchAuditIds] = useState<string[]>([]);

  const openAudit = (row: ModelMaterial) => {
    setAuditTarget(row);
    setBatchAuditIds([row.id]);
    setAuditDecision("approved");
    setAuditReason("");
    setAuditOpen(true);
  };

  const batchAuditMutation = useMutation({
    mutationFn: async (p: { ids: string[]; status: "approved" | "rejected"; reason?: string }) => {
      await Promise.all(p.ids.map((id) => auditModelMaterial(id, { status: p.status, reason: p.reason })));
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

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [previewAsset, setPreviewAsset] = useState<{ type: "image" | "video"; url: string; title?: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ModelMaterial | null>(null);
  const [editMaterialName, setEditMaterialName] = useState("");
  const [editMaterialDescription, setEditMaterialDescription] = useState("");
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const openDelete = (ids: string[]) => {
    setDeleteIds(ids);
    setDeleteOpen(true);
  };

  const openEdit = (item: ModelMaterial) => {
    setEditTarget(item);
    setEditMaterialName(item.materialName?.trim() || "");
    setEditMaterialDescription(item.materialDescription?.trim() || "");
    setEditFormError(null);
    setEditOpen(true);
  };

  const confirmDelete = () => {
    if (deleteIds.length === 0) return;
    deleteMutation.mutate(deleteIds);
    setDeleteOpen(false);
  };

  const batchPublishMutation = useMutation({
    mutationFn: async (payload: { ids: string[]; status: MaterialPublishStatus }) => {
      await Promise.all(payload.ids.map((id) => publishModelMaterial(id, payload.status)));
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

  const [batchPublishOpen, setBatchPublishOpen] = useState(false);
  const [batchPublishStatus, setBatchPublishStatus] = useState<MaterialPublishStatus>("online");
  const [batchPublishFormError, setBatchPublishFormError] = useState<string | null>(null);

  const openBatchAudit = () => {
    setBatchAuditIds(selectedList);
    setAuditTarget(null);
    setAuditDecision("approved");
    setAuditReason("");
    setAuditOpen(true);
  };

  const openBatchPublish = () => {
    setBatchPublishStatus("online");
    setBatchPublishFormError(null);
    setBatchPublishOpen(true);
  };

  const submitBatchPublish = () => {
    if (selectedList.length === 0) return;
    if (batchPublishStatus === "online") {
      const invalidItems = items.filter((item) => selectedIds[item.id] && item.auditStatus !== "approved");
      if (invalidItems.length > 0) {
        setBatchPublishFormError("所选素材中包含未审核通过项，无法批量上架");
        return;
      }
    }
    setBatchPublishFormError(null);
    batchPublishMutation.mutate({ ids: selectedList, status: batchPublishStatus });
    setBatchPublishOpen(false);
  };

  const confirmEdit = () => {
    if (!editTarget) return;
    const nextMaterialName = editMaterialName.trim();
    const nextMaterialDescription = editMaterialDescription.trim();
    if (!nextMaterialName) {
      setEditFormError("请输入素材名称");
      return;
    }
    if (
      nextMaterialName === (editTarget.materialName?.trim() || "")
      && nextMaterialDescription === (editTarget.materialDescription?.trim() || "")
    ) {
      setEditOpen(false);
      setEditTarget(null);
      setEditMaterialName("");
      setEditMaterialDescription("");
      setEditFormError(null);
      return;
    }
    setEditFormError(null);
    updateMetadataMutation.mutate({
      id: editTarget.id,
      materialName: nextMaterialName,
      materialDescription: nextMaterialDescription || undefined,
    });
  };

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFormError, setUploadFormError] = useState<string | null>(null);
  const uploadFiles = useHashedUploadFiles({ dedupScopeKey: sessionScope.scope.queryScopeKey });
  const [uploadCategoryType, setUploadCategoryType] = useState<MaterialCategoryType>("system");
  const [uploadCategoryId, setUploadCategoryId] = useState<string>("none");
  const [uploadTagId, setUploadTagId] = useState<string>("none");
  const [uploadMaterialName, setUploadMaterialName] = useState("");
  const [uploadMaterialDescription, setUploadMaterialDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadTagsQuery = useQuery({
    queryKey: ["materialTags", "model", sessionScope.scope.queryScopeKey, "upload", uploadCategoryId],
    queryFn: () =>
      listMaterialTags({
        materialType: "model",
        categoryId: uploadCategoryId === "none" ? undefined : uploadCategoryId,
        pageNo: 1,
        pageSize: 200,
      }),
    enabled: uploadOpen,
  });
  const uploadTagOptions = uploadTagsQuery.data?.items ?? [];
  const selectedUploadFile = uploadFiles.files[0] ?? null;

  const resetUploadState = () => {
    setUploadCategoryType("system");
    setUploadCategoryId("none");
    setUploadTagId("none");
    setUploadMaterialName("");
    setUploadMaterialDescription("");
    setUploadFormError(null);
    uploadFiles.clearFiles();
    uploadFiles.resetInput();
  };

  const submitUpload = async () => {
    if (uploadCategoryId === "none") {
      setUploadFormError("请选择素材分类");
      return;
    }
    if (!uploadMaterialName.trim()) {
      setUploadFormError("请输入素材名称");
      return;
    }
    if (!selectedUploadFile) {
      setUploadFormError("请先选择模型素材文件");
      return;
    }
    const uploadBlockReason = getSessionScopeReadyError(sessionScope);
    if (uploadBlockReason) {
      notify.error("上传暂不可用", { description: uploadBlockReason });
      return;
    }
    setUploadFormError(null);
    setUploading(true);
    try {
      await uploadModelMaterialForm(withSessionScope(sessionScope.scope, {
        file: selectedUploadFile.file,
        categoryType: uploadCategoryType,
        materialName: uploadMaterialName.trim(),
        materialDescription: uploadMaterialDescription.trim() || undefined,
        fileHash: selectedUploadFile.fileHash,
        tags: uploadTagId !== "none" ? [uploadTagId] : undefined,
        materialCategoryId: uploadCategoryId,
      }));
      notify.success("上传成功");
      await refresh();
      setUploadOpen(false);
      resetUploadState();
    } catch (e) {
      notify.error("上传失败", { description: resolveUserErrorMessage(e, "请求失败") });
    } finally {
      setUploading(false);
    }
  };

  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  const pageFrom = total === 0 ? 0 : (pageNo - 1) * pageSize + 1;
  const pageTo = Math.min(pageNo * pageSize, total);

  return (
    <PageShell>
      <PageHeader
        title="模型素材"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => refresh()} disabled={listQuery.isFetching || categoriesQuery.isFetching}>
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
                if (batchActionMode !== "publish") {
                  setBatchActionMode("publish");
                  setSelectedIds({});
                  return;
                }
                if (selectedCount === 0) return;
                openBatchPublish();
              }}
              disabled={publishMutation.isPending || batchPublishMutation.isPending || (batchActionMode !== "publish" && items.length === 0)}
            >
              <Upload className="w-4 h-4" />
              {batchActionMode !== "publish" ? "批量上架/下架" : selectedCount > 0 ? `上下架(${selectedCount})` : "请选择"}
            </Button>
            <Button variant="pageOutline" onClick={() => setCategoryManagerOpen(true)}>
              <Tags className="w-4 h-4" />
              分类管理
            </Button>
            <Button variant="pageOutline" onClick={() => setTagManagerOpen(true)}>
              <Tags className="w-4 h-4" />
              标签管理
            </Button>
            <Button
              variant="page"
              onClick={() => {
                setUploadFormError(null);
                setUploadOpen(true);
              }}
            >
              <Upload className="w-4 h-4" />
              模型素材上传
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
              <Button
                variant="pageOutline"
                onClick={toggleSelectAllVisible}
                disabled={items.length === 0 || deleteMutation.isPending || auditMutation.isPending || batchAuditMutation.isPending || publishMutation.isPending || batchPublishMutation.isPending}
              >
                {allVisibleSelected ? "取消全选" : "全选"}
              </Button>
            )}
            {selectingBatch && (
              <Button
                variant="pageOutline"
                onClick={resetBatchSelection}
                disabled={deleteMutation.isPending || auditMutation.isPending || batchAuditMutation.isPending || publishMutation.isPending || batchPublishMutation.isPending}
              >
                取消
              </Button>
            )}
          </>
        }
      />

      <PageFilterBar className="flex-wrap">
        <Select
          value={categoryTypes.length ? categoryTypes[0] : "all"}
          onValueChange={(v) => {
            setCategoryTypes(v === "all" ? [] : [v]);
            resetPage();
          }}
        >
          <SelectTrigger className="subpage-native-select w-[160px]">
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value="all">类型: 全部</SelectItem>
            <SelectItem className="subpage-select-item" value="system">公共</SelectItem>
            <SelectItem className="subpage-select-item" value="user">私有</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={categoryId}
          onValueChange={(v) => {
            setCategoryId(v);
            setTagId("");
            resetPage();
          }}
        >
          <SelectTrigger className="subpage-native-select w-[220px]">
            <SelectValue placeholder="分类" />
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value="all">分类: 全部</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} className="subpage-select-item" value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={auditStatus}
          onValueChange={(v) => {
            setAuditStatus(v);
            resetPage();
          }}
        >
          <SelectTrigger className="subpage-native-select w-[160px]">
            <SelectValue placeholder="审核状态" />
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value="all">审核状态: 全部</SelectItem>
            <SelectItem className="subpage-select-item" value="pending">待审核</SelectItem>
            <SelectItem className="subpage-select-item" value="approved">已通过</SelectItem>
            <SelectItem className="subpage-select-item" value="rejected">已拒绝</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={publishStatus}
          onValueChange={(v) => {
            setPublishStatus(v);
            resetPage();
          }}
        >
          <SelectTrigger className="subpage-native-select w-[160px]">
            <SelectValue placeholder="发布状态" />
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value="all">发布状态: 全部</SelectItem>
            <SelectItem className="subpage-select-item" value="offline">下架</SelectItem>
            <SelectItem className="subpage-select-item" value="online">上架</SelectItem>
          </SelectContent>
        </Select>

        <SearchField
          wrapClassName="!max-w-[280px]"
          placeholder="按素材名称或描述搜索，回车搜索"
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

      <input
        ref={uploadFiles.fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const firstFile = e.target.files?.[0];
          uploadFiles.clearFiles();
          uploadFiles.resetInput();
          if (firstFile) {
            void uploadFiles.appendFiles([firstFile]);
          }
        }}
      />

      <div className="flex flex-wrap items-center gap-5 mb-7 pb-1">
        <button
          className={`subpage-tag-btn ${!tagId.trim() ? "subpage-tag-btn-active" : "subpage-tag-btn-inactive"}`}
          onClick={() => {
            setTagId("");
            resetPage();
          }}
        >
          全部
        </button>
        {tagOptions.map((t) => (
          <button
            key={t.id}
            className={`subpage-tag-btn ${tagId.trim() === t.id ? "subpage-tag-btn-active" : "subpage-tag-btn-inactive"}`}
            onClick={() => {
              setTagId(t.id);
              resetPage();
            }}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="grid [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))] gap-5 max-[768px]:grid-cols-1">
        {items.map((item) => (
          <ModelMaterialCard
            key={item.id}
            item={item}
            tagNameById={tagNameById}
            checked={!!selectedIds[item.id]}
            selectable={selectingBatch}
            onCheckedChange={(v) => toggleOne(item.id, v)}
            onAudit={() => openAudit(item)}
            onTogglePublish={() =>
              publishMutation.mutate({ id: item.id, status: item.publishStatus === "online" ? "offline" : "online" })
            }
            onDelete={() => openDelete([item.id])}
            onRename={() => openEdit(item)}
            onPreview={(url, title) => setPreviewAsset({ type: "image", url, title })}
            disabledAudit={auditMutation.isPending || batchAuditMutation.isPending}
            disabledPublish={publishMutation.isPending || batchPublishMutation.isPending}
            disabledDelete={deleteMutation.isPending}
            disabledRename={updateMetadataMutation.isPending}
          />
        ))}
      </div>

      {!listQuery.isLoading && items.length === 0 && <div className="text-center py-20 text-muted-foreground">暂无模型素材</div>}

      <CommonPaginationBar
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
        title={batchAuditIds.length > 1 ? "批量审核模型素材" : "审核模型素材"}
        targetId={batchAuditIds.length > 1 ? `已选择 ${batchAuditIds.length} 项` : auditTarget?.id}
        decision={auditDecision}
        onDecisionChange={setAuditDecision}
        reason={auditReason}
        onReasonChange={setAuditReason}
        onSubmit={submitAudit}
        submitting={auditMutation.isPending || batchAuditMutation.isPending}
      />

      <Dialog
        open={batchPublishOpen}
        onOpenChange={(open) => {
          setBatchPublishOpen(open);
          if (!open) {
            setBatchPublishStatus("online");
            setBatchPublishFormError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>批量上架/下架</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">已选择 {selectedCount} 个素材</p>
            <Select
              value={batchPublishStatus}
              onValueChange={(v) => {
                setBatchPublishFormError(null);
                setBatchPublishStatus(v as MaterialPublishStatus);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="请选择目标状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">上架</SelectItem>
                <SelectItem value="offline">下架</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {batchPublishFormError ? <p className="text-sm text-destructive mr-auto">{batchPublishFormError}</p> : null}
            <Button variant="outline" onClick={() => setBatchPublishOpen(false)}>
              取消
            </Button>
            <Button onClick={submitBatchPublish} disabled={batchPublishMutation.isPending || selectedCount === 0}>
              提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              确定要删除 {deleteIds.length} 个模型素材吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditTarget(null);
            setEditMaterialName("");
            setEditMaterialDescription("");
            setEditFormError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>修改模型素材</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">素材名称</label>
              <Input
                value={editMaterialName}
                onChange={(e) => {
                  setEditFormError(null);
                  setEditMaterialName(e.target.value);
                }}
                placeholder="请输入素材名称"
                maxLength={120}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmEdit();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">素材描述</label>
              <Textarea
                value={editMaterialDescription}
                onChange={(e) => {
                  setEditFormError(null);
                  setEditMaterialDescription(e.target.value);
                }}
                placeholder="请输入素材描述"
                maxLength={500}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {editFormError ? <p className="text-sm text-destructive mr-auto">{editFormError}</p> : null}
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                setEditTarget(null);
                setEditMaterialName("");
                setEditMaterialDescription("");
                setEditFormError(null);
              }}
            >
              取消
            </Button>
            <Button onClick={confirmEdit} disabled={updateMetadataMutation.isPending || !editMaterialName.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModelMaterialUploadDialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) {
            resetUploadState();
          } else {
            setUploadFormError(null);
          }
        }}
        uploadCategoryType={uploadCategoryType}
        setUploadCategoryType={(v) => {
          setUploadFormError(null);
          setUploadCategoryType(v);
        }}
        uploadCategoryId={uploadCategoryId}
        setUploadCategoryId={(v) => {
          setUploadFormError(null);
          setUploadCategoryId(v);
        }}
        uploadTagId={uploadTagId}
        setUploadTagId={(v) => {
          setUploadFormError(null);
          setUploadTagId(v);
        }}
        uploadMaterialName={uploadMaterialName}
        setUploadMaterialName={(v) => {
          setUploadFormError(null);
          setUploadMaterialName(v);
        }}
        uploadMaterialDescription={uploadMaterialDescription}
        setUploadMaterialDescription={(v) => {
          setUploadFormError(null);
          setUploadMaterialDescription(v);
        }}
        categories={categories}
        uploadTagOptions={uploadTagOptions}
        uploadFile={selectedUploadFile as HashedUploadFileState | null}
        onPickFile={() => {
          setUploadFormError(null);
          uploadFiles.openPicker();
        }}
        onRemoveFile={() => {
          setUploadFormError(null);
          if (selectedUploadFile) {
            uploadFiles.removeFile(selectedUploadFile.key);
          }
        }}
        onCancel={() => setUploadOpen(false)}
        onSave={() => void submitUpload()}
        uploading={uploading}
        formError={uploadFormError}
      />

      <MaterialCategoryManagerDialog open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} materialType="model" title="模型分类管理" />
      <MaterialTagManagerDialog open={tagManagerOpen} onOpenChange={setTagManagerOpen} materialType="model" title="模型标签管理" />
      <MaterialMediaPreviewDialog preview={previewAsset} onClose={() => setPreviewAsset(null)} />
    </PageShell>
  );
}
