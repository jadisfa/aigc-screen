import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Slider } from "@/shared/ui/slider";
import { getCroppedAvatarBlob } from "@/modules/ums/lib/avatar-crop";

type UserAvatarCropDialogProps = {
  open: boolean;
  imageUrl: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (blob: Blob) => Promise<void> | void;
};

export default function UserAvatarCropDialog({
  open,
  imageUrl,
  onOpenChange,
  onConfirm,
}: UserAvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [open, imageUrl]);

  const handleConfirm = async () => {
    if (!imageUrl || !croppedAreaPixels) return;
    try {
      setSubmitting(true);
      const blob = await getCroppedAvatarBlob(imageUrl, croppedAreaPixels, 512);
      await onConfirm(blob);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>裁剪头像</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative h-[360px] overflow-hidden rounded-xl bg-black">
            {imageUrl ? (
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
              />
            ) : null}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>缩放</span>
              <span>{zoom.toFixed(1)}x</span>
            </div>
            <Slider
              min={1}
              max={3}
              step={0.1}
              value={[zoom]}
              onValueChange={(value) => setZoom(value[0] ?? 1)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || !imageUrl || !croppedAreaPixels}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            应用裁剪
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
