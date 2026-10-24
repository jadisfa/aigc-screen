import { useRef, useState } from "react";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { getFileMaterialByHash, uploadFileMaterialForm } from "@/shared/api/materials/materials-file-material";
import ImageMaterialField from "@/modules/modelhub/components/ImageMaterialField";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import FileMaterialPickerDialog from "@/shared/components/FileMaterialPickerDialog";
import { getSessionScopeReadyError, useSessionScope, withSessionScope } from "@/shared/hooks/use-session-scope";
import { md5HexFromFile } from "@/shared/lib/md5";
import { notify } from "@/shared/lib/notify";

export type VendorStatus = "启用" | "停用";

export type VendorFormValue = {
  id?: string;
  name: string;
  logoUrl: string;
  description: string;
  status: VendorStatus;
};

export function getVendorFallback(name: string) {
  const normalized = name.trim();
  if (!normalized) return "MH";
  if (/[\u4e00-\u9fa5]/.test(normalized)) return normalized.slice(0, 2);
  return normalized.slice(0, 2).toUpperCase();
}

type ModelHubVendorEditorDialogProps = {
  open: boolean;
  form: VendorFormValue;
  onOpenChange: (open: boolean) => void;
  onFormChange: (updater: (prev: VendorFormValue) => VendorFormValue) => void;
  onSubmit: () => void;
};

export default function ModelHubVendorEditorDialog(props: ModelHubVendorEditorDialogProps) {
  const { form, open, onFormChange, onOpenChange, onSubmit } = props;
  const sessionScope = useSessionScope();
  const localUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);
  const [uploadingLocalLogo, setUploadingLocalLogo] = useState(false);

  const handleUploadLocalLogo = async (file?: File) => {
    if (!file) return;
    const uploadBlockReason = getSessionScopeReadyError(sessionScope);
    if (uploadBlockReason) {
      notify.error("上传暂不可用", { description: uploadBlockReason });
      return;
    }
    setUploadingLocalLogo(true);
    try {
      const fileHash = await md5HexFromFile(file);
      const existing = await getFileMaterialByHash(withSessionScope(sessionScope.scope, { fileHash }));
      const material = existing ?? (await uploadFileMaterialForm(withSessionScope(sessionScope.scope, { file, fileType: "image", fileHash }))).file;
      onFormChange((prev) => ({ ...prev, logoUrl: material.accessUrl }));
      notify.success(existing ? "已复用素材" : "上传成功", { description: existing ? "检测到相同文件，已直接使用已有素材" : "已上传本地图片并设置为厂商 Logo" });
    } catch (error) {
      notify.error("上传失败", { description: resolveUserErrorMessage(error, "请求失败") });
    } finally {
      setUploadingLocalLogo(false);
      if (localUploadInputRef.current) localUploadInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{form.id ? "编辑厂商" : "新增厂商"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-5 py-1">
          
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="workflow-form-label">厂商名称</Label>
              <Input
                value={form.name}
                onChange={(event) => onFormChange((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="请输入厂商名称"
                className="workflow-form-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="workflow-form-label">状态</Label>
              <Select value={form.status} onValueChange={(value: VendorStatus) => onFormChange((prev) => ({ ...prev, status: value }))}>
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  <SelectItem className="subpage-select-item" value="启用">
                    启用
                  </SelectItem>
                  <SelectItem className="subpage-select-item" value="停用">
                    停用
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="workflow-form-label">厂商 Logo</Label>
            <ImageMaterialField
              previewUrl={form.logoUrl}
              alt={form.name || "厂商 Logo"}
              fallbackText={getVendorFallback(form.name || "MH")}
              uploading={uploadingLocalLogo}
              description="点击左侧卡片可从本地上传，右侧按钮可直接从素材库选择，建议使用透明底 Logo。"
              emptyHint="未设置 Logo 时将使用名称首字展示。"
              onUploadClick={() => localUploadInputRef.current?.click()}
              onPickFromLibrary={() => setLogoPickerOpen(true)}
              onClear={() => onFormChange((prev) => ({ ...prev, logoUrl: "" }))}
            />
            <input
              ref={localUploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                void handleUploadLocalLogo(file);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label className="workflow-form-label">厂商说明</Label>
            <Textarea
              value={form.description}
              onChange={(event) => onFormChange((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="描述厂商定位、区域覆盖或能力特点"
              className="workflow-form-textarea min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="subpage-outline-btn" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button className="subpage-primary-btn" onClick={() => void onSubmit()} disabled={!form.name.trim()}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
      <FileMaterialPickerDialog
        open={logoPickerOpen}
        onOpenChange={setLogoPickerOpen}
        title="选择厂商 Logo"
        fileType="image"
        onPick={(url) => onFormChange((prev) => ({ ...prev, logoUrl: url }))}
      />
    </Dialog>
  );
}
