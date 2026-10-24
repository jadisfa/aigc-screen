import { useMemo, useState, type MouseEventHandler } from "react";
import { ChevronRight, FileText, Monitor, Play, Trash2, X } from "lucide-react";
import { StatusBadge, TableSurface } from "@/shared/components/page";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { formatDateTime } from "@/shared/lib/datetime";
import { formatElapsedDuration, formatFen, formatJson } from "@/shared/lib/format";
import { getUserAvatarFallback, resolveUserAvatarUrl } from "@/shared/lib/user-avatar";
import { formatOwnerLabel, isDeviceOwner } from "@/shared/lib/owner-display";
import type { Task } from "@/shared/api/sys/scheduler";
import {
  inferTaskWorkType,
  taskCopyText,
  taskCreatedAt,
  taskFundAmount,
  taskGenerateDurationMs,
  taskImageUrls,
  taskOutputItems,
  taskVideoUrl,
} from "@/modules/workflow/lib/scheduler-task-display";
import { resolveWorkPreviewUrl } from "@/modules/materials/lib/work-material-items";

type SchedulerTaskListTableProps = {
  items: Task[];
  loading?: boolean;
  onViewGallery: (row: Task) => void;
  onViewImage: (row: Task, url: string) => void;
  onViewVideo: (row: Task, url: string) => void;
  onViewDetail: (row: Task) => void;
  onDelete: (row: Task) => void;
  disabledDelete?: boolean;
};

const STICKY_ACTION_CLASS =
  "sticky right-0 z-10 min-w-[88px] bg-background shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]";

export function SchedulerTaskListTable(props: SchedulerTaskListTableProps) {
  const [paramsTarget, setParamsTarget] = useState<Task | null>(null);

  return (
    <>
      <TableSurface className="h-full min-h-0 [&_.page-table-scroll]:h-full [&_.page-table-scroll]:overflow-hidden [&_.page-table-scroll>div]:h-full">
        <Table className="min-w-[1640px] text-[13px] [&_th]:h-10 [&_th]:px-2 [&_td]:px-2">
          <TableHeader className="sticky top-0 z-30 [&_th]:bg-background">
            <TableRow>
              <TableHead className="min-w-[200px]">产出</TableHead>
              <TableHead className="min-w-[130px] whitespace-nowrap">创建时间</TableHead>
              <TableHead className="min-w-[130px] whitespace-nowrap">完成时间</TableHead>
              <TableHead className="min-w-[88px] whitespace-nowrap">生成耗时</TableHead>
              <TableHead className="min-w-[88px] whitespace-nowrap">任务耗时</TableHead>
              <TableHead className="min-w-[120px]">应用</TableHead>
              <TableHead className="min-w-[108px]">服务器</TableHead>
              <TableHead className="min-w-[148px] whitespace-nowrap">所属用户</TableHead>
              <TableHead className="min-w-[88px] whitespace-nowrap">资金消耗</TableHead>
              <TableHead className="min-w-[148px] whitespace-nowrap">任务状态</TableHead>
              <TableHead className="min-w-[80px] whitespace-nowrap">删除标记</TableHead>
              <TableHead className="min-w-[120px] whitespace-nowrap">详情</TableHead>
              <TableHead className={`${STICKY_ACTION_CLASS} z-40`}>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-muted-foreground py-12">
                  {props.loading ? "加载中..." : "暂无数据"}
                </TableCell>
              </TableRow>
            ) : (
              props.items.map((row) => (
                <SchedulerTaskListRow
                  key={row.taskId}
                  row={row}
                  onViewGallery={() => props.onViewGallery(row)}
                  onViewImage={(url) => props.onViewImage(row, url)}
                  onViewVideo={(url) => props.onViewVideo(row, url)}
                  onViewParams={() => setParamsTarget(row)}
                  onViewDetail={() => props.onViewDetail(row)}
                  onDelete={() => props.onDelete(row)}
                  disabledDelete={!!props.disabledDelete}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableSurface>
      <SchedulerTaskParamsDialog target={paramsTarget} onClose={() => setParamsTarget(null)} />
    </>
  );
}

function SchedulerTaskListRow(props: {
  row: Task;
  onViewGallery: () => void;
  onViewImage: (url: string) => void;
  onViewVideo: (url: string) => void;
  onViewParams: () => void;
  onViewDetail: () => void;
  onDelete: () => void;
  disabledDelete: boolean;
}) {
  const appLabel = props.row.workflowTitle || props.row.workflowCode || props.row.workflowId || "-";
  const serverLabel = props.row.serverName || props.row.serverId || "-";
  const ownerLabel = formatOwnerLabel({
    ownerKind: props.row.ownerKind,
    ownerName: props.row.principalName,
    deviceCode: props.row.deviceCode,
  });
  const deleted = !!props.row.deletedAt?.trim();
  const failed = props.row.status === "failed";

  return (
    <TableRow>
      <TableCell>
        <SchedulerTaskOutputCell
          row={props.row}
          onViewGallery={props.onViewGallery}
          onViewImage={props.onViewImage}
          onViewVideo={props.onViewVideo}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(taskCreatedAt(props.row))}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(props.row.finishedAt)}</TableCell>
      <TableCell className="whitespace-nowrap">{formatElapsedDuration(taskGenerateDurationMs(props.row))}</TableCell>
      <TableCell className="whitespace-nowrap">{formatElapsedDuration(props.row.taskDurationMs)}</TableCell>
      <TableCell className="max-w-[180px] truncate" title={appLabel}>
        {appLabel}
      </TableCell>
      <TableCell className="max-w-[160px] truncate" title={serverLabel}>
        {serverLabel}
      </TableCell>
      <TableCell className="min-w-[160px]">
        <div className="flex items-center gap-2 min-w-0" title={ownerLabel}>
          {isDeviceOwner(props.row.ownerKind) ? (
            <div className="h-8 w-8 rounded-md shrink-0 bg-muted flex items-center justify-center">
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </div>
          ) : (
            <Avatar className="h-8 w-8 rounded-md shrink-0">
              <AvatarImage
                src={resolveUserAvatarUrl(props.row.principalAvatarUrl, ownerLabel === "-" ? "U" : ownerLabel, 64)}
                alt={ownerLabel}
                className="object-cover"
              />
              <AvatarFallback className="rounded-md bg-primary/10 text-primary text-xs font-medium">
                {getUserAvatarFallback(ownerLabel === "-" ? "U" : ownerLabel)}
              </AvatarFallback>
            </Avatar>
          )}
          <span className="truncate">{ownerLabel}</span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">{formatFen(taskFundAmount(props.row))}</TableCell>
      <TableCell className="whitespace-nowrap">
        {failed ? (
          <SchedulerTaskFailedStatusButton errorMessage={props.row.errorMessage} />
        ) : (
          <SchedulerTaskStatusBadge status={props.row.status} />
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge variant={deleted ? "destructive" : "secondary"}>{deleted ? "已删除" : "未删除"}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Button variant="link" size="sm" className="h-auto p-0" onClick={props.onViewParams}>
            生成参数
          </Button>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={props.onViewDetail}>
            详情
          </Button>
        </div>
      </TableCell>
      <TableCell className={STICKY_ACTION_CLASS}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:bg-destructive/10"
          onClick={props.onDelete}
          disabled={props.disabledDelete}
          title="删除"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function SchedulerTaskOutputCell(props: {
  row: Task;
  onViewGallery: () => void;
  onViewImage: (url: string) => void;
  onViewVideo: (url: string) => void;
}) {
  const items = useMemo(() => taskOutputItems(props.row), [props.row]);
  const workType = inferTaskWorkType(props.row, items);
  const imageUrls = useMemo(() => taskImageUrls(items), [items]);
  const videoUrl = workType === "video" ? taskVideoUrl(items) : "";
  const coverUrl = workType === "video" ? props.row.coverUrl?.trim() || "" : "";
  const copyText = taskCopyText(items);

  if (workType === "image" && imageUrls.length > 1) {
    const visible = imageUrls.slice(0, 4);
    const extra = imageUrls.length - visible.length;
    return (
      <button
        type="button"
        className="flex items-center gap-1.5"
        onClick={props.onViewGallery}
        title={`共 ${imageUrls.length} 张`}
      >
        {visible.map((url, idx) => (
          <img
            key={`${url}-${idx}`}
            src={url}
            alt=""
            className="h-14 w-14 rounded-md object-cover border bg-muted"
            loading="lazy"
          />
        ))}
        {extra > 0 ? (
          <span className="h-14 min-w-10 px-1.5 rounded-md border bg-muted text-xs text-muted-foreground flex items-center justify-center">
            +{extra}
          </span>
        ) : null}
      </button>
    );
  }

  if (workType === "image") {
    const url = resolveWorkPreviewUrl(props.row.coverUrl, items, "image");
    if (!url) return <span className="text-muted-foreground">-</span>;
    return (
      <button type="button" onClick={() => props.onViewImage(url)} className="block">
        <img src={url} alt="" className="h-14 w-[72px] rounded-md object-cover border bg-muted" loading="lazy" />
      </button>
    );
  }

  if (workType === "video" && (coverUrl || videoUrl)) {
    return (
      <button
        type="button"
        className="relative h-14 w-[72px] rounded-md overflow-hidden border bg-muted"
        onClick={() => {
          if (videoUrl) props.onViewVideo(videoUrl);
        }}
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <video src={videoUrl} className="h-full w-full object-cover" muted preload="metadata" playsInline />
        )}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-7 h-7 rounded-full bg-background/70 border border-border flex items-center justify-center">
            <Play className="w-3.5 h-3.5 text-foreground" />
          </div>
        </div>
      </button>
    );
  }

  if (workType === "video") {
    return (
      <div className="h-14 w-[72px] rounded-md border bg-muted flex flex-col items-center justify-center gap-0.5 text-muted-foreground">
        <Play className="w-4 h-4" />
        <span className="text-[10px]">视频</span>
      </div>
    );
  }

  if (workType === "copywriting") {
    return (
      <button type="button" className="flex items-start gap-2 max-w-[220px] text-left" onClick={props.onViewGallery}>
        <FileText className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
        <span className="line-clamp-2 text-xs text-muted-foreground">{copyText || "文本"}</span>
      </button>
    );
  }

  return <span className="text-muted-foreground">-</span>;
}

export function SchedulerTaskFailedStatusButton(props: {
  errorMessage?: string | null;
  onTriggerClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(false);
  const message = props.errorMessage?.trim() || "无错误信息";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={props.onTriggerClick}
          className="group inline-flex items-center gap-1 rounded-md bg-background/90 px-1 py-0.5 text-left outline-none cursor-pointer shadow-sm hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="查看失败原因"
          title="查看失败原因"
        >
          <SchedulerTaskStatusBadge status="failed" />
          <span className="inline-flex items-center text-xs font-medium text-destructive underline-offset-2 group-hover:underline">
            查看原因
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" sideOffset={8} className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="text-sm font-medium">失败原因</div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setOpen(false)}
            aria-label="关闭"
            title="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <pre className="max-h-56 overflow-y-auto px-3 py-2 text-xs text-foreground whitespace-pre-wrap break-all">
          {message}
        </pre>
      </PopoverContent>
    </Popover>
  );
}

export function SchedulerTaskStatusBadge(props: { status: string; className?: string }) {
  switch (props.status) {
    case "succeeded":
      return <StatusBadge tone="success" className={props.className}>成功</StatusBadge>;
    case "failed":
      return <StatusBadge tone="danger" className={props.className}>失败</StatusBadge>;
    case "canceled":
      return <StatusBadge tone="neutral" className={props.className}>已取消</StatusBadge>;
    case "running":
      return <StatusBadge tone="info" className={props.className}>执行中</StatusBadge>;
    case "queued":
      return <StatusBadge tone="warning" className={props.className}>等待中</StatusBadge>;
    default:
      return <StatusBadge tone="neutral" className={props.className}>{props.status}</StatusBadge>;
  }
}

export function SchedulerTaskParamsDialog(props: {
  target: Task | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!props.target} onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>生成参数</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          <div className="space-y-2">
            <div className="text-sm font-medium">输入参数</div>
            <pre className="overflow-x-auto rounded-md bg-muted/30 p-3 text-xs text-foreground whitespace-pre-wrap break-all">
              {formatJson(props.target?.inputJson || "")}
            </pre>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">输出参数</div>
            <pre className="overflow-x-auto rounded-md bg-muted/30 p-3 text-xs text-foreground whitespace-pre-wrap break-all">
              {formatJson(props.target?.outputJson || "")}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

