import { ArrowLeft, ChevronDown, ChevronUp, Plus, Save, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { DictionaryOptionItem } from "@/shared/api/integration/integration-dictionaries";
import type { VariableDict } from "@/shared/api/integration/message-template";

type MessageTemplateEditorDialogProps = {
  mode: "create" | "edit";
  onCancel: () => void;
  onSave: () => void;
  savePending: boolean;
  formError?: string | null;
  templateTypeOptions: DictionaryOptionItem[];
  regionOptions: DictionaryOptionItem[];
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
  formVariables: string[];
  setFormVariables: Dispatch<SetStateAction<string[]>>;
  variableDict: VariableDict;
};

export default function MessageTemplateEditorDialog(props: MessageTemplateEditorDialogProps) {
  const {
    mode,
    onCancel,
    onSave,
    savePending,
    formError,
    templateTypeOptions,
    regionOptions,
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
    formVariables,
    setFormVariables,
    variableDict,
  } = props;

  const isSms = formTemplateType === "sms";
  const requiresLocalRender = formTemplateType === "email" || formTemplateType === "inbox";
  const [pendingVariableKey, setPendingVariableKey] = useState<string>("");

  const selectedSet = useMemo(() => new Set(formVariables), [formVariables]);
  const availableOptions = useMemo(
    () =>
      Object.values(variableDict)
        .filter((item) => !selectedSet.has(item.key))
        .sort((a, b) => a.key.localeCompare(b.key)),
    [selectedSet, variableDict],
  );
  const selectedItems = formVariables
    .map((key) => variableDict[key] ?? { key, name: key, description: "" })
    .filter((item) => item.key);

  const addVariable = (key: string) => {
    const normalized = key.trim();
    if (!normalized || !variableDict[normalized] || selectedSet.has(normalized)) {
      return;
    }
    setFormVariables((prev) => [...prev, normalized]);
    setPendingVariableKey("");
  };

  const removeVariable = (key: string) => {
    setFormVariables((prev) => prev.filter((item) => item !== key));
  };

  const moveVariable = (key: string, delta: -1 | 1) => {
    setFormVariables((prev) => {
      const index = prev.indexOf(key);
      if (index < 0) return prev;
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const insertPlaceholder = (key: string) => {
    const token = `{{${key}}}`;
    setFormContent((prev) => (prev ? `${prev}${prev.endsWith(" ") || prev.endsWith("\n") ? "" : " "}${token}` : token));
  };

  return (
    <div className="page-content-shell">
      <div className="subpage-toolbar mb-7">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={onCancel} disabled={savePending}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-[18px] font-semibold text-foreground">{mode === "create" ? "新增消息模板" : "编辑消息模板"}</h1>
        </div>
      </div>

      <div className="w-full max-w-[1000px] mx-auto space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <div className="space-y-2">
            <label className="workflow-form-label">
              <span className="text-destructive">*</span>模板名称
            </label>
            <Input
              value={formTemplateName}
              onChange={(e) => setFormTemplateName(e.target.value)}
              placeholder="例如：新工单提醒短信"
              className="workflow-form-input"
            />
          </div>
          <div className="space-y-2">
            <label className="workflow-form-label">
              <span className="text-destructive">*</span>模板编码(关联业务场景)
            </label>
            <Input
              value={formTemplateCode}
              onChange={(e) => setFormTemplateCode(e.target.value)}
              placeholder="例如：otp_login"
              className="workflow-form-input"
              disabled={mode === "edit"}
            />
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
              {isSms ? <span className="text-destructive">*</span> : null}
              外部模板ID(如短信模板ID)
            </label>
            <Input
              value={formExternalTemplateId}
              onChange={(e) => setFormExternalTemplateId(e.target.value)}
              placeholder={isSms ? "云平台模板ID" : "可不填"}
              className="workflow-form-input"
            />
          </div>
        </div>

        <div className="rounded-xl bg-muted/10 py-4 space-y-4">
          <div>
            <div className="text-sm font-medium text-foreground">
              <span className="text-destructive">*</span>模板变量
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              变量名代表固定业务语义，只能从字典选择，不可自定义。
              {isSms
                ? " 短信渠道不渲染本地正文：按下方顺序组装云厂商参数（阿里云按名，腾讯云按 {1}/{2}/...）。"
                : " 邮件/站内信会按 {{key}} 本地渲染正文。"}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="space-y-2 flex-1">
              <label className="workflow-form-label">从变量字典添加</label>
              <Select
                value={pendingVariableKey || undefined}
                onValueChange={setPendingVariableKey}
                disabled={!formTemplateCode.trim() || availableOptions.length === 0 || savePending}
              >
                <SelectTrigger className="subpage-native-select h-10">
                  <SelectValue
                    placeholder={
                      !formTemplateCode.trim()
                        ? "请先填写模板编码"
                        : availableOptions.length === 0
                          ? "字典变量已全部添加"
                          : "请选择变量"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {availableOptions.map((opt) => (
                    <SelectItem key={opt.key} className="subpage-select-item" value={opt.key}>
                      {opt.name || opt.key}（{opt.key}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={!pendingVariableKey || savePending}
              onClick={() => addVariable(pendingVariableKey)}
            >
              <Plus className="w-4 h-4 mr-1" />
              添加
            </Button>
          </div>

          {selectedItems.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-foreground">{isSms ? "已选参数顺序" : "已选变量"}</div>
              <div className="space-y-2">
                {selectedItems.map((v, index) => (
                  <div key={v.key} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                    <div className="w-6 text-xs text-muted-foreground tabular-nums">{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{v.name || v.key}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {isSms ? `参数#${index + 1}` : `{{${v.key}}}`} · {v.key}
                      </div>
                      {v.description ? <div className="text-xs text-muted-foreground mt-1">{v.description}</div> : null}
                    </div>
                    {requiresLocalRender ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={savePending}
                        onClick={() => insertPlaceholder(v.key)}
                      >
                        插入占位符
                      </Button>
                    ) : null}
                    {isSms ? (
                      <>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={index === 0 || savePending}
                          onClick={() => moveVariable(v.key, -1)}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={index === selectedItems.length - 1 || savePending}
                          onClick={() => moveVariable(v.key, 1)}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      disabled={savePending}
                      onClick={() => removeVariable(v.key)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">尚未选择变量，请从上方字典中添加</div>
          )}
        </div>

        <div className="space-y-2">
          <label className="workflow-form-label">
            {requiresLocalRender ? <span className="text-destructive">*</span> : null}
            {isSms ? "备注/存档内容（不参与发送）" : "模板内容"}
          </label>
          <Textarea
            rows={4}
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            placeholder={
              isSms
                ? "可选：仅作本地备注，实际短信正文由云厂商模板渲染"
                : "支持 {{key}} 变量占位，key 必须来自上方已选变量"
            }
            className="min-h-[110px]"
          />
          {isSms ? (
            <div className="text-xs text-muted-foreground">短信渠道不渲染本地正文，只向阿里云/腾讯云传递已选变量参数。</div>
          ) : (
            <div className="text-xs text-muted-foreground">邮件/站内信会在发送前用已选变量渲染正文。</div>
          )}
        </div>

        <div className="pt-3 pb-8 mt-6 space-y-2">
          {formError ? <p className="text-sm text-destructive text-right">{formError}</p> : null}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" className="h-10 px-5" onClick={onCancel} disabled={savePending}>
              取消
            </Button>
            <Button className="h-10 px-5 bg-foreground text-background hover:bg-foreground/90" onClick={onSave} disabled={savePending}>
              <Save className="w-4 h-4 mr-1" />
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
