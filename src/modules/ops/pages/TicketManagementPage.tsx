import { useCallback, useEffect, useMemo, useState } from "react";
import { resolvePagedTotal } from "@/shared/hooks/use-paged-total";
import { MessageSquarePlus, Pencil, Plus, Settings2, Trash2, UserCog, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TicketAssignDialog from "@/modules/ops/components/TicketAssignDialog";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import { DatePicker } from "@/shared/components/DatePicker";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  StatusBadge,
  statusToneFromCode,
  TableSurface,
} from "@/shared/components/page";
import { UserSelect } from "@/shared/components/UserSelect";
import {
  OPS_TICKET_DELETE_CONFIRM_TEXT,
  assignTickets,
  closeTicket,
  deleteTicket,
  listTicketDictionaries,
  listTickets,
  type TicketDictionaryResponse,
  type TicketSummary,
} from "@/shared/api/ops/ops-ticket";
import { notify } from "@/shared/lib/notify";
import { formatDateTime } from "@/shared/lib/datetime";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

const ALL_FILTER_VALUE = "all";

function buildLabelMap(options: { value: string; label: string }[]) {
  return new Map(options.map((item) => [item.value, item.label]));
}

export default function TicketManagementPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<TicketSummary[]>([]);
  const [dictionaries, setDictionaries] = useState<TicketDictionaryResponse>({
    ticketTypes: [],
    ticketStatuses: [],
    priorities: [],
    ticketSources: [],
  });
  const [loading, setLoading] = useState(false);
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastTotal, setLastTotal] = useState<number | undefined>(undefined);

  const [searchText, setSearchText] = useState("");
  const [appliedSearchText, setAppliedSearchText] = useState("");
  const [ticketType, setTicketType] = useState(ALL_FILTER_VALUE);
  const [ticketStatus, setTicketStatus] = useState(ALL_FILTER_VALUE);
  const [priority, setPriority] = useState(ALL_FILTER_VALUE);
  const [assigneeId, setAssigneeId] = useState("");
  const [createdStart, setCreatedStart] = useState("");
  const [createdEnd, setCreatedEnd] = useState("");
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignTargetIds, setAssignTargetIds] = useState<string[]>([]);
  const [assignInitialAssigneeId, setAssignInitialAssigneeId] = useState("");
  const [assignDialogTitle, setAssignDialogTitle] = useState("工单指派");
  const [assignDialogDescription, setAssignDialogDescription] = useState("支持对单个工单或所选工单批量更新处理人，留空可取消当前指派。");

  const ticketTypeMap = useMemo(() => buildLabelMap(dictionaries.ticketTypes), [dictionaries.ticketTypes]);
  const ticketStatusMap = useMemo(() => buildLabelMap(dictionaries.ticketStatuses), [dictionaries.ticketStatuses]);
  const priorityMap = useMemo(() => buildLabelMap(dictionaries.priorities), [dictionaries.priorities]);
  const sourceMap = useMemo(() => buildLabelMap(dictionaries.ticketSources), [dictionaries.ticketSources]);
  const selectedTicketSet = useMemo(() => new Set(selectedTicketIds), [selectedTicketIds]);
  const visibleTicketIds = useMemo(() => items.map((item) => item.id), [items]);
  const allVisibleSelected = visibleTicketIds.length > 0 && visibleTicketIds.every((id) => selectedTicketSet.has(id));
  const partiallySelected = !allVisibleSelected && visibleTicketIds.some((id) => selectedTicketSet.has(id));

  const loadDictionaries = useCallback(async () => {
    try {
      const response = await listTicketDictionaries();
      setDictionaries(response);
    } catch (error) {
      notify.error("加载工单字典失败", { description: error instanceof Error ? error.message : "请求失败" });
    }
  }, []);

  const loadData = useCallback(async (targetPageNo: number, targetPageSize: number, total?: number) => {
    setLoading(true);
    try {
      const response = await listTickets({
        keyword: appliedSearchText.trim() || undefined,
        ticketType: ticketType === ALL_FILTER_VALUE ? undefined : ticketType,
        ticketStatus: ticketStatus === ALL_FILTER_VALUE ? undefined : ticketStatus,
        priority: priority === ALL_FILTER_VALUE ? undefined : priority,
        assigneeId: assigneeId || undefined,
        createdStart: createdStart ? `${createdStart} 00:00:00` : undefined,
        createdEnd: createdEnd ? `${createdEnd} 23:59:59` : undefined,
        pageNo: targetPageNo,
        pageSize: targetPageSize,
        total: resolvePagedTotal(targetPageNo, total ?? lastTotal),
      });
      setItems(response.items ?? []);
      setTotal(response.page?.total ?? 0);
      setLastTotal(response.page?.total ?? 0);
    } catch (error) {
      notify.error("加载工单列表失败", { description: error instanceof Error ? error.message : "请求失败" });
    } finally {
      setLoading(false);
    }
  }, [appliedSearchText, assigneeId, createdEnd, createdStart, lastTotal, priority, ticketStatus, ticketType]);

  useEffect(() => {
    void loadDictionaries();
  }, [loadDictionaries]);

  useEffect(() => {
    void loadData(pageNo, pageSize);
  }, [loadData, pageNo, pageSize]);

  useEffect(() => {
    setSelectedTicketIds((current) => current.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const handleSearch = () => {
    const normalized = searchText.trim();
    setSearchText(normalized);
    setAppliedSearchText(normalized);
    setPageNo(1);
  };

  const handleReset = () => {
    setSearchText("");
    setAppliedSearchText("");
    setTicketType(ALL_FILTER_VALUE);
    setTicketStatus(ALL_FILTER_VALUE);
    setPriority(ALL_FILTER_VALUE);
    setAssigneeId("");
    setCreatedStart("");
    setCreatedEnd("");
    setPageNo(1);
  };

  const handleClose = async (item: TicketSummary) => {
    if (item.ticketStatus === "closed" || item.ticketStatus === "deleted") return;
    if (!window.confirm(`确认关闭工单「${item.title}」吗？`)) return;

    try {
      await closeTicket(item.id);
      notify.success("工单已关闭");
      void loadData(pageNo, pageSize, total);
    } catch (error) {
      notify.error("关闭工单失败", { description: error instanceof Error ? error.message : "请求失败" });
    }
  };

  const handleDelete = async (item: TicketSummary) => {
    const confirmText = window.prompt(`删除工单「${item.title}」前请输入 ${OPS_TICKET_DELETE_CONFIRM_TEXT}`);
    if (!confirmText) return;

    try {
      await deleteTicket(item.id, confirmText);
      notify.success("删除成功");
      void loadData(pageNo, pageSize);
    } catch (error) {
      notify.error("删除工单失败", { description: error instanceof Error ? error.message : "请求失败" });
    }
  };

  const handleOpenAssignDialog = (ticketIds: string[], initialAssigneeId = "", isBatch = false) => {
    setAssignTargetIds(ticketIds);
    setAssignInitialAssigneeId(initialAssigneeId);
    setAssignDialogTitle(isBatch ? "批量指派工单" : initialAssigneeId ? "重新指派工单" : "指派工单");
    setAssignDialogDescription(
      isBatch
        ? "将所选工单批量分派给同一处理人，提交后会立即覆盖当前处理人。"
        : "请选择工单处理人，已指派工单可在此重新指派，留空可取消当前指派。"
    );
    setAssignDialogOpen(true);
  };

  const handleToggleTicket = (ticketId: string, checked: boolean) => {
    setSelectedTicketIds((current) => {
      if (checked) return Array.from(new Set([...current, ticketId]));
      return current.filter((id) => id !== ticketId);
    });
  };

  const handleToggleAllVisible = (checked: boolean) => {
    setSelectedTicketIds((current) => {
      if (!checked) return current.filter((id) => !visibleTicketIds.includes(id));
      return Array.from(new Set([...current, ...visibleTicketIds]));
    });
  };

  const handleAssignSubmit = async (nextAssigneeId: string) => {
    if (assignTargetIds.length === 0) return;

    setAssignSubmitting(true);
    try {
      const result = await assignTickets({
        ticketIds: assignTargetIds,
        assigneeId: nextAssigneeId || null,
      });
      const successCount = result?.successCount ?? 0;
      const failureCount = result?.failureCount ?? 0;
      if (successCount <= 0) {
        const firstError = result?.items?.find((item) => !item.success)?.message;
        notify.fail(assignTargetIds.length > 1 ? "批量指派失败" : "工单指派失败", {
          description: firstError || "没有工单完成指派，请检查工单状态后重试。",
        });
        return;
      }
      if (failureCount > 0) {
        notify.warning("部分工单指派失败", {
          description: `成功 ${successCount} 个，失败 ${failureCount} 个。`,
        });
      } else {
        notify.success(
          assignTargetIds.length > 1 ? "批量指派已完成" : nextAssigneeId ? "工单已指派" : "已取消指派",
          {
            description:
              assignTargetIds.length > 1 ? `已成功处理 ${successCount} 个工单。` : undefined,
          },
        );
      }
      setAssignDialogOpen(false);
      setAssignTargetIds([]);
      setAssignInitialAssigneeId("");
      setSelectedTicketIds((current) => current.filter((id) => !assignTargetIds.includes(id)));
      await loadData(pageNo, pageSize);
    } catch (error) {
      notify.fromError(error, "工单指派失败");
    } finally {
      setAssignSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canNextPage = pageNo < totalPages;

  return (
    <PageShell>
      <PageHeader
        title="工单管理"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => void loadData(pageNo, pageSize, total)} disabled={loading}>
              刷新
            </Button>
            <Button variant="pageOutline" onClick={handleReset} disabled={loading}>
              重置
            </Button>
            <Button
              variant="pageOutline"
              onClick={() => navigate("/ops/tickets/disposal-config")}
              disabled={loading}
            >
              <Settings2 className="h-4 w-4" />
              处置配置
            </Button>
            <Button
              variant="pageOutline"
              onClick={() => handleOpenAssignDialog(selectedTicketIds, "", true)}
              disabled={loading || selectedTicketIds.length === 0}
            >
              <UserCog className="h-4 w-4" />
              批量指派
            </Button>
            <Button variant="page" onClick={() => navigate("/ops/tickets/new")}>
              <Plus className="w-4 h-4" />
              新增工单
            </Button>
          </>
        }
      />

      <PageFilterBar>
          <Select
            value={ticketType}
            onValueChange={(value) => {
              setTicketType(value);
              setPageNo(1);
            }}
          >
            <SelectTrigger className="subpage-native-select w-[120px] h-9">
              <SelectValue placeholder="工单类型" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value={ALL_FILTER_VALUE}>工单类型</SelectItem>
              {dictionaries.ticketTypes.map((option) => (
                <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={ticketStatus}
            onValueChange={(value) => {
              setTicketStatus(value);
              setPageNo(1);
            }}
          >
            <SelectTrigger className="subpage-native-select w-[120px] h-9">
              <SelectValue placeholder="工单状态" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value={ALL_FILTER_VALUE}>工单状态</SelectItem>
              {dictionaries.ticketStatuses.map((option) => (
                <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={priority}
            onValueChange={(value) => {
              setPriority(value);
              setPageNo(1);
            }}
          >
            <SelectTrigger className="subpage-native-select w-[100px] h-9">
              <SelectValue placeholder="优先级" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value={ALL_FILTER_VALUE}>优先级</SelectItem>
              {dictionaries.priorities.map((option) => (
                <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>


          <UserSelect value={assigneeId} onChange={setAssigneeId} placeholder="处理人" className="w-[140px]" />

          <DatePicker value={createdStart} onChange={setCreatedStart} placeholder="开始日期" className="w-[150px]" />
          <DatePicker value={createdEnd} onChange={setCreatedEnd} placeholder="结束日期" className="w-[150px]" />

          <SearchField
            wrapClassName="!w-[300px] !max-w-[300px] shrink-0"
            placeholder="搜索工单编号/标题/描述，回车搜索"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSearch();
              }
            }}
          />
      </PageFilterBar>

      {(selectedTicketIds.length > 0) ? (
        <div className="page-filter-bar !mb-3">
          <div className="page-filter-start">
            <Badge variant="outline" className="text-xs">
              已选 {selectedTicketIds.length} 项
            </Badge>
            <Button variant="pageOutline" onClick={() => setSelectedTicketIds([])}>
              清空选择
            </Button>
          </div>
        </div>
      ) : null}

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allVisibleSelected ? true : partiallySelected ? "indeterminate" : false}
                  aria-label="全选当前页工单"
                  onCheckedChange={(checked) => handleToggleAllVisible(checked === true)}
                />
              </TableHead>
              <TableHead className="min-w-[220px]">标题</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>优先级</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>回复数</TableHead>
              <TableHead className="min-w-[120px]">处理人</TableHead>
              <TableHead className="min-w-[160px]">创建时间</TableHead>
              <TableHead className="min-w-[160px]">更新时间</TableHead>
              <TableHead className="w-40 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-12">
                  {loading ? "加载中..." : "暂无工单数据"}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedTicketSet.has(item.id)}
                      aria-label={`选择工单 ${item.id}`}
                      onCheckedChange={(checked) => handleToggleTicket(item.id, checked === true)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <button
                        type="button"
                        className="text-left font-medium text-foreground hover:text-primary"
                        onClick={() => navigate(`/ops/tickets/${item.id}/replies`)}
                      >
                        {item.title}
                      </button>
                      <div className="text-xs text-muted-foreground">
                        <div className="font-mono">工单编号：{item.id}</div>
                        <div>
                          {item.customerName || item.customerId || item.storeId || item.merchantId
                            ? `客户名称 ${item.customerName || item.customerId || "-"} / 门店 ${item.storeId || "-"} / 商户 ${item.merchantId || "-"}`
                            : "未绑定客户/门店/商户"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{ticketTypeMap.get(item.ticketType) || item.ticketType}</TableCell>
                  <TableCell>
                    <StatusBadge tone={statusToneFromCode(item.ticketStatus)}>
                      {ticketStatusMap.get(item.ticketStatus) || item.ticketStatus}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      tone={
                        item.priority === "high" || item.priority === "urgent"
                          ? "danger"
                          : item.priority === "medium"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {priorityMap.get(item.priority) || item.priority}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{sourceMap.get(item.source) || item.source || "-"}</TableCell>
                  <TableCell>{item.replyCount ?? 0}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div>{item.assigneeName || item.assigneeId || "-"}</div>
                      <div className="text-xs text-muted-foreground">{item.assigneeId ? "已指派" : "待人工分派"}</div>
                    </div>
                  </TableCell>
                  <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                  <TableCell>{formatDateTime(item.updatedAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary hover:text-primary"
                        onClick={() => handleOpenAssignDialog([item.id], item.assigneeId || "")}
                        disabled={item.ticketStatus === "closed" || item.ticketStatus === "deleted"}
                        title={
                          item.ticketStatus === "closed" || item.ticketStatus === "deleted"
                            ? "已关闭工单不可指派"
                            : item.assigneeId
                              ? "重新指派"
                              : "指派"
                        }
                      >
                        <UserCog className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary hover:text-primary"
                        onClick={() => navigate(`/ops/tickets/${item.id}/edit`)}
                        disabled={item.ticketStatus === "closed" || item.ticketStatus === "deleted"}
                        title={item.ticketStatus === "closed" || item.ticketStatus === "deleted" ? "已关闭工单不可编辑" : "编辑"}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary hover:text-primary"
                        onClick={() => navigate(`/ops/tickets/${item.id}/replies`)}
                        title="回复"
                      >
                        <MessageSquarePlus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-amber-600 hover:text-amber-700"
                        onClick={() => void handleClose(item)}
                        disabled={item.ticketStatus === "closed" || item.ticketStatus === "deleted"}
                        title="关闭"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => void handleDelete(item)}
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableSurface>

      <CommonPaginationBar
        className="mt-4"
        pageNo={pageNo}
        pageSize={pageSize}
        total={total}
        canNextPage={canNextPage}
        onPageNoChange={setPageNo}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPageNo(1);
        }}
      />

      <TicketAssignDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        ticketIds={assignTargetIds}
        initialAssigneeId={assignInitialAssigneeId}
        title={assignDialogTitle}
        description={assignDialogDescription}
        submitting={assignSubmitting}
        onSubmit={handleAssignSubmit}
      />
    </PageShell>
  );
}
