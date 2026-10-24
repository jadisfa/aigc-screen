import { ExternalLink, Trash2 } from "lucide-react";
import type { TicketInboxMessage } from "@/shared/api/ops/ops-ticket-inbox";
import { inboxEventTypeLabel } from "@/modules/ops/lib/inbox-event-type";
import { formatDateTime } from "@/shared/lib/datetime";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

function bizRefText(message: TicketInboxMessage | null) {
  if (!message) return "-";
  if (message.bizUrl) return message.bizUrl;
  if (message.bizType && message.bizId) return `${message.bizType}:${message.bizId}`;
  return "-";
}

export default function InboxMessageDetailDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: TicketInboxMessage | null;
  loading?: boolean;
  read?: boolean;
  deleting?: boolean;
  bizActionLabel?: string;
  canGoBiz?: boolean;
  onDelete: () => void;
  onGotoBiz?: () => void;
}) {
  const {
    open,
    onOpenChange,
    detail,
    loading = false,
    read = false,
    deleting = false,
    bizActionLabel,
    canGoBiz = false,
    onDelete,
    onGotoBiz,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>消息详情</DialogTitle>
        </DialogHeader>

        {loading && !detail ? (
          <div className="py-10 text-center text-sm text-muted-foreground">加载中...</div>
        ) : detail ? (
          <div className="space-y-5 py-1">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-snug text-foreground">
                  {detail.subject || "-"}
                </h3>
                <Badge variant="outline">{inboxEventTypeLabel(detail.eventType)}</Badge>
                {read ? <Badge variant="outline">已读</Badge> : <Badge variant="destructive">未读</Badge>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="workflow-form-label">发送人</label>
                <div className="text-sm text-foreground">{detail.senderName || "系统"}</div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">时间</label>
                <div className="text-sm text-foreground">{formatDateTime(detail.createdAt)}</div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="workflow-form-label">关联业务</label>
                <div className="break-all font-mono text-xs text-muted-foreground">{bizRefText(detail)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="workflow-form-label">内容</label>
              <div className="max-h-[280px] overflow-y-auto rounded-2xl bg-muted/40 px-4 py-3 text-sm leading-6 text-foreground">
                <div className="whitespace-pre-wrap break-words">{detail.content || "-"}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-muted-foreground">暂无详情</div>
        )}

        <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
          <Button
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
            disabled={!detail || loading || deleting}
          >
            <Trash2 className="h-4 w-4" />
            删除
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              关闭
            </Button>
            {canGoBiz && detail && onGotoBiz ? (
              <Button onClick={onGotoBiz} disabled={loading}>
                <ExternalLink className="h-4 w-4" />
                {bizActionLabel || "处理"}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
