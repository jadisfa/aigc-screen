import { Save } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { DictionaryOptionItem } from "@/shared/api/integration/integration-dictionaries";
import type { VariableDict } from "@/shared/api/integration/message-template";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  savePending: boolean;
  onSave: () => void;
  error?: string | null;
  formTemplateCode: string;
  setFormTemplateCode: Dispatch<SetStateAction<string>>;
  formTemplateName: string;
  setFormTemplateName: Dispatch<SetStateAction<string>>;
  formTemplateType: string;
  setFormTemplateType: Dispatch<SetStateAction<string>>;
  formRegion: string;
  setFormRegion: Dispatch<SetStateAction<string>>;
  formExternalTemplateId: string;
  setFormExternalTemplateId: Dispatch<SetStateAction<string>>;
  formContent: string;
  setFormContent: Dispatch<SetStateAction<string>>;
  templateTypeOptions: DictionaryOptionItem[];
  regionOptions: DictionaryOptionItem[];
  variableDict: VariableDict;
};

export default function MessageTemplateEditDialog(props: Props) {
  const {
    open,
    onOpenChange,
    title = "编辑消息模板",
    savePending,
    onSave,
    error,
    formTemplateCode,
    setFormTemplateCode,
    formTemplateName,
    setFormTemplateName,
    formTemplateType,
    setFormTemplateType,
    formRegion,
    setFormRegion,
    formExternalTemplateId,
    setFormExternalTemplateId,
    formContent,
    setFormContent,
    templateTypeOptions,
    regionOptions,
    variableDict,
  } = props;

  const variableList = Object.values(variableDict).sort((a, b) => a.key.localeCompare(b.key));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="workflow-form-label">
              <span className="text-destructive">*</span>模板名称
            </label>
            <Input value={formTemplateName} onChange={(e) => setFormTemplateName(e.target.value)} placeholder="例如：新工单提醒短信" />
          </div>
          <div className="space-y-2">
            <label className="workflow-form-label">
              <span className="text-destructive">*</span>模板编码
            </label>
            <Input value={formTemplateCode} onChange={(e) => setFormTemplateCode(e.target.value)} placeholder="例如：ticket_new" disabled />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <label className="workflow-form-label">
              <span className="text-destructive">*</span>模板类型
            </label>
            <Select value={formTemplateType} onValueChange={setFormTemplateType}>
              <SelectTrigger className="subpage-native-select h-10">
                <SelectValue placeholder="请选择模板类型" />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                {templateTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} className="subpage-select-item" value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="workflow-form-label">
              <span className="text-destructive">*</span>国内/国际
            </label>
            <Select value={formRegion} onValueChange={setFormRegion}>
              <SelectTrigger className="subpage-native-select h-10">
                <SelectValue placeholder="请选择区域" />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                {regionOptions.map((opt) => (
                  <SelectItem key={opt.value} className="subpage-select-item" value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="workflow-form-label">
              {formTemplateType === "sms" ? <span className="text-destructive">*</span> : null}
              外部模板ID
            </label>
            <Input
              value={formExternalTemplateId}
              onChange={(e) => setFormExternalTemplateId(e.target.value)}
              placeholder={formTemplateType === "sms" ? "云平台模板ID" : "可不填"}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="workflow-form-label">
            <span className="text-destructive">*</span>模板内容
          </label>
          <Textarea
            rows={4}
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            placeholder={formTemplateType === "sms" ? "用于展示/存档，短信发送仍以外部模板ID为准" : "支持 {{var}} 变量占位"}
            className="min-h-[120px]"
          />
        </div>

        <div className="rounded-xl border bg-muted/10 px-4 py-4">
          <div className="text-sm font-medium text-foreground">变量字典</div>
          <div className="mt-1 text-xs text-muted-foreground">仅用于提示可用占位符，内容中使用 {"{{key}}"} 格式引用</div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {variableList.length > 0 ? (
              variableList.map((v) => (
                <div key={v.key} className="rounded-lg border bg-background px-4 py-3 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-foreground">{v.name || v.key}</div>
                    <div className="text-xs text-muted-foreground font-mono">{"{{"}{v.key}{"}}"}</div>
                  </div>
                  {v.description ? <div className="text-xs text-muted-foreground">{v.description}</div> : null}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">未找到变量</div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {error ? <p className="mr-auto text-sm text-destructive">{error}</p> : null}
          <Button variant="outline" className="h-10 px-5" onClick={() => onOpenChange(false)} disabled={savePending}>
            取消
          </Button>
          <Button className="h-10 px-5 bg-foreground text-background hover:bg-foreground/90" onClick={onSave} disabled={savePending}>
            <Save className="w-4 h-4 mr-1" />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
