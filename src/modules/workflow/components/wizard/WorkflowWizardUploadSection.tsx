import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import JsonEditor from "@/shared/components/JsonEditor";
import {
  executionBackendLabel,
  type WorkflowExecution,
} from "@/modules/workflow/lib/workflow-exec";

export default function WorkflowWizardUploadSection(props: {
  executionBackend?: WorkflowExecution;
  rhWorkflowId?: string;
  onRhWorkflowIdChange?: (next: string) => void;
  accessPassword?: string;
  onAccessPasswordChange?: (next: string) => void;
  workflowJsonText: string;
  onWorkflowJsonTextChange: (next: string) => void;
  onFormat: () => void;
  rawJson: unknown | null;
  nodes?: Array<{ nodeId: string; label: string }>;
  parseError?: string | null;
  isParsing?: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backend = props.executionBackend ?? "comfyui";
  const isRunningHub = backend === "runninghub";

  const readFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      props.onWorkflowJsonTextChange(String(reader.result ?? ""));
    };
    reader.readAsText(f);
  };

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col gap-4 pb-6">
      {isRunningHub ? (
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <div className="text-sm font-medium">RunningHub 模板</div>
          <div className="grid grid-cols-2 gap-3 max-w-3xl">
            <div className="space-y-2 min-w-0">
              <label className="text-xs font-medium text-foreground">
                <span className="text-destructive">*</span> rhWorkflowId
              </label>
              <Input
                value={props.rhWorkflowId ?? ""}
                onChange={(e) => props.onRhWorkflowIdChange?.(e.target.value)}
                placeholder="请输入模板 ID"
                className="workflow-form-input"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <label className="text-xs font-medium text-foreground">访问密码</label>
              <Input
                type="password"
                autoComplete="off"
                value={props.accessPassword ?? ""}
                onChange={(e) => props.onAccessPasswordChange?.(e.target.value)}
                placeholder="选填"
                className="workflow-form-input"
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row gap-6 items-stretch">
        <div className="flex-1 min-w-0 min-h-[550px] flex flex-col">
          <div className="text-sm font-medium mb-3 flex items-center h-9 shrink-0 gap-2">
            上传应用文件
            <span className="text-xs font-normal text-muted-foreground">
              （{executionBackendLabel(backend)} · API 导出格式）
            </span>
          </div>
          <div
            className={`flex-1 min-h-0 w-full rounded-xl border-2 border-dashed transition-colors px-6 py-8 flex flex-col items-center justify-center gap-3 cursor-pointer ${
              isDragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:bg-muted/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (!f) return;
              readFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <Upload className="w-12 h-12 text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground text-center">
              点击选择或者将您的应用文件（API格式）拖拽到这里
            </p>
            <p className="text-xs text-muted-foreground max-w-sm text-center leading-relaxed">
              {isRunningHub
                ? "*请使用 RunningHub / Comfy「Export Workflow API / 保存为 API」导出的 JSON；不要上传含 widgets_values 的画布 UI 格式。"
                : "*上传API格式工作流(ComfyUI界面右侧选项卡上小齿轮进入设置界面，勾选启用开发模式选项，界面将出现保存为API格式选项)"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                readFile(f);
              }}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0 min-h-[550px] flex flex-col">
          <div className="flex items-center justify-between mb-3 h-9 shrink-0">
            <div className="text-sm font-medium flex items-center gap-2">
              <span>Workflow JSON</span>
              {props.nodes && props.nodes.length ? (
                <span className="text-xs text-muted-foreground">已解析节点 {props.nodes.length}</span>
              ) : null}
              {props.isParsing ? <span className="text-xs text-muted-foreground">解析中...</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={props.onFormat} disabled={!props.rawJson}>
                格式化
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!props.workflowJsonText.trim()}
                onClick={async () => {
                  const text = props.rawJson != null ? JSON.stringify(props.rawJson, null, 2) : props.workflowJsonText;
                  await navigator.clipboard.writeText(text);
                }}
              >
                复制
              </Button>
            </div>
          </div>
          <div className="relative flex-1 min-h-0 overflow-hidden">
            <JsonEditor
              jsonText={props.workflowJsonText}
              onJsonTextChange={props.onWorkflowJsonTextChange}
              parsedValue={props.rawJson}
            />
            {props.parseError ? (
              <p className="absolute bottom-2 left-3 right-3 z-10 rounded-md bg-background/90 px-2 py-1 text-xs text-destructive">
                {props.parseError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
