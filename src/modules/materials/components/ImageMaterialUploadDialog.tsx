import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import type { MaterialCategoryType } from "@/modules/materials/lib/material-governance";

type ImageUploadItem = { key: string; previewUrl: string };
type Category = { id: string; name: string };
type Tag = { id: string; name: string };

export default function ImageMaterialUploadDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadCategoryType: MaterialCategoryType;
  setUploadCategoryType: (v: MaterialCategoryType) => void;
  uploadCategoryId: string;
  setUploadCategoryId: (v: string) => void;
  uploadTagId: string;
  setUploadTagId: (v: string) => void;
  categories: Category[];
  uploadTagOptions: Tag[];
  uploadFiles: ImageUploadItem[];
  onPickFiles: () => void;
  onRemoveFile: (key: string) => void;
  onCancel: () => void;
  onSave: () => void;
  uploading: boolean;
  formError?: string | null;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[60vw] max-w-[60vw] min-h-[50vh] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>图片素材上传</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-3 gap-3">
            <Select value={props.uploadCategoryType} onValueChange={(v) => props.setUploadCategoryType(v as MaterialCategoryType)}>
              <SelectTrigger className="w-full h-10"><SelectValue placeholder="分类类型" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">公共</SelectItem>
                <SelectItem value="user">私有</SelectItem>
              </SelectContent>
            </Select>
            <Select value={props.uploadCategoryId} onValueChange={(v) => { props.setUploadCategoryId(v); props.setUploadTagId("none"); }}>
              <SelectTrigger className="w-full h-10"><SelectValue placeholder="素材分类（必选）" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">请选择素材分类</SelectItem>
                {props.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={props.uploadTagId} onValueChange={props.setUploadTagId}>
              <SelectTrigger className="w-full h-10"><SelectValue placeholder="素材标签（可选）" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不选择标签</SelectItem>
                {props.uploadTagOptions.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={props.onPickFiles}
              className="w-24 h-32 rounded-xl border border-dashed border-border hover:border-primary/60 bg-background text-foreground flex flex-col items-center justify-center gap-2 transition-colors"
            >
              <span className="text-2xl leading-none">+</span>
              <span className="text-sm leading-none">选择图片</span>
            </button>
          </div>
          <div className="grid [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))] gap-3">
            {props.uploadFiles.map((f) => (
              <div key={f.key} className="relative rounded-md border overflow-hidden">
                <img src={f.previewUrl} alt="" className="w-full h-24 object-cover" />
                <button className="absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded bg-black/60 text-white" onClick={() => props.onRemoveFile(f.key)}>
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {props.formError ? <p className="text-sm text-destructive mr-auto">{props.formError}</p> : null}
          <Button variant="outline" onClick={props.onCancel}>取消</Button>
          <Button onClick={props.onSave} disabled={props.uploading}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
