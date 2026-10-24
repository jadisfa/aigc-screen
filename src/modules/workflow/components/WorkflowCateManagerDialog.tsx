import { useEffect, useMemo, useState } from "react";
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
import {
  checkDeleteWorkflowCate,
  deleteWorkflowCate,
  listWorkflowCates,
  upsertWorkflowCate,
  type WorkflowCate,
} from "@/shared/api/workflow/workflow-cate";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { notify } from "@/shared/lib/notify";

export default function WorkflowCateManagerDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const sessionScope = useSessionScope();

  const listQuery = useQuery({
    queryKey: ["workflowCatesAll", sessionScope.scope.queryScopeKey],
    queryFn: () => listWorkflowCates(),
    enabled: props.open,
  });

  const items = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const rootOptions = useMemo(() => items.filter((c) => c.level === 1), [items]);
  const cateById = useMemo(() => {
    const map = new Map<string, WorkflowCate>();
    for (const c of items) map.set(c.id, c);
    return map;
  }, [items]);

  const [editing, setEditing] = useState<WorkflowCate | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [sortNo, setSortNo] = useState("100");
  const [iconUrl, setIconUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setEditing(null);
    setName("");
    setParentId("");
    setSortNo("100");
    setIconUrl("");
    setFormError(null);
  }, [props.open]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["workflowCatesAll", sessionScope.scope.queryScopeKey] });
  };

  const upsertMutation = useMutation({
    mutationFn: () =>
      upsertWorkflowCate({
        id: editing?.id,
        name: name.trim(),
        parentId: parentId.trim() ? parentId.trim() : null,
        sortNo: sortNo.trim() ? Number(sortNo) : null,
        iconUrl: iconUrl.trim() ? iconUrl.trim() : null,
      }),
    onSuccess: async () => {
      await refresh();
      setEditing(null);
      setName("");
      setParentId("");
      setSortNo("100");
      setIconUrl("");
      setFormError(null);
      notify.success("保存成功");
    },
    onError: (e) => {
      notify.error("保存失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<WorkflowCate | null>(null);
  const [deleteConfirmMode, setDeleteConfirmMode] = useState<"initial" | "blocked" | "force">("initial");
  const [deleteCheckMessage, setDeleteCheckMessage] = useState("");
  const [checkingDelete, setCheckingDelete] = useState(false);
  const deletingParentName = deleting?.parentId ? (cateById.get(deleting.parentId)?.name || "上级分类") : null;

  const resetDeleteDialog = () => {
    setDeleteOpen(false);
    setDeleting(null);
    setDeleteConfirmMode("initial");
    setDeleteCheckMessage("");
  };

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
        // handled
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
        // handled
      }
    } catch (e) {
      notify.error("删除失败", { description: resolveUserErrorMessage(e, "请求失败") });
    } finally {
      setCheckingDelete(false);
    }
  };

  const openEdit = (c: WorkflowCate) => {
    setEditing(c);
    setName(c.name || "");
    setParentId(c.parentId || "");
    setSortNo(c.sortNo != null ? String(c.sortNo) : "100");
    setIconUrl(c.iconUrl || "");
    setFormError(null);
  };

  const submit = async () => {
    if (!name.trim()) {
      setFormError("请输入分类名称");
      return;
    }
    const sortNum = Number(sortNo);
    if (Number.isNaN(sortNum) || sortNum < 0) {
      setFormError("sortNo 必须是非负整数");
      return;
    }
    setFormError(null);
    await upsertMutation.mutateAsync();
  };

  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>分类管理</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-4 gap-3 items-center">
              <Input placeholder="名称" value={name} onChange={(e) => setName(e.target.value)} />

              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="父级（可选）" />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  <SelectItem className="subpage-select-item" value="">
                    无（一级分类）
                  </SelectItem>
                  {rootOptions.map((c) => (
                    <SelectItem key={c.id} className="subpage-select-item" value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input placeholder="sortNo" value={sortNo} onChange={(e) => setSortNo(e.target.value)} />
              <Input placeholder="iconUrl（可选）" value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-muted-foreground">{editing ? `编辑：${editing.name}` : "新增分类"}</div>
                {formError ? <p className="text-sm text-destructive mt-1">{formError}</p> : null}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {editing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(null);
                      setName("");
                      setParentId("");
                      setSortNo("100");
                      setIconUrl("");
                      setFormError(null);
                    }}
                  >
                    取消编辑
                  </Button>
                )}
                <Button size="sm" onClick={submit} disabled={upsertMutation.isPending}>
                  保存
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table className="text-[13px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">ID</TableHead>
                    <TableHead className="min-w-[160px]">名称</TableHead>
                    <TableHead className="min-w-[220px]">parentId</TableHead>
                    <TableHead className="w-20 text-center">level</TableHead>
                    <TableHead className="w-20 text-center">sort</TableHead>
                    <TableHead className="w-40">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listQuery.isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        加载中...
                      </TableCell>
                    </TableRow>
                  )}
                  {!listQuery.isLoading &&
                    items.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-[12px]">{c.id}</TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="font-mono text-[12px] text-muted-foreground">{c.parentId || "-"}</TableCell>
                        <TableCell className="text-center">{c.level}</TableCell>
                        <TableCell className="text-center">{c.sortNo ?? "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                              编辑
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => openDelete(c)}
                            >
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  {!listQuery.isLoading && items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        暂无分类
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => props.onOpenChange(false)}>
              关闭
            </Button>
          </DialogFooter>
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
                ? deleteCheckMessage || "当前分类暂时无法删除"
                : deleteConfirmMode === "force"
                  ? deleteCheckMessage || "强力删除将自动解除关联应用的分类关系"
                  : `将删除分类：${deleting?.name || "-"}。若存在关联应用，系统会提示是否强力删除。该操作不可恢复。`}
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
