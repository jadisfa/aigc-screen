import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  getTicketInboxUnreadCount,
  invalidateOpsInboxQueries,
  listTicketInboxMessages,
  markAllTicketInboxMessagesRead,
  markTicketInboxMessageRead,
  opsInboxQueryKeys,
  type TicketInboxMessage,
} from "@/shared/api/ops/ops-ticket-inbox";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { formatDateTime } from "@/shared/lib/datetime";
import {
  canNavigateInboxBiz,
  navigateInboxBiz,
  resolveInboxBizTarget,
} from "@/modules/ops/lib/inbox-biz-navigation";
import { inboxEventTypeLabel } from "@/modules/ops/lib/inbox-event-type";

const NotificationPopover = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionScope = useSessionScope();
  const scopeKey = sessionScope.scope.queryScopeKey;
  const [open, setOpen] = useState(false);

  const unreadQuery = useQuery({
    queryKey: opsInboxQueryKeys.unread(scopeKey),
    queryFn: getTicketInboxUnreadCount,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const recentQuery = useQuery({
    queryKey: opsInboxQueryKeys.recent(scopeKey),
    queryFn: () => listTicketInboxMessages({ pageNo: 1, pageSize: 10 }),
    enabled: open,
    refetchOnWindowFocus: true,
  });

  const markAllMutation = useMutation({
    mutationFn: markAllTicketInboxMessagesRead,
    onSuccess: async () => {
      await invalidateOpsInboxQueries(queryClient);
    },
  });

  const handleOpenMessage = async (item: TicketInboxMessage) => {
    setOpen(false);
    if (!item.read) {
      try {
        await markTicketInboxMessageRead(item.id);
        await invalidateOpsInboxQueries(queryClient);
      } catch {
        // 跳转优先，已读失败不阻断业务处理
      }
    }

    const target = resolveInboxBizTarget(item);
    if (canNavigateInboxBiz(target)) {
      navigateInboxBiz(navigate, target);
      return;
    }
    navigate("/ops/notifications", { state: { openMessageId: item.id } });
  };

  const inboxUnreadCount = unreadQuery.data ?? 0;
  const notifications = recentQuery.data?.items ?? [];

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          void queryClient.invalidateQueries({ queryKey: opsInboxQueryKeys.recent(scopeKey) });
          void queryClient.invalidateQueries({ queryKey: opsInboxQueryKeys.unread(scopeKey) });
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
          title="消息通知"
        >
          <Bell className="h-4 w-4" />
          {inboxUnreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {inboxUnreadCount > 99 ? "99+" : inboxUnreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] rounded-xl border border-border p-0 shadow-lg" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 pb-0 pt-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span>系统消息</span>
            {inboxUnreadCount > 0 ? (
              <Badge variant="destructive" className="h-4 min-w-[16px] rounded-full px-1 text-[10px]">
                {inboxUnreadCount > 99 ? "99+" : inboxUnreadCount}
              </Badge>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/ops/notifications");
            }}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            查看全部
          </button>
        </div>
        <div className="flex items-center justify-end px-4 py-2">
          <button
            type="button"
            onClick={() => void markAllMutation.mutateAsync()}
            disabled={notifications.length === 0 || inboxUnreadCount === 0 || markAllMutation.isPending}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted-foreground"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {markAllMutation.isPending ? "处理中..." : "全部标记为已读"}
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="space-y-3 px-4 pb-4">
            {recentQuery.isLoading ? (
              <EmptyState label="加载中..." />
            ) : notifications.length > 0 ? (
              notifications.map((item) => (
                <NotificationCard key={item.id} item={item} onClick={() => void handleOpenMessage(item)} />
              ))
            ) : (
              <EmptyState label="暂无消息" />
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const NotificationCard = ({ item, onClick }: { item: TicketInboxMessage; onClick: () => void }) => {
  const avatar = (item.senderName || "系").charAt(0);
  const typeLabel = inboxEventTypeLabel(item.eventType, "");
  const target = resolveInboxBizTarget(item);
  const actionHint = canNavigateInboxBiz(target) ? target.label : "查看详情";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full space-y-2 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/20 ${
        item.read ? "opacity-60" : "bg-card"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
          {avatar}
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.subject || "系统通知"}</span>
        {!item.read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" /> : null}
        <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
      </div>
      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.content || "-"}</p>
      <div className="flex items-center justify-between gap-2">
        {typeLabel ? (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
            {typeLabel}
          </Badge>
        ) : (
          <span />
        )}
        <span className="text-[11px] text-primary">{actionHint}</span>
      </div>
    </button>
  );
};

const EmptyState = ({ label }: { label: string }) => {
  return (
    <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 text-sm text-muted-foreground">
      {label}
    </div>
  );
};

export default NotificationPopover;
