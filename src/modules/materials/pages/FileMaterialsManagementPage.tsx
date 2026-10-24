import { useEffect, useMemo, useRef, useState } from "react";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
} from "@/shared/components/page";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Checkbox } from "@/shared/ui/checkbox";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import MaterialAuditDialog from "@/modules/materials/components/MaterialAuditDialog";
import {
  auditFileMaterial,
  deleteFileMaterialsBatch,
  getFileMaterialByHash,
  listFileMaterials,
  publishFileMaterial,
  updateFileMaterialName,
  uploadFileMaterialForm,
  type FileMaterial,
} from "@/shared/api/materials/materials-file-material";
import { md5HexFromFile } from "@/shared/lib/md5";
import { formatDateTime } from "@/shared/lib/datetime";
import { formatOwnerLabel } from "@/shared/lib/owner-display";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import { useVideoPoster } from "@/shared/hooks/use-video-poster";
import { batchUploadWithDedup } from "@/shared/lib/batch-upload";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { MaterialMediaPreviewDialog } from "@/modules/materials/components/MaterialMediaPreviewDialog";
import {
  materialAuditBadgeVariant,
  materialAuditLabel,
  materialCategoryLabel,
  materialPublishBadgeVariant,
  materialPublishLabel,
  type MaterialAuditFilter,
  type MaterialCategoryFilter,
  type MaterialPublishFilter,
  type MaterialPublishStatus,
} from "@/modules/materials/lib/material-governance";
import { getSessionScopeReadyError, toSessionScopeParams, useSessionScope, withSessionScope } from "@/shared/hooks/use-session-scope";
import { notify } from "@/shared/lib/notify";

function formatBytes(bytes: number) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const val = n / 1024 ** idx;
  return `${val >= 10 || idx === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[idx]}`;
}

function detectFileType(f: File): "image" | "video" | "file" {
  const mime = (f.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

function parseTagLabels(item: FileMaterial) {
  if (Array.isArray(item.tagLabels) && item.tagLabels.length > 0) {
    return item.tagLabels.filter((tag): tag is string => Boolean(tag));
  }
  if (Array.isArray(item.tagCodes) && item.tagCodes.length > 0) {
    return item.tagCodes.filter((tag): tag is string => Boolean(tag));
  }
  if (!item.tags) return [];
  return item.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function FileMaterialsManagementPage() {
  const queryClient = useQueryClient();
  const meQuery = useMePermissions();
  const sessionScope = useSessionScope();

  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, invalidateTotal, changePageSize, rememberTotal } =
    usePagedListQuery(48);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [fileType, setFileType] = useState<"all" | "image" | "video" | "file">("all");
  const [categoryType, setCategoryType] = useState<MaterialCategoryFilter>("all");
  const [auditStatus, setAuditStatus] = useState<MaterialAuditFilter>("all");
  const [publishStatus, setPublishStatus] = useState<MaterialPublishFilter>("all");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const applyKeywordSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
    resetPage();
  };

  const listQuery = useQuery({
    queryKey: [
      "materialsFileMaterial",
      sessionScope.scope.queryScopeKey,
      pageNo,
      pageSize,
      fileType,
      categoryType,
      auditStatus,
      publishStatus,
      appliedKeyword,
    ],
    queryFn: () =>
      listFileMaterials({
        pageNo,
        pageSize,
        total: getTotalParam(),
        fileType: fileType === "all" ? undefined : fileType,
        categoryType: categoryType === "all" ? undefined : categoryType,
        auditStatus: auditStatus === "all" ? undefined : auditStatus,
        publishStatus: publishStatus === "all" ? undefined : publishStatus,
        keyword: appliedKeyword.trim() ? appliedKeyword.trim() : undefined,
        ...toSessionScopeParams(sessionScope.scope),
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
    await queryClient.invalidateQueries({ queryKey: ["materialsFileMaterial"] });
  };

  const auditMutation = useMutation({
    mutationFn: (payload: { id: string; status: "approved" | "rejected"; reason?: string }) =>
      auditFileMaterial(payload.id, { status: payload.status, reason: payload.reason }),
    onSuccess: async (_data, payload) => {
      notify.success(payload.status === "approved" ? "审核成功" : "已驳回");
      await refresh();
    },
    onError: (e) => {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (payload: { id: string; status: MaterialPublishStatus }) => publishFileMaterial(payload.id, payload.status),
    onSuccess: async (_data, payload) => {
      notify.success(payload.status === "online" ? "上架成功" : "下线成功");
      await refresh();
    },
    onError: (e) => {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteFileMaterialsBatch(ids),
    onSuccess: async () => {
      notify.success("删除成功");
      invalidateTotal();
      await refresh();
      setSelectedIds({});
      setBatchDeleteMode(false);
    },
    onError: (e) => {
      notify.error("删除失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, fileName }: { id: string; fileName: string }) => updateFileMaterialName(id, fileName),
    onSuccess: async () => {
      notify.success("修改成功");
      await refresh();
      setRenameOpen(false);
      setRenameTarget(null);
      setRenameValue("");
    },
    onError: (e) => {
      notify.error("修改失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const [batchDeleteMode, setBatchDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const selectedList = useMemo(() => Object.keys(selectedIds).filter((id) => selectedIds[id]), [selectedIds]);
  const selectedCount = selectedList.length;
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
    setBatchDeleteMode(false);
    setSelectedIds({});
  };

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditTarget, setAuditTarget] = useState<FileMaterial | null>(null);
  const [auditDecision, setAuditDecision] = useState<"approved" | "rejected">("approved");
  const [auditReason, setAuditReason] = useState("");
  const openAudit = (item: FileMaterial) => {
    setAuditTarget(item);
    setAuditDecision(item.auditStatus === "rejected" ? "rejected" : "approved");
    setAuditReason("");
    setAuditOpen(true);
  };

  const submitAudit = () => {
    if (!auditTarget) return;
    auditMutation.mutate({
      id: auditTarget.id,
      status: auditDecision,
      reason: auditReason.trim() ? auditReason.trim() : undefined,
    });
    setAuditOpen(false);
  };

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [previewAsset, setPreviewAsset] = useState<{ type: "image" | "video"; url: string; title?: string } | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileMaterial | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const openDelete = (ids: string[]) => {
    setDeleteIds(ids);
    setDeleteOpen(true);
  };

  const openRename = (item: FileMaterial) => {
    setRenameTarget(item);
    setRenameValue(item.fileName || "");
    setRenameOpen(true);
  };

  const confirmDelete = () => {
    if (deleteIds.length === 0) return;
    deleteMutation.mutate(deleteIds);
    setDeleteOpen(false);
  };

  const confirmRename = () => {
    if (!renameTarget) return;
    const nextName = renameValue.trim();
    if (!nextName || nextName === renameTarget.fileName) {
      setRenameOpen(false);
      setRenameTarget(null);
      setRenameValue("");
      return;
    }
    renameMutation.mutate({ id: renameTarget.id, fileName: nextName });
  };

  const [uploading, setUploading] = useState(false);
  const handlePickFiles = () => {
    fileInputRef.current?.click();
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length || uploading) return;
    const uploadBlockReason = getSessionScopeReadyError(sessionScope);
    if (uploadBlockReason) {
      notify.error("上传暂不可用", { description: uploadBlockReason });
      return;
    }
    setUploading(true);
    try {
      await batchUploadWithDedup({
        files,
        computeHash: md5HexFromFile,
        checkExisted: async (fileHash) => getFileMaterialByHash(withSessionScope(sessionScope.scope, { fileHash })),
        uploadOne: async (file, fileHash) =>
          uploadFileMaterialForm(
            withSessionScope(sessionScope.scope, {
              file,
              fileType: detectFileType(file),
              fileHash,
              ownerPrincipalId: meQuery.data?.principalId,
            }),
          ),
        isUploadedAsExisted: (res) => Boolean((res as { existed?: boolean } | null | undefined)?.existed),
        onFileError: (_file, e) => {
          notify.error("上传失败", { description: resolveUserErrorMessage(e, "请求失败") });
        },
      });
      notify.success("上传成功");
      await refresh();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  };

  const canNextPage = useMemo(() => {
    if (total <= 0) return false;
    return pageNo * pageSize < total;
  }, [pageNo, pageSize, total]);

  return (
    <PageShell>
      <PageHeader
        title="文件管理"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => refresh()} disabled={listQuery.isFetching}>
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
            <Button variant="page" onClick={handlePickFiles} disabled={uploading}>
              <Upload className="w-4 h-4" />
              批量导入
            </Button>
            <Button
              variant="pageOutline"
              className="!border-destructive !text-destructive hover:!bg-destructive/10"
              onClick={() => {
                if (!batchDeleteMode) {
                  setBatchDeleteMode(true);
                  setSelectedIds({});
                  return;
                }
                if (selectedCount === 0) return;
                openDelete(selectedList);
              }}
              disabled={deleteMutation.isPending || (!batchDeleteMode && items.length === 0)}
            >
              <Trash2 className="w-4 h-4" />
              {!batchDeleteMode ? "批量删除" : selectedCount > 0 ? `删除(${selectedCount})` : "请选择"}
            </Button>
            {batchDeleteMode && (
              <Button
                variant="pageOutline"
                onClick={toggleSelectAllVisible}
                disabled={items.length === 0 || deleteMutation.isPending}
              >
                {allVisibleSelected ? "取消全选" : "全选"}
              </Button>
            )}
            {batchDeleteMode && (
              <Button
                variant="pageOutline"
                onClick={resetBatchSelection}
                disabled={deleteMutation.isPending}
              >
                取消
              </Button>
            )}
          </>
        }
      />

      <PageFilterBar className="flex-wrap">
        <Select
          value={fileType}
          onValueChange={(value) => {
            setFileType(value as "all" | "image" | "video" | "file");
            resetPage();
          }}
        >
          <SelectTrigger className="subpage-native-select w-[150px]">
            <SelectValue placeholder="文件类型" />
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value="all">
              文件类型: 全部
            </SelectItem>
            <SelectItem className="subpage-select-item" value="image">
              图片
            </SelectItem>
            <SelectItem className="subpage-select-item" value="video">
              视频
            </SelectItem>
            <SelectItem className="subpage-select-item" value="file">
              文件
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={categoryType}
          onValueChange={(value) => {
            setCategoryType(value as MaterialCategoryFilter);
            resetPage();
          }}
        >
          <SelectTrigger className="subpage-native-select w-[160px]">
            <SelectValue placeholder="文件分类" />
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value="all">
              文件分类: 全部
            </SelectItem>
            <SelectItem className="subpage-select-item" value="system">公共</SelectItem>
            <SelectItem className="subpage-select-item" value="user">私有</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={auditStatus}
          onValueChange={(value) => {
            setAuditStatus(value as MaterialAuditFilter);
            resetPage();
          }}
        >
          <SelectTrigger className="subpage-native-select w-[160px]">
            <SelectValue placeholder="审核状态" />
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
          onValueChange={(value) => {
            setPublishStatus(value as MaterialPublishFilter);
            resetPage();
          }}
        >
          <SelectTrigger className="subpage-native-select w-[160px]">
            <SelectValue placeholder="发布状态" />
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

        <SearchField
          wrapClassName="!max-w-[320px]"
          placeholder="文件名称/标签，回车搜索"
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
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          void uploadFiles(files);
        }}
      />

      <div className="grid [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] gap-5 max-[768px]:grid-cols-1">
        {items.map((item) => (
          <FileMaterialCard
            key={item.id}
            item={item}
            selectable={batchDeleteMode}
            checked={!!selectedIds[item.id]}
            onCheckedChange={(checked) => toggleOne(item.id, checked)}
            onDelete={() => openDelete([item.id])}
            onRename={() => openRename(item)}
            onAudit={() => openAudit(item)}
            onTogglePublish={() =>
              publishMutation.mutate({
                id: item.id,
                status: item.publishStatus === "online" ? "offline" : "online",
              })
            }
            onPreview={(preview) => setPreviewAsset(preview)}
            disabledAudit={auditMutation.isPending}
            disabledPublish={publishMutation.isPending || item.auditStatus !== "approved"}
            disabledDelete={deleteMutation.isPending}
            disabledRename={renameMutation.isPending}
          />
        ))}
      </div>

      {!listQuery.isLoading && items.length === 0 && <div className="py-20 text-center text-muted-foreground">暂无文件</div>}

      <CommonPaginationBar
        total={total || items.length}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={canNextPage}
        onPageNoChange={setPageNo}
        onPageSizeChange={changePageSize}
        pageSizeOptions={[12, 24, 48]}
        showPageSizeSelect={true}
      />

      <MaterialAuditDialog
        open={auditOpen}
        onOpenChange={(open) => {
          setAuditOpen(open);
          if (!open) setAuditTarget(null);
        }}
        title="审核文件"
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
              {deleteIds.length > 1 ? (
                <>
                  确定要删除已选择的 <span className="font-mono">{deleteIds.length}</span> 个文件吗？此操作不可撤销。
                </>
              ) : (
                <>确定要删除当前文件吗？此操作不可撤销。</>
              )}
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
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open);
          if (!open) {
            setRenameTarget(null);
            setRenameValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>修改文件名称</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">修改后仅更新素材展示名称，不影响文件访问地址。</div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">文件名称</label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="请输入文件名称"
                maxLength={255}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmRename();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameOpen(false);
                setRenameTarget(null);
                setRenameValue("");
              }}
            >
              取消
            </Button>
            <Button onClick={confirmRename} disabled={renameMutation.isPending || !renameValue.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MaterialMediaPreviewDialog preview={previewAsset} onClose={() => setPreviewAsset(null)} />
    </PageShell>
  );
}

function getFileExtLower(fileName: string) {
  const base = (fileName || "").split(/[\\/]/).pop() || "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

function resolveFileIcon(meta: { fileName: string; mimeType?: string | null; fileType?: string }) {
  const ext = getFileExtLower(meta.fileName);
  const mime = (meta.mimeType || "").toLowerCase();
  const mimeMain = mime.split(";")[0].trim();

  const isImage = meta.fileType === "image" || mimeMain.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext);
  if (isImage) return { icon: FileImage, label: "图片" };

  const isVideo = meta.fileType === "video" || mimeMain.startsWith("video/") || ["mp4", "mov", "mkv", "webm", "avi", "flv", "m4v"].includes(ext);
  if (isVideo) return { icon: FileVideo, label: "视频" };

  const isAudio = mimeMain.startsWith("audio/") || ["mp3", "wav", "flac", "aac", "ogg", "m4a"].includes(ext);
  if (isAudio) return { icon: FileAudio, label: "音频" };

  const isArchive = ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext);
  if (isArchive) return { icon: FileArchive, label: (ext || "压缩").toUpperCase() };

  const isSpreadsheet = ["xlsx", "xls", "csv"].includes(ext);
  if (isSpreadsheet) return { icon: FileSpreadsheet, label: (ext || "表格").toUpperCase() };

  const isJson = ["json", "yml", "yaml", "toml"].includes(ext) || mimeMain === "application/json";
  if (isJson) return { icon: FileJson, label: (ext || "JSON").toUpperCase() };

  const isCode = ["js", "jsx", "ts", "tsx", "py", "java", "go", "rs", "cpp", "c", "h", "cs", "php", "sh", "bash"].includes(ext);
  if (isCode) return { icon: FileCode, label: (ext || "代码").toUpperCase() };

  if (ext) return { icon: FileText, label: ext.toUpperCase() };
  return { icon: File, label: "文件" };
}

function isSvgLikeImage(meta: { fileName?: string | null; mimeType?: string | null }) {
  const fileName = (meta.fileName || "").toLowerCase().trim();
  const mimeType = (meta.mimeType || "").toLowerCase().trim();
  return mimeType === "image/svg+xml" || fileName.endsWith(".svg");
}

function FileMaterialImageThumbnail(props: {
  src: string;
  alt: string;
  fileName?: string | null;
  mimeType?: string | null;
}) {
  const isSvg = useMemo(() => isSvgLikeImage({ fileName: props.fileName, mimeType: props.mimeType }), [props.fileName, props.mimeType]);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const isTinyRaster = !isSvg && naturalSize ? Math.max(naturalSize.width, naturalSize.height) <= 128 : false;
  const isLargeRaster = !isSvg && naturalSize ? naturalSize.width >= 240 && naturalSize.height >= 180 : false;

  return (
    <img
      src={props.src}
      alt={props.alt}
      className={
        isSvg
          ? "h-full w-full cursor-zoom-in object-contain p-2 transition-transform duration-300 group-hover:scale-[1.02]"
          : isTinyRaster
            ? "max-h-[112px] max-w-[112px] cursor-zoom-in object-contain"
            : isLargeRaster
              ? "h-full w-full cursor-zoom-in object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              : "h-full w-full cursor-zoom-in object-contain p-2 transition-transform duration-300 group-hover:scale-[1.02]"
      }
      loading="lazy"
      onLoad={(event) => {
        const next = {
          width: event.currentTarget.naturalWidth,
          height: event.currentTarget.naturalHeight,
        };
        setNaturalSize((prev) => (prev && prev.width === next.width && prev.height === next.height ? prev : next));
      }}
    />
  );
}

function FileMaterialCard(props: {
  item: FileMaterial;
  selectable: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onDelete: () => void;
  onRename: () => void;
  onAudit: () => void;
  onTogglePublish: () => void;
  onPreview: (preview: { type: "image" | "video"; url: string; title?: string }) => void;
  disabledAudit: boolean;
  disabledPublish: boolean;
  disabledDelete: boolean;
  disabledRename: boolean;
}) {
  const { icon: Icon, label } = useMemo(
    () => resolveFileIcon({ fileName: props.item.fileName, mimeType: props.item.mimeType, fileType: props.item.fileType }),
    [props.item.fileName, props.item.fileType, props.item.mimeType],
  );

  const videoPoster = useVideoPoster(props.item.fileType === "video" ? props.item.accessUrl : "");
  const isPreviewable = props.item.fileType === "image" || props.item.fileType === "video";
  const tagLabels = useMemo(() => parseTagLabels(props.item), [props.item]);
  const visibleTags = tagLabels.slice(0, 2);
  const hiddenTagCount = Math.max(tagLabels.length - visibleTags.length, 0);
  const publishBtnLabel = props.item.publishStatus === "online" ? "下架" : "上架";

  return (
    <div className="group overflow-hidden rounded-lg border bg-card transition-all hover:border-primary/35 hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted flex items-center justify-center">
        {props.item.fileType === "image" ? (
          <button
            type="button"
            className="flex h-full w-full items-center justify-center bg-muted/10"
            onClick={() => props.onPreview({ type: "image", url: props.item.accessUrl, title: props.item.fileName })}
            title="点击放大预览"
          >
            <FileMaterialImageThumbnail
              src={props.item.accessUrl}
              alt={props.item.fileName}
              fileName={props.item.fileName}
              mimeType={props.item.mimeType}
            />
          </button>
        ) : props.item.fileType === "video" ? (
          <button
            type="button"
            className="block h-full w-full"
            onClick={() => props.onPreview({ type: "video", url: props.item.accessUrl, title: props.item.fileName })}
            title="点击放大预览"
          >
            {videoPoster ? (
              <img src={videoPoster} alt={props.item.fileName} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <video src={props.item.accessUrl} className="h-full w-full object-cover" muted preload="metadata" playsInline />
            )}
          </button>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Icon className="h-7 w-7" />
            <span className="text-xs">{label}</span>
          </div>
        )}

        {props.item.fileType === "video" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/70">
              <Play className="h-5 w-5 text-foreground" />
            </div>
          </div>
        )}

        <div className="absolute left-2 top-2 flex items-center gap-2">
          {props.selectable && (
            <div className="rounded-md bg-background/90 p-1" onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={props.checked} onCheckedChange={(value) => props.onCheckedChange(value === true)} aria-label="选择" />
            </div>
          )}
          <Badge variant={materialAuditBadgeVariant(props.item.auditStatus)}>
            {materialAuditLabel(props.item.auditStatus, props.item.auditStatusLabel)}
          </Badge>
          <Badge variant={materialPublishBadgeVariant(props.item.publishStatus)}>
            {materialPublishLabel(props.item.publishStatus, props.item.publishStatusLabel)}
          </Badge>
        </div>

        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-background/90 hover:bg-background"
            onClick={(e) => {
              e.stopPropagation();
              props.onAudit();
            }}
            disabled={props.disabledAudit}
            title="审核"
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-background/90 hover:bg-background"
            onClick={(e) => {
              e.stopPropagation();
              props.onTogglePublish();
            }}
            disabled={props.disabledPublish}
            title={props.disabledPublish ? "需先通过审核" : publishBtnLabel}
          >
            {props.item.publishStatus === "online" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-background/90 text-destructive hover:bg-background"
            onClick={(e) => {
              e.stopPropagation();
              props.onDelete();
            }}
            disabled={props.disabledDelete}
            title="删除"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground" title={props.item.fileName}>
            {props.item.fileName}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={props.onRename}
            disabled={props.disabledRename}
            title="修改名称"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>

        <p className="truncate text-[12px] text-muted-foreground" title={formatOwnerLabel(props.item)}>
          {formatOwnerLabel(props.item)}
        </p>
        <p className="truncate text-[12px] text-muted-foreground" title={materialCategoryLabel(props.item.categoryType, props.item.categoryTypeLabel)}>
          {materialCategoryLabel(props.item.categoryType, props.item.categoryTypeLabel)} · {formatBytes(props.item.fileSize)} · {formatDateTime(props.item.createdAt)}
        </p>

        <div className="min-h-8 border-t border-border pt-2">
          {tagLabels.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {visibleTags.map((tag) => (
                <Badge key={tag} variant="outline" className="max-w-[140px] truncate">
                  {tag}
                </Badge>
              ))}
              {hiddenTagCount > 0 && (
                <Badge variant="outline">+{hiddenTagCount}</Badge>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">暂无标签</span>
          )}
        </div>

        {!isPreviewable && (
          <div className="text-xs text-muted-foreground">
            文件类型: {label}
          </div>
        )}
      </div>
    </div>
  );
}
