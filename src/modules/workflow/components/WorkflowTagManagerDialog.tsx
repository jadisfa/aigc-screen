import { ArrowDown, ArrowUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Label } from "@/shared/ui/label";
import {
  checkDeleteWorkflowTag,
  deleteWorkflowTag,
  listWorkflowTags,
  moveWorkflowTag,
  upsertWorkflowTag,
  type WorkflowSortDirection,
  type WorkflowTag,
} from "@/shared/api/workflow/workflow-tag";
import { formatDateTime } from "@/shared/lib/datetime";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { notify } from "@/shared/lib/notify";

export default function WorkflowTagManagerDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const sessionScope = useSessionScope();

  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const {
    pageNo,
    setPageNo,
    pageSize,
    setPageSize,
    getTotalParam,
    resetPage,
    invalidateTotal,
    changePageSize,
    rememberTotal,
  } = usePagedListQuery(10);

  const listQuery = useQuery({
    queryKey: ["workflowTags", sessionScope.scope.queryScopeKey, pageNo, pageSize, appliedKeyword],
    queryFn: () =>
      listWorkflowTags({
        pageNo,
        pageSize,
        total: getTotalParam(),
        keyword: appliedKeyword.trim() ? appliedKeyword.trim() : undefined,
      }),
    enabled: props.open,
  });

  useEffect(() => {
    rememberTotal(listQuery.data?.page?.total);
  }, [listQuery.data?.page?.total, rememberTotal]);

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.page?.total ?? 0;
  const totalPages = useMemo(() => {
    if (total <= 0) return 0;
    return Math.ceil(total / pageSize);
  }, [pageSize, total]);

  const canNextPage = useMemo(() => {
    if (total > 0) return pageNo * pageSize < total;
    return items.length >= pageSize;
  }, [items.length, pageNo, pageSize, total]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["workflowTags", sessionScope.scope.queryScopeKey] });
    await queryClient.invalidateQueries({ queryKey: ["workflowTagsAll", sessionScope.scope.queryScopeKey] });
  };

  const [editing, setEditing] = useState<WorkflowTag | null>(null);
  const [name, setName] = useState("");
  const [sortNo, setSortNo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setEditing(null);
    setName("");
    setSortNo("");
    setKeyword("");
    setAppliedKeyword("");
    resetPage();
    setPageSize(10);
    setFormOpen(false);
    setFormError(null);
  }, [props.open, resetPage, setPageSize]);

  const applyKeywordSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
    resetPage();
  };

  const upsertMutation = useMutation({
    mutationFn: () =>
      upsertWorkflowTag({
        id: editing?.id,
        name: name.trim(),
        sortNo: sortNo.trim() ? Number(sortNo) : null,
      }),
    onSuccess: async () => {
      invalidateTotal();
      await refresh();
      setEditing(null);
      setName("");
      setSortNo("");
      setFormError(null);
      setFormOpen(false);
      notify.success("保存成功");
    },
    onError: (e) => {
      notify.error("保存失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: WorkflowSortDirection }) => moveWorkflowTag(id, direction),
    onSuccess: async () => {
      await refresh();
    },
    onError: (e) => {
      notify.error("排序失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const sortingDisabled = !!appliedKeyword.trim() || moveMutation.isPending;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<WorkflowTag | null>(null);
  const [deleteConfirmMode, setDeleteConfirmMode] = useState<"initial" | "blocked" | "force">("initial");
  const [deleteCheckMessage, setDeleteCheckMessage] = useState("");
  const [checkingDelete, setCheckingDelete] = useState(false);

  const resetDeleteDialog = () => {
    setDeleteOpen(false);
    setDeleting(null);
    setDeleteConfirmMode("initial");
    setDeleteCheckMessage("");
  };

  const openDelete = (tag: WorkflowTag) => {
    setDeleting(tag);
    setDeleteConfirmMode("initial");
    setDeleteCheckMessage("");
    setDeleteOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => deleteWorkflowTag(id, { force }),
    onSuccess: async () => {
      invalidateTotal();
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
        // handled
      }
      return;
    }

    setCheckingDelete(true);
    try {
      const result = await checkDeleteWorkflowTag(deleting.id);
      if (result.forceRequired) {
        setDeleteConfirmMode("force");
        setDeleteCheckMessage(result.message || "当前标签已关联应用，强力删除后会自动解除这些应用的标签关联");
        return;
      }
      if (!result.canDelete) {
        setDeleteConfirmMode("blocked");
        setDeleteCheckMessage(result.message || "当前标签暂时无法删除");
        return;
      }
      try {
        await deleteMutation.mutateAsync({ id: deleting.id });
      } catch {
        // handled
      }
    } catch (e) {
      notify.error("删除失败", { description: resolveUserErrorMessage(e, "请求失败") });
    } finally {
      setCheckingDelete(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setSortNo("");
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (t: WorkflowTag) => {
    setEditing(t);
    setName(t.name || "");
    setSortNo(t.sortNo != null ? String(t.sortNo) : "");
    setFormError(null);
    setFormOpen(true);
  };

  const submit = async () => {
    if (!name.trim()) {
      setFormError("请输入标签名称");
      return;
    }
    if (sortNo.trim()) {
      const sortNum = Number(sortNo);
      if (!Number.isInteger(sortNum) || sortNum < 0) {
        setFormError("排序号必须是非负整数");
        return;
      }
    }
    setFormError(null);
    await upsertMutation.mutateAsync();
  };

  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none sm:rounded-none p-0 gap-0 flex flex-col">
          <div className="page-content-shell flex flex-col">
            <div className="subpage-toolbar mb-7">
              <DialogTitle className="text-[18px] font-semibold text-foreground">标签管理</DialogTitle>
            </div>

            <div className="subpage-toolbar mb-4">
              <div className="subpage-toolbar-start !flex-nowrap gap-3">
                <div className="subpage-search-wrap !w-[380px] !max-w-[380px] shrink-0">
                  <Search className="subpage-search-icon" />
                  <Input
                    placeholder="标签名称，回车搜索"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyKeywordSearch();
                      }
                    }}
                    className="subpage-search-input"
                  />
                </div>
              </div>
              <div className="subpage-toolbar-end">
                <button className="subpage-primary-btn" onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-1" />
                  添加标签
                </button>
              </div>
            </div>

            <Dialog
              open={formOpen}
              onOpenChange={(o) => {
                setFormOpen(o);
                if (!o) {
                  setEditing(null);
                  setName("");
                  setSortNo("");
                  setFormError(null);
                }
              }}
            >
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>{editing ? "编辑标签" : "新增标签"}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-5 py-1">
                  <div className="space-y-2">
                    <Label className="workflow-form-label" htmlFor="workflow-tag-name">
                      标签名称
                    </Label>
                    <Input
                      id="workflow-tag-name"
                      placeholder="请输入标签名称"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="workflow-form-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="workflow-form-label" htmlFor="workflow-tag-sort-no">
                      排序号
                    </Label>
                    <Input
                      id="workflow-tag-sort-no"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="留空则自动分配"
                      value={sortNo}
                      onChange={(e) => {
                        setSortNo(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="workflow-form-input"
                    />
                    <p className="text-xs text-muted-foreground">数值越小越靠前；留空时由系统自动赋默认值。</p>
                  </div>
                </div>
                {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(null);
                      setName("");
                      setSortNo("");
                      setFormError(null);
                      setFormOpen(false);
                    }}
                  >
                    取消
                  </Button>
                  <Button onClick={submit} disabled={upsertMutation.isPending}>
                    保存
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="text-[13px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">序号</TableHead>
                      <TableHead className="w-24">排序号</TableHead>
                      <TableHead className="min-w-[220px]">标签名称</TableHead>
                      <TableHead className="min-w-[200px]">创建时间</TableHead>
                      <TableHead className="w-40 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                          加载中...
                        </TableCell>
                      </TableRow>
                    )}
                    {listQuery.isError && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-destructive py-12">
                          加载失败：{listQuery.error instanceof Error ? listQuery.error.message : "请求失败"}
                        </TableCell>
                      </TableRow>
                    )}
                    {!listQuery.isLoading &&
                      !listQuery.isError &&
                      items.map((t, idx) => {
                        const absoluteIndex = (pageNo - 1) * pageSize + idx;
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="text-muted-foreground">{absoluteIndex + 1}</TableCell>
                            <TableCell className="text-muted-foreground">{t.sortNo ?? "-"}</TableCell>
                            <TableCell className="font-medium">{t.name}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDateTime(t.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title={appliedKeyword.trim() ? "搜索时不可排序" : "上移"}
                                  disabled={sortingDisabled || absoluteIndex <= 0}
                                  onClick={() => moveMutation.mutate({ id: t.id, direction: "up" })}
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title={appliedKeyword.trim() ? "搜索时不可排序" : "下移"}
                                  disabled={sortingDisabled || absoluteIndex >= total - 1}
                                  onClick={() => moveMutation.mutate({ id: t.id, direction: "down" })}
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-primary hover:bg-primary/10"
                                  onClick={() => openEdit(t)}
                                  title="编辑"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  onClick={() => openDelete(t)}
                                  title="删除"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {!listQuery.isLoading && !listQuery.isError && items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                          暂无标签
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex items-center justify-end mt-4 gap-3 text-sm text-muted-foreground">
              <span>共 {total || items.length} 条</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" disabled={pageNo === 1} onClick={() => setPageNo(1)}>
                  {"<<"}
                </Button>
                <Button variant="ghost" size="sm" disabled={pageNo === 1} onClick={() => setPageNo((p) => Math.max(1, p - 1))}>
                  {"<"}
                </Button>
                <Button variant="ghost" size="sm" disabled={!canNextPage} onClick={() => setPageNo((p) => p + 1)}>
                  {">"}
                </Button>
              </div>
              <span>
                第 {totalPages > 0 ? pageNo : 0} 页 / {pageSize} 条
              </span>

              <div className="subpage-toolbar-end">
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    changePageSize(Number(v));
                  }}
                >
                  <SelectTrigger className="subpage-native-select w-24 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="subpage-select-content">
                    <SelectItem className="subpage-select-item" value="10">
                      10/页
                    </SelectItem>
                    <SelectItem className="subpage-select-item" value="20">
                      20/页
                    </SelectItem>
                    <SelectItem className="subpage-select-item" value="50">
                      50/页
                    </SelectItem>
                    <SelectItem className="subpage-select-item" value="100">
                      100/页
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) resetDeleteDialog();
          else setDeleteOpen(true);
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
                ? deleteCheckMessage || "当前标签暂时无法删除"
                : deleteConfirmMode === "force"
                  ? deleteCheckMessage || "当前标签已关联应用，强力删除后会自动解除这些应用的标签关联"
                  : `将删除标签：${deleting?.name || "-"}。若存在关联应用，系统会提示是否强力删除并自动解除关联。该操作不可恢复。`}
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
    </>
  );
}
