import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import {
  createKindLabel,
  type WorkflowAppCreateKind,
} from "@/modules/workflow/lib/workflow-exec";

const OPTIONS: Array<{
  value: WorkflowAppCreateKind;
  title: string;
  description: string;
}> = [
  {
    value: "comfyui",
    title: "ComfyUI",
    description: "自建 / 兼容 Comfy 节点，上传 API 格式工作流，并自定义调用页面",
  },
  {
    value: "runninghub",
    title: "RunningHub",
    description: "使用RunningHub平台工作流，上传 API 导出 JSON 配置参数。",
  },
  {
    value: "template",
    title: "模板应用",
    description: "封装 LLM 模型平台能力（文生视频等），无需上传第三方工作流 JSON。",
  },
];

export default function WorkflowAppTypeSelectDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: WorkflowAppCreateKind;
  onValueChange: (next: WorkflowAppCreateKind) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>选择应用类型</DialogTitle>
          <DialogDescription>请选择工作流/经验类型</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {OPTIONS.map((opt) => {
            const active = props.value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => props.onValueChange(opt.value)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-foreground">{opt.title}</div>
                  <div
                    className={cn(
                      "h-4 w-4 rounded-full border",
                      active ? "border-primary bg-primary" : "border-muted-foreground/40",
                    )}
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{opt.description}</p>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" variant="page" onClick={props.onConfirm}>
            创建 {createKindLabel(props.value)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
