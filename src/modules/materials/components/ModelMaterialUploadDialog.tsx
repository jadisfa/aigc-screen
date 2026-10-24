import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Box, Plus } from "lucide-react";
import type { HashedUploadFileState } from "@/modules/materials/hooks/use-hashed-upload-files";
import type { MaterialCategoryType } from "@/modules/materials/lib/material-governance";

type Category = { id: string; name: string };
type Tag = { id: string; name: string };

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function resolvePreviewKind(file: File): "image" | "video" | "other" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "other";
}

export default function ModelMaterialUploadDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadCategoryType: MaterialCategoryType;
  setUploadCategoryType: (v: MaterialCategoryType) => void;
  uploadCategoryId: string;
  setUploadCategoryId: (v: string) => void;
  uploadTagId: string;
  setUploadTagId: (v: string) => void;
  uploadMaterialName: string;
  setUploadMaterialName: (v: string) => void;
  uploadMaterialDescription: string;
  setUploadMaterialDescription: (v: string) => void;
  categories: Category[];
  uploadTagOptions: Tag[];
  uploadFile: HashedUploadFileState | null;
  onPickFile: () => void;
  onRemoveFile: () => void;
  onCancel: () => void;
  onSave: () => void;
  uploading: boolean;
  formError?: string | null;
}) {
  const selectedFile = props.uploadFile?.file ?? null;
  const previewKind = selectedFile ? resolvePreviewKind(selectedFile) : null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[50vw] max-w-[50vw] min-h-[50vh] max-h-[85vh] overflow-y-auto"> 
        <DialogHeader>
          <DialogTitle>模型素材上传</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="grid grid-cols-3 gap-3">
            <Select value={props.uploadCategoryType} onValueChange={(v) => props.setUploadCategoryType(v as MaterialCategoryType)}>
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="分类类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">公共</SelectItem>
                <SelectItem value="user">私有</SelectItem>
              </SelectContent>
            </Select>
            <Select value={props.uploadCategoryId} onValueChange={(v) => { props.setUploadCategoryId(v); props.setUploadTagId("none"); }}>
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="素材分类（必选）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">请选择素材分类</SelectItem>
                {props.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={props.uploadTagId} onValueChange={props.setUploadTagId}>
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="素材标签（可选）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不选择标签</SelectItem>
                {props.uploadTagOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">素材名称</label>
                <span className="text-xs text-muted-foreground">{props.uploadMaterialName.length}/120</span>
              </div>
              <Input
                value={props.uploadMaterialName}
                onChange={(e) => props.setUploadMaterialName(e.target.value)}
                placeholder="请输入素材名称"
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">素材描述</label>
                <span className="text-xs text-muted-foreground">{props.uploadMaterialDescription.length}/500</span>
              </div>
              <Textarea
                value={props.uploadMaterialDescription}
                onChange={(e) => props.setUploadMaterialDescription(e.target.value)}
                placeholder="请输入素材描述（可选）"
                rows={4}
                maxLength={500}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">上传文件</label>
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={props.onPickFile}
                className="w-[120px] h-[150px] rounded-xl border border-dashed border-border bg-background hover:bg-muted/20 overflow-hidden flex items-center justify-center transition-colors"
              >
                {props.uploadFile ? (
                  previewKind === "image" ? (
                    <img
                      src={props.uploadFile.previewUrl}
                      alt={props.uploadFile.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : previewKind === "video" ? (
                    <video
                      src={props.uploadFile.previewUrl}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-foreground">
                      <Box className="w-6 h-6" />
                      <span className="text-xs leading-none">已选择</span>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center gap-1 text-foreground">
                    <Plus className="w-5 h-5" />
                    <span className="text-sm">上传</span>
                  </div>
                )}
              </button>
              <div className="flex-1 space-y-2">
                <Input
                  value={props.uploadFile?.file.name ?? ""}
                  readOnly
                  placeholder="请选择单个文件"
                />
                <div className="text-xs text-muted-foreground">
                  {props.uploadFile
                    ? `${selectedFile?.type || "未知类型"} · ${selectedFile ? formatFileSize(selectedFile.size) : "--"}`
                    : "支持图片、视频及其他模型相关文件"}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={props.onPickFile}>
                    {props.uploadFile ? "重新选择" : "上传"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={props.onRemoveFile} disabled={!props.uploadFile}>
                    清空
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {props.formError ? <p className="text-sm text-destructive mr-auto">{props.formError}</p> : null}
          <Button variant="outline" onClick={props.onCancel}>
            取消
          </Button>
          <Button onClick={props.onSave} disabled={props.uploading}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
