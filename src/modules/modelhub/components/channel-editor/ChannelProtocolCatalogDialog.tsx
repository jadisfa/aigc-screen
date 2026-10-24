import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import ChannelProtocolCatalogEditor from "@/modules/modelhub/components/channel-editor/ChannelProtocolCatalogEditor";
import { resolveModelHubErrorMessage } from "@/modules/modelhub/services/modelhubAdminUi";
import { invocationLabel, sceneLabels } from "@/modules/modelhub/types/protocolCatalogTypes";
import {
  cloneModelHubProtocol,
  deleteModelHubProtocol,
  listModelHubProtocols,
  updateModelHubProtocolStatus,
  type ModelHubProtocolCatalogItem,
} from "@/shared/api/model-hub/model-hub";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import { PageFilterBar, SearchField, StatusBadge, TableSurface } from "@/shared/components/page";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { formatNumber } from "@/shared/lib/format";
import { notify } from "@/shared/lib/notify";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

export default function ChannelProtocolCatalogDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, invalidateTotal, changePageSize, rememberTotal } =
    usePagedListQuery(10);
  const [view, setView] = useState<"list" | "editor">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<"all" | "enabled" | "disabled">("all");
  const [saving, setSaving] = useState(false);

  const listQuery = useQuery({
    queryKey: ["modelhub", "protocols", pageNo, pageSize, keyword, status],
    queryFn: () =>
      listModelHubProtocols({
        pageNo,
        pageSize,
        total: getTotalParam(),
        keyword: keyword.trim() || undefined,
        status: status === "all" ? undefined : status,
      }),
    enabled: props.open,
  });

  useEffect(() => {
    setView("list");
    setEditingId(null);
  }, [props.open]);

  useEffect(() => {
    rememberTotal(listQuery.data?.page.total);
  }, [listQuery.data?.page.total, rememberTotal]);

  useEffect(() => {
    if (!listQuery.error) {
      return;
    }
    notify.error("加载失败", { description: resolveModelHubErrorMessage(listQuery.error, "协议目录加载失败") });
  }, [listQuery.error]);

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.page.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const summary = listQuery.data?.summary;

  const summaryCards = useMemo(
    () => [
      { value: formatNumber(summary?.totalCount), label: "协议总数", hint: "含停用" },
      { value: formatNumber(summary?.enabledCount), label: "启用中", hint: "可被渠道绑定" },
      { value: formatNumber(summary?.systemCount), label: "系统内置", hint: "只读，可复制" },
      { value: formatNumber(summary?.customCount), label: "自定义适配", hint: "Java Adapter" },
    ],
    [summary],
  );

  const backToList = useCallback(() => {
    setView("list");
    setEditingId(null);
    void listQuery.refetch();
  }, [listQuery]);

  const openCreate = () => {
    setEditingId(null);
    setView("editor");
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setView("editor");
  };

  const handleClone = async (item: ModelHubProtocolCatalogItem) => {
    setSaving(true);
    try {
      const clonedId = await cloneModelHubProtocol(item.id, {
        code: `${item.code}-copy`,
        name: `${item.name} 副本`,
        version: "v1",
      });
      notify.success("已复制为新协议");
      props.onChanged?.();
      invalidateTotal();
      openEdit(clonedId);
    } catch (error) {
      notify.error("复制失败", { description: resolveModelHubErrorMessage(error, "请更换编码后重试") });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (item: ModelHubProtocolCatalogItem) => {
    const next = item.status === "enabled" ? "disabled" : "enabled";
    setSaving(true);
    try {
      await updateModelHubProtocolStatus(item.id, next);
      notify.success(next === "enabled" ? "已启用" : "已停用");
      props.onChanged?.();
      await listQuery.refetch();
    } catch (error) {
      notify.error("更新失败", { description: resolveModelHubErrorMessage(error, "状态更新失败") });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ModelHubProtocolCatalogItem) => {
    if (item.isSystem) {
      return;
    }
    if (!window.confirm(`确认删除协议「${item.name}」吗？`)) {
      return;
    }
    setSaving(true);
    try {
      await deleteModelHubProtocol(item.id);
      notify.success("已删除");
      props.onChanged?.();
      invalidateTotal();
      await listQuery.refetch();
    } catch (error) {
      notify.error("删除失败", { description: resolveModelHubErrorMessage(error, "协议删除失败") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open && view === "editor") {
          return;
        }
        props.onOpenChange(open);
      }}
    >
      <DialogContent className="left-0 top-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-none">
        <div className="page-content-shell flex flex-1 flex-col overflow-hidden">
            <DialogHeader className="mb-4 py-0">
              <DialogTitle className="text-[18px] font-semibold text-foreground">接入协议</DialogTitle>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {summaryCards.map((card) => (
                    <div key={card.label} className="rounded-xl border border-border/70 bg-muted/10 px-3 py-2">
                      <div className="text-[18px] font-semibold">{card.value}</div>
                      <div className="text-[12px] text-muted-foreground">{card.label} · {card.hint}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="pageOutline"
                    onClick={() => {
                      void listQuery.refetch();
                    }}
                    disabled={listQuery.isFetching}
                  >
                    <RefreshCw />
                    {listQuery.isFetching ? "刷新中..." : "刷新"}
                  </Button>
                  <Button variant="page" onClick={openCreate}>
                    <Plus />
                    新增协议
                  </Button>
                </div>
              </div>

              <PageFilterBar>
                <Select value={status} onValueChange={(value) => {
                  setStatus(value as "all" | "enabled" | "disabled");
                  resetPage();
                }}>
                  <SelectTrigger className="subpage-native-select h-9 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="subpage-select-content">
                    <SelectItem className="subpage-select-item" value="all">全部状态</SelectItem>
                    <SelectItem className="subpage-select-item" value="enabled">启用</SelectItem>
                    <SelectItem className="subpage-select-item" value="disabled">停用</SelectItem>
                  </SelectContent>
                </Select>
                <SearchField
                  wrapClassName="!max-w-[420px] shrink-0"
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setKeyword(keywordInput.trim());
                      resetPage();
                    }
                  }}
                  placeholder="搜索名称 / 编码"
                />
                <Button
                  variant="pageOutline"
                  onClick={() => {
                    setKeyword(keywordInput.trim());
                    resetPage();
                  }}
                >
                  搜索
                </Button>
               
              </PageFilterBar>

              <TableSurface className="min-h-0 flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>协议</TableHead>
                      <TableHead>场景</TableHead>
                      <TableHead>调用</TableHead>
                      <TableHead>适配</TableHead>
                      <TableHead>引用</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                          {listQuery.isFetching ? "加载中..." : "暂无协议"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.name}</div>
                            <div className="font-mono text-[12px] text-muted-foreground">{item.code}@{item.version}</div>
                          </TableCell>
                          <TableCell className="text-sm">{sceneLabels(item.sceneCodes || [])}</TableCell>
                          <TableCell>{invocationLabel(item.invocationStyle)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {item.isSystem ? <Badge variant="outline">内置</Badge> : <Badge variant="secondary">自建</Badge>}
                              {item.adapterKind === "CUSTOM" ? <Badge variant="outline">CUSTOM</Badge> : null}
                            </div>
                          </TableCell>
                          <TableCell>{item.bindingCount || 0}</TableCell>
                          <TableCell>
                            <StatusBadge tone={item.status === "enabled" ? "success" : "warning"}>
                              {item.status === "enabled" ? "启用" : "停用"}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openEdit(item.id)}>
                                {item.isSystem ? "查看" : "编辑"}
                              </Button>
                              <Button size="sm" variant="ghost" disabled={saving} onClick={() => void handleClone(item)}>
                                复制
                              </Button>
                              <Button size="sm" variant="ghost" disabled={saving} onClick={() => void handleToggleStatus(item)}>
                                {item.status === "enabled" ? "停用" : "启用"}
                              </Button>
                              {!item.isSystem ? (
                                <Button size="sm" variant="ghost" className="text-destructive" disabled={saving} onClick={() => void handleDelete(item)}>
                                  删除
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableSurface>

              <CommonPaginationBar
                pageNo={pageNo}
                pageSize={pageSize}
                total={total}
                canNextPage={pageNo < totalPages}
                onPageNoChange={setPageNo}
                onPageSizeChange={changePageSize}
                disabled={listQuery.isFetching}
              />
            </div>
          </div>
      </DialogContent>
    </Dialog>
    <ChannelProtocolCatalogEditor
      key={editingId ?? "create"}
      open={props.open && view === "editor"}
      protocolId={editingId}
      onCancel={backToList}
      onChanged={() => {
        invalidateTotal();
        props.onChanged?.();
      }}
    />
    </>
  );
}
