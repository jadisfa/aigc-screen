import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { listDeletedWorkflows } from "@/shared/api/workflow/workflow";
import { listWorkflowCates, type WorkflowCate } from "@/shared/api/workflow/workflow-cate";
import { listWorkflowTags } from "@/shared/api/workflow/workflow-tag";
import WorkflowDeletedAppCard from "@/modules/workflow/components/WorkflowDeletedAppCard";
import { CateIcon } from "@/modules/workflow/components/CateIcon";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { notify } from "@/shared/lib/notify";

export default function WorkflowDeletedAppsDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const sessionScope = useSessionScope();
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [cateId, setCateId] = useState("all");
  const [subCateId, setSubCateId] = useState("all");
  const [type, setType] = useState("all");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, changePageSize, rememberTotal } =
    usePagedListQuery(20);

  useEffect(() => {
    if (!props.open) return;
    setKeyword("");
    setAppliedKeyword("");
    setCateId("all");
    setSubCateId("all");
    setType("all");
    resetPage();
  }, [props.open, resetPage]);

  const catesQuery = useQuery({
    queryKey: ["workflowCatesAll", sessionScope.scope.queryScopeKey],
    queryFn: () => listWorkflowCates(),
    enabled: props.open,
  });

  const tagsQuery = useQuery({
    queryKey: ["workflowTagsAll", sessionScope.scope.queryScopeKey],
    queryFn: () => listWorkflowTags({ pageNo: 1, pageSize: 200 }),
    enabled: props.open,
  });

  const tagNameById = useMemo(() => {
    const items = tagsQuery.data?.items ?? [];
    return new Map(items.map((t) => [t.id, t.name]));
  }, [tagsQuery.data?.items]);

  const topCateOptions = useMemo(() => {
    const list = catesQuery.data ?? [];
    return list.filter((c) => c.level === 1 || !c.parentId);
  }, [catesQuery.data]);

  const cateOptionGroups = useMemo(() => {
    const childMap = new Map<string, WorkflowCate[]>();
    for (const cate of catesQuery.data ?? []) {
      if (!cate.parentId) continue;
      const current = childMap.get(cate.parentId) ?? [];
      current.push(cate);
      childMap.set(cate.parentId, current);
    }
    return topCateOptions.map((parent) => ({
      parent,
      children: childMap.get(parent.id) ?? [],
    }));
  }, [catesQuery.data, topCateOptions]);

  const cateById = useMemo(() => {
    const map = new Map<string, WorkflowCate>();
    for (const cate of catesQuery.data ?? []) {
      map.set(cate.id, cate);
    }
    return map;
  }, [catesQuery.data]);

  const selectedCate = useMemo(() => {
    if (subCateId !== "all") return cateById.get(subCateId) ?? null;
    if (cateId !== "all") return cateById.get(cateId) ?? null;
    return null;
  }, [cateById, cateId, subCateId]);

  const categoryOptions = useMemo(() => {
    return [
      {
        key: "all",
        value: "全部分类",
        cateId: "all",
        subCateId: "all",
        label: "全部分类",
        iconUrl: null as string | null,
        isChild: false,
        parentName: undefined as string | undefined,
      },
      ...cateOptionGroups.flatMap(({ parent, children }) => [
        {
          key: `parent-${parent.id}`,
          value: `${parent.name} 全部 ${parent.name} 一级分类`,
          cateId: parent.id,
          subCateId: "all",
          label: parent.name,
          iconUrl: parent.iconUrl,
          isChild: false,
          parentName: undefined as string | undefined,
        },
        ...children.map((child) => ({
          key: `child-${child.id}`,
          value: `${parent.name} ${child.name} 二级分类`,
          cateId: parent.id,
          subCateId: child.id,
          label: child.name,
          iconUrl: child.iconUrl,
          isChild: true,
          parentName: parent.name,
        })),
      ]),
    ];
  }, [cateOptionGroups]);

  const categoryDisplayText = useMemo(() => {
    if (cateId === "all") return "全部分类";
    if (subCateId !== "all") {
      const parent = cateById.get(cateId);
      const child = cateById.get(subCateId);
      if (parent && child) return `${parent.name} / ${child.name}`;
      return child?.name ?? subCateId;
    }
    return cateById.get(cateId)?.name ?? cateId;
  }, [cateById, cateId, subCateId]);

  useEffect(() => {
    if (cateId === "all") {
      if (subCateId !== "all") setSubCateId("all");
      return;
    }
    if (subCateId === "all") return;
    const matched = (catesQuery.data ?? []).some((cate) => cate.parentId === cateId && cate.id === subCateId);
    if (!matched) setSubCateId("all");
  }, [cateId, catesQuery.data, subCateId]);

  const listQuery = useQuery({
    queryKey: [
      "workflowDeletedList",
      sessionScope.scope.queryScopeKey,
      pageNo,
      pageSize,
      appliedKeyword,
      cateId,
      subCateId,
      type,
    ],
    queryFn: () =>
      listDeletedWorkflows({
        pageNo,
        pageSize,
        total: getTotalParam(),
        keyword: appliedKeyword.trim() || undefined,
        cateId: cateId === "all" ? undefined : cateId,
        subCateId: subCateId === "all" ? undefined : subCateId,
        type: type === "all" ? undefined : type,
      }),
    enabled: props.open,
  });

  useEffect(() => {
    rememberTotal(listQuery.data?.page?.total);
  }, [listQuery.data?.page?.total, rememberTotal]);

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.page?.total ?? 0;

  const canNextPage = useMemo(() => {
    if (total > 0) return pageNo * pageSize < total;
    return items.length >= pageSize;
  }, [items.length, pageNo, pageSize, total]);

  useEffect(() => {
    if (!listQuery.isError) return;
    notify.fromError(listQuery.error, "请求失败", "加载失败");
  }, [listQuery.error, listQuery.isError]);

  const applyKeywordSearch = () => {
    setAppliedKeyword(keyword.trim());
    resetPage();
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none sm:rounded-none p-0 gap-0 flex flex-col">
        <div className="page-content-shell flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="subpage-toolbar mb-5 shrink-0">
            <DialogTitle className="text-[18px] font-semibold text-foreground">应用回收站</DialogTitle>
          </div>

          <div className="subpage-toolbar mb-4 shrink-0">
            <div className="subpage-toolbar-start !flex-nowrap gap-3">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground whitespace-nowrap">分类:</span>
                <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="subpage-native-select w-52 h-9 justify-start font-normal px-3">
                      <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
                        {selectedCate?.iconUrl ? (
                          <CateIcon url={selectedCate.iconUrl} alt={selectedCate.name} className="h-4 w-4 shrink-0" />
                        ) : null}
                        <span className="truncate">{categoryDisplayText}</span>
                      </div>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[340px] p-0">
                    <Command>
                      <CommandInput placeholder="搜索分类..." />
                      <CommandList className="max-h-[360px]">
                        <CommandEmpty>未找到分类</CommandEmpty>
                        <CommandGroup>
                          {categoryOptions.map((option) => {
                            const isSelected = cateId === option.cateId && subCateId === option.subCateId;
                            return (
                              <CommandItem
                                key={option.key}
                                value={option.value}
                                onSelect={() => {
                                  setCateId(option.cateId);
                                  setSubCateId(option.subCateId);
                                  resetPage();
                                  setCategoryOpen(false);
                                }}
                                className={option.isChild ? "pl-8" : ""}
                              >
                                <Check className={`mr-2 h-4 w-4 shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {option.iconUrl ? (
                                    <CateIcon url={option.iconUrl} alt={option.label} className="h-4 w-4 shrink-0" />
                                  ) : null}
                                  <div className="min-w-0 flex flex-col">
                                    <span className={`truncate ${option.isChild ? "text-sm" : ""}`}>{option.label}</span>
                                    {option.isChild && option.parentName ? (
                                      <span className="truncate text-xs text-muted-foreground">{option.parentName}</span>
                                    ) : null}
                                  </div>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground whitespace-nowrap">类型:</span>
                <Select
                  value={type}
                  onValueChange={(v) => {
                    setType(v);
                    resetPage();
                  }}
                >
                  <SelectTrigger className="subpage-native-select w-32 h-9">
                    <SelectValue placeholder="类型" />
                  </SelectTrigger>
                  <SelectContent className="subpage-select-content">
                    <SelectItem className="subpage-select-item" value="all">全部</SelectItem>
                    <SelectItem className="subpage-select-item" value="comfyui">comfyui</SelectItem>
                    <SelectItem className="subpage-select-item" value="flow">flow</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="subpage-search-wrap !w-[380px] !max-w-[380px] shrink-0">
                <Search className="subpage-search-icon" />
                <Input
                  placeholder="搜索已删应用名称/编码，回车搜索"
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
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(360px,1fr))] gap-5 max-[1200px]:[grid-template-columns:repeat(auto-fill,minmax(320px,1fr))] max-[768px]:grid-cols-1">
              {listQuery.isLoading && (
                <div className="text-sm text-muted-foreground py-12">加载中...</div>
              )}
              {!listQuery.isLoading &&
                items.map((it) => (
                  <WorkflowDeletedAppCard
                    key={it.id}
                    item={it}
                    tagNameById={tagNameById}
                  />
                ))}
              {!listQuery.isLoading && items.length === 0 && (
                <div className="text-sm text-muted-foreground py-12">暂无已删应用</div>
              )}
            </div>
          </div>

          <div className="shrink-0 pt-4">
            <CommonPaginationBar
              total={total || items.length}
              pageNo={pageNo}
              pageSize={pageSize}
              canNextPage={canNextPage}
              onPageNoChange={setPageNo}
              onPageSizeChange={changePageSize}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
