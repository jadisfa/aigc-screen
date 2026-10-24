import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Eye, ExternalLink, Megaphone, RefreshCw, Trash2 } from "lucide-react";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  StatusBadge,
  TableSurface,
} from "@/shared/components/page";
import {
  deleteTicketInboxMessage,
  getTicketInboxMessage,
  getTicketInboxUnreadCount,
  invalidateOpsInboxQueries,
  listTicketInboxMessageTypes,
  listTicketInboxMessages,
  markAllTicketInboxMessagesRead,
  markTicketInboxMessageRead,
  opsInboxQueryKeys,
  type TicketInboxMessage,
} from "@/shared/api/ops/ops-ticket-inbox";
import {
  getNotificationBroadcast,
  listNotificationBroadcasts,
  opsBroadcastQueryKeys,
  type BroadcastJob,
} from "@/shared/api/ops/ops-notification-broadcast";
import NotificationBroadcastComposerDialog from "@/modules/ops/components/NotificationBroadcastComposerDialog";
import InboxMessageDetailDialog from "@/modules/ops/components/InboxMessageDetailDialog";
import BroadcastJobDetailDialog, {
  BROADCAST_AUDIENCE_TYPE_LABELS,
  BROADCAST_STATUS_LABELS,
} from "@/modules/ops/components/BroadcastJobDetailDialog";
import { resolvePagedTotal } from "@/shared/hooks/use-paged-total";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import { notify } from "@/shared/lib/notify";
import { formatDateTime } from "@/shared/lib/datetime";
import {
  CONSOLE_PERMISSION_NAMESPACE,
  CONSOLE_PERMISSIONS,
  buildPermissionSetForNamespace,
  hasPermission,
} from "@/shared/lib/permissions";
import {
  canNavigateInboxBiz,
  navigateInboxBiz,
  resolveInboxBizTarget,
} from "@/modules/ops/lib/inbox-biz-navigation";
import { inboxEventTypeLabel } from "@/modules/ops/lib/inbox-event-type";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

const ALL_FILTER_VALUE = "all";

function buildReadParam(value: string) {
  if (value === "read") return true;
  if (value === "unread") return false;
  return undefined;
}

export default function NotificationInboxPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const sessionScope = useSessionScope();
  const scopeKey = sessionScope.scope.queryScopeKey;
  const permissionsQuery = useMePermissions({ sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode });
  const permissionSet = useMemo(
    () => buildPermissionSetForNamespace(CONSOLE_PERMISSION_NAMESPACE, permissionsQuery.data?.permissions ?? []),
    [permissionsQuery.data?.permissions],
  );
  const canBroadcast = hasPermission(permissionSet, CONSOLE_PERMISSIONS.opsNotificationBroadcast);

  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const lastTotalRef = useRef<number | undefined>(undefined);

  const [activeTab, setActiveTab] = useState<"inbox" | "broadcasts">("inbox");
  const [composerOpen, setComposerOpen] = useState(false);
  const [broadcastPageNo, setBroadcastPageNo] = useState(1);
  const [broadcastPageSize, setBroadcastPageSize] = useState(10);
  const broadcastTotalRef = useRef<number | undefined>(undefined);
  const [broadcastDetailId, setBroadcastDetailId] = useState<string | null>(null);
  const [broadcastDetailOpen, setBroadcastDetailOpen] = useState(false);

  const [filterType, setFilterType] = useState(ALL_FILTER_VALUE);
  const [filterRead, setFilterRead] = useState(ALL_FILTER_VALUE);
  const [filterKeyword, setFilterKeyword] = useState("");
  const [appliedType, setAppliedType] = useState(ALL_FILTER_VALUE);
  const [appliedRead, setAppliedRead] = useState(ALL_FILTER_VALUE);
  const [appliedKeyword, setAppliedKeyword] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TicketInboxMessage | null>(null);
  const openedFromNavRef = useRef<string | null>(null);

  const listParams = useMemo(
    () => ({
      pageNo,
      pageSize,
      type: appliedType === ALL_FILTER_VALUE ? undefined : appliedType,
      keyword: appliedKeyword.trim() ? appliedKeyword.trim() : undefined,
      read: buildReadParam(appliedRead),
      total: resolvePagedTotal(pageNo, lastTotalRef.current),
    }),
    [appliedKeyword, appliedRead, appliedType, pageNo, pageSize],
  );

  const typesQuery = useQuery({
    queryKey: opsInboxQueryKeys.types(scopeKey),
    queryFn: listTicketInboxMessageTypes,
  });

  const unreadQuery = useQuery({
    queryKey: opsInboxQueryKeys.unread(scopeKey),
    queryFn: getTicketInboxUnreadCount,
    refetchInterval: 30_000,
  });

  const listQuery = useQuery({
    queryKey: opsInboxQueryKeys.messages(scopeKey, {
      pageNo: listParams.pageNo,
      pageSize: listParams.pageSize,
      type: listParams.type ?? null,
      keyword: listParams.keyword ?? null,
      read: listParams.read ?? null,
    }),
    queryFn: () => listTicketInboxMessages(listParams),
  });

  const broadcastListParams = useMemo(
    () => ({
      pageNo: broadcastPageNo,
      pageSize: broadcastPageSize,
      total: resolvePagedTotal(broadcastPageNo, broadcastTotalRef.current),
    }),
    [broadcastPageNo, broadcastPageSize],
  );

  const broadcastListQuery = useQuery({
    queryKey: opsBroadcastQueryKeys.list(scopeKey, broadcastListParams),
    queryFn: () => listNotificationBroadcasts(broadcastListParams),
    enabled: canBroadcast && activeTab === "broadcasts",
  });

  useEffect(() => {
    if (broadcastListQuery.data?.page?.total != null) {
      broadcastTotalRef.current = broadcastListQuery.data.page.total;
    }
  }, [broadcastListQuery.data?.page?.total]);

  const broadcastDetailQuery = useQuery({
    queryKey: opsBroadcastQueryKeys.detail(scopeKey, broadcastDetailId ?? ""),
    queryFn: () => getNotificationBroadcast(broadcastDetailId!),
    enabled: canBroadcast && broadcastDetailOpen && !!broadcastDetailId,
  });

  useEffect(() => {
    if (listQuery.data?.page?.total != null) {
      lastTotalRef.current = listQuery.data.page.total;
    }
  }, [listQuery.data?.page?.total]);

  const detailQuery = useQuery({
    queryKey: opsInboxQueryKeys.detail(scopeKey, detailId ?? ""),
    queryFn: () => getTicketInboxMessage(detailId!),
    enabled: detailOpen && !!detailId,
  });

  const markReadMutation = useMutation({
    mutationFn: markTicketInboxMessageRead,
    onSuccess: async () => {
      await invalidateOpsInboxQueries(queryClient);
    },
    onError: (error) => {
      notify.error("标记已读失败", { description: error instanceof Error ? error.message : "请求失败" });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllTicketInboxMessagesRead,
    onSuccess: async () => {
      await invalidateOpsInboxQueries(queryClient);
      notify.success("已全部标记已读");
    },
    onError: (error) => {
      notify.error("全部标记已读失败", { description: error instanceof Error ? error.message : "请求失败" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTicketInboxMessage,
    onSuccess: async (_ok, messageId) => {
      setDeleteTarget(null);
      if (detailId === messageId) {
        setDetailOpen(false);
        setDetailId(null);
      }
      const remaining = listQuery.data?.items?.length ?? 0;
      if (remaining <= 1 && pageNo > 1) {
        setPageNo((prev) => Math.max(1, prev - 1));
      }
      await invalidateOpsInboxQueries(queryClient);
      notify.success("删除成功");
    },
    onError: (error) => {
      notify.error("删除消息失败", { description: error instanceof Error ? error.message : "请求失败" });
    },
  });

  const autoMarkedIdsRef = useRef<Set<string>>(new Set());

  // 打开详情时自动标记已读
  useEffect(() => {
    const msg = detailQuery.data;
    if (!detailOpen || !msg || msg.read) return;
    if (autoMarkedIdsRef.current.has(msg.id)) return;
    autoMarkedIdsRef.current.add(msg.id);
    void markReadMutation.mutateAsync(msg.id).catch((error) => {
      autoMarkedIdsRef.current.delete(msg.id);
      notify.fromError(error, "标记已读失败");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only auto-mark when detail identity/read changes
  }, [detailOpen, detailQuery.data?.id, detailQuery.data?.read]);

  // 顶栏跳转带 openMessageId：有业务目标则直接处理，否则打开详情
  useEffect(() => {
    const state = location.state as { openMessageId?: string } | null;
    const openMessageId = state?.openMessageId;
    if (!openMessageId || openedFromNavRef.current === openMessageId) return;
    openedFromNavRef.current = openMessageId;
    navigate(location.pathname, { replace: true, state: null });

    void (async () => {
      try {
        const msg = await getTicketInboxMessage(openMessageId);
        if (!msg.read) {
          try {
            await markTicketInboxMessageRead(msg.id);
            await invalidateOpsInboxQueries(queryClient);
          } catch (error) {
            notify.fromError(error, "标记已读失败");
          }
        }
        const target = resolveInboxBizTarget(msg);
        if (canNavigateInboxBiz(target)) {
          navigateInboxBiz(navigate, target);
          return;
        }
        setDetailId(msg.id);
        setDetailOpen(true);
      } catch (error) {
        notify.error("打开消息失败", { description: error instanceof Error ? error.message : "请求失败" });
      }
    })();
  }, [location.pathname, location.state, navigate, queryClient]);

  useEffect(() => {
    if (typesQuery.isError) {
      notify.error("加载消息类型失败", { description: typesQuery.error instanceof Error ? typesQuery.error.message : "请求失败" });
    }
  }, [typesQuery.error, typesQuery.isError]);

  useEffect(() => {
    if (listQuery.isError) {
      notify.error("加载消息通知失败", { description: listQuery.error instanceof Error ? listQuery.error.message : "请求失败" });
    }
  }, [listQuery.error, listQuery.isError]);

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.page?.total ?? 0;
  const unreadCount = unreadQuery.data ?? 0;
  const types = typesQuery.data ?? [];
  const loading = listQuery.isFetching;
  const detail = detailQuery.data ?? null;
  const detailLoading = detailQuery.isFetching;
  const broadcastItems = broadcastListQuery.data?.items ?? [];
  const broadcastTotal = broadcastListQuery.data?.page?.total ?? 0;
  const broadcastLoading = broadcastListQuery.isFetching;
  const broadcastDetail = broadcastDetailQuery.data ?? null;
  const broadcastDetailLoading = broadcastDetailQuery.isFetching;
  const broadcastTotalPages = useMemo(
    () => Math.max(1, Math.ceil(broadcastTotal / broadcastPageSize)),
    [broadcastPageSize, broadcastTotal],
  );
  const canNextBroadcastPage = broadcastPageNo < broadcastTotalPages;

  const handleSearch = () => {
    const nextFilters = { type: filterType, read: filterRead, keyword: filterKeyword.trim() };
    const unchanged =
      nextFilters.type === appliedType && nextFilters.read === appliedRead && nextFilters.keyword === appliedKeyword;

    setAppliedType(nextFilters.type);
    setAppliedRead(nextFilters.read);
    setAppliedKeyword(nextFilters.keyword);

    if (pageNo === 1) {
      if (unchanged) void listQuery.refetch();
      return;
    }
    setPageNo(1);
  };

  const handleReset = () => {
    setFilterType(ALL_FILTER_VALUE);
    setFilterRead(ALL_FILTER_VALUE);
    setFilterKeyword("");
    setAppliedType(ALL_FILTER_VALUE);
    setAppliedRead(ALL_FILTER_VALUE);
    setAppliedKeyword("");
    if (pageNo === 1) {
      void listQuery.refetch();
      return;
    }
    setPageNo(1);
  };

  const handleOpenDetail = (messageId: string) => {
    setDetailId(messageId);
    setDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setDetailId(null);
  };

  const handleRequestDelete = (message: TicketInboxMessage) => {
    setDeleteTarget(message);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    void deleteMutation.mutateAsync(deleteTarget.id);
  };

  const isDetailRead = (message: TicketInboxMessage) => message.read || autoMarkedIdsRef.current.has(message.id);

  const handleGotoBiz = async (message: TicketInboxMessage, options?: { closeDetail?: boolean }) => {
    const target = resolveInboxBizTarget(message);
    if (!canNavigateInboxBiz(target)) {
      notify.error("暂无可跳转业务", { description: "该消息未关联可处理的业务对象。" });
      return;
    }
    if (!message.read) {
      try {
        await markTicketInboxMessageRead(message.id);
        await invalidateOpsInboxQueries(queryClient);
      } catch (error) {
        notify.fromError(error, "标记已读失败");
      }
    }
    if (options?.closeDetail) {
      setDetailOpen(false);
      setDetailId(null);
    }
    navigateInboxBiz(navigate, target);
  };

  const handleOpenMessage = (message: TicketInboxMessage) => {
    const target = resolveInboxBizTarget(message);
    if (canNavigateInboxBiz(target)) {
      void handleGotoBiz(message);
      return;
    }
    handleOpenDetail(message.id);
  };

  const detailBizTarget = resolveInboxBizTarget(detail);
  const canGoBiz = canNavigateInboxBiz(detailBizTarget);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);
  const canNextPage = pageNo < totalPages;
  const mutating = markAllMutation.isPending || deleteMutation.isPending || markReadMutation.isPending;

  return (
    <PageShell>
      <PageHeader
        title="消息通知"
        titleExtra={
          unreadCount > 0 ? (
            <Badge variant="destructive" className="h-6 px-2">
              未读 {unreadCount}
            </Badge>
          ) : (
            <Badge variant="outline" className="h-6 px-2 text-muted-foreground">
              全部已读
            </Badge>
          )
        }
        actions={
          <>
            <Button
              variant="pageOutline"
              onClick={() => {
                if (activeTab === "broadcasts") {
                  void broadcastListQuery.refetch();
                  return;
                }
                void invalidateOpsInboxQueries(queryClient);
              }}
              disabled={loading || mutating || broadcastLoading}
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
            {activeTab === "inbox" ? (
              <>
                <Button variant="pageOutline" onClick={handleReset} disabled={loading || mutating}>
                  重置
                </Button>
                <Button
                  variant="pageOutline"
                  onClick={() => void markAllMutation.mutateAsync()}
                  disabled={loading || mutating || unreadCount === 0}
                >
                  <CheckCheck className="h-4 w-4" />
                  全部标记为已读
                </Button>
              </>
            ) : null}
            {canBroadcast ? (
              <Button variant="page" onClick={() => setComposerOpen(true)}>
                <Megaphone className="h-4 w-4" />
                群发消息
              </Button>
            ) : null}
          </>
        }
      />

      {canBroadcast ? (
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value === "broadcasts" ? "broadcasts" : "inbox")}
          className="mb-5"
        >
          <TabsList>
            <TabsTrigger value="inbox">我的消息</TabsTrigger>
            <TabsTrigger value="broadcasts">群发任务</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {activeTab === "inbox" ? (
        <>
      <PageFilterBar>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="subpage-native-select h-9 w-[160px]">
              <SelectValue placeholder="消息类型" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value={ALL_FILTER_VALUE}>
                消息类型：全部
              </SelectItem>
              {types.map((t) => (
                <SelectItem key={t} className="subpage-select-item" value={t}>
                  {inboxEventTypeLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterRead} onValueChange={setFilterRead}>
            <SelectTrigger className="subpage-native-select h-9 w-[140px]">
              <SelectValue placeholder="已读状态" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value={ALL_FILTER_VALUE}>
                已读状态：全部
              </SelectItem>
              <SelectItem className="subpage-select-item" value="unread">
                未读
              </SelectItem>
              <SelectItem className="subpage-select-item" value="read">
                已读
              </SelectItem>
            </SelectContent>
          </Select>

          <SearchField
            wrapClassName="!w-[300px] !max-w-[300px] shrink-0"
            placeholder="搜索主题/内容，回车搜索"
            value={filterKeyword}
            onChange={(event) => setFilterKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSearch();
              }
            }}
          />
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[280px]">主题</TableHead>
              <TableHead className="min-w-[110px]">类型</TableHead>
              <TableHead className="min-w-[90px]">状态</TableHead>
              <TableHead className="min-w-[120px]">发送人</TableHead>
              <TableHead className="min-w-[160px]">时间</TableHead>
              <TableHead className="w-28 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  加载中...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  暂无消息通知
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const deleting = deleteMutation.isPending && deleteMutation.variables === item.id;
                const bizTarget = resolveInboxBizTarget(item);
                const hasBiz = canNavigateInboxBiz(bizTarget);
                return (
                  <TableRow key={item.id} className={item.read ? undefined : "bg-muted/20"}>
                    <TableCell>
                      <div className="space-y-1">
                        <button
                          type="button"
                          className={`text-left hover:text-primary ${item.read ? "font-medium text-foreground" : "font-semibold text-foreground"}`}
                          onClick={() => handleOpenMessage(item)}
                          title={hasBiz ? bizTarget.label : "查看详情"}
                        >
                          {!item.read ? <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-destructive align-middle" /> : null}
                          {item.subject || "-"}
                        </button>
                        <div className="line-clamp-1 text-xs text-muted-foreground">{item.content || "-"}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{inboxEventTypeLabel(item.eventType)}</Badge>
                    </TableCell>
                    <TableCell>
                      {item.read ? <Badge variant="outline">已读</Badge> : <Badge variant="destructive">未读</Badge>}
                    </TableCell>
                    <TableCell>{item.senderName || "系统"}</TableCell>
                    <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {hasBiz ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary hover:text-primary"
                            onClick={() => void handleGotoBiz(item)}
                            title={bizTarget.label}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary hover:text-primary"
                          onClick={() => handleOpenDetail(item.id)}
                          title="查看详情"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleRequestDelete(item)}
                          disabled={deleting}
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableSurface>

      <CommonPaginationBar
        className="mt-4"
        total={total}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={canNextPage}
        onPageNoChange={setPageNo}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPageNo(1);
        }}
        showLastButton
        disabled={loading || mutating}
      />
        </>
      ) : (
        <>
          <TableSurface>
            <Table className="text-[13px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">主题</TableHead>
                  <TableHead className="min-w-[100px]">受众</TableHead>
                  <TableHead className="min-w-[120px]">通道</TableHead>
                  <TableHead className="min-w-[90px]">人数</TableHead>
                  <TableHead className="min-w-[100px]">状态</TableHead>
                  <TableHead className="min-w-[160px]">创建时间</TableHead>
                  <TableHead className="w-24 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcastLoading && broadcastItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : broadcastItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      暂无群发任务
                    </TableCell>
                  </TableRow>
                ) : (
                  broadcastItems.map((job: BroadcastJob) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.subject || "-"}</TableCell>
                      <TableCell>{BROADCAST_AUDIENCE_TYPE_LABELS[job.audienceType] || job.audienceType}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(job.channels || []).map((channel) => (
                            <Badge key={channel} variant="outline">
                              {channel === "inbox" ? "站内信" : channel === "sms" ? "短信" : channel === "email" ? "邮件" : channel}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{job.totalRecipients}</TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={
                            job.status === "failed"
                              ? "danger"
                              : job.status === "completed"
                                ? "success"
                                : job.status === "running"
                                  ? "info"
                                  : "warning"
                          }
                        >
                          {BROADCAST_STATUS_LABELS[job.status] || job.status}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>{formatDateTime(job.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary hover:text-primary"
                          title="查看详情"
                          onClick={() => {
                            setBroadcastDetailId(job.id);
                            setBroadcastDetailOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableSurface>
          <CommonPaginationBar
            className="mt-4"
            total={broadcastTotal}
            pageNo={broadcastPageNo}
            pageSize={broadcastPageSize}
            canNextPage={canNextBroadcastPage}
            onPageNoChange={setBroadcastPageNo}
            onPageSizeChange={(value) => {
              setBroadcastPageSize(value);
              setBroadcastPageNo(1);
            }}
            showLastButton
            disabled={broadcastLoading}
          />
        </>
      )}

      <NotificationBroadcastComposerDialog
        open={composerOpen}
        onOpenChange={setComposerOpen}
        onCreated={() => {
          setActiveTab("broadcasts");
          void queryClient.invalidateQueries({ queryKey: opsBroadcastQueryKeys.all });
        }}
      />

      <InboxMessageDetailDialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseDetail();
            return;
          }
          setDetailOpen(true);
        }}
        detail={detail}
        loading={detailLoading}
        read={detail ? isDetailRead(detail) : false}
        deleting={deleteMutation.isPending}
        bizActionLabel={detailBizTarget.label}
        canGoBiz={canGoBiz}
        onDelete={() => detail && handleRequestDelete(detail)}
        onGotoBiz={() => detail && void handleGotoBiz(detail, { closeDetail: true })}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              将删除消息：{deleteTarget?.subject || "-"}。该操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleConfirmDelete();
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BroadcastJobDetailDialog
        open={broadcastDetailOpen}
        onOpenChange={(open) => {
          setBroadcastDetailOpen(open);
          if (!open) setBroadcastDetailId(null);
        }}
        detail={broadcastDetail}
        loading={broadcastDetailLoading}
      />
    </PageShell>
  );
}
