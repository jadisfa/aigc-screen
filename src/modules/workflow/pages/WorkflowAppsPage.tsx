import { useEffect, useMemo, useRef, useState } from "react";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Archive, Check, ChevronsUpDown, FolderKanban, Plus, RefreshCw, Tags } from "lucide-react";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
} from "@/shared/components/page";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { listWorkflowCates, type WorkflowCate } from "@/shared/api/workflow/workflow-cate";
import { listWorkflowTags } from "@/shared/api/workflow/workflow-tag";
import { listWorkflows, searchWorkflowsByKeyword } from "@/shared/api/workflow/workflow";
import WorkflowTagManagerDialog from "@/modules/workflow/components/WorkflowTagManagerDialog";
import WorkflowAppTypeSelectDialog from "@/modules/workflow/components/WorkflowAppTypeSelectDialog";
import WorkflowAppCard from "@/modules/workflow/components/WorkflowAppCard";
import WorkflowDeletedAppsDialog from "@/modules/workflow/components/WorkflowDeletedAppsDialog";
import { CateIcon } from "@/modules/workflow/components/CateIcon";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { type WorkflowAppCreateKind } from "@/modules/workflow/lib/workflow-exec";
import { notify } from "@/shared/lib/notify";

export default function WorkflowAppsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const sessionScope = useSessionScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedKeyword = searchParams.get("keyword")?.trim() ?? "";

  const [keyword, setKeyword] = useState(requestedKeyword);
  const [cateId, setCateId] = useState<string>("all");
  const [subCateId, setSubCateId] = useState<string>("all");
  const [tagId, setTagId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, changePageSize, rememberTotal } =
    usePagedListQuery(50);
  /** 已提交搜索的关键词（回车后生效） */
  const [appliedKeyword, setAppliedKeyword] = useState(requestedKeyword);
  /** 本地回车写回 URL 时跳过「URL → 输入框」同步 */
  const skipKeywordUrlSyncRef = useRef(false);

  const catesQuery = useQuery({
    queryKey: ["workflowCatesAll", sessionScope.scope.queryScopeKey],
    queryFn: () => listWorkflowCates(),
  });

  const tagsQuery = useQuery({
    queryKey: ["workflowTagsAll", sessionScope.scope.queryScopeKey],
    queryFn: () => listWorkflowTags({ pageNo: 1, pageSize: 200 }),
  });

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

  const tagNameById = useMemo(() => {
    const items = tagsQuery.data?.items ?? [];
    return new Map(items.map((t) => [t.id, t.name]));
  }, [tagsQuery.data?.items]);

  const tagBarItems = useMemo(() => {
    return [{ id: "all", name: "全部" }, ...(tagsQuery.data?.items ?? [])];
  }, [tagsQuery.data?.items]);

  const normalizedKeyword = appliedKeyword.trim();
  const isKeywordSearchMode = normalizedKeyword.length > 0;
  const searchParamsString = searchParams.toString();
  const filterCateId = cateId === "all" ? undefined : cateId;
  const filterSubCateId = subCateId === "all" ? undefined : subCateId;

  const applyKeywordSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
    resetPage();

    const nextParams = new URLSearchParams(searchParamsString);
    if (normalized) {
      nextParams.set("keyword", normalized);
    } else {
      nextParams.delete("keyword");
    }
    if (nextParams.toString() !== searchParamsString) {
      skipKeywordUrlSyncRef.current = true;
      setSearchParams(nextParams, { replace: true });
    }
  };

  const listQuery = useQuery({
    queryKey: [
      isKeywordSearchMode ? "workflowKeywordSearch" : "workflowList",
      sessionScope.scope.queryScopeKey,
      pageNo,
      pageSize,
      normalizedKeyword,
      cateId,
      subCateId,
      tagId,
      status,
      type,
    ],
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    queryFn: () =>
      isKeywordSearchMode
        ? searchWorkflowsByKeyword({
            pageNo,
            pageSize,
            total: getTotalParam(),
            keyword: normalizedKeyword,
            // Parent category: send cateId only, backend expands to parent + children.
            // Child category: send both cateId and subCateId, backend narrows to the child.
            cateId: filterCateId,
            subCateId: filterSubCateId,
            tagId: tagId === "all" ? undefined : tagId,
            status: status === "all" ? undefined : status,
            type: type === "all" ? undefined : type,
          })
        : listWorkflows({
            pageNo,
            pageSize,
            total: getTotalParam(),
            cateId: filterCateId,
            subCateId: filterSubCateId,
            tagId: tagId === "all" ? undefined : tagId,
            status: status === "all" ? undefined : status,
            type: type === "all" ? undefined : type,
          }),
  });

  useEffect(() => {
    rememberTotal(listQuery.data?.page?.total);
  }, [listQuery.data?.page?.total, rememberTotal]);

  // 仅在 URL 的 keyword 外部变化时同步到输入框（如浏览器前进/后退、外链带参）
  useEffect(() => {
    if (skipKeywordUrlSyncRef.current) {
      skipKeywordUrlSyncRef.current = false;
      return;
    }
    setKeyword(requestedKeyword);
    setAppliedKeyword(requestedKeyword);
    resetPage();
  }, [requestedKeyword, resetPage]);

  useEffect(() => {
    if (cateId === "all") {
      if (subCateId !== "all") {
        setSubCateId("all");
      }
      return;
    }
    if (subCateId === "all") {
      return;
    }
    const matched = (catesQuery.data ?? []).some((cate) => cate.parentId === cateId && cate.id === subCateId);
    if (!matched) {
      setSubCateId("all");
    }
  }, [cateId, catesQuery.data, subCateId]);

  useEffect(() => {
    if (!listQuery.isError) return;
    notify.fromError(listQuery.error, "请求失败", "加载失败");
  }, [listQuery.error, listQuery.isError]);

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.page?.total ?? 0;

  const paginationTotal = useMemo(() => {
    if (total > 0) return total;
    if (items.length === 0) return 0;
    return (pageNo - 1) * pageSize + items.length;
  }, [items.length, pageNo, pageSize, total]);

  const canNextPage = useMemo(() => {
    if (total > 0) return pageNo * pageSize < total;
    return items.length === pageSize;
  }, [items.length, pageNo, pageSize, total]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["workflowList", sessionScope.scope.queryScopeKey] });
    await queryClient.invalidateQueries({ queryKey: ["workflowKeywordSearch", sessionScope.scope.queryScopeKey] });
  };

  const [tagDlgOpen, setTagDlgOpen] = useState(false);
  const [deletedDlgOpen, setDeletedDlgOpen] = useState(false);
  const [createTypeDlgOpen, setCreateTypeDlgOpen] = useState(false);
  const [createKind, setCreateKind] = useState<WorkflowAppCreateKind>("comfyui");
  const [categoryOpen, setCategoryOpen] = useState(false);

  return (
    <PageShell>
      <PageHeader
        title="应用管理"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => refresh()} disabled={listQuery.isFetching}>
              <RefreshCw className="w-4 h-4 mr-1" />
              刷新
            </Button>
            <Button variant="pageOutline" onClick={() => navigate("/app/categories")}>
              <FolderKanban className="w-4 h-4 mr-1" />
              分类管理
            </Button>
            <Button variant="pageOutline" onClick={() => setTagDlgOpen(true)}>
              <Tags className="w-4 h-4 mr-1" />
              标签管理
            </Button>
            <Button variant="pageOutline" onClick={() => setDeletedDlgOpen(true)}>
              <Archive className="w-4 h-4 mr-1" />
              应用回收站
            </Button>
            <Button
              variant="page"
              onClick={() => {
                setCreateKind("comfyui");
                setCreateTypeDlgOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              新增应用
            </Button>
          </>
        }
      />

      <PageFilterBar>
          <div className="flex items-center gap-2">
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
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              resetPage();
            }}
          >
            <SelectTrigger className="subpage-native-select w-32 h-9">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value="all">
                全部状态
              </SelectItem>
              <SelectItem className="subpage-select-item" value="online">
                上线
              </SelectItem>
              <SelectItem className="subpage-select-item" value="offline">
                下线
              </SelectItem>
            </SelectContent>
          </Select>
          </div>

          <div className="flex items-center gap-2">
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
              <SelectItem className="subpage-select-item" value="all">
                全部类型
              </SelectItem>
              <SelectItem className="subpage-select-item" value="comfyui">
                comfyui
              </SelectItem>
              <SelectItem className="subpage-select-item" value="flow">
                flow
              </SelectItem>
            </SelectContent>
          </Select>
          </div>

          <SearchField
            wrapClassName="!max-w-[420px] flex-1 min-w-[300px]"
            placeholder="搜索应用名称/应用关键词，回车搜索"
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

      <div className="flex items-center gap-1 mb-7 overflow-x-auto pb-1">
        {tagBarItems.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTagId(t.id);
              resetPage();
            }}
            className={`subpage-tag-btn ${tagId === t.id ? "subpage-tag-btn-active" : "subpage-tag-btn-inactive"}`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="grid [grid-template-columns:repeat(auto-fill,minmax(360px,1fr))] gap-5 max-[1200px]:[grid-template-columns:repeat(auto-fill,minmax(320px,1fr))] max-[768px]:grid-cols-1">
        {listQuery.isLoading && (
          <div className="text-sm text-muted-foreground py-12">加载中...</div>
        )}
        {!listQuery.isLoading &&
          items.map((it) => <WorkflowAppCard key={it.id} item={it} tagNameById={tagNameById} />)}
        {!listQuery.isLoading && items.length === 0 && (
          <div className="text-sm text-muted-foreground py-12">暂无应用</div>
        )}
      </div>

      <CommonPaginationBar
        total={paginationTotal || items.length}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={canNextPage}
        onPageNoChange={setPageNo}
        onPageSizeChange={changePageSize}
      />

      <WorkflowTagManagerDialog open={tagDlgOpen} onOpenChange={setTagDlgOpen} />
      <WorkflowDeletedAppsDialog open={deletedDlgOpen} onOpenChange={setDeletedDlgOpen} />
      <WorkflowAppTypeSelectDialog
        open={createTypeDlgOpen}
        onOpenChange={setCreateTypeDlgOpen}
        value={createKind}
        onValueChange={setCreateKind}
        onConfirm={() => {
          setCreateTypeDlgOpen(false);
          if (createKind === "template") {
            navigate("/app/workflows/new?createKind=template");
            return;
          }
          navigate(`/app/workflows/new?executionBackend=${encodeURIComponent(createKind)}`);
        }}
      />
    </PageShell>
  );
}
