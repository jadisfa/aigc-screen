import type { BroadcastJob } from "@/shared/api/ops/ops-notification-broadcast";
import { formatDateTime } from "@/shared/lib/datetime";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

export const BROADCAST_STATUS_LABELS: Record<string, string> = {
  queued: "排队中",
  running: "发送中",
  completed: "已完成",
  failed: "失败",
};

export const BROADCAST_AUDIENCE_TYPE_LABELS: Record<string, string> = {
  ALL: "全体",
  MERCHANT: "指定商户",
  STORE: "指定门店",
  USERS: "指定用户",
};

function channelLabel(channel: string) {
  if (channel === "inbox") return "站内信";
  if (channel === "sms") return "短信";
  if (channel === "email") return "邮件";
  return channel;
}

export default function BroadcastJobDetailDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: BroadcastJob | null;
  loading?: boolean;
}) {
  const { open, onOpenChange, detail, loading = false } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>群发任务详情</DialogTitle>
        </DialogHeader>
        {loading && !detail ? (
          <div className="py-10 text-center text-sm text-muted-foreground">加载中...</div>
        ) : detail ? (
          <div className="space-y-5 py-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold text-foreground">{detail.subject || "-"}</h3>
              <Badge variant={detail.status === "failed" ? "destructive" : "outline"}>
                {BROADCAST_STATUS_LABELS[detail.status] || detail.status}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="workflow-form-label">受众类型</label>
                <div className="text-sm">
                  {BROADCAST_AUDIENCE_TYPE_LABELS[detail.audienceType] || detail.audienceType}
                </div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">人数</label>
                <div className="text-sm">{detail.totalRecipients}</div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">通道</label>
                <div className="flex flex-wrap gap-1">
                  {(detail.channels || []).map((channel) => (
                    <Badge key={channel} variant="outline">
                      {channelLabel(channel)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">创建时间</label>
                <div className="text-sm">{formatDateTime(detail.createdAt)}</div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">站内信</label>
                <div className="text-sm text-muted-foreground">
                  已入队 {detail.inboxQueued} / 已投递 {detail.inboxSent} / 失败 {detail.inboxFailed}
                </div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">短信</label>
                <div className="text-sm text-muted-foreground">
                  已入队 {detail.smsQueued} / 已投递 {detail.smsSent} / 失败 {detail.smsFailed}
                </div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">邮件</label>
                <div className="text-sm text-muted-foreground">
                  已入队 {detail.emailQueued ?? 0} / 已投递 {detail.emailSent ?? 0} / 失败 {detail.emailFailed ?? 0}
                </div>
              </div>
            </div>
            {detail.content ? (
              <div className="space-y-2">
                <label className="workflow-form-label">内容</label>
                <div className="max-h-[200px] overflow-y-auto rounded-2xl bg-muted/40 px-4 py-3 text-sm leading-6 whitespace-pre-wrap break-words">
                  {detail.content}
                </div>
              </div>
            ) : null}
            {detail.errorMessage ? <div className="text-sm text-destructive">{detail.errorMessage}</div> : null}
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-muted-foreground">暂无详情</div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
