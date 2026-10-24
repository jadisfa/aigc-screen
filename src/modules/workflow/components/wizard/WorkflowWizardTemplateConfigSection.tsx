import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import JsonEditor from "@/shared/components/JsonEditor";
import {
  TEMPLATE_ADAPTERS,
  DEFAULT_TEMPLATE_ADAPTER_ID,
  DEFAULT_TEMPLATE_BIZ_CODE,
  getTemplateAdapter,
  type TemplateAdapterId,
  type TemplateFieldDef,
  type TemplateFieldType,
  type TemplateOutputType,
} from "@/modules/workflow/lib/template-adapter-catalog";
import { buildTemplateGraph, parseTemplateGraph } from "@/modules/workflow/lib/template-graph";
import { parseJsonText } from "@/modules/workflow/lib/wizard-json";
import { notify } from "@/shared/lib/notify";

const FIELD_GRID = "grid grid-cols-[minmax(0,1.2fr)_120px_minmax(0,1fr)_56px_36px] gap-2 items-center";

export default function WorkflowWizardTemplateConfigSection(props: {
  workflowJsonText: string;
  onWorkflowJsonTextChange: (next: string) => void;
  onAdapterDefaultsApplied?: (timeoutSec: number) => void;
}) {
  const [pendingAdapterId, setPendingAdapterId] = useState<TemplateAdapterId | null>(null);

  const localParsed = useMemo(() => parseJsonText(props.workflowJsonText, "workflow JSON"), [props.workflowJsonText]);
  const graphParsed = useMemo(() => {
    if (!localParsed.ok) return null;
    const parsed = parseTemplateGraph(localParsed.value);
    return parsed.ok ? parsed.value : null;
  }, [localParsed]);
  const parseMessage = useMemo(() => {
    if (localParsed.ok === false) return localParsed.message;
    if (graphParsed) return null;
    const parsed = parseTemplateGraph(localParsed.value);
    return parsed.ok === false ? parsed.message : null;
  }, [graphParsed, localParsed]);

  const adapter = graphParsed ? getTemplateAdapter(graphParsed.adapterId) : getTemplateAdapter(DEFAULT_TEMPLATE_ADAPTER_ID);
  const fields = (graphParsed?.fields ?? adapter?.defaultFields ?? []).filter((item) => item.name !== "bizCode");
  const outputType: TemplateOutputType = graphParsed?.outputType ?? adapter?.defaultOutputType ?? "image";
  const bizCode = graphParsed != null ? graphParsed.bizCode : adapter?.defaultBizCode || DEFAULT_TEMPLATE_BIZ_CODE;
  const rawJson = graphParsed?.doc ?? (localParsed.ok ? localParsed.value : null);

  const commit = (next: {
    adapterId: TemplateAdapterId;
    fields: TemplateFieldDef[];
    outputType?: TemplateOutputType;
    bizCode?: string;
  }) => {
    const doc = buildTemplateGraph({
      adapterId: next.adapterId,
      fields: next.fields,
      outputType: next.outputType ?? outputType,
      bizCode: next.bizCode ?? bizCode,
    });
    props.onWorkflowJsonTextChange(JSON.stringify(doc, null, 2));
  };

  const applyAdapter = (adapterId: TemplateAdapterId) => {
    const nextAdapter = getTemplateAdapter(adapterId);
    if (!nextAdapter?.enabled) return;
    commit({
      adapterId: nextAdapter.id,
      fields: nextAdapter.defaultFields,
      outputType: nextAdapter.defaultOutputType,
      bizCode: nextAdapter.defaultBizCode ?? DEFAULT_TEMPLATE_BIZ_CODE,
    });
    props.onAdapterDefaultsApplied?.(nextAdapter.defaultTimeoutSec);
  };

  const updateFields = (nextFields: TemplateFieldDef[]) => {
    if (!adapter) return;
    commit({ adapterId: adapter.id, fields: nextFields });
  };

  const patchField = (index: number, patch: Partial<TemplateFieldDef>) => {
    updateFields(fields.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col gap-4 pb-6">
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 max-w-3xl">
          <div className="space-y-2 min-w-0">
            <div className="text-sm font-medium">选择模板</div>
            <Select
              value={adapter?.id ?? DEFAULT_TEMPLATE_ADAPTER_ID}
              onValueChange={(value) => {
                const next = value as TemplateAdapterId;
                if (next === adapter?.id) return;
                const nextAdapter = getTemplateAdapter(next);
                if (!nextAdapter?.enabled) return;
                setPendingAdapterId(next);
              }}
            >
              <SelectTrigger className="workflow-form-select">
                <SelectValue placeholder="选择模板" />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                {TEMPLATE_ADAPTERS.map((item) => (
                  <SelectItem key={item.id} className="subpage-select-item" value={item.id} disabled={!item.enabled}>
                    {item.label}
                    {item.enabled ? "" : `（${item.comingSoonHint || "即将支持"}）`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 min-w-0">
            <div className="text-sm font-medium">业务编码</div>
            <Input
              value={bizCode}
              onChange={(e) => {
                if (!adapter) return;
                commit({ adapterId: adapter.id, fields, bizCode: e.target.value });
              }}
              placeholder={DEFAULT_TEMPLATE_BIZ_CODE}
              className="workflow-form-input"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row gap-6 items-stretch">
        <div className="flex-1 min-w-0 min-h-[550px] flex flex-col">
          <div className="text-sm font-medium mb-3 flex items-center h-9 shrink-0 gap-2">
            开始节点入参
            <span className="text-xs font-normal text-muted-foreground">
              （{adapter?.platformLabel ?? "模板"} · 可改默认值）
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() =>
                updateFields([
                  ...fields,
                  {
                    name: `param_${fields.length + 1}`,
                    type: "string",
                    defaultValue: "",
                    required: false,
                  },
                ])
              }
            >
              <Plus className="w-4 h-4 mr-1" />
              添加入参
            </Button>
          </div>
          <div className="flex-1 min-h-0 w-full rounded-xl border border-border bg-background overflow-hidden flex flex-col">
            <div className={`${FIELD_GRID} shrink-0 px-3 py-2 border-b border-border bg-muted/20`}>
              <span className="text-xs text-muted-foreground">名称</span>
              <span className="text-xs text-muted-foreground">类型</span>
              <span className="text-xs text-muted-foreground">默认值</span>
              <span className="text-xs text-muted-foreground">必填</span>
              <span />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {fields.length === 0 ? (
                <div className="h-full min-h-[240px] flex flex-col items-center justify-center gap-2 px-6">
                  <p className="text-sm font-medium text-foreground">暂无入参</p>
                  <p className="text-xs text-muted-foreground">点击右上角「添加入参」添加至少一项</p>
                </div>
              ) : (
                fields.map((field, index) => (
                  <div
                    key={`${field.name}-${index}`}
                    className={`${FIELD_GRID} px-3 py-2 border-b border-border last:border-b-0 hover:bg-muted/20`}
                  >
                    <Input
                      value={field.name}
                      onChange={(e) => patchField(index, { name: e.target.value })}
                      placeholder="名称"
                      className="workflow-form-input"
                    />
                    <Select
                      value={field.type}
                      onValueChange={(value) => {
                        const type = value as TemplateFieldType;
                        const defaultValue =
                          type === "boolean" ? Boolean(field.defaultValue) : type === "number" ? Number(field.defaultValue) || 0 : String(field.defaultValue ?? "");
                        patchField(index, { type, defaultValue });
                      }}
                    >
                      <SelectTrigger className="workflow-form-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="subpage-select-content">
                        <SelectItem className="subpage-select-item" value="string">
                          string
                        </SelectItem>
                        <SelectItem className="subpage-select-item" value="number">
                          number
                        </SelectItem>
                        <SelectItem className="subpage-select-item" value="boolean">
                          boolean
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {field.type === "boolean" ? (
                      <div className="h-10 flex items-center">
                        <Switch checked={field.defaultValue === true} onCheckedChange={(checked) => patchField(index, { defaultValue: checked })} />
                      </div>
                    ) : (
                      <Input
                        type={field.type === "number" ? "number" : "text"}
                        value={String(field.defaultValue ?? "")}
                        onChange={(e) =>
                          patchField(index, {
                            defaultValue: field.type === "number" ? Number(e.target.value) : e.target.value,
                          })
                        }
                        placeholder="默认值"
                        className="workflow-form-input"
                      />
                    )}
                    <div className="h-10 flex items-center justify-center">
                      <Switch checked={field.required} onCheckedChange={(checked) => patchField(index, { required: checked })} />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive h-10 w-9 p-0"
                      onClick={() => updateFields(fields.filter((_, i) => i !== index))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 min-h-[550px] flex flex-col">
          <div className="flex items-center justify-between mb-3 h-9 shrink-0">
            <div className="text-sm font-medium flex items-center gap-2">
              <span>Workflow JSON</span>
              {graphParsed ? <span className="text-xs font-normal text-muted-foreground">三节点模板</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!localParsed.ok) return;
                  props.onWorkflowJsonTextChange(JSON.stringify(localParsed.value, null, 2));
                }}
                disabled={!rawJson}
              >
                格式化
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!props.workflowJsonText.trim()}
                onClick={async () => {
                  const text = rawJson != null ? JSON.stringify(rawJson, null, 2) : props.workflowJsonText;
                  await navigator.clipboard.writeText(text);
                }}
              >
                复制
              </Button>
            </div>
          </div>
          <div className="relative flex-1 min-h-0 overflow-hidden">
            <JsonEditor jsonText={props.workflowJsonText} onJsonTextChange={props.onWorkflowJsonTextChange} parsedValue={rawJson} />
            {parseMessage ? (
              <p className="absolute bottom-2 left-3 right-3 z-10 rounded-md bg-background/90 px-2 py-1 text-xs text-destructive">{parseMessage}</p>
            ) : null}
          </div>
        </div>
      </div>

      <AlertDialog open={!!pendingAdapterId} onOpenChange={(open) => !open && setPendingAdapterId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>更换模板？</AlertDialogTitle>
            <AlertDialogDescription>将重置为该模板的默认入参，当前填写会丢失。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingAdapterId) return;
                applyAdapter(pendingAdapterId);
                setPendingAdapterId(null);
                notify.success("已切换模板");
              }}
            >
              确认重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
