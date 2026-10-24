import { useState, useEffect } from "react";
import { type DispatchTimelineItem } from "@/shared/api/sys/scheduler";
import { formatDuration } from "./utils";
import { useDispatchStream } from "@/modules/workflow/hooks/use-dispatch-stream";
import { Progress } from "@/shared/ui/progress";

export function useLiveTaskDuration(item: DispatchTimelineItem): string | null {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (item.status === "queued" || item.status === "running") {
      const timer = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(timer);
    }
  }, [item.status]);

  const startStr = item.startedAt || item.submittedAt;
  if (!startStr) return null;
  const start = Date.parse(startStr);
  if (!Number.isFinite(start)) return null;

  if (item.status === "queued" || item.status === "running") {
    return formatDuration(Math.max(0, now - start));
  }

  const endStr = item.finishedAt;
  if (!endStr) return null;
  const end = Date.parse(endStr);
  if (!Number.isFinite(end)) return null;

  return formatDuration(Math.max(0, end - start));
}

/** 解析计划总耗时（秒）：优先单图耗时 × 份数，其次调度 ETA，最后兜底。 */
export function resolvePlannedEtaSec(args: {
  etaSeconds?: number | null;
  generateTimeSec?: number | null;
  expectedImageCount?: number | null;
}): number {
  const generateTimeSec = args.generateTimeSec != null && args.generateTimeSec > 0
    ? args.generateTimeSec
    : null;
  const expectedImageCount = args.expectedImageCount != null && args.expectedImageCount > 0
    ? args.expectedImageCount
    : null;
  if (generateTimeSec != null && expectedImageCount != null) {
    return Math.max(15, Math.round(generateTimeSec * expectedImageCount));
  }
  const etaSeconds = args.etaSeconds != null && args.etaSeconds > 0 ? args.etaSeconds : null;
  if (etaSeconds != null) {
    return Math.max(15, Math.round(etaSeconds));
  }
  return 180;
}

/**
 * 预估剩余时间文案。
 * - 有有效进度时按 elapsed/progress 外推，避免计划 ETA 耗尽后永远显示「1s」
 * - 超时且进度偏低时显示「仍在生成中」，接近完成时显示「即将完成」
 */
export function resolveRemainingEtaLabel(args: {
  elapsedSec: number;
  progress: number;
  plannedEtaSec: number;
}): string {
  const elapsedSec = Math.max(0, args.elapsedSec);
  const progress = Math.max(0, Math.min(99, Math.floor(Number(args.progress) || 0)));
  const plannedEtaSec = Math.max(1, args.plannedEtaSec);
  const plannedRemaining = plannedEtaSec - elapsedSec;

  if (progress >= 3 && elapsedSec >= 2) {
    const extrapolated = (elapsedSec * (100 - progress)) / progress;
    let remainingSec = Math.max(0, Math.round(extrapolated));
    // 早期进度噪声大时，不要远低于计划剩余（避免刚开始就显示很快结束）
    if (progress < 25 && plannedRemaining > remainingSec) {
      remainingSec = Math.round((remainingSec + plannedRemaining) / 2);
    }
    if (remainingSec <= 0) {
      return progress >= 90 ? "即将完成" : "仍在生成中";
    }
    return `预估剩余 ${formatDuration(remainingSec * 1000)}`;
  }

  if (plannedRemaining > 0) {
    return `预估剩余 ${formatDuration(Math.round(plannedRemaining) * 1000)}`;
  }

  return progress >= 90 ? "即将完成" : "仍在生成中";
}

export function LiveProgressOverlay({ detail, expectedImageCount, generateTimeSec }: {
  detail: NonNullable<ReturnType<typeof useDispatchStream>["detail"]>;
  expectedImageCount?: number;
  generateTimeSec?: number | null;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startStr = detail.startedAt || detail.submittedAt;
  const start = startStr ? Date.parse(startStr) : Date.now();
  const elapsedSec = Math.max(0, (now - start) / 1000);
  const plannedEtaSec = resolvePlannedEtaSec({
    etaSeconds: detail.etaSeconds,
    generateTimeSec,
    expectedImageCount,
  });
  const remainingLabel = resolveRemainingEtaLabel({
    elapsedSec,
    progress: detail.progress,
    plannedEtaSec,
  });
  const progressValue = Math.min(99, Math.max(0, Math.floor(Number(detail.progress) || 0)));
  const progressText = progressValue > 0 ? `${progressValue}%` : "准备中";

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/30 backdrop-blur-[2px] transition-all duration-300">
      <div className="flex flex-col items-center bg-background/80 px-3 py-2 rounded-lg shadow-sm border border-border/50">
        <span className="text-[11px] text-muted-foreground mb-0.5">{remainingLabel}</span>
        <span className="text-[14px] font-semibold text-foreground">
          {progressText}
        </span>
        <Progress value={progressValue} className="mt-2 h-1.5 w-28" />
      </div>
    </div>
  );
}

export function LiveDuration({ item }: { item: DispatchTimelineItem }) {
  const duration = useLiveTaskDuration(item);
  if (!duration) return null;
  return <> &bull; 耗时 {duration}</>;
}
