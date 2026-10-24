import { type Dispatch as SchedulerDispatch, type TaskEvent, formatTaskEventType } from "@/shared/api/sys/scheduler";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { formatDateTime } from "@/shared/lib/datetime";
import { XCircle, ExternalLink } from "lucide-react";
import { isTerminalStatus, getStatusBadgeVariant, normalizeDisplayText, safeJsonParse, toCompactJson } from "./utils";
import { resolveTaskFailureMessage } from "@/shared/api/sys/error-message";

export function TaskCanvas(props: {
  detail: SchedulerDispatch | null;
  events: TaskEvent[];
  streamMode: "idle" | "ws" | "http";
  streamHint: string | null;
  onCancel: () => void;
  cancelDisabled: boolean;
}) {
  const status = props.detail?.status || "";
  const terminal = isTerminalStatus(status);

  const assets = props.detail?.assets ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge variant={getStatusBadgeVariant(status)} className="text-xs">
          {status ? `状态：${status}` : "状态：未运行"}
        </Badge>
        {typeof props.detail?.progress === "number" && props.detail ? (
          <Badge variant="outline" className="text-xs">
            进度：{props.detail.progress}%
          </Badge>
        ) : null}
        {props.streamMode !== "idle" && (
          <Badge variant="secondary" className="text-xs">
            {props.streamMode === "ws" ? "实时：WebSocket" : "回退：HTTP"}
          </Badge>
        )}
        {props.detail?.taskId && <span className="text-xs text-muted-foreground font-mono">{props.detail.taskId}</span>}
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={props.onCancel}
          disabled={props.cancelDisabled || terminal || !props.detail?.taskId}
        >
          <XCircle className="w-4 h-4 mr-1" />
          取消
        </Button>
      </div>

      {props.streamHint && <div className="text-xs text-muted-foreground">{props.streamHint}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
        <div className="rounded-lg border border-border p-3 bg-background">
          <div className="text-foreground text-xs mb-1">提交时间</div>
          <div>{formatDateTime(props.detail?.submittedAt)}</div>
        </div>
        <div className="rounded-lg border border-border p-3 bg-background">
          <div className="text-foreground text-xs mb-1">开始时间</div>
          <div>{formatDateTime(props.detail?.startedAt)}</div>
        </div>
        <div className="rounded-lg border border-border p-3 bg-background">
          <div className="text-foreground text-xs mb-1">结束时间</div>
          <div>{formatDateTime(props.detail?.finishedAt)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
        <div className="rounded-lg border border-border p-3 bg-background">
          <div className="text-foreground text-xs mb-1">调度服务器</div>
          <div>{props.detail?.serverName || props.detail?.serverId || "-"}</div>
        </div>
        <div className="rounded-lg border border-border p-3 bg-background">
          <div className="text-foreground text-xs mb-1">队列位置</div>
          <div>{props.detail?.queuePosition ?? 0}</div>
        </div>
        <div className="rounded-lg border border-border p-3 bg-background">
          <div className="text-foreground text-xs mb-1">预计耗时</div>
          <div>{props.detail?.etaSeconds ? `${props.detail.etaSeconds}s` : "-"}</div>
        </div>
      </div>

      {normalizeDisplayText(props.detail?.errorMessage) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {resolveTaskFailureMessage(props.detail?.errorMessage, props.detail?.errorCode)}
        </div>
      )}

      <div className="rounded-lg border border-border bg-background p-3">
        <div className="text-sm font-medium text-foreground mb-2">运行事件</div>
        {props.events.length === 0 ? (
          <div className="text-xs text-muted-foreground">暂无事件</div>
        ) : (
          <div className="space-y-2">
            {props.events.map((e, idx) => (
              <div key={`${e.eventType}-${e.createdAt}-${idx}`} className="flex items-start gap-2 text-xs">
                <span className="text-muted-foreground w-24 shrink-0">{formatDateTime(e.createdAt)}</span>
                <span className="text-foreground w-28 shrink-0">{formatTaskEventType(e.eventType)}</span>
                <span className="text-muted-foreground break-all flex-1">{normalizeDisplayText(e.detailJson) || "-"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-background p-3">
        <div className="text-sm font-medium text-foreground mb-2">运行结果</div>
        {assets.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            {normalizeDisplayText(props.detail?.outputJson)
              || normalizeDisplayText(toCompactJson(safeJsonParse(props.detail?.outputJson || "") ?? props.detail?.outputJson))
              || "暂无输出"}
          </div>
        ) : (
          <div className="space-y-2">
            {assets.map((a) => (
              <div key={a.assetId} className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground font-mono">{a.assetId}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {a.kind}
                  </Badge>
                  {a.reviewStatus && (
                    <Badge variant="secondary" className="text-[10px]">
                      审核：{a.reviewStatus}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {a.textContent && /^https?:\/\//i.test(a.textContent) ? (
                    <a className="inline-flex items-center gap-1 text-primary hover:underline" href={a.textContent} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-3 h-3" />
                      打开输出链接
                    </a>
                  ) : (
                    a.textContent || "-"
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
