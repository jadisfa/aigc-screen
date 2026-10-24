import { useEffect, useMemo, useRef, useState } from "react";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Tags, Trash2, Upload } from "lucide-react";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
} from "@/shared/components/page";
import { Input } from "@/shared/ui/input";
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
  deleteMediaMaterials,
  getMediaMaterialByHash,
  listMediaMaterials,
  uploadMediaMaterial,
  type MediaMaterial,
} from "@/shared/api/materials/materials-media";
import { uploadFileMaterialForm } from "@/shared/api/materials/materials-file-material";
import { md5HexFromFile } from "@/shared/lib/md5";
import { formatDateTime } from "@/shared/lib/datetime";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import { listMaterialCategories, listMaterialTags } from "@/shared/api/materials/materials-taxonomy";
import MaterialCategoryManagerDialog from "@/modules/materials/components/MaterialCategoryManagerDialog";
import MaterialTagManagerDialog from "@/modules/materials/components/MaterialTagManagerDialog";
import ImageMaterialUploadDialog from "@/modules/materials/components/ImageMaterialUploadDialog";
import { MaterialMediaPreviewDialog } from "@/modules/materials/components/MaterialMediaPreviewDialog";
import type { MaterialCategoryType } from "@/modules/materials/lib/material-governance";
import { buildScopedHashKey, getSessionScopeReadyError, useSessionScope, withSessionScope } from "@/shared/hooks/use-session-scope";
import { notify } from "@/shared/lib/notify";

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

export default function ImageMaterialsManagementPage() {
  const queryClient = useQueryClient();
  const meQuery = useMePermissions();
  const sessionScope = useSessionScope();

  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, invalidateTotal, changePageSize, rememberTotal } =
    usePagedListQuery(48);
  const [fileNameKeyword, setFileNameKeyword] = useState("");
  const [appliedFileNameKeyword, setAppliedFileNameKeyword] = useState("");
  const [tagId, setTagId] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const applyKeywordSearch = () => {
    const normalized = fileNameKeyword.trim();
    setFileNameKeyword(normalized);
    setAppliedFileNameKeyword(normalized);
    setPageNo(1);
  };

  const categoriesQuery = useQuery({
    queryKey: ["materialCategories", "image", sessionScope.scope.queryScopeKey],
    queryFn: () => listMaterialCategories({ materialType: "image" }),
  });

  const categories = categoriesQuery.data ?? [];

  const tagsQuery = useQuery({
    queryKey: ["materialTags", "image", sessionScope.scope.queryScopeKey, categoryId],
    queryFn: () =>
      listMaterialTags({
        materialType: "image",
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
      mediaType: "image" as const,
      tagId: tagId.trim() ? tagId.trim() : undefined,
      tagName: tagId.trim() ? tagNameById[tagId] : undefined,
      categoryId: categoryId === "all" ? undefined : categoryId,
    };
  }, [categoryId, pageNo, pageSize, tagId, tagNameById]);

  const listQuery = useQuery({
    queryKey: ["materialsMediaMaterial", sessionScope.scope.queryScopeKey, params],
    queryFn: () => listMediaMaterials({ ...params, total: getTotalParam() }),
  });

  useEffect(() => {
    rememberTotal(listQuery.data?.page?.total);
  }, [listQuery.data?.page?.total, rememberTotal]);

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const filteredItems = useMemo(() => {
    const kw = appliedFileNameKeyword.trim().toLowerCase();
    if (!kw) return items;
    return items.filter((item) => {
      const name = fileNameFromUrl(item.assetUrl).toLowerCase();
      return name.includes(kw);
    });
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
      queryClient.invalidateQueries({ queryKey: ["materialsMediaMaterial"] }),
      queryClient.invalidateQueries({ queryKey: ["materialCategories", "image"] }),
      queryClient.invalidateQueries({ queryKey: ["materialTags", "image"] }),
    ]);
  };

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteMediaMaterials(ids),
    onSuccess: async () => {
      notify.success("删除成功");
      invalidateTotal();
      await refresh();
      setSelectedIds({});
    },
    onError: (e) => {
      notify.error("删除失败", { description: e instanceof Error ? e.message : "请求失败" });
    },
  });

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const selectedList = useMemo(() => Object.keys(selectedIds).filter((k) => selectedIds[k]), [selectedIds]);

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => ({ ...prev, [id]: checked }));
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

  const [uploading, setUploading] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFormError, setUploadFormError] = useState<string | null>(null);
  const [uploadCategoryType, setUploadCategoryType] = useState<MaterialCategoryType>("user");
  const [uploadCategoryId, setUploadCategoryId] = useState<string>("none");
  const [uploadTagId, setUploadTagId] = useState<string>("none");
  const [uploadFilesState, setUploadFilesState] = useState<Array<{ key: string; file: File; previewUrl: string; fileHash: string }>>([]);
  const uploadTagsQuery = useQuery({
    queryKey: ["materialTags", "image", sessionScope.scope.queryScopeKey, "upload", uploadCategoryId],
    queryFn: () =>
      listMaterialTags({
        materialType: "image",
        categoryId: uploadCategoryId === "none" ? undefined : uploadCategoryId,
        pageNo: 1,
        pageSize: 200,
      }),
    enabled: uploadOpen,
  });
  const uploadTagOptions = uploadTagsQuery.data?.items ?? [];

  const handlePickFiles = () => {
    fileInputRef.current?.click();
  };

  const appendUploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploadFormError(null);
    const batch = await Promise.all(
      files.map(async (f, idx) => ({
        key: `${f.name}-${f.size}-${f.lastModified}-${idx}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
        fileHash: await md5HexFromFile(f),
      })),
    );
    setUploadFilesState((prev) => {
      const existedHash = new Set(prev.map((x) => buildScopedHashKey(sessionScope.scope.queryScopeKey, x.fileHash)));
      const next = [...prev];
      batch.forEach((b) => {
        const dedupKey = buildScopedHashKey(sessionScope.scope.queryScopeKey, b.fileHash);
        if (!existedHash.has(dedupKey)) next.push(b);
      });
      return next;
    });
  };

  const removeUploadFile = (key: string) => {
    setUploadFormError(null);
    setUploadFilesState((prev) => {
      const target = prev.find((x) => x.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((x) => x.key !== key);
    });
  };

  const saveUpload = async () => {
    if (uploadCategoryId === "none") {
      setUploadFormError("请选择素材分类");
      return;
    }
    if (uploadFilesState.length === 0) {
      setUploadFormError("请先选择图片素材");
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
      for (const item of uploadFilesState) {
        try {
          const existed = await getMediaMaterialByHash(withSessionScope(sessionScope.scope, { mediaType: "image", fileHash: item.fileHash }));
          if (existed) {
            continue;
          }
          const fileResult = await uploadFileMaterialForm(withSessionScope(sessionScope.scope, {
            file: item.file,
            fileType: "image",
            fileHash: item.fileHash,
          }));
          await uploadMediaMaterial(withSessionScope(sessionScope.scope, {
            mediaType: "image",
            categoryType: uploadCategoryType,
            fileHash: item.fileHash,
            assetUrl: fileResult.file.accessUrl,
            previewUrl: fileResult.file.accessUrl,
            tags: uploadTagId !== "none" ? [uploadTagId] : undefined,
            materialCategoryId: uploadCategoryId,
          }));
        } catch (e) {
          notify.error("上传失败", { description: e instanceof Error ? e.message : "请求失败" });
        }
      }
      notify.success("上传成功");
      await refresh();
      setUploadOpen(false);
      setUploadFormError(null);
      setUploadCategoryId("none");
      setUploadTagId("none");
      setUploadFilesState((prev) => {
        prev.forEach((x) => URL.revokeObjectURL(x.previewUrl));
        return [];
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
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
        title="图片文件"
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
              disabled={uploading}
            >
              <Upload className="w-4 h-4" />
              图片上传
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

      <PageFilterBar>
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
        <SearchField
          wrapClassName="max-w-md"
          placeholder="按文件名称搜索，回车搜索"
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
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const fs = e.target.files ? Array.from(e.target.files) : [];
          void appendUploadFiles(fs);
        }}
      />

      <div className="grid [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))] gap-5 max-[768px]:grid-cols-1">
        {filteredItems.map((item) => (
          <ImageFileCard
            key={item.id}
            item={item}
            checked={!!selectedIds[item.id]}
            onCheckedChange={(v) => toggleOne(item.id, v)}
            onDelete={() => openDelete([item.id])}
            onPreview={(url, title) => setPreviewAsset({ type: "image", url, title })}
            disabled={deleteMutation.isPending}
          />
        ))}
      </div>

      {!listQuery.isLoading && filteredItems.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">暂无图片文件</div>
      )}

      <CommonPaginationBar
        total={total || items.length}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={canNextPage}
        onPageNoChange={setPageNo}
        showPageSizeSelect={true}
        pageSizeOptions={[12, 24, 48]}
        onPageSizeChange={changePageSize}
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
              确定要删除 {deleteIds.length} 个图片文件吗？此操作不可撤销。
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

      <MaterialCategoryManagerDialog open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} materialType="image" title="图片分类管理" />
      <MaterialTagManagerDialog open={tagManagerOpen} onOpenChange={setTagManagerOpen} materialType="image" title="图片标签管理" />
      <ImageMaterialUploadDialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) {
            setUploadFormError(null);
            setUploadCategoryType("user");
            setUploadCategoryId("none");
            setUploadTagId("none");
            setUploadFilesState((prev) => {
              prev.forEach((x) => URL.revokeObjectURL(x.previewUrl));
              return [];
            });
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
        uploadFiles={uploadFilesState}
        onPickFiles={handlePickFiles}
        onRemoveFile={removeUploadFile}
        onCancel={() => setUploadOpen(false)}
        onSave={() => void saveUpload()}
        uploading={uploading}
        formError={uploadFormError}
      />
      <MaterialMediaPreviewDialog preview={previewAsset} onClose={() => setPreviewAsset(null)} />
    </PageShell>
  );
}

function ImageFileCard(props: {
  item: MediaMaterial;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
  onDelete: () => void;
  onPreview: (url: string, title: string) => void;
}) {
  const previewUrl = props.item.assetUrl;
  const name = fileNameFromUrl(props.item.assetUrl) || props.item.id;
  return (
    <div className="rounded-lg border bg-card overflow-hidden group hover:shadow-md hover:border-primary/35 transition-all">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <button type="button" className="block w-full h-full" onClick={() => props.onPreview(previewUrl, name)} title="点击放大预览">
          <img
            src={previewUrl}
            alt={name}
            className="w-full h-full cursor-zoom-in object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </button>
        <div className="absolute top-2 left-2">
          <Checkbox checked={props.checked} onCheckedChange={(v) => props.onCheckedChange(v === true)} aria-label="选择" />
        </div>
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-background/90 hover:bg-background"
            onClick={props.onDelete}
            disabled={props.disabled}
            title="删除"
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>
      <div className="p-4 space-y-1.5">
        <p className="text-[15px] font-semibold text-foreground truncate" title={name}>{name}</p>
        <p className="text-[12px] text-muted-foreground">
          {props.item.fileHash ? `${props.item.fileHash.slice(0, 10)}…` : "-"}
        </p>
        <p className="text-[12px] text-muted-foreground">{formatDateTime(props.item.createdAt)}</p>
      </div>
    </div>
  );
}
