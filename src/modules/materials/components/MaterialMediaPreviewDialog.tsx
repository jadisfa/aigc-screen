import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { ImageViewerDialog } from "@/modules/workflow/components/preview/ImageViewerDialog";

export type MaterialPreviewAsset = {
  type: "image" | "video";
  url: string;
  title?: string;
};

export function MaterialMediaPreviewDialog(props: {
  preview: MaterialPreviewAsset | null;
  onClose: () => void;
}) {
  const { preview, onClose } = props;

  if (preview?.type === "image") {
    return (
      <ImageViewerDialog
        previewImageUrl={preview.url}
        gallery={[{ src: preview.url }]}
        onClose={onClose}
      />
    );
  }

  return (
    <Dialog
      open={preview?.type === "video"}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="w-[min(92vw,1200px)] max-w-[min(92vw,1200px)] gap-0 overflow-visible border-none bg-transparent p-0 shadow-none [&>button]:hidden">
        <DialogTitle className="sr-only">{preview?.title || "视频预览"}</DialogTitle>
        <div className="relative">
          <button
            type="button"
            className="absolute -right-2 -top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/75 text-white shadow-lg backdrop-blur-sm transition-colors hover:border-transparent hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={onClose}
            aria-label="关闭"
            title="关闭"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
          <div className="overflow-hidden bg-black shadow-2xl sm:rounded-lg">
            <video
              key={preview?.url || "video-preview"}
              src={preview?.url || ""}
              controls
              autoPlay
              playsInline
              className="block w-full max-h-[85vh] bg-black"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
