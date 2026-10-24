import { useEffect, useMemo, useState } from "react";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Play, RefreshCw, Tags, Trash2, Upload } from "lucide-react";
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
import {
  auditMediaMaterial,
  deleteMediaMaterials,
  getMediaMaterialByHash,
  listMediaMaterials,
  publishMediaMaterial,
  uploadMediaMaterial,
  type MediaMaterial,
} from "@/shared/api/materials/materials-media";
import { uploadFileMaterialForm } from "@/shared/api/materials/materials-file-material";
import { batchUploadHashed } from "@/shared/lib/batch-upload";
import { formatDateTime } from "@/shared/lib/datetime";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import { listMaterialCategories, listMaterialTags } from "@/shared/api/materials/materials-taxonomy";
import MaterialCategoryManagerDialog from "@/modules/materials/components/MaterialCategoryManagerDialog";
import MaterialTagManagerDialog from "@/modules/materials/components/MaterialTagManagerDialog";
import { useHashedUploadFiles, type HashedUploadFileState } from "@/modules/materials/hooks/use-hashed-upload-files";
import MaterialAuditDialog from "@/modules/materials/components/MaterialAuditDialog";
import VideoMaterialUploadDialog from "@/modules/materials/components/VideoMaterialUploadDialog";
import { MaterialMediaPreviewDialog } from "@/modules/materials/components/MaterialMediaPreviewDialog";
import {
  materialAuditBadgeVariant,
  materialAuditLabel,
  materialPublishBadgeVariant,
  materialPublishLabel,
  type MaterialAuditFilter,
  type MaterialCategoryFilter,
  type MaterialCategoryType,
  type MaterialPublishFilter,
  type MaterialPublishStatus,
} from "@/modules/materials/lib/material-governance";
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

function fileNameFromUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const pathname = new URL(url).pathname;
    const raw = pathname.split("/").pop() || "";
    return decodeURIComponent(raw);
  } catch {
    const raw = (url || "").split("?")[0].split("#")[0];
    return decodeURIComponent(raw.split("/").pop() || "");
  }
}

export default function VideoMaterialsManagementPage() {
  const queryClient = useQueryClient();
  const sessionScope = useSessionScope();

  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, invalidateTotal, changePageSize, rememberTotal } =
    usePagedListQuery(48);

  const [categoryType, setCategoryType] = useState<MaterialCategoryFilter>("all");
  const [auditStatus, setAuditStatus] = useState<MaterialAuditFilter>("all");
  const [publishStatus, setPublishStatus] = useState<MaterialPublishFilter>("all");
  const [fileNameKeyword, setFileNameKeyword] = useState<string>("");
  const [appliedFileNameKeyword, setAppliedFileNameKeyword] = useState<string>("");
  const [tagId, setTagId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("all");

  const applyKeywordSearch = () => {
    const normalized = fileNameKeyword.trim();
    setFileNameKeyword(normalized);
    setAppliedFileNameKeyword(normalized);
    setPageNo(1);
  };

  const categoriesQuery = useQuery({
    queryKey: ["materialCategories", "video", sessionScope.scope.queryScopeKey],
    queryFn: () => listMaterialCategories({ materialType: "video" }),
  });

  const categories = categoriesQuery.data ?? [];

  const tagsQuery = useQuery({
    queryKey: ["materialTags", "video", sessionScope.scope.queryScopeKey, categoryId],
    queryFn: () =>
      listMaterialTags({
        materialType: "video",
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
      mediaType: "video",
      categoryType: categoryType === "all" ? undefined : categoryType,
      auditStatus: auditStatus === "all" ? undefined : auditStatus,
      publishStatus: publishStatus === "all" ? undefined : publishStatus,
      tagId: tagId.trim() ? tagId.trim() : undefined,
      tagName: tagId.trim() ? tagNameById[tagId] : undefined,
      categoryId: categoryId === "all" ? undefined : categoryId,
    };
  }, [auditStatus, categoryId, categoryType, pageNo, pageSize, publishStatus, tagId, tagNameById]);

  const listQuery = useQuery({
    queryKey: ["materialsMedia", sessionScope.scope.queryScopeKey, params],
    queryFn: () => listMediaMaterials({ ...params, total: getTotalParam() }),
  });

  useEffect(() => {
    rememberTotal(listQuery.data?.page?.total);
  }, [listQuery.data?.page?.total, rememberTotal]);

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const filteredItems = useMemo(() => {
    const kw = appliedFileNameKeyword.trim().toLowerCase();
    if (!kw) return items;
    return items.filter((item) => fileNameFromUrl(item.assetUrl).toLowerCase().includes(kw));
  }, [appliedFileNameKeyword, items]);
  const total = listQuery.data?.page?.total ?? 0;

  const totalPages = useMemo(() => {
    if (total <= 0) return 0;
    return Math.ceil(total / pageSize);
  }, [pageSize, total]);

  useEffect(() => {
    if (totalPages === 0) {
      if (pageNo !== 1) setPageNo(1);
      return;
    }
    if (pageNo > totalPages) setPageNo(totalPages);
  }, [pageNo, totalPages]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["materialsMedia"] }),
      queryClient.invalidateQueries({ queryKey: ["materialCategories", "video"] }),
      queryClient.invalidateQueries({ queryKey: ["materialTags", "video"] }),
    ]);
  };

  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  const auditMutation = useMutation({
    mutationFn: (p: { id: string; status: "approved" | "rejected"; reason?: string }) => auditMediaMaterial(p.id, { status: p.status, reason: p.reason }),
    onSuccess: async (_data, p) => {
      notify.success(p.status === "approved" ? "审核成功" : "已驳回");
      await refresh();
    },
    onError: (e) => {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (p: { id: string; status: MaterialPublishStatus }) => publishMediaMaterial(p.id, p.status),
    onSuccess: async (_data, p) => {
      notify.success(p.status === "online" ? "上架成功" : "下线成功");
      await refresh();
    },
    onError: (e) => {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteMediaMaterials(ids),
    onSuccess: async () => {
      notify.success("删除成功");
      invalidateTotal();
      await refresh();
      setSelectedIds({});
    },
    onError: (e) => {
      notify.error("删除失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (payload: { categoryType: MaterialCategoryType; fileHash: string; assetUrl: string; previewUrl?: string; tags?: string[]; materialCategoryId?: string }) =>
      uploadMediaMaterial(withSessionScope(sessionScope.scope, { mediaType: "video", ...payload })),
    onError: (e) => {
      notify.error("上传失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const selectedList = useMemo(() => Object.keys(selectedIds).filter((k) => selectedIds[k]), [selectedIds]);

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => ({ ...prev, [id]: checked }));
  };

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditTarget, setAuditTarget] = useState<MediaMaterial | null>(null);
  const [auditDecision, setAuditDecision] = useState<"approved" | "rejected">("approved");
  const [auditReason, setAuditReason] = useState("");

  const openAudit = (row: MediaMaterial) => {
    setAuditTarget(row);
    setAuditDecision("approved");
    setAuditReason("");
    setAuditOpen(true);
  };

  const submitAudit = () => {
    if (!auditTarget) return;
    auditMutation.mutate({ id: auditTarget.id, status: auditDecision, reason: auditReason.trim() ? auditReason.trim() : undefined });
    setAuditOpen(false);
  };

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [previewAsset, setPreviewAsset] = useState<{ type: "image" | "video"; url: string; title?: string } | null>(null);
  const openDelete = (ids: string[]) => {
    setDeleteIds(ids);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (deleteIds.length === 0) return;
    deleteMutation.mutate(deleteIds);
    setDeleteOpen(false);
  };

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFormError, setUploadFormError] = useState<string | null>(null);
  const uploadFiles = useHashedUploadFiles({ dedupScopeKey: sessionScope.scope.queryScopeKey });
  const [uploadCategoryType, setUploadCategoryType] = useState<MaterialCategoryType>("system");
  const [uploadCategoryId, setUploadCategoryId] = useState<string>("none");
  const [uploadTagId, setUploadTagId] = useState<string>("none");
  const [uploading, setUploading] = useState(false);
  const uploadTagsQuery = useQuery({
    queryKey: ["materialTags", "video", sessionScope.scope.queryScopeKey, "upload", uploadCategoryId],
    queryFn: () =>
      listMaterialTags({
        materialType: "video",
        categoryId: uploadCategoryId === "none" ? undefined : uploadCategoryId,
        pageNo: 1,
        pageSize: 200,
      }),
    enabled: uploadOpen,
  });
  const uploadTagOptions = uploadTagsQuery.data?.items ?? [];

  const submitUpload = async () => {
    if (uploadCategoryId === "none") {
      setUploadFormError("请选择素材分类");
      return;
    }
    if (uploadFiles.files.length === 0) {
      setUploadFormError("请先选择视频文件");
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
      await batchUploadHashed({
        items: uploadFiles.files,
        checkExisted: async (fileHash) => getMediaMaterialByHash(withSessionScope(sessionScope.scope, { mediaType: "video", fileHash })),
        uploadOne: async (item) => {
          const fileResult = await uploadFileMaterialForm(withSessionScope(sessionScope.scope, {
            file: item.file,
            fileType: "video",
            fileHash: item.fileHash,
          }));
          return uploadMutation.mutateAsync({
            categoryType: uploadCategoryType,
            fileHash: item.fileHash,
            assetUrl: fileResult.file.accessUrl,
            previewUrl: fileResult.file.accessUrl,
            tags: uploadTagId !== "none" ? [uploadTagId] : undefined,
            materialCategoryId: uploadCategoryId,
          });
        },
        isUploadedAsExisted: (res) => Boolean((res as { existed?: boolean } | null | undefined)?.existed),
        onItemError: (_item, e) =>
          notify.error("上传失败", { description: resolveUserErrorMessage(e, "请求失败") }),
      });
      notify.success("上传成功");
      await refresh();
      setUploadOpen(false);
      setUploadFormError(null);
      setUploadCategoryId("none");
      setUploadTagId("none");
      uploadFiles.clearFiles();
      uploadFiles.resetInput();
    } finally {
      setUploading(false);
    }
  };

  const pageFrom = total === 0 ? 0 : (pageNo - 1) * pageSize + 1;
  const pageTo = Math.min(pageNo * pageSize, total);
  const canNextPage = useMemo(() => {
    if (total <= 0) return false;
    return pageNo * pageSize < total;
  }, [pageNo, pageSize, total]);

  return (
    <PageShell>
      <PageHeader
        title="视频素材"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => refresh()} disabled={listQuery.isFetching}>
              <RefreshCw className="w-4 h-4" />
              刷新
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
              视频上传
            </Button>
            <Button
              variant="pageOutline"
              className="!border-destructive !text-destructive hover:!bg-destructive/10"
              onClick={() => openDelete(selectedList)}
              disabled={selectedList.length === 0 || deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
              批量删除
            </Button>
          </>
        }
      />

      <PageFilterBar className="flex-wrap">
        <Select
          value={categoryType}
          onValueChange={(v) => {
            setCategoryType(v);
            resetPage();
          }}
        >
          <SelectTrigger className="subpage-native-select w-[160px]">
            <SelectValue placeholder="类型"/>
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
            <SelectValue placeholder="审核状态"/>
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
            <SelectValue placeholder="发布状态"/>
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value="all">发布状态: 全部</SelectItem>
            <SelectItem className="subpage-select-item" value="offline">下架</SelectItem>
            <SelectItem className="subpage-select-item" value="online">上架</SelectItem>
          </SelectContent>
        </Select>

        <SearchField
          wrapClassName="max-w-md"
          placeholder="按视频文件名称搜索，回车搜索"
          value={fileNameKeyword}
          onChange={(e) => setFileNameKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyKeywordSearch();
            }
          }}
        />
      </PageFilterBar>

      <div className="flex flex-wrap items-center gap-5 mb-7">
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

      <input
        ref={uploadFiles.fileInputRef}
        type="file"
        multiple
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const fs = e.target.files ? Array.from(e.target.files) : [];
          void uploadFiles.appendFiles(fs);
        }}
      />

      <div className="grid [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))] gap-5 max-[768px]:grid-cols-1">
        {filteredItems.map((item) => (
          <VideoMaterialCard
            key={item.id}
            item={item}
            tagNameById={tagNameById}
            checked={!!selectedIds[item.id]}
            onCheckedChange={(v) => toggleOne(item.id, v)}
            onDelete={() => openDelete([item.id])}
            onAudit={() => openAudit(item)}
            onTogglePublish={() =>
              publishMutation.mutate({ id: item.id, status: item.publishStatus === "online" ? "offline" : "online" })
            }
            onPreview={(url, title) => setPreviewAsset({ type: "video", url, title })}
            deleting={deleteMutation.isPending}
            auditing={auditMutation.isPending}
            publishing={publishMutation.isPending}
          />
        ))}
      </div>

      {!listQuery.isLoading && filteredItems.length === 0 && <div className="text-center py-20 text-muted-foreground">暂无视频素材</div>}

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
          if (!open) setAuditTarget(null);
        }}
        title="审核视频素材"
        targetId={auditTarget?.id}
        decision={auditDecision}
        onDecisionChange={setAuditDecision}
        reason={auditReason}
        onReasonChange={setAuditReason}
        onSubmit={submitAudit}
        submitting={auditMutation.isPending}
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
              确定要删除 {deleteIds.length} 个视频素材吗？此操作不可撤销。
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

      <VideoMaterialUploadDialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) {
            setUploadFormError(null);
            setUploadCategoryType("system");
            setUploadCategoryId("none");
            setUploadTagId("none");
            uploadFiles.clearFiles();
            uploadFiles.resetInput();
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
        categories={categories}
        uploadTagOptions={uploadTagOptions}
        uploadFiles={uploadFiles.files as HashedUploadFileState[]}
        onPickFiles={() => {
          setUploadFormError(null);
          uploadFiles.openPicker();
        }}
        onRemoveFile={(key) => {
          setUploadFormError(null);
          uploadFiles.removeFile(key);
        }}
        onCancel={() => setUploadOpen(false)}
        onSave={() => void submitUpload()}
        uploading={uploading || uploadMutation.isPending}
        formError={uploadFormError}
      />

      <MaterialCategoryManagerDialog open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} materialType="video" title="视频分类管理" />
      <MaterialTagManagerDialog open={tagManagerOpen} onOpenChange={setTagManagerOpen} materialType="video" title="视频标签管理" />
      <MaterialMediaPreviewDialog preview={previewAsset} onClose={() => setPreviewAsset(null)} />
    </PageShell>
  );
}

function VideoMaterialCard(props: {
  item: MediaMaterial;
  tagNameById: Record<string, string>;
  checked: boolean;
  deleting: boolean;
  auditing: boolean;
  publishing: boolean;
  onCheckedChange: (checked: boolean) => void;
  onDelete: () => void;
  onAudit: () => void;
  onTogglePublish: () => void;
  onPreview: (url: string, title: string) => void;
}) {
  const tags = useMemo(() => resolveTagNames(safeParseTags(props.item.tagsJson), props.tagNameById), [props.item.tagsJson, props.tagNameById]);
  const preview = props.item.previewUrl || props.item.assetUrl;
  const nextPublish = props.item.publishStatus === "online" ? "offline" : "online";
  const publishBtnLabel = nextPublish === "online" ? "上架" : "下架";
  const canOnline = props.item.auditStatus === "approved";

  return (
    <div className="rounded-lg border bg-card overflow-hidden group hover:shadow-md hover:border-primary/35 transition-all">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <button
          type="button"
          className="block h-full w-full"
          onClick={() => props.onPreview(props.item.assetUrl, fileNameFromUrl(props.item.assetUrl) || props.item.id)}
          title="点击放大预览"
        >
          {props.item.previewUrl ? (
            <img
              src={preview}
              alt={props.item.id}
              className="w-full h-full cursor-pointer object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <video src={preview} className="w-full h-full object-cover" muted preload="metadata" playsInline />
          )}
        </button>
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-background/70 border border-border flex items-center justify-center">
            <Play className="w-5 h-5 text-foreground" />
          </div>
        </div>
        <div className="absolute top-2 left-2">
          <Checkbox checked={props.checked} onCheckedChange={(v) => props.onCheckedChange(v === true)} aria-label="选择" />
        </div>
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-background/90 hover:bg-background"
            onClick={props.onDelete}
            disabled={props.deleting}
            title="删除"
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-2">
        <p className="text-[13px] font-mono text-muted-foreground truncate" title={props.item.id}>
          {props.item.id}
        </p>
        <div className="flex items-center gap-2">
          <Badge variant={materialAuditBadgeVariant(props.item.auditStatus)}>{materialAuditLabel(props.item.auditStatus)}</Badge>
          <Badge variant={materialPublishBadgeVariant(props.item.publishStatus)}>{materialPublishLabel(props.item.publishStatus)}</Badge>
        </div>
        <p className="text-[12px] text-muted-foreground">分类：{props.item.categoryType || "-"}</p>
        <div className="flex flex-wrap gap-1 min-h-5">
          {tags.length ? (
            tags.slice(0, 4).map((t) => (
              <span key={t} className="text-[12px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {t}
              </span>
            ))
          ) : (
            <span className="text-[12px] text-muted-foreground">无标签</span>
          )}
        </div>
        <p className="text-[12px] text-muted-foreground">{formatDateTime(props.item.createdAt)}</p>
        <div className="flex items-center gap-2 pt-1">
          <Button variant="ghost" size="sm" className="h-8 px-2.5 gap-1 text-[12px]" onClick={props.onAudit} disabled={props.auditing}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            审核
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-[12px]"
            onClick={props.onTogglePublish}
            disabled={props.publishing || (nextPublish === "online" && !canOnline)}
          >
            {publishBtnLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
