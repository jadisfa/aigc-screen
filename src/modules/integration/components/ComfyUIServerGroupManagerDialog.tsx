import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePagedTotal } from "@/shared/hooks/use-paged-total";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
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
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { formatDateTime } from "@/shared/lib/datetime";
import {
  createComfyUIServerGroup,
  deleteComfyUIServerGroup,
  listComfyUIServerGroups,
  updateComfyUIServerGroup,
  type ComfyUIServerGroup,
} from "@/shared/api/comfyui/comfyui-server-group";
import { notify } from "@/shared/lib/notify";

export default function ComfyUIServerGroupManagerDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();

  const [keyword, setKeyword] = useState("");
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ComfyUIServerGroup | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setKeyword("");
    setPageNo(1);
    setPageSize(10);
    setFormOpen(false);
    setFormMode("create");
    setEditing(null);
    setName("");
    setDescription("");
    setFormError(null);
  }, [props.open]);

  const listQuery = useQuery({
    queryKey: ["intComfyUIServerGroups", pageNo, pageSize, keyword],
    queryFn: () =>
      listComfyUIServerGroups({
        pageNo,
        pageSize,
        total: requestTotal,
        keyword: keyword.trim() ? keyword.trim() : undefined,
      }),
    enabled: props.open,
  });

  const requestTotal = usePagedTotal(pageNo, listQuery.data?.page?.total);

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.page?.total ?? 0;
  const canNextPage = useMemo(() => {
    if (total > 0) return pageNo * pageSize < total;
    return items.length === pageSize;
  }, [items.length, pageNo, pageSize, total]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["intComfyUIServerGroups"] });
    await queryClient.invalidateQueries({ queryKey: ["intComfyUIServerGroupsAll"] });
    await queryClient.invalidateQueries({ queryKey: ["intComfyUIServers"] });
  };

  const createMutation = useMutation({
    mutationFn: () => createComfyUIServerGroup({ name: name.trim(), description: description.trim() ? description.trim() : null }),
    onSuccess: async () => {
      notify.success("创建成功");
      await refresh();
      setFormOpen(false);
      setName("");
      setDescription("");
      setEditing(null);
      setFormMode("create");
      setFormError(null);
    },
    onError: (e) => {
      notify.error("创建失败", { description: resolveUserErrorMessage(e, "创建失败") });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateComfyUIServerGroup(editing!.id, { name: name.trim(), description: description.trim() ? description.trim() : null }),
    onSuccess: async () => {
      notify.success("保存成功");
      await refresh();
      setFormOpen(false);
      setName("");
      setDescription("");
      setEditing(null);
      setFormMode("create");
      setFormError(null);
    },
    onError: (e) => {
      notify.error("保存失败", { description: resolveUserErrorMessage(e, "保存失败") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteComfyUIServerGroup(id),
    onSuccess: async () => {
      notify.success("删除成功");
      await refresh();
    },
    onError: (e) => {
      notify.error("删除失败", { description: resolveUserErrorMessage(e, "删除失败") });
    },
  });

  const openCreate = () => {
    setFormMode("create");
    setEditing(null);
    setName("");
    setDescription("");
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (g: ComfyUIServerGroup) => {
    setFormMode("edit");
    setEditing(g);
    setName(g.name || "");
    setDescription(g.description || "");
    setFormError(null);
    setFormOpen(true);
  };

  const submitForm = () => {
    if (!name.trim()) {
      setFormError("请输入分组名称");
      return;
    }
    setFormError(null);
    if (formMode === "create") {
      createMutation.mutate();
      return;
    }
    if (!editing?.id) return;
    updateMutation.mutate();
  };

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<ComfyUIServerGroup | null>(null);

  const openDelete = (g: ComfyUIServerGroup) => {
    setDeleting(g);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteMutation.mutateAsync(deleting.id);
    setDeleteOpen(false);
    setDeleting(null);
  };

  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none sm:rounded-none p-0 gap-0 flex flex-col">
          <div className="page-content-shell flex flex-col">
            <div className="subpage-toolbar mb-7">
              <h1 className="text-[18px] font-semibold text-foreground">分组管理</h1>
            </div>

            <div className="subpage-toolbar mb-4">
              <div className="subpage-toolbar-start !flex-nowrap gap-3">
                <div className="subpage-search-wrap !w-[380px] !max-w-[380px] shrink-0">
                  <Search className="subpage-search-icon" />
                  <Input
                    placeholder="分组名称"
                    value={keyword}
                    onChange={(e) => {
                      setKeyword(e.target.value);
                      setPageNo(1);
                    }}
                    className="subpage-search-input"
                  />
                </div>
              </div>
              <div className="subpage-toolbar-end">
                <button className="subpage-primary-btn" onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-1" />
                  新增分组
                </button>
              </div>
            </div>

            <Dialog
              open={formOpen}
              onOpenChange={(o) => {
                setFormOpen(o);
                if (!o) {
                  setEditing(null);
                  setFormMode("create");
                  setName("");
                  setDescription("");
                  setFormError(null);
                }
              }}
            >
              <DialogContent className="sm:max-w-[640px]">
                <DialogHeader>
                  <DialogTitle>{formMode === "create" ? "新增分组" : "编辑分组"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="分组名称（必填）"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (formError) setFormError(null);
                    }}
                  />
                  <Input placeholder="描述（可选）" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(null);
                      setFormMode("create");
                      setName("");
                      setDescription("");
                      setFormError(null);
                      setFormOpen(false);
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={submitForm}
                    disabled={createMutation.isPending || updateMutation.isPending || !name.trim() || (formMode === "edit" && !editing?.id)}
                  >
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
                      <TableHead className="min-w-[220px]">分组名称</TableHead>
                      <TableHead className="min-w-[360px]">描述</TableHead>
                      <TableHead className="w-32 text-center">服务器数</TableHead>
                      <TableHead className="min-w-[200px]">更新时间</TableHead>
                      <TableHead className="w-28 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                          加载中...
                        </TableCell>
                      </TableRow>
                    )}
                    {listQuery.isError && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-destructive py-12">
                          加载失败：{resolveUserErrorMessage(listQuery.error, "请求失败")}
                        </TableCell>
                      </TableRow>
                    )}
                    {!listQuery.isLoading &&
                      !listQuery.isError &&
                      items.map((g, idx) => (
                        <TableRow key={g.id}>
                          <TableCell className="text-muted-foreground">{(pageNo - 1) * pageSize + idx + 1}</TableCell>
                          <TableCell className="font-medium">{g.name}</TableCell>
                          <TableCell className="text-muted-foreground">{g.description || "-"}</TableCell>
                          <TableCell className="text-center text-muted-foreground">{g.serverCount ?? 0}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDateTime(g.updatedAt || g.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-primary hover:bg-primary/10"
                                onClick={() => openEdit(g)}
                                disabled={deleteMutation.isPending}
                                title="编辑"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => openDelete(g)}
                                disabled={deleteMutation.isPending}
                                title="删除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    {!listQuery.isLoading && !listQuery.isError && items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                          暂无分组
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
                第 {pageNo} 页 / {pageSize} 条
              </span>

              <div className="subpage-toolbar-end">
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setPageNo(1);
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
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>将删除分组：{deleting?.name || "-"}。该操作不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void confirmDelete();
              }}
              disabled={deleteMutation.isPending}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
