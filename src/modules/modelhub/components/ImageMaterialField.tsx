import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";

type ImageMaterialFieldProps = {
  previewUrl: string;
  alt: string;
  fallbackText: string;
  uploading: boolean;
  description: string;
  emptyHint: string;
  onUploadClick: () => void;
  onPickFromLibrary: () => void;
  onClear: () => void;
};

export default function ImageMaterialField(props: ImageMaterialFieldProps) {
  return (
    <div className="flex items-start gap-4">
      <button
        type="button"
        onClick={props.onUploadClick}
        className="flex h-[120px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background transition-colors hover:bg-muted/20"
        disabled={props.uploading}
      >
        {props.previewUrl.trim() ? (
          <img src={props.previewUrl.trim()} alt={props.alt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-foreground">
            <Plus className="h-5 w-5" />
            <span className="text-sm">{props.uploading ? "上传中..." : "上传"}</span>
          </div>
        )}
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="w-full rounded-lg border border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
          {props.description}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={props.onPickFromLibrary}>
            <FolderOpen className="w-4 h-4 mr-1" />
            从素材库选择
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={props.onClear}
            disabled={!props.previewUrl.trim()}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            清空
          </Button>
        </div>
        {props.previewUrl.trim() ? (
          <div className="w-full truncate font-mono text-[11px] text-muted-foreground" title={props.previewUrl}>
            {props.previewUrl}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Avatar className="h-10 w-10 rounded-xl border border-border/60">
              <AvatarFallback className="text-[11px] font-medium">{props.fallbackText}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{props.emptyHint}</span>
          </div>
        )}
      </div>
    </div>
  );
}
