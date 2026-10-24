import { useState, useRef, useCallback, useEffect, useMemo, useImperativeHandle, forwardRef, UIEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseTaskEventDetailJson, type Dispatch, type DispatchTimelineItem, type TaskEvent } from "@/shared/api/sys/scheduler";
import { Badge } from "@/shared/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import {
  Download,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  Copy,
  Eye,
} from "lucide-react";
import { notify } from "@/shared/lib/notify";
import { TaskCanvas } from "./TaskCanvas";
import { LiveProgressOverlay, LiveDuration } from "./LiveTaskStatus";
import { ImageViewerDialog } from "./ImageViewerDialog";
import { useAssetDownloader } from "@/modules/workflow/hooks/use-asset-downloader";
import { resolveTaskFailureHint } from "@/shared/api/sys/error-message";
import {
  isProbablyImageUrl,
  isProbablyVideoUrl,
  getExpectedImageCount,
  extractTextFromUnknown,
  normalizeDisplayText,
  safeJsonParse,
  toCompactJson,
  formatDateTime,
  taskTime,
  isInFlightStatus,
  isTerminalStatus,
  formatInFlightStatusLabel,
  shouldShowLiveProgressOverlay,
} from "./utils";
import template1 from "@/assets/template-1.jpg";
import template8 from "@/assets/template-8.jpg";

const TOKEN_USAGE_LINE_RE = /^(prompt tokens|completion tokens|completions tokens|total tokens)\s*:/i;

function OverflowSubtitle(props: { text: string }) {
  const { text } = props;
  const textRef = useRef<HTMLDivElement | null>(null);
  const [overflowed, setOverflowed] = useState(false);
  const [open, setOpen] = useState(false);

  const measure = useCallback(() => {
    const el = textRef.current;
    if (!el) {
      setOverflowed(false);
      return;
    }
    setOverflowed(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useEffect(() => {
    measure();
    const el = textRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, measure]);

  const copyFullText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      notify.success("已复制到剪贴板");
    } catch {
      notify.error("复制失败，请重试");
    }
  }, [text]);

  if (!text) {
    return <div className="text-[11px] text-muted-foreground/80 mt-1">-</div>;
  }

  return (
    <>
      <div className="mt-1 flex items-center gap-1 min-w-0">
        <div
          ref={textRef}
          className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-muted-foreground/80"
        >
          {text}
        </div>
        {overflowed && (
          <button
            type="button"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
            title="查看全部"
            aria-label="查看全部内容"
            onClick={() => setOpen(true)}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>提示词</DialogTitle>
            {/* <DialogDescription>当前提示词 / 副标题全文，可复制后粘贴使用。</DialogDescription> */}
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border bg-muted/20 px-3 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <pre className="whitespace-pre-wrap break-words text-[13px] leading-6 text-foreground/90 font-sans">
              {text}
            </pre>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              关闭
            </Button>
            <Button type="button" onClick={() => void copyFullText()}>
              <Copy className="w-4 h-4 mr-1.5" />
              复制全部
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function normalizeMarkdownContent(value: string): string | null {
  const normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  if (!normalized) {
    return null;
  }
  return normalized
    .replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2")
    .replace(/^(#{1,6}\s[^\n]+)\n([^\n])/gm, "$1\n\n$2")
    .replace(/^[ \t]*(---+|\*\*\*+|___+)[ \t]*$/gm, "")
    .replace(/([^\n])\n((?:\d+\.)|(?:[-*+]))\s/g, "$1\n\n$2 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitTextAssetContent(value: string | null | undefined): { markdown: string | null; tokenUsage: string | null } {
  const text = normalizeDisplayText(value);
  if (!text) {
    return { markdown: null, tokenUsage: null };
  }
  const tokenLines: string[] = [];
  const contentLines: string[] = [];
  text.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      contentLines.push("");
      return;
    }
    if (TOKEN_USAGE_LINE_RE.test(trimmedLine)) {
      tokenLines.push(trimmedLine);
      return;
    }
    contentLines.push(line.replace(/[ \t]+$/g, ""));
  });
  return {
    markdown: normalizeMarkdownContent(contentLines.join("\n")),
    tokenUsage: tokenLines.length > 0 ? tokenLines.join(" · ") : null,
  };
}

function formatTokenUsageText(value: string | null | undefined): string | null {
  const text = normalizeDisplayText(value);
  if (!text) {
    return null;
  }
  const normalized = text
    .replace(/prompt tokens\s*:\s*(\d+)\s*\(\s*\)/ig, "提示词：$1")
    .replace(/prompt tokens\s*:\s*(\d+)/ig, "提示词：$1")
    .replace(/completions? tokens\s*:\s*(\d+)\s*\(\s*reasoning\s*:\s*(\d+)\s*\)/ig, "输出：$1（推理：$2）")
    .replace(/completions? tokens\s*:\s*(\d+)/ig, "输出：$1")
    .replace(/total tokens\s*:\s*(\d+)/ig, "总计：$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\s*·\s*/g, " · ")
    .trim();
  return normalized ? `词元消耗：${normalized}` : null;
}

function extractStringField(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate.replace(/[`'"]/g, "").trim() : null;
}

function findFirstImage(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    let trimmed = value.replace(/[`'"]/g, "").trim();
    if (trimmed.includes("http")) {
      trimmed = trimmed.substring(trimmed.indexOf("http"));
    } else if (trimmed.includes("data:image")) {
      trimmed = trimmed.substring(trimmed.indexOf("data:image"));
    }
    const isImageUrl =
      (trimmed.startsWith("http") || trimmed.startsWith("data:image")) && /\.(jpg|jpeg|png|webp|gif)/i.test(trimmed);
    return isImageUrl ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findFirstImage(entry);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (typeof value === "object") {
    const accessUrl = extractStringField(value, "accessUrl");
    if (accessUrl) {
      return accessUrl;
    }
    const previewUrl = extractStringField(value, "previewUrl");
    if (previewUrl) {
      return previewUrl;
    }
    for (const child of Object.values(value as Record<string, unknown>)) {
      const found = findFirstImage(child);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function extractEventErrorMessage(detail: Record<string, unknown> | null): string | null {
  if (!detail) {
    return null;
  }
  const status = typeof detail.status === "string"
    ? detail.status.toLowerCase()
    : typeof detail.stage === "string"
      ? detail.stage.toLowerCase()
      : "";
  const eventType = typeof detail.eventType === "string" ? detail.eventType.toLowerCase() : "";
  const isFailureLike = status === "failed" || status === "canceled" || eventType === "failed" || eventType === "canceled";
  if (typeof detail.errorMessage === "string" && detail.errorMessage.trim()) {
    return normalizeDisplayText(detail.errorMessage);
  }
  const payload = detail.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const payloadRecord = payload as Record<string, unknown>;
    const candidates = [
      payloadRecord.userMessage,
      payloadRecord.errorMessage,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return normalizeDisplayText(candidate);
      }
    }
  }
  if (!isFailureLike) {
    return null;
  }
  if (typeof detail.message === "string" && detail.message.trim()) {
    return normalizeDisplayText(detail.message);
  }
  return null;
}

function extractEventErrorCode(detail: Record<string, unknown> | null): string | null {
  if (!detail) return null;
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
  return null;
}

export type PreviewPaneHandle = {
  /** 终端 clear 语义：保留历史，插入一屏空白并滚到视口空白区 */
  clearViewport: () => void;
};

type ViewportClearSpacer = {
  id: string;
  height: number;
  /** 清屏当下已存在的 taskId；这些任务渲染在该 spacer 上方 */
  taskIdsAtClear: string[];
};

type TimelineRenderSegment =
  | { kind: "tasks"; key: string; items: DispatchTimelineItem[] }
  | { kind: "spacer"; id: string; height: number };

function buildTimelineClearSegments(
  visualItems: DispatchTimelineItem[],
  clears: ViewportClearSpacer[]
): TimelineRenderSegment[] {
  if (clears.length === 0) {
    return visualItems.length > 0 ? [{ kind: "tasks", key: "all", items: visualItems }] : [];
  }

  const segments: TimelineRenderSegment[] = [];
  let remaining = visualItems;
  for (const clear of clears) {
    const snap = new Set(clear.taskIdsAtClear);
    const above = remaining.filter((item) => snap.has(item.taskId));
    remaining = remaining.filter((item) => !snap.has(item.taskId));
    if (above.length > 0) {
      segments.push({ kind: "tasks", key: `above-${clear.id}`, items: above });
    }
    segments.push({ kind: "spacer", id: clear.id, height: clear.height });
  }
  if (remaining.length > 0) {
    segments.push({ kind: "tasks", key: "tail", items: remaining });
  }
  return segments;
}

export const PreviewPane = forwardRef<PreviewPaneHandle, {
  workflowTitle: string;
  workflowCoverUrl?: string | null;
  workflowSubtitle?: string | null;
  sessionName: string;
  sessionId: string;
  activeTaskId: string | null;
  timelineItems: DispatchTimelineItem[];
  timelineHasMore: boolean;
  timelineLoading: boolean;
  onLoadMoreTimeline: () => void;
  onDeleteTimelineTask: (taskId: string) => void;
  deletingTimelineTaskId: string | null;
  detail: Dispatch | null;
  events: TaskEvent[];
  streamMode: "idle" | "ws" | "http";
  streamHint: string | null;
  cancelPending: boolean;
  onCancel: () => void;
  showDebug: boolean;
  generateTimeSec?: number | null;
}>(function PreviewPane(props, ref) {
  const {
    workflowTitle,
    workflowCoverUrl,
    workflowSubtitle,
    sessionId,
    activeTaskId,
    timelineItems,
    timelineHasMore,
    timelineLoading,
    onLoadMoreTimeline,
    onDeleteTimelineTask,
    deletingTimelineTaskId,
    detail,
    events,
    streamMode,
    streamHint,
    cancelPending,
    onCancel,
    showDebug,
    generateTimeSec,
  } = props;

  const stickToBottomRef = useRef(true);
  const [clearSpacers, setClearSpacers] = useState<ViewportClearSpacer[]>([]);

  const onTimelineScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceToBottom <= 48;
    if (el.scrollTop <= 24 && timelineHasMore && !timelineLoading) {
      onLoadMoreTimeline();
    }
  }, [timelineHasMore, timelineLoading, onLoadMoreTimeline]);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const prevSessionIdRef = useRef(sessionId);
  const prevTimelineLengthRef = useRef(0);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageGallery, setPreviewImageGallery] = useState<{ src: string }[]>([]);

  const openImageGallery = useCallback((imgs: { src: string }[], currentSrc: string) => {
    setPreviewImageGallery(imgs);
    setPreviewImageUrl(currentSrc);
  }, []);

  const { downloadImage, downloadTaskImageArchive } = useAssetDownloader();

  const scrollTimelineToBottom = useCallback(() => {
    window.requestAnimationFrame(() => {
      const el = timelineScrollRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  const clearViewport = useCallback(() => {
    const el = timelineScrollRef.current;
    const height = Math.max(el?.clientHeight ?? 0, 320);
    const taskIdsAtClear = timelineItems.map((item) => item.taskId).filter(Boolean);
    setClearSpacers((prev) => [
      ...prev,
      {
        id: `clear-${Date.now()}-${prev.length}`,
        height,
        taskIdsAtClear,
      },
    ]);
    stickToBottomRef.current = true;
  }, [timelineItems]);

  useImperativeHandle(ref, () => ({ clearViewport }), [clearViewport]);

  useEffect(() => {
    const sessionChanged = prevSessionIdRef.current !== sessionId;
    const firstLoadForSession = prevTimelineLengthRef.current === 0 && timelineItems.length > 0;
    if (sessionChanged) {
      setClearSpacers([]);
      stickToBottomRef.current = true;
    }
    if (sessionChanged || firstLoadForSession || stickToBottomRef.current) {
      scrollTimelineToBottom();
    }
    prevSessionIdRef.current = sessionId;
    prevTimelineLengthRef.current = timelineItems.length;
  }, [sessionId, timelineItems.length, clearSpacers.length, scrollTimelineToBottom]);

  const currentTaskId = activeTaskId || detail?.taskId || null;
  const currentTaskDetail = detail?.taskId === currentTaskId ? detail : null;
  const renderedTimelineItems = timelineItems;
  const timelineSegments = useMemo(() => {
    const visualItems = renderedTimelineItems.slice().reverse();
    return buildTimelineClearSegments(visualItems, clearSpacers);
  }, [clearSpacers, renderedTimelineItems]);

  const activeTaskErrorMessage = (() => {
    if (currentTaskDetail?.errorMessage?.trim()) return normalizeDisplayText(currentTaskDetail.errorMessage);
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const event = events[i];
      const parsed = parseTaskEventDetailJson(event.detailJson);
      const parsedErrorMessage = extractEventErrorMessage(parsed as Record<string, unknown> | null);
      if (parsedErrorMessage) {
        return parsedErrorMessage;
      }
      if (event.detailJson?.trim() && String(event.eventType || "").toLowerCase() === "failed") {
        return normalizeDisplayText(event.detailJson);
      }
    }
    return null;
  })();

  const activeTaskErrorCode = (() => {
    if (currentTaskDetail?.errorCode) {
      return currentTaskDetail.errorCode;
    }
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const event = events[i];
      if (String(event.eventType || "").toLowerCase() !== "failed") continue;
      const parsed = parseTaskEventDetailJson(event.detailJson);
      const code = extractEventErrorCode(parsed as Record<string, unknown> | null);
      if (code) return code;
    }
    return null;
  })();

  const renderTimelineItem = (baseItem: DispatchTimelineItem) => {
              const isCurrent = !!currentTaskId && baseItem.taskId === currentTaskId;
              const item = isCurrent && currentTaskDetail ? {
                ...baseItem,
                status: currentTaskDetail.status || baseItem.status,
                assets: (currentTaskDetail.assets && currentTaskDetail.assets.length > 0) ? currentTaskDetail.assets : baseItem.assets,
                startedAt: currentTaskDetail.startedAt || baseItem.startedAt,
                finishedAt: currentTaskDetail.finishedAt || baseItem.finishedAt,
                outputJson: currentTaskDetail.outputJson || baseItem.outputJson,
              } : baseItem;
              
              const assets = Array.isArray(item.assets) ? item.assets : [];
              const videoAssets = assets.filter((a) => a.kind === "video" || isProbablyVideoUrl(a.textContent || ""));
              const imgAssets = assets.filter((a) => !videoAssets.some((v) => v.assetId === a.assetId) && isProbablyImageUrl(a.textContent || ""));
              const otherAssets = assets.filter((a) => !videoAssets.some((v) => v.assetId === a.assetId) && !imgAssets.some((v) => v.assetId === a.assetId));
              const textAssets = otherAssets
                .map((asset) => {
                  const { markdown, tokenUsage } = splitTextAssetContent(asset.textContent);
                  return {
                    ...asset,
                    markdown,
                    tokenUsage,
                  };
                })
                .filter((asset) => asset.markdown || asset.tokenUsage);
              const textDisplayAssets = textAssets.filter((asset) => asset.markdown);
              const tokenUsageText = textAssets
                .map((asset) => asset.tokenUsage)
                .find((value) => !!value) || null;
              const tokenUsageLabel = formatTokenUsageText(tokenUsageText);
              const imgUrls = imgAssets.map((a) => a.textContent || "").filter(Boolean);
              let appIcon = item.app?.icon || template1;
              const jsonToParse = item.inputJson;
              if (jsonToParse) {
                try {
                  const inputObj = JSON.parse(jsonToParse);
                  const userUploadImage = findFirstImage(inputObj);
                  if (userUploadImage) {
                    appIcon = userUploadImage;
                  }
                } catch (e) {
                  console.error("==> Failed to parse inputJson or find image:", e);
                }
              }
              const appTitle = item.app?.title || item.appId || "未知应用";
              const appSubtitle = item.prompt || item.app?.subtitle || null;
              
              const statusText = (item.status || "").toLowerCase();
              const isLocalOnlyItem = item.taskId.startsWith("local-");
              const liveProgress =
                isCurrent && typeof currentTaskDetail?.progress === "number"
                  ? currentTaskDetail.progress
                  : null;
              // claimed / 进度事件 stage≠lifecycle 时，timeline 状态可能短暂不是 running；
              // 只要仍在飞行中或当前任务有进行中进度，就展示骨架占位，避免空白卡片。
              const isRunning = isInFlightStatus(statusText)
                || (isCurrent
                  && liveProgress != null
                  && liveProgress > 0
                  && liveProgress < 100
                  && !isTerminalStatus(statusText));
              const timelineErrorMessage = normalizeDisplayText(item.errorMessage);
              const outputPreviewText = normalizeDisplayText(
                extractTextFromUnknown(safeJsonParse(item.outputJson || "")) || item.outputJson
              );
              const outputErrorMessage = statusText === "failed" && item.outputJson
                ? outputPreviewText
                : null;
              const errorMessage = isCurrent
                ? activeTaskErrorMessage || timelineErrorMessage || outputErrorMessage
                : timelineErrorMessage || outputErrorMessage;
              const hasError = ["failed", "canceled"].includes(statusText) || !!errorMessage;
              const failureHint = statusText === "canceled" && !errorMessage
                ? { title: "已取消", description: "任务已取消" }
                : resolveTaskFailureHint(
                  errorMessage,
                  isCurrent ? activeTaskErrorCode : null
                );
              const expectedImageCount = getExpectedImageCount(item);
              // succeeded 但资产尚未回填：同样给骨架，避免只剩时间戳的空壳
              const awaitingResultAssets = !hasError
                && statusText === "succeeded"
                && imgAssets.length === 0
                && textDisplayAssets.length === 0
                && otherAssets.length === 0;
              const showImagePlaceholders = isRunning || awaitingResultAssets;
              const canBatchDownload = !hasError && imgUrls.length > 0;

              return (
                <div key={item.taskId} className="rounded-lg pl-6 pr-4 py-2 min-w-0 max-w-full overflow-hidden">
                  <div className="flex items-start gap-3 mb-2.5 min-w-0 max-w-full">
                    <img src={appIcon} alt={appTitle} className="w-10 h-10 rounded-md object-cover border border-border shrink-0" />
                    <div className="w-0 flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[14px] font-medium text-foreground truncate" title={appTitle}>{appTitle}</span>
                        {isRunning && (
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 flex items-center gap-1 font-normal shrink-0">
                            <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
                            {formatInFlightStatusLabel(item.status)}
                          </Badge>
                        )}
                      </div>
                      <OverflowSubtitle text={appSubtitle || ""} />
                    </div>
                  </div>

                  {(imgAssets.length > 0 || videoAssets.length > 0 || otherAssets.length > 0 || showImagePlaceholders || hasError) && (
                    <div className="grid grid-cols-4 gap-4 max-w-[1020px]">
                      {hasError ? (
                        <div className="col-span-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                          <div className="text-sm font-medium text-destructive">{failureHint.title || "生成失败"}</div>
                          <div className="mt-2 text-sm leading-6 text-destructive/90">
                            {failureHint.description}
                          </div>
                          {showDebug && errorMessage && errorMessage !== failureHint.description && (
                            <pre className="mt-3 whitespace-pre-wrap break-words text-[11px] leading-5 text-muted-foreground/80 border-t border-destructive/15 pt-2">
                              {errorMessage}
                            </pre>
                          )}
                        </div>
                      ) : videoAssets.length > 0
                        ? videoAssets.map((asset) => (
                            <div key={asset.assetId} className="col-span-4 rounded-md overflow-hidden border border-border bg-black">
                              <video src={asset.textContent || ""} controls className="w-full max-h-[420px] bg-black" />
                            </div>
                          ))
                        : imgAssets.length > 0
                        ? imgAssets.map((a) => ({ key: a.assetId, src: a.textContent || "", isPlaceholder: false })).map((img) => (
                            <div key={img.key} className="group relative aspect-square rounded-md overflow-hidden border border-border bg-muted/40">
                              <img
                                src={img.src}
                                alt=""
                                className="w-full h-full object-contain cursor-zoom-in"
                                onClick={() => openImageGallery(imgAssets.map(a => ({ src: a.textContent || "" })), img.src)}
                              />
                              <div className="absolute right-1 top-1 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  className="h-8 w-8 inline-flex items-center justify-center rounded bg-background/90 text-foreground hover:bg-background"
                                  title="放大"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openImageGallery(imgAssets.map(a => ({ src: a.textContent || "" })), img.src);
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
                                    downloadImage(img.src);
                                  }}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))
                        : showImagePlaceholders ? (
                          Array.from({ length: Math.max(1, expectedImageCount) }).map((_, i) => (
                            <div key={`skeleton-${i}`} className="aspect-square rounded-md border border-border bg-muted/20 animate-pulse flex items-center justify-center relative overflow-hidden">
                              <ImageIcon className="w-12 h-12 text-muted-foreground/20" />
                              {shouldShowLiveProgressOverlay({
                                isRunning,
                                isCurrent,
                                hasDetail: !!currentTaskDetail,
                              }) && currentTaskDetail && (
                                <LiveProgressOverlay detail={currentTaskDetail} expectedImageCount={expectedImageCount} generateTimeSec={generateTimeSec} />
                              )}
                              {awaitingResultAssets && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                                  <span className="text-[11px] text-muted-foreground bg-background/80 px-2 py-1 rounded border border-border/50">
                                    结果处理中…
                                  </span>
                                </div>
                              )}
                            </div>
                          ))
                        ) : textDisplayAssets.length > 0 ? (
                          <div className="col-span-4 space-y-5">
                            {textDisplayAssets.map((asset) => (
                              <article key={asset.assetId} className="max-w-none">
                                <div className="max-w-none break-words text-[14px] leading-7 text-foreground/95 [&_h1]:mt-6 [&_h1]:mb-4 [&_h1]:font-semibold [&_h1]:text-[20px] [&_h1]:leading-8 [&_h2]:mt-6 [&_h2]:mb-4 [&_h2]:font-semibold [&_h2]:text-[18px] [&_h2]:leading-8 [&_h3]:mt-5 [&_h3]:mb-3 [&_h3]:font-semibold [&_h3]:text-[16px] [&_h3]:leading-7 [&_h4]:mt-5 [&_h4]:mb-3 [&_h4]:font-semibold [&_h4]:text-[15px] [&_h4]:leading-7 [&_p]:my-3 [&_p]:leading-7 [&_a]:text-primary hover:[&_a]:underline [&_strong]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_li]:leading-7 [&_hr]:hidden [&_code]:rounded-sm [&_code]:bg-muted/40 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.92em] [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted/50 [&_pre]:px-4 [&_pre]:py-3 [&_pre>code]:bg-transparent [&_pre>code]:p-0 [&_pre>code]:text-inherit [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/25 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {asset.markdown || ""}
                                  </ReactMarkdown>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          Array.from({ length: expectedImageCount }, (_, i) => ({ key: `template-${i}`, src: template8 })).map((img) => (
                            <div key={img.key} className="group relative aspect-square rounded-md overflow-hidden border border-border bg-muted/40">
                              <img src={img.src} alt="" className="w-full h-full object-cover opacity-50 grayscale" />
                            </div>
                          ))
                        )}
                    </div>
                  )}

                  {assets.length === 0 && outputPreviewText && (
                    <div className="text-xs text-muted-foreground break-all">{outputPreviewText}</div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                    <span>{formatDateTime(taskTime(item))}</span>
                    <LiveDuration item={item} />
                    {tokenUsageLabel && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-muted-foreground/90">
                          {tokenUsageLabel}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-muted-foreground">
                    {textDisplayAssets.length > 0 && (
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/12 text-violet-600 transition-colors hover:bg-violet-500/18 hover:text-violet-700 disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground"
                        onClick={() => {
                          const fullText = textDisplayAssets.map((a) => a.markdown).filter(Boolean).join("\n\n");
                          if (fullText) {
                            navigator.clipboard.writeText(fullText).then(() => {
                              notify.success("已复制到剪贴板");
                            }).catch(() => {
                              notify.error("复制失败，请重试");
                            });
                          }
                        }}
                        title="复制内容"
                        aria-label="复制内容"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/12 text-violet-600 transition-colors hover:bg-violet-500/18 hover:text-violet-700 disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground"
                      disabled={!canBatchDownload || isLocalOnlyItem}
                      onClick={() => {
                        if (imgUrls.length === 1) {
                          downloadImage(imgUrls[0]);
                          return;
                        }
                        void downloadTaskImageArchive(item.taskId).catch(() => void 0);
                      }}
                      title={
                        canBatchDownload
                          ? imgUrls.length === 1
                            ? "下载当前任务生成的图片"
                            : `下载当前任务生成的 ${imgUrls.length} 张图片`
                          : "当前任务暂无可下载图片"
                      }
                      aria-label="批量下载当前任务生成的图片"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/12 text-violet-600 transition-colors hover:bg-violet-500/18 hover:text-violet-700 disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground"
                      disabled={!!deletingTimelineTaskId || isLocalOnlyItem}
                      onClick={() => onDeleteTimelineTask(item.taskId)}
                      title="删除关联作品"
                      aria-label="删除关联作品"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
  };

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
      <div
        ref={timelineScrollRef}
        onScroll={onTimelineScroll}
        className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {renderedTimelineItems.length === 0 && clearSpacers.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">暂无任务记录</div>
        ) : (
          <div className="min-w-0 space-y-6">
            {timelineSegments.map((seg) => {
              if (seg.kind === "spacer") {
                return (
                  <div
                    key={seg.id}
                    aria-hidden
                    className="pointer-events-none w-full shrink-0"
                    style={{ height: seg.height }}
                  />
                );
              }
              return (
                <div key={seg.key} className="space-y-6 min-w-0">
                  {seg.items.map((baseItem) => renderTimelineItem(baseItem))}
                </div>
              );
            })}
            {timelineLoading && <div className="text-xs text-muted-foreground text-center py-2">加载历史任务中...</div>}
          </div>
        )}
      </div>

      <ImageViewerDialog previewImageUrl={previewImageUrl} gallery={previewImageGallery} onClose={() => {
        setPreviewImageUrl(null);
        setPreviewImageGallery([]);
      }} />

      {/* 事件与快照调试区：默认收起，便于排查工作流输出问题 */}
      {showDebug && (
        <details className="sticky bottom-0 z-20 mt-auto border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <summary className="px-6 py-3 text-[13px] text-muted-foreground cursor-pointer select-none">调试信息（调度详情 / 事件信息）</summary>
          <div className="max-h-[40vh] overflow-y-auto p-6 pt-0">
            <TaskCanvas
              detail={detail}
              events={events}
              streamMode={streamMode}
              streamHint={streamHint}
              onCancel={onCancel}
              cancelDisabled={cancelPending}
            />
            {normalizeDisplayText(detail?.outputJson) ? (
              <div className="mt-4 rounded-lg border border-border bg-background p-3">
                <div className="text-sm font-medium text-foreground mb-2">输出JSON原文</div>
                <div className="text-xs text-muted-foreground break-all">{normalizeDisplayText(detail?.outputJson)}</div>
                <div className="mt-2 text-[10px] text-muted-foreground break-all">
                  解析预览：{normalizeDisplayText(toCompactJson(safeJsonParse(detail.outputJson) ?? detail.outputJson)) || "-"}
                </div>
              </div>
            ) : null}
          </div>
        </details>
      )}
    </div>
  );
});
