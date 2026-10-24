import type { ReactNode } from "react";
import { useState } from "react";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import type { UiComponent } from "../ui-schema";
import { defaultCollectDispatchParamsForComponent } from "./shared";
import type { UiComponentDefinition } from "./types";
import {
  sessionChatCompletionsStream,
  type SessionChatMessage,
} from "@/shared/api/model-hub/session-inference";
import { BIZ_CAPABILITY_CODES } from "@/shared/lib/biz-capability-codes";
import { translateText } from "@/shared/api/sys/translation";
import {
  resolveUserErrorNotice,
  tryGetBackendTraceId,
} from "@/shared/api/sys/error-message";
import { notify } from "@/shared/lib/notify";
function resolvePolishErrorNotice(error: unknown) {
  const notice = resolveUserErrorNotice(error, "润色失败，请稍后重试", "润色失败");
  const traceId = tryGetBackendTraceId(error);
  return {
    title: notice.title || "润色失败",
    description: traceId ? `${notice.description}（追踪号：${traceId}）` : notice.description,
  };
}

function getErrorMessage(error: unknown): string {
  return resolveUserErrorNotice(error, "接口调用异常").description;
}

function PositivePromptRuntimeField({
  comp,
  value,
  onChange,
  LabelComp,
}: {
  comp: Extract<UiComponent, { type: "PositivePrompt" }>;
  value: string;
  onChange: (next: string) => void;
  LabelComp?: () => ReactNode;
}) {
  const [isPolishing, setIsPolishing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const enableLLM = !!comp.ext.enableLLM;
  const enableTranslate = !!comp.ext.enableTranslate;
  
  const handlePolish = async () => {
    if (!value.trim()) {
      notify.success("提示", { description: "请输入需要润色的正向提示词内容" });
      return;
    }
    
    setIsPolishing(true);
    const previousValue = value;
    try {
      const messages: SessionChatMessage[] = [];
      const systemPrompt = comp.ext?.aiPresetPrompt || comp.ext?.prependPrompt;
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: value });

      // 清空当前内容准备接收流式输出
      let currentResult = "";
      onChange("");

      await sessionChatCompletionsStream(
        { messages },
        (token) => {
          currentResult += token;
          onChange(currentResult);
        },
        BIZ_CAPABILITY_CODES.WORKFLOW_UI_LLM
      );

      notify.success("AI润色成功", { description: "提示词已更新" });
    } catch (e: unknown) {
      console.error("AI Polish Error:", e);
      onChange(previousValue);
      const notice = resolvePolishErrorNotice(e);
      notify.error(notice.title, { description: notice.description });
    } finally {
      setIsPolishing(false);
    }
  };

  const handleTranslate = async () => {
    if (!value.trim()) {
      notify.success("提示", { description: "请输入需要翻译的内容" });
      return;
    }
    
    setIsTranslating(true);
    try {
      const result = await translateText(value);
      onChange(result);
      notify.success("翻译成功", { description: "内容已翻译为英文" });
    } catch (e: unknown) {
      console.error("Translate Error:", e);
      notify.error("翻译失败", { description: getErrorMessage(e) });
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="space-y-2">
      {LabelComp && (
        <div className="flex items-center justify-between min-w-0">
          <LabelComp />
          <div className="flex items-center">
            {enableTranslate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[12px] bg-accent text-muted-foreground hover:bg-accent/80 hover:text-primary transition-colors ml-2 shrink-0"
                onClick={handleTranslate}
                disabled={isTranslating || isPolishing}
              >
                {isTranslating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                翻译
              </Button>
            )}
            {enableLLM && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[12px] bg-accent text-muted-foreground hover:bg-accent/80 hover:text-primary transition-colors ml-2 shrink-0"
                onClick={handlePolish}
                disabled={isPolishing || isTranslating}
              >
                {isPolishing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                AI润色
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="relative">
        <Textarea
          className="workflow-form-textarea"
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="请输入正向提示词"
          disabled={isPolishing || isTranslating}
        />
      </div>
    </div>
  );
}

export const positivePromptDefinition: UiComponentDefinition = {
  type: "PositivePrompt",
  iconName: "sparkles",
  palette: { id: "pos-prompt", label: "正向提示词", category: "提示词", order: 10 },
  // renderPaletteHoverPreview：
  // - 左侧组件面板 hover 时的预览卡片
  // - 用“更像真实组件”的静态布局，帮助用户在添加前理解组件形态
  renderPaletteHoverPreview: () => {
    return (
      <div className="w-[280px]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">正向提示词</span>
          </div>
          <span className="text-[10px] bg-accent text-primary px-2 py-0.5 rounded border border-border font-normal">AI润色</span>
        </div>
        <div className="border border-border rounded-md p-3 min-h-[60px] text-xs text-muted-foreground">
          请输入正向提示词
        </div>
      </div>
    );
  },
  createInitialRuntimeValue: (component) => (component as Extract<UiComponent, { type: "PositivePrompt" }>).basic?.params?.[0]?.defaultValue ?? "",
  collectDispatchParams: (component, values) => defaultCollectDispatchParamsForComponent(component, values),
  // renderCanvasPreview：
  // - 画布中的静态预览（偏“占位 + 识别”）
  // - 这里使用 Textarea 展示默认值/占位符，便于在画布中一眼看出这是提示词输入
  renderCanvasPreview: (component): ReactNode => {
    const c = component as Extract<UiComponent, { type: "PositivePrompt" }>;
    const def = c.basic?.params?.[0]?.defaultValue;
    const displayValue = def || "请输入正向提示词...";
    return (
      <div className="space-y-2">
        <Textarea rows={3} value={displayValue} readOnly />
      </div>
    );
  },
  // renderRuntimeField：
  // - 运行时表单中的真实输入控件
  // - 用户输入的提示词通过 onChange 写回运行时 value
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    return (
      <PositivePromptRuntimeField
        comp={comp as Extract<UiComponent, { type: "PositivePrompt" }>}
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
        LabelComp={LabelComp}
      />
    );
  },
  // renderExtEditor：
  // - 右侧属性面板：编辑该组件的扩展配置（c.ext）
  // - 这些配置通常影响运行时行为（如：前置追加提示词、是否启用 LLM/翻译、预设润色指令等）
  renderExtEditor: (component, onChange) => {
    const c = component as Extract<UiComponent, { type: "PositivePrompt" }>;
    return (
      <div className="space-y-4 mt-4 mx-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">启用LLM</span>
          <Switch checked={!!c.ext.enableLLM} onCheckedChange={(v) => onChange({ ...c, ext: { ...c.ext, enableLLM: v } })} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">启用翻译</span>
          <Switch checked={!!c.ext.enableTranslate} onCheckedChange={(v) => onChange({ ...c, ext: { ...c.ext, enableTranslate: v } })} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">启用自动翻译</span>
          <Switch
            checked={!!c.ext.enableAutoTranslate}
            onCheckedChange={(v) => onChange({ ...c, ext: { ...c.ext, enableAutoTranslate: v } })}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">前置追加正向提示词</label>
          <Input
            value={c.ext.prependPrompt ?? ""}
            onChange={(e) => onChange({ ...c, ext: { ...c.ext, prependPrompt: e.target.value } })}
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm text-primary font-medium">预设AI润色指令</label>
          <Textarea
            value={c.ext.aiPresetPrompt ?? ""}
            onChange={(e) => onChange({ ...c, ext: { ...c.ext, aiPresetPrompt: e.target.value } })}
            rows={4}
            className="text-sm text-primary"
          />
        </div>
      </div>
    );
  },
};
