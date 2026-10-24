import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Images, Play, Trash2 } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { formatDateTime } from "@/shared/lib/datetime";
import { formatOwnerLabel } from "@/shared/lib/owner-display";
import type { Task } from "@/shared/api/sys/scheduler";
import {
  inferTaskWorkType,
  taskCreatedAt,
  taskOutputItems,
  taskVideoUrl,
} from "@/modules/workflow/lib/scheduler-task-display";
import {
  resolveWorkPreviewUrl,
  type WorkGeneratedItem,
} from "@/modules/materials/lib/work-material-items";
import {
  SchedulerTaskFailedStatusButton,
  SchedulerTaskStatusBadge,
} from "@/modules/workflow/components/SchedulerTaskListTable";

export function SchedulerTaskCard(props: {
  item: Task;
  onDelete: () => void;
  onViewGallery: () => void;
  onViewImage?: (url: string) => void;
  onViewVideo?: (url: string) => void;
  onViewParams: () => void;
  onViewDetail: () => void;
  disabledDelete?: boolean;
}) {
  const parsedItems = useMemo(() => taskOutputItems(props.item), [props.item]);
  const workType = inferTaskWorkType(props.item, parsedItems);
  const isVideo = workType === "video";
  const isImage = workType === "image";
  const isCopywriting = workType === "copywriting";
  const itemsCount = Array.isArray(parsedItems) ? parsedItems.length : 0;
  const videoUrl = isVideo ? taskVideoUrl(parsedItems) : "";
  const coverUrl = isVideo ? props.item.coverUrl?.trim() || "" : "";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null);
  const [slideDirection, setSlideDirection] = useState<"prev" | "next" | null>(null);
  const [isSliding, setIsSliding] = useState(false);
  const slideRafRef = useRef<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  const carouselUrls = useMemo(() => {
    if (isImage && itemsCount > 1) {
      return parsedItems
        .filter((item): item is WorkGeneratedItem & { url: string } => !!item.url && (item.kind === "image" || !item.kind))
        .map((item) => item.url);
    }
    return [];
  }, [isImage, itemsCount, parsedItems]);

  const hasCarousel = carouselUrls.length > 1;
  const currentImageUrl = hasCarousel
    ? carouselUrls[currentIndex]
    : resolveWorkPreviewUrl(props.item.coverUrl, parsedItems, "image");
  const incomingImageUrl = incomingIndex !== null ? carouselUrls[incomingIndex] : null;

  const startSlide = useCallback((nextIndex: number, direction: "prev" | "next") => {
    if (!hasCarousel || nextIndex === currentIndex || isSliding) return;
    if (slideRafRef.current !== null) {
      window.cancelAnimationFrame(slideRafRef.current);
    }
    setIncomingIndex(nextIndex);
    setSlideDirection(direction);
    setIsSliding(false);
    slideRafRef.current = window.requestAnimationFrame(() => {
      slideRafRef.current = window.requestAnimationFrame(() => {
        setIsSliding(true);
      });
    });
  }, [currentIndex, hasCarousel, isSliding]);

  useEffect(() => {
    if (currentIndex < carouselUrls.length) return;
    setCurrentIndex(0);
    setIncomingIndex(null);
    setSlideDirection(null);
    setIsSliding(false);
  }, [carouselUrls.length, currentIndex]);

  useEffect(() => {
    if (!hasCarousel || isHovering || isSliding) return;
    const timer = setInterval(() => {
      startSlide(currentIndex < carouselUrls.length - 1 ? currentIndex + 1 : 0, "next");
    }, 3000);
    return () => clearInterval(timer);
  }, [carouselUrls.length, currentIndex, hasCarousel, isHovering, isSliding, startSlide]);

  useEffect(() => {
    return () => {
      if (slideRafRef.current !== null) {
        window.cancelAnimationFrame(slideRafRef.current);
      }
    };
  }, []);

  const ownerLabel = formatOwnerLabel({
    ownerKind: props.item.ownerKind,
    ownerName: props.item.principalName,
    deviceCode: props.item.deviceCode,
  });
  const failed = props.item.status === "failed";

  return (
    <div
      className="rounded-lg border bg-card overflow-hidden group hover:shadow-md hover:border-primary/35 transition-all"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        className={`relative aspect-[4/3] overflow-hidden bg-muted flex items-center justify-center group/cover ${isImage || itemsCount > 1 || (isVideo && videoUrl) ? "cursor-pointer" : ""}`}
        onClick={() => {
          if (itemsCount > 1) {
            props.onViewGallery();
            return;
          }
          if (isImage && currentImageUrl) {
            props.onViewImage?.(currentImageUrl);
            return;
          }
          if (isVideo && videoUrl) {
            props.onViewVideo?.(videoUrl);
          }
        }}
      >
        {isImage && currentImageUrl ? (
          <>
            {hasCarousel && incomingImageUrl && slideDirection ? (
              <>
                <div
                  className="absolute inset-0 will-change-transform"
                  style={{
                    transform: isSliding
                      ? slideDirection === "next"
                        ? "translateX(-100%)"
                        : "translateX(100%)"
                      : "translateX(0%)",
                    transition: "transform 320ms ease-out",
                  }}
                >
                  <img
                    src={currentImageUrl}
                    alt={props.item.taskId}
                    className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <div
                  className="absolute inset-0 will-change-transform"
                  style={{
                    transform: isSliding
                      ? "translateX(0%)"
                      : slideDirection === "next"
                        ? "translateX(100%)"
                        : "translateX(-100%)",
                    transition: "transform 320ms ease-out",
                  }}
                  onTransitionEnd={(e) => {
                    if (e.target !== e.currentTarget || incomingIndex === null) return;
                    slideRafRef.current = null;
                    setCurrentIndex(incomingIndex);
                    setIncomingIndex(null);
                    setSlideDirection(null);
                    setIsSliding(false);
                  }}
                >
                  <img
                    src={incomingImageUrl}
                    alt={props.item.taskId}
                    className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              </>
            ) : (
              <img
                src={currentImageUrl}
                alt={props.item.taskId}
                className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            )}
            {hasCarousel && (
              <>
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity hover:bg-black/70"
                  onClick={(e) => {
                    e.stopPropagation();
                    startSlide(currentIndex > 0 ? currentIndex - 1 : carouselUrls.length - 1, "prev");
                  }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity hover:bg-black/70"
                  onClick={(e) => {
                    e.stopPropagation();
                    startSlide(currentIndex < carouselUrls.length - 1 ? currentIndex + 1 : 0, "next");
                  }}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
                  {carouselUrls.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentIndex ? "bg-white scale-125" : "bg-white/50"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : isVideo && (coverUrl || videoUrl) ? (
          <>
            {coverUrl ? (
              <img src={coverUrl} alt={props.item.taskId} className="w-full h-full object-cover" />
            ) : (
              <video src={videoUrl} className="w-full h-full object-cover" muted preload="metadata" playsInline />
            )}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-background/70 border border-border flex items-center justify-center">
                <Play className="w-5 h-5 text-foreground" />
              </div>
            </div>
          </>
        ) : isVideo ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Play className="w-7 h-7" />
            <span className="text-xs">视频</span>
          </div>
        ) : isCopywriting ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground p-4">
            <FileText className="w-7 h-7" />
            <span className="text-xs line-clamp-4 text-center">{parsedItems.find((item) => item.text)?.text || "文本"}</span>
          </div>
        ) : (
          <div className="w-full h-full" />
        )}

        <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
          {failed ? (
            <SchedulerTaskFailedStatusButton
              errorMessage={props.item.errorMessage}
              onTriggerClick={(e) => e.stopPropagation()}
            />
          ) : (
            <SchedulerTaskStatusBadge
              status={props.item.status}
              className="h-6 justify-center py-0 leading-none !bg-background/95 shadow-sm backdrop-blur-sm"
            />
          )}
        </div>
        {itemsCount > 0 && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="bg-black/50 text-white hover:bg-black/50 border-none px-1.5">{itemsCount} P</Badge>
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        <p className="text-[13px] text-muted-foreground truncate flex justify-between items-center gap-3" title={ownerLabel}>
          <span className="truncate">{ownerLabel}</span>
          <span className="font-mono flex-shrink-0">{formatDateTime(taskCreatedAt(props.item))}</span>
        </p>
        <div className="flex items-center justify-end gap-1 pt-1">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={props.onViewParams}>
            生成参数
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={props.onViewDetail}>
            详情
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
      </div>
    </div>
  );
}
