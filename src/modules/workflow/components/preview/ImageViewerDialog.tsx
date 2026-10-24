import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/shared/ui/dialog";
import {
  ZoomIn,
  ZoomOut,
  FlipHorizontal,
  FlipVertical,
  RotateCcw as RotateLeft,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export function ImageViewerDialog(props: {
  previewImageUrl: string | null;
  gallery?: { src: string }[];
  onClose: () => void;
}) {
  const { previewImageUrl, gallery = [], onClose } = props;
  const viewerRef = useRef<HTMLDivElement | null>(null);

  const [currentUrl, setCurrentUrl] = useState<string | null>(previewImageUrl);

  // Sync currentUrl when previewImageUrl changes
  useEffect(() => {
    setCurrentUrl(previewImageUrl);
  }, [previewImageUrl]);

  const currentIndex = gallery.findIndex(g => g.src === currentUrl);
  const hasMultiple = gallery.length > 1;

  const resetImageState = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setFlipH(1);
    setFlipV(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const closeViewer = useCallback(() => {
    onClose();
    resetImageState();
  }, [onClose, resetImageState]);

  const goPrev = useCallback(() => {
    if (!hasMultiple || currentIndex <= 0) return;
    const nextIndex = currentIndex - 1;
    setCurrentUrl(gallery[nextIndex].src);
    resetImageState();
  }, [currentIndex, gallery, hasMultiple, resetImageState]);

  const goNext = useCallback(() => {
    if (!hasMultiple || currentIndex < 0 || currentIndex >= gallery.length - 1) return;
    const nextIndex = currentIndex + 1;
    setCurrentUrl(gallery[nextIndex].src);
    resetImageState();
  }, [currentIndex, gallery, hasMultiple, resetImageState]);

  useEffect(() => {
    if (!previewImageUrl) return;
    const rafId = window.requestAnimationFrame(() => {
      viewerRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [previewImageUrl]);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(1);
  const [flipV, setFlipV] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  return (
    <Dialog open={!!previewImageUrl} onOpenChange={(open) => {
      if (!open) {
        closeViewer();
      }
    }}>
      <DialogContent
        ref={viewerRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (!currentUrl || !hasMultiple) return;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            e.stopPropagation();
            goPrev();
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            e.stopPropagation();
            goNext();
          }
        }}
        className="max-w-[100vw] w-screen h-screen max-h-[100vh] p-0 m-0 rounded-none bg-black/10 border-none shadow-none flex flex-col outline-none [&>button]:hidden"
      >
        {/* Header Toolbar */}
        <div className="h-14 shrink-0 flex items-center justify-end px-4 gap-2 bg-black/50 text-white z-50">
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors" title="上下翻转" onClick={() => setFlipV(v => v * -1)}>
            <FlipVertical className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors" title="左右翻转" onClick={() => setFlipH(v => v * -1)}>
            <FlipHorizontal className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors" title="向左旋转" onClick={() => setRotation(r => r - 90)}>
            <RotateLeft className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-white/20 mx-2" />
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors" title="缩小" onClick={() => setZoom(z => Math.max(0.1, z - 0.25))}>
            <ZoomOut className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors" title="放大" onClick={() => setZoom(z => Math.min(5, z + 0.25))}>
            <ZoomIn className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-white/20 mx-2" />
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-500 transition-colors" title="关闭" onClick={closeViewer}>
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Image Container */}
        <div 
          className="flex-1 min-h-0 overflow-hidden relative flex items-center justify-center select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeViewer();
            }
          }}
          onWheel={(e) => {
            e.preventDefault();
            setZoom(z => {
              const newZoom = e.deltaY < 0 ? z + 0.1 : z - 0.1;
              return Math.min(Math.max(0.1, newZoom), 5);
            });
          }}
        >
          <img
            src={currentUrl || ""}
            alt="Preview"
            draggable={false}
            className="max-w-none max-h-none origin-center cursor-move"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg) scaleX(${flipH}) scaleY(${flipV})`,
              transition: isDragging ? "none" : "transform 0.2s ease-out"
            }}
            onPointerDown={(e) => {
              setIsDragging(true);
              panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (isDragging) {
                setPan({
                  x: e.clientX - panStartRef.current.x,
                  y: e.clientY - panStartRef.current.y
                });
              }
            }}
            onPointerUp={(e) => {
              setIsDragging(false);
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={(e) => {
              setIsDragging(false);
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
          />

          {hasMultiple && (
            <>
              {currentIndex > 0 && (
                <button
                  className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-[100] pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrev();
                  }}
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
              )}
              {currentIndex < gallery.length - 1 && (
                <button
                  className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-[100] pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
