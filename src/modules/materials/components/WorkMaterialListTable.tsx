import { useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, FileText, Monitor, Play, Trash2 } from "lucide-react";
import { TableSurface } from "@/shared/components/page";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { formatDateTime } from "@/shared/lib/datetime";
import { formatElapsedDuration, formatFen, formatJson } from "@/shared/lib/format";
import { getUserAvatarFallback, resolveUserAvatarUrl } from "@/shared/lib/user-avatar";
import { formatOwnerLabel, isDeviceOwner } from "@/shared/lib/owner-display";
import type { WorkMaterialSummary } from "@/shared/api/materials/materials-work";
import {
  materialSourceLabel,
} from "@/modules/materials/lib/material-governance";
import {
  firstItemUrl,
  parseWorkItems,
  resolveWorkPreviewUrl,
  workImageUrls,
  type WorkGeneratedItem,
} from "@/modules/materials/lib/work-material-items";

type WorkMaterialListTableProps = {
  items: WorkMaterialSummary[];
  loading?: boolean;
  selectable: boolean;
  selectedIds: Record<string, boolean>;
  onCheckedChange: (id: string, checked: boolean) => void;
  onAudit: (row: WorkMaterialSummary) => void;
  onTogglePublish: (row: WorkMaterialSummary) => void;
  onDelete: (row: WorkMaterialSummary) => void;
  onViewGallery: (row: WorkMaterialSummary) => void;
  onViewImage: (row: WorkMaterialSummary, url: string) => void;
  onViewVideo: (row: WorkMaterialSummary, url: string) => void;
  disabledAudit: boolean;
  disabledPublish: (row: WorkMaterialSummary) => boolean;
  disabledDelete: boolean;
};

const STICKY_ACTION_CLASS =
  "sticky right-0 z-10 min-w-[148px] bg-background shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]";

export function WorkMaterialListTable(props: WorkMaterialListTableProps) {
  const [paramsTarget, setParamsTarget] = useState<WorkMaterialSummary | null>(null);

  return (
    <>
      <TableSurface className="h-full min-h-0 [&_.page-table-scroll]:h-full [&_.page-table-scroll]:overflow-hidden [&_.page-table-scroll>div]:h-full">
        <Table className="min-w-[1720px] text-[13px] [&_th]:h-10 [&_th]:px-2 [&_td]:px-2">
          <TableHeader className="sticky top-0 z-30 [&_th]:bg-background">
            <TableRow>
              {props.selectable ? <TableHead className="w-10 min-w-10" /> : null}
              <TableHead className="min-w-[200px]">产出</TableHead>
              <TableHead className="min-w-[148px] whitespace-nowrap">创建时间</TableHead>
              <TableHead className="min-w-[148px] whitespace-nowrap">完成时间</TableHead>
              <TableHead className="min-w-[88px] whitespace-nowrap">生成耗时</TableHead>
              <TableHead className="min-w-[88px] whitespace-nowrap">任务总耗时</TableHead>
              <TableHead className="min-w-[120px]">应用</TableHead>
              <TableHead className="min-w-[72px]">来源</TableHead>
              <TableHead className="min-w-[108px]">服务器</TableHead>
              <TableHead className="min-w-[148px] whitespace-nowrap">所属用户</TableHead>
              <TableHead className="min-w-[88px] whitespace-nowrap">资金消耗</TableHead>
              <TableHead className="min-w-[80px] whitespace-nowrap">删除标记</TableHead>
              <TableHead className="min-w-[80px] whitespace-nowrap">生成参数</TableHead>
              <TableHead className={`${STICKY_ACTION_CLASS} z-40`}>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={props.selectable ? 14 : 13}
                  className="text-center text-muted-foreground py-12"
                >
                  {props.loading ? "加载中..." : "暂无作品"}
                </TableCell>
              </TableRow>
            ) : (
              props.items.map((row) => (
                <WorkMaterialListRow
                  key={row.id}
                  row={row}
                  selectable={props.selectable}
                  checked={!!props.selectedIds[row.id]}
                  onCheckedChange={(checked) => props.onCheckedChange(row.id, checked)}
                  onAudit={() => props.onAudit(row)}
                  onTogglePublish={() => props.onTogglePublish(row)}
                  onDelete={() => props.onDelete(row)}
                  onViewGallery={() => props.onViewGallery(row)}
                  onViewImage={(url) => props.onViewImage(row, url)}
                  onViewVideo={(url) => props.onViewVideo(row, url)}
                  onViewParams={() => setParamsTarget(row)}
                  disabledAudit={props.disabledAudit}
                  disabledPublish={props.disabledPublish(row)}
                  disabledDelete={props.disabledDelete}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableSurface>
      <WorkMaterialParamsDialog target={paramsTarget} onClose={() => setParamsTarget(null)} />
    </>
  );
}

function WorkMaterialListRow(props: {
  row: WorkMaterialSummary;
  selectable: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onAudit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
  onViewGallery: () => void;
  onViewImage: (url: string) => void;
  onViewVideo: (url: string) => void;
  onViewParams: () => void;
  disabledAudit: boolean;
  disabledPublish: boolean;
  disabledDelete: boolean;
}) {
  const publishBtnLabel = props.row.publishStatus === "online" ? "下架" : "上架";
  const completedAt = props.row.endedAt || props.row.taskExecution?.finishedAt || "";
  const generateDurationMs =
    props.row.durationMs ??
    (typeof props.row.taskExecution?.generateTimeSec === "number"
      ? props.row.taskExecution.generateTimeSec * 1000
      : null);
  const taskDurationMs = props.row.taskExecution?.taskDurationMs;
  const appLabel = props.row.workflowTitle || props.row.workflowCode || props.row.workflowId || "-";
  const serverLabel = props.row.serverName || props.row.serverId || "-";
  const ownerLabel = formatOwnerLabel(props.row);
  const deleted = !!props.row.deletedAt?.trim();

  return (
    <TableRow>
      {props.selectable ? (
        <TableCell>
          <Checkbox
            checked={props.checked}
            onCheckedChange={(v) => props.onCheckedChange(v === true)}
            aria-label="选择"
          />
        </TableCell>
      ) : null}
      <TableCell>
        <WorkMaterialOutputCell
          row={props.row}
          onViewGallery={props.onViewGallery}
          onViewImage={props.onViewImage}
          onViewVideo={props.onViewVideo}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(props.row.createdAt)}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(completedAt)}</TableCell>
      <TableCell className="whitespace-nowrap">{formatElapsedDuration(generateDurationMs)}</TableCell>
      <TableCell className="whitespace-nowrap">{formatElapsedDuration(taskDurationMs)}</TableCell>
      <TableCell className="max-w-[180px] truncate" title={appLabel}>
        {appLabel}
      </TableCell>
      <TableCell className="whitespace-nowrap">{materialSourceLabel(props.row.sourceType)}</TableCell>
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
                src={resolveUserAvatarUrl(props.row.ownerAvatarUrl, ownerLabel === "-" ? "U" : ownerLabel, 64)}
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
      <TableCell className="whitespace-nowrap">
        {formatFen(props.row.computeCost)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge variant={deleted ? "destructive" : "secondary"}>{deleted ? "已删除" : "未删除"}</Badge>
      </TableCell>
      <TableCell>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={props.onViewParams}>
          查看
        </Button>
      </TableCell>
      <TableCell className={STICKY_ACTION_CLASS}>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={props.onAudit} disabled={props.disabledAudit} title="审核">
            <CheckCircle2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={props.onTogglePublish}
            disabled={props.disabledPublish}
            title={props.disabledPublish ? "需先通过审核" : publishBtnLabel}
          >
            {props.row.publishStatus === "online" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
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
        </div>
      </TableCell>
    </TableRow>
  );
}

function WorkMaterialOutputCell(props: {
  row: WorkMaterialSummary;
  onViewGallery: () => void;
  onViewImage: (url: string) => void;
  onViewVideo: (url: string) => void;
}) {
  const parsedItems = useMemo(() => parseWorkItems(props.row.itemsJson), [props.row.itemsJson]);
  const isVideo = props.row.workType === "video";
  const isImage = props.row.workType === "image";
  const isCopywriting = props.row.workType === "copywriting";
  const imageUrls = useMemo(() => workImageUrls(parsedItems), [parsedItems]);
  const videoUrl = isVideo ? firstItemUrl(parsedItems, "video") : "";
  const coverUrl = isVideo ? props.row.coverUrl?.trim() || "" : "";
  const copyText = copywritingPreview(parsedItems);

  if (isImage && imageUrls.length > 1) {
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

  if (isImage) {
    const url = resolveWorkPreviewUrl(props.row.coverUrl, parsedItems, "image");
    if (!url) return <span className="text-muted-foreground">-</span>;
    return (
      <button type="button" onClick={() => props.onViewImage(url)} className="block">
        <img src={url} alt="" className="h-14 w-[72px] rounded-md object-cover border bg-muted" loading="lazy" />
      </button>
    );
  }

  if (isVideo && (coverUrl || videoUrl)) {
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

  if (isVideo) {
    return (
      <div className="h-14 w-[72px] rounded-md border bg-muted flex flex-col items-center justify-center gap-0.5 text-muted-foreground">
        <Play className="w-4 h-4" />
        <span className="text-[10px]">视频</span>
      </div>
    );
  }

  if (isCopywriting) {
    return (
      <button
        type="button"
        className="flex items-start gap-2 max-w-[220px] text-left"
        onClick={props.onViewGallery}
      >
        <FileText className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
        <span className="line-clamp-2 text-xs text-muted-foreground">{copyText || "文案"}</span>
      </button>
    );
  }

  return <span className="text-muted-foreground">-</span>;
}

function copywritingPreview(items: WorkGeneratedItem[]): string {
  const first = items.find((item) => {
    const text = typeof item.text === "string" ? item.text.trim() : "";
    const url = typeof item.url === "string" ? item.url.trim() : "";
    return !!text || !!url;
  });
  if (!first) return "";
  return (typeof first.text === "string" && first.text.trim()) || (typeof first.url === "string" && first.url.trim()) || "";
}

function WorkMaterialParamsDialog(props: {
  target: WorkMaterialSummary | null;
  onClose: () => void;
}) {
  const inputParams = props.target?.taskExecution?.inputParams || props.target?.requestParams || "";
  const outputParams = props.target?.taskExecution?.outputParams || props.target?.itemsJson || "";

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
              {formatJson(inputParams)}
            </pre>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">输出参数</div>
            <pre className="overflow-x-auto rounded-md bg-muted/30 p-3 text-xs text-foreground whitespace-pre-wrap break-all">
              {formatJson(outputParams)}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
