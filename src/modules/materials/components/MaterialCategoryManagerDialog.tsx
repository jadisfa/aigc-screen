import { ArrowDown, ArrowUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/shared/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Label } from "@/shared/ui/label";
import { hasBackendErrorCode, resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import {
  createMaterialCategory,
  deleteMaterialCategory,
  listMaterialCategories,
  moveMaterialCategory,
  updateMaterialCategory,
  type MaterialCategory,
  type MaterialSortDirection,
} from "@/shared/api/materials/materials-taxonomy";
import { formatDateTime } from "@/shared/lib/datetime";
import { notify } from "@/shared/lib/notify";

export default function MaterialCategoryManagerDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialType: "image" | "video" | "model";
  title?: string;
}) {
  const queryClient = useQueryClient();
  const sessionScope = useSessionScope();
  const canCreatePrivateCategory = !!sessionScope.scope.merchantId;

  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<MaterialCategory | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortNo, setSortNo] = useState("");
  const [publicScope, setPublicScope] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setKeyword("");
    setAppliedKeyword("");
    setPageNo(1);
    setPageSize(10);
    setEditing(null);
    setName("");
    setDescription("");
    setSortNo("");
    setPublicScope(!canCreatePrivateCategory);
    setFormOpen(false);
    setFormError(null);
  }, [canCreatePrivateCategory, props.open]);

  useEffect(() => {
    if (!formOpen || editing || canCreatePrivateCategory) return;
    setPublicScope(true);
  }, [canCreatePrivateCategory, editing, formOpen]);

  const categoriesQuery = useQuery({
    queryKey: ["materialCategories", props.materialType, sessionScope.scope.queryScopeKey],
    queryFn: () => listMaterialCategories({ materialType: props.materialType }),
    enabled: props.open,
  });

  const filtered = useMemo(() => {
    const items = categoriesQuery.data ?? [];
    const kw = appliedKeyword.trim().toLowerCase();
    if (!kw) return items;
    return items.filter((c) => (c.name || "").toLowerCase().includes(kw));
  }, [appliedKeyword, categoriesQuery.data]);

  const total = filtered.length;
  const totalPages = useMemo(() => {
    if (total <= 0) return 0;
    return Math.ceil(total / pageSize);
  }, [pageSize, total]);
  const canNextPage = pageNo * pageSize < total;
  const pageItems = useMemo(() => {
    const start = (pageNo - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageNo, pageSize]);

  useEffect(() => {
    if (totalPages === 0) {
      if (pageNo !== 1) setPageNo(1);
      return;
    }
    if (pageNo > totalPages) setPageNo(totalPages);
  }, [pageNo, totalPages]);

  const applyKeywordSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
    setPageNo(1);
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["materialCategories", props.materialType] });
  };

  const resolveCategoryDeleteErrorMessage = (error: unknown) => {
    if (hasBackendErrorCode(error, "MATERIALS-RESOURCE-IN-USE")) {
      return "该分类正在被素材使用，暂时无法删除";
    }
    return resolveUserErrorMessage(error, "请求失败");
  };

  const saveMutation = useMutation<string | boolean, Error, void>({
    mutationFn: async () => {
      const sortNoValue = sortNo.trim() ? Number(sortNo) : null;
      if (editing) {
        return updateMaterialCategory(editing.id, {
          name: name.trim(),
          description: description.trim() ? description.trim() : undefined,
          sortNo: sortNoValue,
        });
      }
      return createMaterialCategory({
        materialType: props.materialType,
        name: name.trim(),
        description: description.trim() ? description.trim() : undefined,
        publicScope,
        sortNo: sortNoValue,
      });
    },
    onSuccess: async () => {
      notify.success(editing ? "保存成功" : "创建成功");
      await refresh();
      setEditing(null);
      setName("");
      setDescription("");
      setSortNo("");
      setFormError(null);
      setFormOpen(false);
    },
    onError: (e) => {
      notify.error(editing ? "更新失败" : "创建失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMaterialCategory(id),
    onSuccess: async () => {
      notify.success("删除成功");
      await refresh();
    },
    onError: (e) => {
      notify.error("删除失败", { description: resolveCategoryDeleteErrorMessage(e) });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: MaterialSortDirection }) => moveMaterialCategory(id, direction),
    onSuccess: async () => {
      await refresh();
    },
    onError: (e) => {
      notify.error("排序失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<MaterialCategory | null>(null);
  const sortingDisabled = !!appliedKeyword.trim() || moveMutation.isPending;

  const openDelete = (c: MaterialCategory) => {
    setDeleting(c);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id);
    setDeleteOpen(false);
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setSortNo("");
    setPublicScope(!canCreatePrivateCategory);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (c: MaterialCategory) => {
    setEditing(c);
    setName(c.name || "");
    setDescription(c.description || "");
    setSortNo(c.sortNo != null ? String(c.sortNo) : "");
    setPublicScope(!c.merchantId);
    setFormError(null);
    setFormOpen(true);
  };

  const submitCreate = () => {
    if (!name.trim()) {
      setFormError("请输入分类名称");
      return;
    }
    if (!editing && !publicScope && !canCreatePrivateCategory) {
      setFormError("当前作用域下只能创建公共分类");
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
    saveMutation.mutate();
  };

  const moveCategory = (c: MaterialCategory, direction: MaterialSortDirection) => {
    if (sortingDisabled) return;
    moveMutation.mutate({ id: c.id, direction });
  };

  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none sm:rounded-none p-0 gap-0 flex flex-col">
          <div className="page-content-shell flex flex-col">
            <div className="subpage-toolbar mb-5">
              <h1 className="text-[18px] font-semibold text-foreground">{props.title || "分类管理"}</h1>
            </div>

            <div className="subpage-toolbar mb-4">
              <div className="subpage-toolbar-start !flex-nowrap gap-3">
                <div className="subpage-search-wrap !w-[320px] !max-w-[320px] shrink-0">
                  <Search className="subpage-search-icon" />
                  <Input
                    placeholder="搜索分类，回车搜索"
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
                  添加分类
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
                  setDescription("");
                  setSortNo("");
                  setPublicScope(!canCreatePrivateCategory);
                  setFormError(null);
                }
              }}
            >
              <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                  <DialogTitle>{editing ? "编辑分类" : "新增分类"}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-5 py-1">
                  <div className="space-y-2">
                    <Label className="workflow-form-label" htmlFor="material-category-name">
                      分类名称
                    </Label>
                    <Input
                      id="material-category-name"
                      placeholder="请输入分类名称"
                      value={name}
                      onChange={(e) => {
                        setFormError(null);
                        setName(e.target.value);
                      }}
                      className="workflow-form-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="workflow-form-label" htmlFor="material-category-description">
                      描述
                    </Label>
                    <Input
                      id="material-category-description"
                      placeholder="可选，补充分类说明"
                      value={description}
                      onChange={(e) => {
                        setFormError(null);
                        setDescription(e.target.value);
                      }}
                      className="workflow-form-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="workflow-form-label" htmlFor="material-category-sort-no">
                      排序号
                    </Label>
                    <Input
                      id="material-category-sort-no"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="留空则自动分配"
                      value={sortNo}
                      onChange={(e) => {
                        setFormError(null);
                        setSortNo(e.target.value);
                      }}
                      className="workflow-form-input"
                    />
                    <p className="text-xs text-muted-foreground">数值越小越靠前；留空时由系统自动赋默认值。</p>
                  </div>
                  {!editing && (
                    <div className="space-y-2">
                      <Label className="workflow-form-label">可见范围</Label>
                      <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
                        <Checkbox
                          checked={publicScope}
                          disabled={!canCreatePrivateCategory}
                          onCheckedChange={(v) => {
                            setFormError(null);
                            setPublicScope(v === true);
                          }}
                        />
                        公共分类
                      </label>
                      {!canCreatePrivateCategory && (
                        <p className="text-xs text-muted-foreground">当前会话不在商户作用域下，只能创建公共分类。</p>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter className="gap-2 sm:gap-2">
                  {formError ? <p className="text-sm text-destructive mr-auto">{formError}</p> : null}
                  <Button
                    variant="outline"
                    className="subpage-outline-btn"
                    onClick={() => {
                      setEditing(null);
                      setName("");
                      setDescription("");
                      setSortNo("");
                      setPublicScope(!canCreatePrivateCategory);
                      setFormError(null);
                      setFormOpen(false);
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    className="subpage-primary-btn"
                    onClick={submitCreate}
                    disabled={saveMutation.isPending || !name.trim()}
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
                      <TableHead className="w-24">排序号</TableHead>
                      <TableHead className="min-w-[220px]">分类名称</TableHead>
                      <TableHead className="min-w-[260px]">描述</TableHead>
                      <TableHead className="min-w-[160px]">范围</TableHead>
                      <TableHead className="min-w-[200px]">创建时间</TableHead>
                      <TableHead className="w-40 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoriesQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                          加载中...
                        </TableCell>
                      </TableRow>
                    )}
                    {categoriesQuery.isError && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-destructive py-12">
                          加载失败：{resolveUserErrorMessage(categoriesQuery.error, "请求失败")}
                        </TableCell>
                      </TableRow>
                    )}
                    {!categoriesQuery.isLoading &&
                      !categoriesQuery.isError &&
                      pageItems.map((c, idx) => {
                        const absoluteIndex = (pageNo - 1) * pageSize + idx;
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="text-muted-foreground">{absoluteIndex + 1}</TableCell>
                            <TableCell className="text-muted-foreground">{c.sortNo ?? "-"}</TableCell>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="text-muted-foreground">{c.description || "-"}</TableCell>
                            <TableCell className="text-muted-foreground">{c.merchantId ? "机构" : "公共"}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDateTime(c.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="上移"
                                  disabled={sortingDisabled || absoluteIndex <= 0}
                                  onClick={() => moveCategory(c, "up")}
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="下移"
                                  disabled={sortingDisabled || absoluteIndex >= filtered.length - 1}
                                  onClick={() => moveCategory(c, "down")}
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => openEdit(c)} title="编辑">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => openDelete(c)} disabled={deleteMutation.isPending} title="删除">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {!categoriesQuery.isLoading && !categoriesQuery.isError && pageItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                          暂无分类
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex items-center justify-end mt-4 gap-3 text-sm text-muted-foreground">
              <span>共 {total} 条</span>
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
            <AlertDialogDescription>确定要删除分类 “{deleting?.name || "-"}” 吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
