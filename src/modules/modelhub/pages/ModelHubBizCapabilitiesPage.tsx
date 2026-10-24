import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import BizCapabilityEditorPage from "@/modules/modelhub/components/BizCapabilityEditorPage";
import {
  deleteBizCapability,
  getBizCapability,
  listBizCapabilities,
  type BizCapability,
} from "@/shared/api/model-hub/biz-capability";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  StatusBadge,
  TableSurface,
} from "@/shared/components/page";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import {
  ROUTE_ENTRY_LABEL,
  ROUTE_ENTRY_ORDER,
  type RouteEntryCode,
} from "@/shared/lib/route-entry-dicts";
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
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { notify } from "@/shared/lib/notify";

const SCENE_ALL = "all";

function formatAllowedModels(item: BizCapability) {
  const names = (item.allowedModelNames ?? []).map((n) => n?.trim()).filter(Boolean);
  if (names.length > 0) {
    return names.join("、");
  }
  if ((item.allowedModelIds?.length ?? 0) > 0) {
    return `${item.allowedModelIds.length} 个`;
  }
  return "默认池";
}

export default function ModelHubBizCapabilitiesPage() {
  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, invalidateTotal, changePageSize, rememberTotal } =
    usePagedListQuery();
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editItem, setEditItem] = useState<BizCapability | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BizCapability | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sceneFilter, setSceneFilter] = useState<string>(SCENE_ALL);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");

  const listQuery = useQuery({
    queryKey: ["modelhub", "biz-capabilities", pageNo, pageSize, sceneFilter, keyword],
    queryFn: () =>
      listBizCapabilities({
        pageNo,
        pageSize,
        total: getTotalParam(),
        keyword: keyword.trim() || undefined,
        sceneCode: sceneFilter === SCENE_ALL ? undefined : sceneFilter,
      }),
  });

  useEffect(() => {
    rememberTotal(listQuery.data?.page.total);
  }, [listQuery.data?.page.total, rememberTotal]);

  useEffect(() => {
    if (!listQuery.error) {
      return;
    }
    notify.error("加载失败", { description: listQuery.error instanceof Error ? listQuery.error.message : "请求失败" });
  }, [listQuery.error]);

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.page.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const loading = listQuery.isFetching;

  const applyFilters = () => {
    setKeyword(keywordInput.trim());
    resetPage();
  };

  const handleEditorBack = useCallback(() => {
    setView("list");
    setEditItem(null);
  }, []);

  const handleEditorSuccess = useCallback(() => {
    setView("list");
    setEditItem(null);
    invalidateTotal();
    void listQuery.refetch();
  }, [invalidateTotal, listQuery]);

  async function openEdit(item: BizCapability) {
    try {
      const detail = await getBizCapability(item.bizCode);
      setEditItem(detail);
      setView("edit");
    } catch (e) {
      notify.error("加载失败", { description: e instanceof Error ? e.message : "请求失败" });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBizCapability(deleteTarget.id);
      notify.success("删除成功");
      setDeleteTarget(null);
      invalidateTotal();
      void listQuery.refetch();
    } catch (e) {
      notify.error("删除失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setDeleting(false);
    }
  }

  if (view === "create" || (view === "edit" && editItem)) {
    return (
      <BizCapabilityEditorPage
        mode={view}
        config={editItem}
        onBack={handleEditorBack}
        onSuccess={handleEditorSuccess}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="业务配置"
        actions={
          <Button
            variant="page"
            onClick={() => {
              setEditItem(null);
              setView("create");
            }}
          >
            <Plus className="w-4 h-4" />
            新增配置
          </Button>
        }
      />

      <PageFilterBar>
          <Select
            value={sceneFilter}
            onValueChange={(value) => {
              setSceneFilter(value);
              resetPage();
            }}
          >
            <SelectTrigger className="subpage-native-select w-44 h-9 shrink-0">
              <SelectValue placeholder="路由场景" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value={SCENE_ALL}>全部场景</SelectItem>
              {ROUTE_ENTRY_ORDER.map((code) => (
                <SelectItem key={code} className="subpage-select-item" value={code}>
                  {ROUTE_ENTRY_LABEL[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SearchField
            wrapClassName="!w-[320px] !max-w-[320px] shrink-0"
            placeholder="搜索业务编码/业务名称"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                applyFilters();
              }
            }}
          />
          <Button variant="pageOutline" className="shrink-0" onClick={applyFilters}>
            搜索
          </Button>
      </PageFilterBar>

      <TableSurface>
        <Table className="min-w-[960px] text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[140px]">业务名称</TableHead>
              <TableHead className="min-w-[140px]">业务编码</TableHead>
              <TableHead className="w-36">路由场景</TableHead>
              <TableHead className="min-w-[200px]">可执行模型</TableHead>
              <TableHead className="w-20 text-center">状态</TableHead>
              <TableHead className="sticky right-0 z-20 w-[120px] min-w-[120px] max-w-[120px] bg-background shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  加载中...
                </TableCell>
              </TableRow>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  {keyword || sceneFilter !== SCENE_ALL
                    ? "没有符合筛选条件的配置"
                    : "暂无业务能力配置，请点击右上角添加"}
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.bizName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs font-mono">
                    {item.bizCode}
                  </Badge>
                </TableCell>
                <TableCell>
                  {ROUTE_ENTRY_LABEL[item.sceneCode as RouteEntryCode] || item.sceneCode}
                </TableCell>
                <TableCell className="text-muted-foreground break-words">
                  {formatAllowedModels(item)}
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge tone={item.enabled ? "success" : "neutral"}>
                    {item.enabled ? "启用" : "停用"}
                  </StatusBadge>
                </TableCell>
                <TableCell className="sticky right-0 z-10 w-[120px] min-w-[120px] max-w-[120px] bg-background px-3 py-2 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="编辑"
                      onClick={() => void openEdit(item)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      title="删除"
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableSurface>

      <CommonPaginationBar
        total={total}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={pageNo < totalPages}
        onPageNoChange={setPageNo}
        onPageSizeChange={changePageSize}
        disabled={loading}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除业务能力「{deleteTarget?.bizName}」（{deleteTarget?.bizCode}
              ）？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
