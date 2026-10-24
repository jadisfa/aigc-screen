import { ArrowDown, ArrowUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
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
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import {
  createMaterialTag,
  deleteMaterialTag,
  listMaterialCategories,
  listMaterialTags,
  moveMaterialTag,
  updateMaterialTag,
  type MaterialCategory,
  type MaterialSortDirection,
  type MaterialTag,
} from "@/shared/api/materials/materials-taxonomy";
import { formatDateTime } from "@/shared/lib/datetime";
import { notify } from "@/shared/lib/notify";

export default function MaterialTagManagerDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialType: "image" | "video" | "model";
  title?: string;
}) {
  const queryClient = useQueryClient();

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

  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");

  const [editing, setEditing] = useState<MaterialTag | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortNo, setSortNo] = useState("");
  const [publicScope, setPublicScope] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setKeyword("");
    setAppliedKeyword("");
    resetPage();
    setPageSize(10);
    setFilterCategoryId("all");
    setEditing(null);
    setName("");
    setDescription("");
    setSortNo("");
    setPublicScope(false);
    setCategoryId("");
    setFormOpen(false);
    setFormError(null);
  }, [props.open, resetPage, setPageSize]);

  const categoriesQuery = useQuery({
    queryKey: ["materialCategories", props.materialType],
    queryFn: () => listMaterialCategories({ materialType: props.materialType }),
    enabled: props.open,
  });

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, MaterialCategory>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  useEffect(() => {
    if (!props.open) return;
    if (!categoryId) return;
    if (categoryNameById.has(categoryId)) return;
    setCategoryId("");
  }, [categoryId, props.open, categoryNameById]);

  const listQuery = useQuery({
    queryKey: ["materialTags", props.materialType, pageNo, pageSize, appliedKeyword, filterCategoryId],
    queryFn: () =>
      listMaterialTags({
        materialType: props.materialType,
        categoryId: filterCategoryId !== "all" ? filterCategoryId : undefined,
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

  const applyKeywordSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
    resetPage();
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["materialTags", props.materialType] });
  };

  const saveMutation = useMutation<string | boolean, Error, void>({
    mutationFn: async () => {
      const sortNoValue = sortNo.trim() ? Number(sortNo) : null;
      if (editing) {
        return updateMaterialTag(editing.id, {
          name: name.trim(),
          description: description.trim() ? description.trim() : undefined,
          sortNo: sortNoValue,
        });
      }
      return createMaterialTag({
        materialType: props.materialType,
        categoryId,
        name: name.trim(),
        description: description.trim() ? description.trim() : undefined,
        publicScope,
        sortNo: sortNoValue,
      });
    },
    onSuccess: async () => {
      notify.success(editing ? "保存成功" : "创建成功");
      invalidateTotal();
      await refresh();
      setEditing(null);
      setName("");
      setDescription("");
      setSortNo("");
      setPublicScope(false);
      setCategoryId("");
      setFormError(null);
      setFormOpen(false);
    },
    onError: (e) => {
      notify.error(editing ? "更新失败" : "创建失败", { description: e instanceof Error ? e.message : "请求失败" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMaterialTag(id),
    onSuccess: async () => {
      notify.success("删除成功");
      invalidateTotal();
      await refresh();
    },
    onError: (e) => {
      notify.error("删除失败", { description: e instanceof Error ? e.message : "请求失败" });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: MaterialSortDirection }) => moveMaterialTag(id, direction),
    onSuccess: async () => {
      await refresh();
    },
    onError: (e) => {
      notify.error("排序失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  // 搜索结果非完整排序序列，仅此时禁用上下移（后端按同分类邻居换序）
  const sortingDisabled = !!appliedKeyword.trim() || moveMutation.isPending;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<MaterialTag | null>(null);

  const openDelete = (t: MaterialTag) => {
    setDeleting(t);
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
    setPublicScope(false);
    setCategoryId("");
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (t: MaterialTag) => {
    setEditing(t);
    setName(t.name || "");
    setDescription(t.description || "");
    setSortNo(t.sortNo != null ? String(t.sortNo) : "");
    setPublicScope(!t.merchantId);
    setCategoryId(t.categoryId || "");
    setFormError(null);
    setFormOpen(true);
  };

  const submitCreate = () => {
    if (!name.trim()) {
      setFormError("请输入标签名称");
      return;
    }
    if (!categoryId) {
      setFormError("请选择分类");
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

  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none sm:rounded-none p-0 gap-0 flex flex-col">
          <div className="page-content-shell flex flex-col">
            <div className="subpage-toolbar mb-5">
              <h1 className="text-[18px] font-semibold text-foreground">{props.title || "标签管理"}</h1>
            </div>

            <div className="subpage-toolbar mb-4">
              <div className="subpage-toolbar-start !flex-nowrap gap-3">
                <div className="subpage-search-wrap !w-[320px] !max-w-[320px] shrink-0">
                  <Search className="subpage-search-icon" />
                  <Input
                    placeholder="搜索标签，回车搜索"
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
                <Select
                  value={filterCategoryId}
                  onValueChange={(v) => {
                    setFilterCategoryId(v);
                    resetPage();
                  }}
                >
                  <SelectTrigger className="subpage-native-select w-[200px]">
                    <SelectValue placeholder="分类" />
                  </SelectTrigger>
                  <SelectContent className="subpage-select-content">
                    <SelectItem className="subpage-select-item" value="all">
                      分类: 全部
                    </SelectItem>
                    {categories.map((c: MaterialCategory) => (
                      <SelectItem key={c.id} className="subpage-select-item" value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  setDescription("");
                  setSortNo("");
                  setPublicScope(false);
                  setCategoryId("");
                  setFormError(null);
                }
              }}
            >
              <DialogContent className="sm:max-w-[640px]">
                <DialogHeader>
                  <DialogTitle>{editing ? "编辑标签" : "新增标签"}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-5 py-1">
                  {!editing ? (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="workflow-form-label">所属分类</Label>
                        <Select
                          value={categoryId}
                          onValueChange={(v) => {
                            setFormError(null);
                            setCategoryId(v);
                            const selected = categoryNameById.get(v);
                            if (selected) setPublicScope(!selected.merchantId);
                          }}
                        >
                          <SelectTrigger className="subpage-native-select h-10 w-full">
                            <SelectValue placeholder="请选择分类" />
                          </SelectTrigger>
                          <SelectContent className="subpage-select-content">
                            {categories.map((c: MaterialCategory) => (
                              <SelectItem key={c.id} className="subpage-select-item" value={c.id}>
                                {c.name}（{c.merchantId ? "机构" : "公共"}）
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="workflow-form-label">可见范围</Label>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground select-none h-10">
                          <Checkbox
                            checked={publicScope}
                            onCheckedChange={(v) => {
                              setFormError(null);
                              setPublicScope(v === true);
                              setCategoryId("");
                            }}
                          />
                          公共标签
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="workflow-form-label">所属分类</Label>
                      <div className="h-10 flex items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
                        {(() => {
                          const cat = categoryNameById.get(categoryId);
                          if (!cat) return "-";
                          return `${cat.name}（${cat.merchantId ? "机构" : "公共"}）`;
                        })()}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="workflow-form-label" htmlFor="material-tag-name">
                      标签名称
                    </Label>
                    <Input
                      id="material-tag-name"
                      placeholder="请输入标签名称"
                      value={name}
                      onChange={(e) => {
                        setFormError(null);
                        setName(e.target.value);
                      }}
                      className="workflow-form-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="workflow-form-label" htmlFor="material-tag-description">
                      描述
                    </Label>
                    <Input
                      id="material-tag-description"
                      placeholder="可选，补充标签说明"
                      value={description}
                      onChange={(e) => {
                        setFormError(null);
                        setDescription(e.target.value);
                      }}
                      className="workflow-form-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="workflow-form-label" htmlFor="material-tag-sort-no">
                      排序号
                    </Label>
                    <Input
                      id="material-tag-sort-no"
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
                      setPublicScope(false);
                      setCategoryId("");
                      setFormError(null);
                      setFormOpen(false);
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    className="subpage-primary-btn"
                    onClick={submitCreate}
                    disabled={saveMutation.isPending || !name.trim() || (!editing && !categoryId)}
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
                      <TableHead className="min-w-[220px]">标签名称</TableHead>
                      <TableHead className="min-w-[260px]">描述</TableHead>
                      <TableHead className="min-w-[160px]">范围</TableHead>
                      <TableHead className="min-w-[200px]">创建时间</TableHead>
                      <TableHead className="w-40 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                          加载中...
                        </TableCell>
                      </TableRow>
                    )}
                    {listQuery.isError && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-destructive py-12">
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
                            <TableCell className="text-muted-foreground">{t.description || "-"}</TableCell>
                            <TableCell className="text-muted-foreground">{t.merchantId ? "机构" : "公共"}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDateTime(t.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="上移"
                                  disabled={sortingDisabled || absoluteIndex <= 0}
                                  onClick={() => moveMutation.mutate({ id: t.id, direction: "up" })}
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="下移"
                                  disabled={sortingDisabled || absoluteIndex >= total - 1}
                                  onClick={() => moveMutation.mutate({ id: t.id, direction: "down" })}
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => openEdit(t)} title="编辑">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => openDelete(t)} disabled={deleteMutation.isPending} title="删除">
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {!listQuery.isLoading && !listQuery.isError && items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
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
                第 {pageNo} 页 / {pageSize} 条
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
            <AlertDialogDescription>确定要删除标签 “{deleting?.name || "-"}” 吗？</AlertDialogDescription>
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
