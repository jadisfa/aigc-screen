import { Camera, CircleDot, ChevronRight, Cpu, Eye, FileText, Hash, Info, Palette, Scan, Sparkles, Dices, Image, Upload, RatioIcon, SlidersHorizontal, ToggleLeft } from "lucide-react";

export type IconName = "seed" | "ratio" | "sparkles" | "scan" | "circle-dot" | "chevron-right" | "image" | "upload" | "image-preview" | "file-text" | "hash" | "info" | "sliders-horizontal" | "palette" | "camera" | "cpu" | "toggle-left";

export const UI_COMPONENT_ICON_MAP: Record<IconName, React.ComponentType<{ className?: string }>> = {
  seed: Dices,
  ratio: RatioIcon as React.ComponentType<{ className?: string }>,
  sparkles: Sparkles,
  scan: Scan,
  "circle-dot": CircleDot,
  "chevron-right": ChevronRight,
  image: Image,
  upload: Upload,
  "image-preview": Eye,
  "file-text": FileText,
  hash: Hash,
  info: Info,
  "sliders-horizontal": SlidersHorizontal,
  palette: Palette,
  camera: Camera,
  cpu: Cpu,
  "toggle-left": ToggleLeft,
};
