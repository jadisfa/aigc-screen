import { useEffect, useState } from "react";
import { AlertTriangle, Check, Wand2 } from "lucide-react";
import { FieldGroup } from "@/modules/modelhub/components/EditorFormSection";
import {
  PROTOCOL_SCENE_OPTIONS,
  type ProtocolEditorForm,
} from "@/modules/modelhub/types/protocolCatalogTypes";
import {
  applyProtocolInferPatch,
  emptyProtocolSampleInput,
  inferProtocolFromSamples,
  type ProtocolInferResult,
  type ProtocolSampleField,
  type ProtocolSampleInput,
} from "@/modules/modelhub/types/protocolSampleInfer";
import { StatusBadge } from "@/shared/components/page";
import { notify } from "@/shared/lib/notify";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";

const SAMPLE_FIELDS: Array<{
  key: ProtocolSampleField;
  label: string;
  hint: string;
  placeholder: string;
}> = [
  {
    key: "submitRequest",
    label: "任务请求",
    hint: "",
    placeholder: `curl --location 'https://api.example.com/v1/jobs/createTask' \\
  -H "Authorization: Bearer sk-..." \\
  -d '{"model":"...","prompt":"..."}'`,
  },
  {
    key: "submitResponse",
    label: "结果返回",
    hint: "",
    placeholder: `{\n  "code": 200,\n  "data": { "taskId": "task_..." }\n}`,
  },
  {
    key: "pollRequest",
    label: "状态查询请求",
    hint: "",
    placeholder: "GET https://api.example.com/v1/jobs/recordInfo?taskId={task_id}",
  },
  {
    key: "pollResponse",
    label: "状态查询返回",
    hint: "",
    placeholder: `{\n  "data": {\n    "state": "success",\n    "resultJson": "{\\"resultUrls\\":[\\"https://...\\"]}"\n  }\n}`,
  },
];

export default function ProtocolSampleInferDialog(props: {
  open: boolean;
  form: ProtocolEditorForm;
  onOpenChange: (open: boolean) => void;
  onConfirm: (next: ProtocolEditorForm) => void;
}) {
  const [samples, setSamples] = useState<ProtocolSampleInput>(emptyProtocolSampleInput);
  const [result, setResult] = useState<ProtocolInferResult | null>(null);

  useEffect(() => {
    if (!props.open) {
      return;
    }
    setResult(null);
    setSamples({
      ...emptyProtocolSampleInput(),
      sceneCode: props.form.sceneCodes[0] || "video_generation",
    });
  }, [props.open, props.form.sceneCodes]);

  const patchSample = (key: ProtocolSampleField, value: string) => {
    setSamples((current) => ({ ...current, [key]: value }));
    setResult(null);
  };

  const handleGenerate = () => {
    setResult(inferProtocolFromSamples(samples));
  };

  const handleConfirm = () => {
    if (!result?.ok) {
      return;
    }
    props.onConfirm(applyProtocolInferPatch(props.form, result.patch));
    notify.success("已回填协议表单", { description: "请核对路径、请求体和 JSONPath 后再保存" });
    props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-[960px] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-4 pr-12 text-left">
          <DialogTitle>从样例生成协议</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto scrollbar-hidden px-6 py-5">
          <FieldGroup label="协议场景" required>
            <Select
              value={samples.sceneCode}
              onValueChange={(value) => {
                setSamples((current) => ({ ...current, sceneCode: value }));
                setResult(null);
              }}
            >
              <SelectTrigger className={cn("subpage-native-select h-10 w-full max-w-sm", result?.fieldErrors.sceneCode ? "border-destructive/60" : "")}>
                <SelectValue placeholder="选择场景" />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                {PROTOCOL_SCENE_OPTIONS.map((scene) => (
                  <SelectItem className="subpage-select-item" value={scene.code} key={scene.code}>
                    {scene.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {result?.fieldErrors.sceneCode ? (
              <p className="text-[12px] text-destructive">{result.fieldErrors.sceneCode}</p>
            ) : null}
          </FieldGroup>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {SAMPLE_FIELDS.map((field) => (
              <FieldGroup key={field.key} label={field.label} required={field.key === "submitRequest"}>
                <p className="text-[12px] leading-5 text-muted-foreground">{field.hint}</p>
                <Textarea
                  value={samples[field.key]}
                  onChange={(event) => patchSample(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  spellCheck={false}
                  className={cn(
                    "min-h-[148px] font-mono text-[12px] leading-5",
                    result?.fieldErrors[field.key] ? "border-destructive/60" : "",
                  )}
                />
                {result?.fieldErrors[field.key] ? (
                  <p className="text-[12px] text-destructive">{result.fieldErrors[field.key]}</p>
                ) : null}
              </FieldGroup>
            ))}
          </div>

          {result && !result.ok ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive">
              {result.error || "样例无法解析"}
            </div>
          ) : null}

          {result?.ok ? (
            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success-foreground" />
                  <span className="text-[13px] font-semibold">转换草稿</span>
                </div>
                {result.warnings.length > 0 ? (
                  <StatusBadge tone="warning">{result.warnings.length} 项待核对</StatusBadge>
                ) : (
                  <StatusBadge tone="success">可回填</StatusBadge>
                )}
              </div>
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {result.summary.map((item) => (
                  <div key={item.label} className="min-w-0 rounded-lg bg-background px-3 py-2">
                    <dt className="text-[12px] text-muted-foreground">{item.label}</dt>
                    <dd className="mt-0.5 truncate font-mono text-[12px] leading-5 text-foreground" title={item.value}>
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {result.warnings.length > 0 ? (
                <ul className="space-y-1.5">
                  {result.warnings.map((warning) => (
                    <li key={warning.code} className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-[12px] leading-5 text-warning-foreground">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{warning.message}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/70 px-6 py-3 sm:space-x-0">
          <Button variant="pageOutline" onClick={() => props.onOpenChange(false)}>
            取消
          </Button>
          <Button variant="pageOutline" onClick={handleGenerate}>
            <Wand2 />
            生成转换
          </Button>
          <Button variant="page" disabled={!result?.ok} onClick={handleConfirm}>
            确认回填
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
