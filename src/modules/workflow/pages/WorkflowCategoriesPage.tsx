import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, CornerDownRight, GripVertical, Pencil, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/shared/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
} from "@/shared/components/page";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { checkDeleteWorkflowCate, deleteWorkflowCate, listWorkflowCates, upsertWorkflowCate, type WorkflowCate } from "@/shared/api/workflow/workflow-cate";
import { buildTwoLevelWorkflowCateTree, canAddChildCate, type WorkflowCateTreeNode } from "./workflow-cate-tree";
import { getFileMaterialByHash, uploadFileMaterialForm } from "@/shared/api/materials/materials-file-material";
import { md5HexFromFile } from "@/shared/lib/md5";
import FileMaterialPickerDialog from "@/shared/components/FileMaterialPickerDialog";
import { CateIcon } from "../components/CateIcon";
import { getSessionScopeReadyError, useSessionScope, withSessionScope } from "@/shared/hooks/use-session-scope";
import { notify } from "@/shared/lib/notify";

const EMPTY_WORKFLOW_CATES: WorkflowCate[] = [];
type CateDragState = { id: string; parentId: string | null };

function filterTree(tree: WorkflowCateTreeNode[], keyword: string): WorkflowCateTreeNode[] {
  const q = keyword.trim();
  if (!q) return tree;
  return tree
    .map((r) => {
      const rootMatch = r.name?.includes(q);
      const children = r.children.filter((c) => c.name?.includes(q));
      if (rootMatch) return r;
      if (children.length > 0) return { ...r, children };
      return null;
    })
    .filter(Boolean) as WorkflowCateTreeNode[];
}

export default function WorkflowCategoriesPage() {
  const queryClient = useQueryClient();
  const sessionScope = useSessionScope();

  const listQuery = useQuery({
    queryKey: ["workflowCatesAll", sessionScope.scope.queryScopeKey],
    queryFn: () => listWorkflowCates(),
  });

  const items = listQuery.data ?? EMPTY_WORKFLOW_CATES;
  const cateById = useMemo(() => {
    const map = new Map<string, WorkflowCate>();
    for (const c of items) map.set(c.id, c);
    return map;
  }, [items]);

  const tree = useMemo(() => buildTwoLevelWorkflowCateTree(items), [items]);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const filteredTree = useMemo(() => filterTree(tree, appliedKeyword), [tree, appliedKeyword]);

  const applyKeywordSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
  };

  const [expandedRootIds, setExpandedRootIds] = useState<string[]>([]);
  const expandedSet = useMemo(() => new Set(expandedRootIds), [expandedRootIds]);

  useEffect(() => {
    if (tree.length === 0) return;
    setExpandedRootIds((prev) => {
      if (prev.length > 0) return prev;
      return tree.map((r) => r.id);
    });
  }, [tree]);

  useEffect(() => {
    const q = appliedKeyword.trim();
    if (!q) return;
    const ids = filteredTree.map((r) => r.id);
    setExpandedRootIds((prev) => Array.from(new Set([...prev, ...ids])));
  }, [appliedKeyword, filteredTree]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["workflowCatesAll", sessionScope.scope.queryScopeKey] });
  };

  const toggleRoot = (id: string) => {
    setExpandedRootIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const expandAll = () => setExpandedRootIds(filteredTree.map((r) => r.id));
  const collapseAll = () => setExpandedRootIds([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formId, setFormId] = useState<string | null>(null);
  const [formParentId, setFormParentId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formIconUrl, setFormIconUrl] = useState("");
  const [formSortNo, setFormSortNo] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingLocalIcon, setUploadingLocalIcon] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const iconFileInputRef = useRef<HTMLInputElement | null>(null);
  const [draggingCate, setDraggingCate] = useState<CateDragState | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ id: string; placement: "before" | "after" } | null>(null);

  const openCreateRoot = () => {
    setFormMode("create");
    setFormId(null);
    setFormParentId(null);
    setFormName("");
    setFormIconUrl("");
    setFormSortNo("");
    setFormError(null);
    setFormOpen(true);
  };

  const openCreateChild = (parent: WorkflowCateTreeNode) => {
    setFormMode("create");
    setFormId(null);
    setFormParentId(parent.id);
    setFormName("");
    setFormIconUrl("");
    setFormSortNo("");
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (c: WorkflowCate) => {
    setFormMode("edit");
    setFormId(c.id);
    setFormParentId(c.parentId ?? null);
    setFormName(c.name || "");
    setFormIconUrl(c.iconUrl || "");
    setFormSortNo(c.sortNo != null ? String(c.sortNo) : "");
    setFormError(null);
    setFormOpen(true);
  };

  const resetForm = () => {
    setFormOpen(false);
    setFormMode("create");
    setFormId(null);
    setFormParentId(null);
    setFormName("");
    setFormIconUrl("");
    setFormSortNo("");
    setFormError(null);
    setUploadingLocalIcon(false);
  };

  const hasSiblingNameConflict = (name: string, parentId: string | null, currentId: string | null) => {
    const normalizedName = name.trim();
    if (!normalizedName) return false;
    return items.some((item) => item.parentId === parentId && item.name?.trim() === normalizedName && item.id !== currentId);
  };

  const getSiblingIds = (parentId: string | null) => {
    if (!parentId) {
      return tree.map((root) => root.id);
    }
    return tree.find((root) => root.id === parentId)?.children.map((child) => child.id) ?? [];
  };

  const upsertMutation = useMutation({
    mutationFn: async ({ sortNo }: { sortNo: number | null }) => {
      const name = formName.trim();
      const parentId = formParentId ?? null;
      return upsertWorkflowCate({
        id: formMode === "edit" ? formId : null,
        name,
        parentId,
        iconUrl: formIconUrl.trim() ? formIconUrl.trim() : null,
        sortNo,
      });
    },
    onSuccess: async () => {
      await refresh();
      resetForm();
      notify.success("保存成功");
    },
    onError: (e) => {
      notify.error("保存失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ cate, targetSortNo }: { cate: WorkflowCate; targetSortNo: number }) =>
      upsertWorkflowCate({
        id: cate.id,
        name: cate.name,
        parentId: cate.parentId,
        iconUrl: cate.iconUrl,
        sortNo: targetSortNo,
      }),
    onSuccess: async () => {
      await refresh();
    },
    onError: (e) => {
      notify.error("排序失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const handleUploadLocalIcon = async (file?: File) => {
    if (!file) return;
    const uploadBlockReason = getSessionScopeReadyError(sessionScope);
    if (uploadBlockReason) {
      notify.error("上传暂不可用", { description: uploadBlockReason });
      return;
    }
    setUploadingLocalIcon(true);
    try {
      const fileHash = await md5HexFromFile(file);
      const existed = await getFileMaterialByHash(withSessionScope(sessionScope.scope, { fileHash }));
      if (existed?.accessUrl) {
        setFormIconUrl(existed.accessUrl);
        notify.success("上传成功");
        return;
      }
      const uploaded = await uploadFileMaterialForm(withSessionScope(sessionScope.scope, {
        file,
        fileType: "image",
        fileHash,
      }));
      setFormIconUrl(uploaded.file.accessUrl);
      notify.success("上传成功");
    } catch (e) {
      notify.error("上传失败", { description: resolveUserErrorMessage(e, "请求失败") });
    } finally {
      setUploadingLocalIcon(false);
    }
  };

  const submitForm = async () => {
    const trimmedName = formName.trim();
    const trimmedSortNo = formSortNo.trim();
    const parsedSortNo = trimmedSortNo ? Number(trimmedSortNo) : null;

    if (!trimmedName) {
      setFormError("请输入分类名称");
      return;
    }

    if (trimmedSortNo && (!Number.isInteger(parsedSortNo) || (parsedSortNo ?? 0) <= 0)) {
      setFormError("排序值需为大于 0 的整数");
      return;
    }

    if (hasSiblingNameConflict(trimmedName, formParentId, formMode === "edit" ? formId : null)) {
      setFormError(formParentId ? "同一一级分类下已存在同名二级分类，请修改名称后再保存" : "已存在同名一级分类，请修改名称后再保存");
      return;
    }

    if (formMode === "create" && formParentId) {
      const parent = cateById.get(formParentId);
      if (parent && !canAddChildCate(parent)) {
        setFormError("二级分类下不可再新增子分类");
        return;
      }
    }
    setFormError(null);
    await upsertMutation.mutateAsync({ sortNo: parsedSortNo });
  };

  const reorderCateToIndex = async (cate: WorkflowCate, targetIndex: number) => {
    const siblingIds = getSiblingIds(cate.parentId ?? null);
    const currentIndex = siblingIds.indexOf(cate.id);
    if (currentIndex < 0) return;
    const normalizedIndex = Math.max(0, Math.min(targetIndex, siblingIds.length - 1));
    if (normalizedIndex === currentIndex) return;
    await reorderMutation.mutateAsync({ cate, targetSortNo: normalizedIndex + 1 });
  };

  const moveCateByStep = async (cate: WorkflowCate, step: number) => {
    const siblingIds = getSiblingIds(cate.parentId ?? null);
    const currentIndex = siblingIds.indexOf(cate.id);
    if (currentIndex < 0) return;
    await reorderCateToIndex(cate, currentIndex + step);
  };

  const handleCateDragStart = (e: React.DragEvent<HTMLButtonElement>, cate: WorkflowCate) => {
    if (keyword.trim() || reorderMutation.isPending) return;
    setDraggingCate({ id: cate.id, parentId: cate.parentId ?? null });
    setDragOverTarget(null);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", cate.id);
  };

  const handleCateDragEnd = () => {
    setDraggingCate(null);
    setDragOverTarget(null);
  };

  const handleCateDragOver = (e: React.DragEvent<HTMLDivElement>, target: WorkflowCate) => {
    if (!draggingCate || draggingCate.id === target.id) return;
    if ((target.parentId ?? null) !== draggingCate.parentId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const placement = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
    setDragOverTarget((prev) => (prev?.id === target.id && prev.placement === placement ? prev : { id: target.id, placement }));
  };

  const handleCateDrop = async (e: React.DragEvent<HTMLDivElement>, target: WorkflowCate) => {
    e.preventDefault();
    if (!draggingCate || draggingCate.id === target.id) {
      setDragOverTarget(null);
      return;
    }
    const draggedCate = cateById.get(draggingCate.id);
    const targetParentId = target.parentId ?? null;
    if (!draggedCate || (draggedCate.parentId ?? null) !== targetParentId) {
      setDraggingCate(null);
      setDragOverTarget(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const placement = dragOverTarget?.id === target.id ? dragOverTarget.placement : e.clientY - rect.top < rect.height / 2 ? "before" : "after";
    const siblingIds = getSiblingIds(targetParentId);
    const nextIds = siblingIds.filter((id) => id !== draggedCate.id);
    let insertIndex = nextIds.indexOf(target.id);
    if (insertIndex < 0) {
      setDraggingCate(null);
      setDragOverTarget(null);
      return;
    }
    if (placement === "after") insertIndex += 1;
    nextIds.splice(insertIndex, 0, draggedCate.id);

    const unchanged = nextIds.length === siblingIds.length && nextIds.every((id, index) => id === siblingIds[index]);
    if (!unchanged) {
      await reorderMutation.mutateAsync({ cate: draggedCate, targetSortNo: insertIndex + 1 });
    }
    setDraggingCate(null);
    setDragOverTarget(null);
  };

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<WorkflowCate | null>(null);
  const [deleteConfirmMode, setDeleteConfirmMode] = useState<"initial" | "blocked" | "force">("initial");
  const [deleteCheckMessage, setDeleteCheckMessage] = useState("");
  const [checkingDelete, setCheckingDelete] = useState(false);
  const deletingParentName = deleting?.parentId ? (cateById.get(deleting.parentId)?.name || "上级分类") : null;

  const openDelete = (cate: WorkflowCate) => {
    setDeleting(cate);
    setDeleteCheckMessage("");

    const isRoot = !cate.parentId;
    if (isRoot) {
      const childCount = items.filter((item) => item.parentId === cate.id).length;
      if (childCount > 0) {
        setDeleteConfirmMode("blocked");
        setDeleteCheckMessage(`当前一级分类下还有 ${childCount} 个二级分类，请先删除或调整二级分类后再试`);
        setDeleteOpen(true);
        return;
      }
    }

    setDeleteConfirmMode("initial");
    setDeleteOpen(true);
  };

  const resetDeleteDialog = () => {
    setDeleteOpen(false);
    setDeleting(null);
    setDeleteConfirmMode("initial");
    setDeleteCheckMessage("");
  };

  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => deleteWorkflowCate(id, { force }),
    onSuccess: async () => {
      await refresh();
      resetDeleteDialog();
      notify.success("删除成功");
    },
    onError: (e) => {
      notify.error("删除失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const handleDeleteConfirm = async () => {
    if (!deleting || deleteConfirmMode === "blocked") return;

    if (deleteConfirmMode === "force") {
      try {
        await deleteMutation.mutateAsync({ id: deleting.id, force: true });
      } catch {
        // Errors are handled in mutation callbacks.
      }
      return;
    }

    setCheckingDelete(true);
    try {
      const result = await checkDeleteWorkflowCate(deleting.id);
      if (result.forceRequired) {
        setDeleteConfirmMode("force");
        setDeleteCheckMessage(
          result.message ||
            (deleting.parentId
              ? `当前二级分类已关联应用，强力删除后会自动将这些应用调整到上级分类“${deletingParentName || "上级分类"}”`
              : "当前分类已关联应用，强力删除后会自动解除这些应用的分类关系")
        );
        return;
      }
      if (!result.canDelete) {
        setDeleteConfirmMode("blocked");
        setDeleteCheckMessage(result.message || "当前分类暂时无法删除");
        return;
      }
      try {
        await deleteMutation.mutateAsync({ id: deleting.id });
      } catch {
        // Errors are handled in mutation callbacks.
      }
    } catch (e) {
      notify.error("删除失败", { description: resolveUserErrorMessage(e, "请求失败") });
    } finally {
      setCheckingDelete(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="应用分类"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => refresh()} disabled={listQuery.isFetching}>
              <RefreshCw className="w-4 h-4 mr-1" />
              刷新
            </Button>
            <Button variant="pageOutline" onClick={expandAll} disabled={filteredTree.length === 0}>
              展开全部
            </Button>
            <Button variant="pageOutline" onClick={collapseAll} disabled={expandedRootIds.length === 0}>
              收起全部
            </Button>
            <Button variant="page" onClick={openCreateRoot}>
              <Plus className="w-4 h-4 mr-1" />
              新增一级分类
            </Button>
          </>
        }
      />

      <PageFilterBar>
        <SearchField
          wrapClassName="!w-[380px] !max-w-[380px] shrink-0"
          placeholder="搜索分类名称，回车搜索"
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

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {listQuery.isLoading && <div className="text-sm text-muted-foreground py-12 text-center">加载中...</div>}
        {listQuery.isError && (
          <div className="text-sm text-destructive py-12 text-center">
            加载失败：{listQuery.error instanceof Error ? listQuery.error.message : "请求失败"}
          </div>
        )}
        {!listQuery.isLoading && !listQuery.isError && filteredTree.length === 0 && (
          <div className="text-sm text-muted-foreground py-12 text-center">暂无分类</div>
        )}

        {!listQuery.isLoading &&
          !listQuery.isError &&
          filteredTree.map((root) => {
            const expanded = expandedSet.has(root.id);
            return (
              <div key={root.id} className="border-b border-border last:border-b-0">
                <div
                  className="relative flex items-center justify-between px-4 py-3"
                  onDragOver={(e) => handleCateDragOver(e, root)}
                  onDrop={(e) => {
                    void handleCateDrop(e, root);
                  }}
                >
                  {dragOverTarget?.id === root.id && (
                    <div className={`absolute left-0 right-0 ${dragOverTarget.placement === "before" ? "top-0" : "bottom-0"} h-0.5 bg-primary`} />
                  )}
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted shrink-0"
                      onClick={() => toggleRoot(root.id)}
                      aria-label={expanded ? "收起" : "展开"}
                    >
                      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      draggable={!keyword.trim() && !reorderMutation.isPending}
                      onDragStart={(e) => handleCateDragStart(e, root)}
                      onDragEnd={handleCateDragEnd}
                      onClick={(e) => e.stopPropagation()}
                      className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40 cursor-grab active:cursor-grabbing"
                      disabled={!!keyword.trim() || reorderMutation.isPending}
                      title={keyword.trim() ? "搜索时不可拖拽排序" : "拖拽排序"}
                    >
                      <GripVertical className="w-4 h-4" />
                    </button>
                    <CateIcon url={root.iconUrl} alt={root.name} className="h-9 w-9" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{root.name}</div>
                      <div className="text-xs text-muted-foreground">
                        一级分类 · 排序 {root.sortNo ?? "-"} · {root.children.length} 个二级
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => void moveCateByStep(root, -1)}
                      title="上移"
                      disabled={reorderMutation.isPending || getSiblingIds(null).indexOf(root.id) <= 0}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => void moveCateByStep(root, 1)}
                      title="下移"
                      disabled={reorderMutation.isPending || getSiblingIds(null).indexOf(root.id) >= getSiblingIds(null).length - 1}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCreateChild(root)} title="新增二级分类">
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(root)} title="编辑">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => openDelete(root)}
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {expanded && root.children.length > 0 && (
                  <div className="px-4 pb-3">
                    <div className="pl-9 space-y-1">
                      {root.children.map((child) => (
                          <div
                            key={child.id}
                            className="relative flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted/40"
                            onDragOver={(e) => handleCateDragOver(e, child)}
                            onDrop={(e) => {
                              void handleCateDrop(e, child);
                            }}
                          >
                            {dragOverTarget?.id === child.id && (
                              <div className={`absolute left-0 right-0 ${dragOverTarget.placement === "before" ? "top-0" : "bottom-0"} h-0.5 bg-primary`} />
                            )}
                            <div className="flex items-center gap-2 min-w-0">
                              <CornerDownRight className="w-4 h-4 text-muted-foreground shrink-0" />
                              <button
                                type="button"
                                draggable={!keyword.trim() && !reorderMutation.isPending}
                                onDragStart={(e) => handleCateDragStart(e, child)}
                                onDragEnd={handleCateDragEnd}
                                onClick={(e) => e.stopPropagation()}
                                className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40 cursor-grab active:cursor-grabbing"
                                disabled={!!keyword.trim() || reorderMutation.isPending}
                                title={keyword.trim() ? "搜索时不可拖拽排序" : "拖拽排序"}
                              >
                                <GripVertical className="w-4 h-4" />
                              </button>
                              <CateIcon url={child.iconUrl} alt={child.name} className="h-8 w-8" />
                              <div className="min-w-0">
                                <div className="text-[14px] truncate">{child.name}</div>
                                <div className="text-xs text-muted-foreground">二级分类 · 排序 {child.sortNo ?? "-"}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => void moveCateByStep(child, -1)}
                                title="上移"
                                disabled={reorderMutation.isPending || getSiblingIds(root.id).indexOf(child.id) <= 0}
                              >
                                <ArrowUp className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => void moveCateByStep(child, 1)}
                                title="下移"
                                disabled={reorderMutation.isPending || getSiblingIds(root.id).indexOf(child.id) >= getSiblingIds(root.id).length - 1}
                              >
                                <ArrowDown className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(child)} title="编辑">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => openDelete(child)}
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          else setFormOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {formMode === "edit" ? "编辑分类" : formParentId ? "新增二级分类" : "新增一级分类"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {formParentId && (
              <div className="text-sm text-muted-foreground">
                父级：
                <span className="text-foreground font-medium ml-1">{cateById.get(formParentId)?.name || formParentId}</span>
              </div>
            )}

            <div className="flex items-start gap-4">
              <CateIcon url={formIconUrl} alt={formName} className="h-28 w-28" />
              <div className="flex-1 min-w-0 space-y-2">
                <Input
                  placeholder="分类名称"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (formError) setFormError(null);
                  }}
                />
                <Input placeholder="iconUrl（可选）" value={formIconUrl} onChange={(e) => setFormIconUrl(e.target.value)} />

                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    ref={iconFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      void handleUploadLocalIcon(file);
                      e.currentTarget.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => iconFileInputRef.current?.click()}
                    disabled={uploadingLocalIcon}
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    本地上传
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setMaterialPickerOpen(true)} disabled={uploadingLocalIcon}>
                    从素材库选择
                  </Button>
                  {formIconUrl.trim() && (
                    <Button type="button" variant="ghost" onClick={() => setFormIconUrl("")} disabled={uploadingLocalIcon}>
                      清空图标
                    </Button>
                  )}
                </div>
                {/* <div className="space-y-1">
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="排序值（可选，默认追加到同级末尾）"
                    value={formSortNo}
                    onChange={(e) => setFormSortNo(e.target.value)}
                  />
                  <div className="text-xs text-muted-foreground">排序值越小越靠前；留空时按新增顺序自动递增。</div>
                </div> */}
              </div>
            </div>
          </div>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => resetForm()}>
              取消
            </Button>
            <Button onClick={submitForm} disabled={upsertMutation.isPending || reorderMutation.isPending || uploadingLocalIcon}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FileMaterialPickerDialog
        open={materialPickerOpen}
        onOpenChange={setMaterialPickerOpen}
        title="选择分类图标"
        fileType="image"
        onPick={(url) => {
          setFormIconUrl(url);
        }}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetDeleteDialog();
            return;
          }
          setDeleteOpen(true);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirmMode === "blocked"
                ? "无法删除"
                : deleteConfirmMode === "force"
                  ? "需要强力删除"
                  : "确认删除"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmMode === "blocked"
                ? deleteCheckMessage || "当前分类暂时无法删除"
                : deleteConfirmMode === "force"
                  ? deleteCheckMessage ||
                    (deleting?.parentId
                      ? `此分类已关联应用。强力删除后，这些应用会自动调整到父分类“${deletingParentName || "上级分类"}”。`
                      : "此分类已关联应用。强力删除后，会自动解除这些应用的分类关系。")
                  : `将删除分类：${deleting?.name || "-"}。该操作不可恢复。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {deleteConfirmMode === "blocked" ? (
              <AlertDialogCancel>知道了</AlertDialogCancel>
            ) : (
              <>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  className={deleteConfirmMode === "force" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
                  onClick={async (e) => {
                    e.preventDefault();
                    await handleDeleteConfirm();
                  }}
                  disabled={deleteMutation.isPending || checkingDelete}
                >
                  {checkingDelete ? "检查中..." : deleteConfirmMode === "force" ? "强力删除" : "删除"}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
