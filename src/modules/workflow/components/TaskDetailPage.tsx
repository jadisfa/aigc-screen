import { useCallback, useEffect, useState, useMemo } from "react";
import { ArrowLeft, Download, Image as ImageIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Progress } from "@/shared/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  getTask,
  listTaskEvents,
  cancelTask,
  reassignTask,
  listServers,
  TaskDetail,
  TaskEvent,
  Server,
  parseTaskEventDetailJson,
  formatTaskEventType,
} from "@/shared/api/sys/scheduler";
import { formatDateTime } from "@/shared/lib/datetime";
import { Badge } from "@/shared/ui/badge";
import { resolveTaskFailureHint } from "@/shared/api/sys/error-message";

export interface TaskDetailPageProps {
  taskId: string;
  onBack: () => void;
}
import { notify } from "@/shared/lib/notify";

export default function TaskDetailPage({ taskId, onBack }: TaskDetailPageProps) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);
  const [reassignServerId, setReassignServerId] = useState<string>("");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const [taskRes, eventsRes, serversRes] = await Promise.all([
        getTask(taskId),
        listTaskEvents(taskId),
        listServers()
      ]);
      setTask(taskRes);
      setEvents(eventsRes);
      setServers(serversRes.items);
    } catch (e) {
      notify.error("加载任务详情失败");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (taskId) {
      void loadData();
    }
  }, [loadData, taskId]);

  const handleCancel = async () => {
    if (!taskId) return;
    try {
      await cancelTask(taskId);
      notify.success("任务已取消");
      loadData();
    } catch (e) {
      notify.error("取消任务失败");
    }
  };

  const handleReassign = async () => {
    if (!taskId || !reassignServerId) return;
    try {
      await reassignTask(taskId, reassignServerId);
      notify.success("任务重调度成功");
      loadData();
    } catch (e) {
      notify.error("任务重调度失败");
    }
  };

  const latestProgress = useMemo(() => {
    if (!events.length) return null;
    for (let i = events.length - 1; i >= 0; i--) {
      const parsed = parseTaskEventDetailJson(events[i].detailJson);
      if (parsed?.progress !== undefined && parsed.progress !== null) {
        return parsed.progress;
      }
    }
    return null;
  }, [events]);

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case "succeeded":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">成功</Badge>;
      case "failed":
        return <Badge variant="destructive">失败</Badge>;
      case "canceled":
        return <Badge variant="secondary">已取消</Badge>;
      case "running":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">运行中</Badge>;
      case "queued":
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200">排队中</Badge>;
      default:
        return <Badge variant="outline">{status || "未知"}</Badge>;
    }
  };

  const renderReviewStatus = (status?: string | null, compact = false) => {
    switch (status) {
      case "passed":
        return <span className="text-green-600 font-medium">通过</span>;
      case "blocked":
        return <span className="text-amber-600 font-medium">{compact ? "拦截" : "已拦截"}</span>;
      case "rejected":
        return <span className="text-destructive font-medium">拒绝</span>;
      case "pending":
        return <span className="text-yellow-600 font-medium">{compact ? "审核中" : "待审核"}</span>;
      default:
        return status ? <span className="text-muted-foreground font-medium">{status}</span> : null;
    }
  };

  const downloadImage = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const imgAssets = useMemo(() => {
    return task?.assets?.filter((a) => a.kind === "image") || [];
  }, [task?.assets]);

  const otherAssets = useMemo(() => {
    return task?.assets?.filter((a) => a.kind !== "image") || [];
  }, [task?.assets]);

  if (loading && !task) {
    return <div className="flex justify-center p-8 text-muted-foreground">加载中...</div>;
  }

  if (!task) {
    return null;
  }

  const failureHint = resolveTaskFailureHint(task.errorMessage, extractTaskErrorCode(events));

  return (
    <div className="page-content-shell flex-1 overflow-hidden p-0 flex flex-col">
      <div className="subpage-toolbar mb-0 shrink-0 bg-background z-20">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-[18px] font-semibold text-foreground">任务详情 - {taskId}</h1>
        </div>
        <div className="flex items-center gap-2">
          {task?.status === "queued" && (
            <>
              <Select value={reassignServerId} onValueChange={setReassignServerId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="选择服务器" />
                </SelectTrigger>
                <SelectContent>
                  {servers.map((s) => (
                    <SelectItem key={s.serverId} value={s.serverId}>
                      {s.serverName || s.serverId} ({s.queueSize})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleReassign} disabled={!reassignServerId}>
                重调度
              </Button>
              <Button variant="destructive" size="sm" onClick={handleCancel}>
                取消任务
              </Button>
            </>
          )}
          {task?.status === "running" && (
            <Button variant="destructive" size="sm" onClick={handleCancel}>
              取消任务
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-6">
        <div className="w-full max-w-[1200px] mx-auto space-y-8 pb-12">
        {/* 基础信息 */}
        <section className="space-y-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold flex items-center gap-3">
              基础信息
              {renderStatusBadge(task.status)}
            </h2>
          </div>
          
          {task.status === "running" && (
            <div className="space-y-2 max-w-xl">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">运行进度</span>
                <span className="font-medium">{latestProgress !== null ? `${latestProgress}%` : '计算中...'}</span>
              </div>
              <Progress value={latestProgress ?? undefined} className="h-2" />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-muted/20 p-5 rounded-lg border">
            <div className="space-y-1.5">
              <div className="text-sm text-muted-foreground">任务名称</div>
              <div className="font-medium text-foreground">{task.taskName || "-"}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-sm text-muted-foreground">优先级</div>
              <div className="font-medium text-foreground">{task.priority}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-sm text-muted-foreground">预览模式</div>
              <div className="font-medium text-foreground">{task.preview ? "是" : "否"}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-sm text-muted-foreground">提交时间</div>
              <div className="font-medium text-foreground">{formatDateTime(task.submittedAt)}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-sm text-muted-foreground">开始时间</div>
              <div className="font-medium text-foreground">{formatDateTime(task.startedAt)}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-sm text-muted-foreground">结束时间</div>
              <div className="font-medium text-foreground">{formatDateTime(task.finishedAt)}</div>
            </div>
          </div>

          {task.errorMessage && (
            <div className="space-y-2 mt-4">
              <h3 className="text-base font-medium text-destructive">
                {failureHint.title || "异常/错误信息"}
              </h3>
              <div className="bg-destructive/10 text-destructive p-4 rounded-md whitespace-pre-wrap text-sm border border-destructive/20">
                {failureHint.description}
              </div>
            </div>
          )}
        </section>

        {/* 运行详细参数 */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">运行详细参数</h2>
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">输入参数 (Inputs)</h3>
              <div className="bg-muted/40 p-4 rounded-md whitespace-pre-wrap font-mono text-sm max-h-[600px] overflow-auto border break-all">
                {task.inputJson ? (() => {
                  try {
                    return JSON.stringify(JSON.parse(task.inputJson), null, 2);
                  } catch (e) {
                    return task.inputJson;
                  }
                })() : "无输入参数"}
              </div>
            </div>
          </div>
        </section>

        {/* 生成结果 */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">生成结果 (Assets)</h2>
          {imgAssets.length > 0 || otherAssets.length > 0 ? (
            <div className="space-y-6">
              {imgAssets.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-[1020px]">
                  {imgAssets.map((img) => (
                    <div key={img.assetId} className="group relative aspect-square rounded-md overflow-hidden border border-border bg-muted/40">
                      <img
                        src={img.textContent || ""}
                        alt=""
                        className="w-full h-full object-cover cursor-zoom-in"
                        onClick={() => setPreviewImageUrl(img.textContent || "")}
                      />
                      <div className="absolute right-1 top-1 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          className="h-8 w-8 inline-flex items-center justify-center rounded bg-background/90 text-foreground hover:bg-background"
                          title="放大"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImageUrl(img.textContent || "");
                          }}
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="h-8 w-8 inline-flex items-center justify-center rounded bg-background/90 text-foreground hover:bg-background"
                          title="下载图片"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadImage(img.textContent || "");
                          }}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 flex justify-between items-center bg-background/80 backdrop-blur-sm py-1 text-xs">
                        <span className="truncate flex-1 font-mono text-[12px]" title={img.assetId}>{img.assetId.substring(0, 8)}...</span>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {renderReviewStatus(img.reviewStatus, true)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {otherAssets.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>资产 ID</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>提供方</TableHead>
                        <TableHead>审核状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {otherAssets.map((a) => (
                        <TableRow key={a.assetId}>
                          <TableCell className="font-mono text-sm">{a.assetId}</TableCell>
                          <TableCell>{a.kind}</TableCell>
                          <TableCell>{a.provider || "-"}</TableCell>
                          <TableCell>
                            {renderReviewStatus(a.reviewStatus) || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground bg-muted/20 p-4 rounded-md border text-center">暂无生成结果。</div>
          )}
        </section>

        {/* 事件信息 */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">事件信息</h2>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[180px]">发生时间</TableHead>
                  <TableHead className="w-[150px]">事件类型</TableHead>
                  <TableHead>详情 (Details)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">暂无事件记录</TableCell>
                  </TableRow>
                ) : (
                  events.map((e, idx) => {
                    const parsed = parseTaskEventDetailJson(e.detailJson);
                    return (
                      <TableRow key={e.eventId || idx}>
                        <TableCell className="text-sm text-muted-foreground">{formatDateTime(e.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">{formatTaskEventType(e.eventType)}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-pre-wrap break-all max-w-[600px]">
                          {parsed ? JSON.stringify(parsed, null, 2) : e.detailJson || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>
        </div>
      </div>

      {/* 图片放大预览 */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <img
            src={previewImageUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-md"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-2"
            onClick={() => setPreviewImageUrl(null)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      )}
    </div>
  );
}

function extractTaskErrorCode(events: TaskEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const detail = parseTaskEventDetailJson(events[i]?.detailJson ?? null);
    if (!detail) continue;
    if (typeof detail.errorCode === "string" && detail.errorCode.trim()) {
      return detail.errorCode.trim();
    }
    const payload = detail.payload;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const code = (payload as Record<string, unknown>).errorCode;
      if (typeof code === "string" && code.trim()) {
        return code.trim();
      }
    }
  }
  return null;
}
