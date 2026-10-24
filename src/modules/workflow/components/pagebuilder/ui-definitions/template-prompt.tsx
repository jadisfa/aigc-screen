import type { ClipboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import type { TemplatePromptVar, UiComponent } from "../ui-schema";
import { defaultCollectDispatchParamsForComponent } from "./shared";
import { OptionsTextarea } from "./shared-components";
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

export function TemplatePromptRuntimeField({
  comp,
  value,
  onChange,
  LabelComp,
}: {
  comp: Extract<UiComponent, { type: "TemplatePrompt" }>;
  value: string;
  onChange: (v: string) => void;
  LabelComp?: () => ReactNode;
}) {
  const template = comp.ext?.template || "";
  const vars = useMemo<TemplatePromptVar[]>(() => comp.ext?.vars || [], [comp.ext?.vars]);
  const editorWrapRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedTemplateKeyRef = useRef<string>("");
  const lastEmittedValueRef = useRef(value);

  const { parts } = useMemo(() => {
    const regex = /\{\{([^}]+)\}\}/g;
    const out: { type: "text" | "var"; content: string }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(template)) !== null) {
      if (match.index > lastIndex) {
        out.push({ type: "text", content: template.substring(lastIndex, match.index) });
      }
      out.push({ type: "var", content: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < template.length) {
      out.push({ type: "text", content: template.substring(lastIndex) });
    }
    return { parts: out };
  }, [template]);

  const defaultSelectedValues = useMemo(() => {
    const init: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== "var") continue;
      init[p.content] = p.content;
    }
    return init;
  }, [parts]);

  const [selectedValues, setSelectedValues] = useState<Record<string, string>>(defaultSelectedValues);
  const [activeMenu, setActiveMenu] = useState<{ varName: string; top: number; left: number } | null>(null);
  const [isEditorEmpty, setIsEditorEmpty] = useState(!value);

  const templateKey = useMemo(
    () => JSON.stringify({ template, vars: vars.map((item) => ({ name: item.name, options: item.options })) }),
    [template, vars],
  );

  const serializeEditorText = useCallback(() => {
    const text = editorRef.current?.innerText ?? "";
    return text.replace(/\u00a0/g, " ").replace(/\n$/, "");
  }, []);

  const updateEmptyState = useCallback(() => {
    const nextText = serializeEditorText();
    setIsEditorEmpty(!nextText.trim());
  }, [serializeEditorText]);

  const setEditorPlainText = useCallback(
    (text: string) => {
      if (!editorRef.current) return;
      editorRef.current.textContent = text;
      updateEmptyState();
      lastEmittedValueRef.current = text;
    },
    [updateEmptyState],
  );

  const inferSelectionsFromValue = useCallback(
    (currentValue: string) => {
      if (!currentValue || parts.length === 0) return null;
      const inferred: Record<string, string> = {};
      let cursor = 0;

      for (let index = 0; index < parts.length; index += 1) {
        const part = parts[index];
        if (part.type === "text") {
          if (!currentValue.startsWith(part.content, cursor)) {
            return null;
          }
          cursor += part.content.length;
          continue;
        }

        let nextStaticText = "";
        for (let nextIndex = index + 1; nextIndex < parts.length; nextIndex += 1) {
          const nextPart = parts[nextIndex];
          if (nextPart.type === "text" && nextPart.content) {
            nextStaticText = nextPart.content;
            break;
          }
        }

        if (!nextStaticText) {
          inferred[part.content] = currentValue.slice(cursor);
          cursor = currentValue.length;
          continue;
        }

        const nextStaticIndex = currentValue.indexOf(nextStaticText, cursor);
        if (nextStaticIndex < 0) {
          return null;
        }
        inferred[part.content] = currentValue.slice(cursor, nextStaticIndex);
        cursor = nextStaticIndex;
      }

      return inferred;
    },
    [parts],
  );

  const renderTemplateIntoEditor = useCallback(
    (valuesMap: Record<string, string>) => {
      if (!editorRef.current) return;
      const fragment = document.createDocumentFragment();

      for (const part of parts) {
        if (part.type === "text") {
          fragment.appendChild(document.createTextNode(part.content));
          continue;
        }

        const span = document.createElement("span");
        span.dataset.templateVar = part.content;
        span.contentEditable = "false";
        span.className =
          "mx-0.5 inline-flex cursor-pointer rounded-sm px-0.5 font-medium text-primary underline decoration-primary/30 underline-offset-2";
        span.textContent = valuesMap[part.content] || part.content;
        fragment.appendChild(span);
      }

      editorRef.current.replaceChildren(fragment);
      updateEmptyState();
      lastEmittedValueRef.current = serializeEditorText();
    },
    [parts, serializeEditorText, updateEmptyState],
  );

  const openMenuForSpan = useCallback((span: HTMLElement) => {
    if (!editorWrapRef.current) return;
    const varName = span.dataset.templateVar;
    if (!varName) return;

    const spanRect = span.getBoundingClientRect();
    const wrapRect = editorWrapRef.current.getBoundingClientRect();
    setActiveMenu({
      varName,
      top: spanRect.bottom - wrapRect.top + 6,
      left: spanRect.left - wrapRect.left,
    });
  }, []);

  const emitCurrentEditorValue = useCallback(() => {
    const nextText = serializeEditorText();
    lastEmittedValueRef.current = nextText;
    updateEmptyState();
    onChange(nextText);
  }, [onChange, serializeEditorText, updateEmptyState]);

  const handleSelect = useCallback(
    (varName: string, option: string) => {
      if (!editorRef.current) return;

      const variableSpans = Array.from(editorRef.current.querySelectorAll<HTMLElement>("[data-template-var]")).filter(
        (element) => element.dataset.templateVar === varName,
      );
      variableSpans.forEach((element) => {
        element.textContent = option;
      });

      setSelectedValues((prev) => ({ ...prev, [varName]: option }));
      setActiveMenu(null);
      emitCurrentEditorValue();
      editorRef.current.focus();
    },
    [emitCurrentEditorValue],
  );
  const [isPolishing, setIsPolishing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const enableLLM = !!comp.ext?.enableLLM;
  const enableTranslate = !!comp.ext?.enableTranslate;

  const handlePolish = async () => {
    const currentText = serializeEditorText() || value;
    if (!currentText) {
      notify.error("请先组合模板提示词");
      return;
    }
    setIsPolishing(true);
    const previousValue = currentText;
    try {
      const messages: SessionChatMessage[] = [];
      const systemPrompt = comp.ext?.aiPresetPrompt || comp.ext?.prependPrompt;
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: currentText });

      let currentResult = "";
      setActiveMenu(null);
      setEditorPlainText("");
      onChange("");

      await sessionChatCompletionsStream(
        { messages },
        (token) => {
          currentResult += token;
          setEditorPlainText(currentResult);
          onChange(currentResult);
        },
        BIZ_CAPABILITY_CODES.WORKFLOW_UI_LLM
      );

      notify.success("AI润色成功", { description: "提示词已更新" });
    } catch (e: unknown) {
      console.error("AI Polish Error:", e);
      setEditorPlainText(previousValue);
      onChange(previousValue);
      const notice = resolvePolishErrorNotice(e);
      notify.error(notice.title, { description: notice.description });
    } finally {
      setIsPolishing(false);
    }
  };

  const handleTranslate = async () => {
    const currentText = serializeEditorText() || value;
    if (!currentText) {
      notify.error("请先组合模板提示词");
      return;
    }
    setIsTranslating(true);
    try {
      const result = await translateText(currentText);
      setActiveMenu(null);
      setEditorPlainText(result);
      onChange(result);
      notify.success("翻译成功", { description: "内容已翻译为英文" });
    } catch (e: unknown) {
      console.error("Translate Error:", e);
      notify.error("翻译失败", { description: getErrorMessage(e) });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleEditorPaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
      emitCurrentEditorValue();
    },
    [emitCurrentEditorValue],
  );

  useEffect(() => {
    setSelectedValues(defaultSelectedValues);
  }, [defaultSelectedValues]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (initializedTemplateKeyRef.current === templateKey) return;

    initializedTemplateKeyRef.current = templateKey;
    const inferredSelections = inferSelectionsFromValue(value);
    if (inferredSelections) {
      const nextSelections = { ...defaultSelectedValues, ...inferredSelections };
      setSelectedValues(nextSelections);
      renderTemplateIntoEditor(nextSelections);
      return;
    }

    if (parts.length > 0 && !value) {
      renderTemplateIntoEditor(defaultSelectedValues);
      const nextText = serializeEditorText();
      if (nextText) {
        lastEmittedValueRef.current = nextText;
        onChange(nextText);
      }
      return;
    }

    setEditorPlainText(value || "");
  }, [
    defaultSelectedValues,
    inferSelectionsFromValue,
    onChange,
    parts.length,
    renderTemplateIntoEditor,
    serializeEditorText,
    setEditorPlainText,
    templateKey,
    value,
  ]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (document.activeElement === editorRef.current) return;
    if (value === lastEmittedValueRef.current) return;

    const inferredSelections = inferSelectionsFromValue(value);
    if (inferredSelections) {
      const nextSelections = { ...defaultSelectedValues, ...inferredSelections };
      setSelectedValues(nextSelections);
      renderTemplateIntoEditor(nextSelections);
      return;
    }

    setEditorPlainText(value || "");
  }, [defaultSelectedValues, inferSelectionsFromValue, renderTemplateIntoEditor, setEditorPlainText, value]);

  return (
    <div className="space-y-2 relative hover:z-50 z-10" onClick={(e) => e.stopPropagation()}>
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
      <div
        ref={editorWrapRef}
        className="relative"
        onMouseOverCapture={(event) => {
          const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-template-var]") : null;
          if (target) {
            openMenuForSpan(target);
          }
        }}
        onMouseLeave={() => setActiveMenu(null)}
      >
        <div
          ref={editorRef}
          contentEditable={!isPolishing && !isTranslating}
          suppressContentEditableWarning
          spellCheck={false}
          className="workflow-form-textarea min-h-[104px] whitespace-pre-wrap break-words px-3 py-3 text-sm leading-relaxed"
          onInput={emitCurrentEditorValue}
          onPaste={handleEditorPaste}
          onClickCapture={(event) => {
            const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-template-var]") : null;
            if (target) {
              event.preventDefault();
              openMenuForSpan(target);
            }
          }}
        />
        {isEditorEmpty && (
          <div className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">请输入提示词</div>
        )}
        {activeMenu && (
          <div
            className="absolute z-50 min-w-[140px] overflow-hidden rounded-md border border-border bg-popover py-1 shadow-md"
            style={{ top: activeMenu.top, left: activeMenu.left }}
            onMouseDown={(event) => event.preventDefault()}
          >
            {(vars.find((item) => item.name === activeMenu.varName)?.options || []).length > 0 ? (
              (vars.find((item) => item.name === activeMenu.varName)?.options || []).map((option) => (
                <button
                  key={option}
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleSelect(activeMenu.varName, option)}
                >
                  {option}
                </button>
              ))
            ) : (
              <div className="px-3 py-1.5 text-xs text-muted-foreground">暂无选项</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const templatePromptDefinition: UiComponentDefinition = {
  type: "TemplatePrompt",
  iconName: "file-text",
  palette: { id: "prompt-tpl", label: "提示词模板", category: "提示词", badge: "Biz", order: 20 },
  // renderPaletteHoverPreview：
  // - 左侧组件面板 hover 预览
  // - 用“示例模板片段”展示该组件的用途：通过模板快速拼装提示词
  renderPaletteHoverPreview: () => {
    return (
      <div className="w-[300px]">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-4 h-4 text-foreground" />
          <span className="text-sm font-medium text-foreground">根据模版构建轻松构建您的提示词</span>
        </div>
        <div className="border border-border rounded-lg p-3 bg-background">
          <p className="text-sm leading-relaxed text-foreground">
            一个<span className="text-primary font-normal">人物特征</span>走在大街上，
            <span className="text-primary font-normal">人物动作</span>，景别
            <span className="text-primary font-normal">运镜方式</span>，
            <span className="text-primary font-normal">画面细节</span>
          </p>
        </div>
      </div>
    );
  },
  // createInitialRuntimeValue：
  // - 根据模板生成默认提示词（value）
  // - 若配置了 basic.params[0].defaultValue 则优先使用；否则按模板中 {{var}} 直接展示变量名本身
  createInitialRuntimeValue: (component) => {
    const c = component as Extract<UiComponent, { type: "TemplatePrompt" }>;
    const def = c.basic?.params?.[0]?.defaultValue;
    if (def) return def;
    const template = c.ext?.template || "";
    const regex = /\{\{([^}]+)\}\}/g;
    let finalStr = "";
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(template)) !== null) {
      finalStr += template.substring(lastIndex, match.index);
      const varName = match[1];
      finalStr += varName;
      lastIndex = match.index + match[0].length;
    }
    finalStr += template.substring(lastIndex);
    return finalStr;
  },
  collectDispatchParams: (component, values) => defaultCollectDispatchParamsForComponent(component, values),
  // renderCanvasPreview：
  // - 画布中的静态预览
  // - 复用运行时组件的 UI 形态，帮助在画布中识别组件结构（这里传入空 value/onChange，仅用于展示）
  renderCanvasPreview: (component): ReactNode => {
    return <TemplatePromptRuntimeField comp={component as Extract<UiComponent, { type: "TemplatePrompt" }>} value="" onChange={() => {}} />;
  },
  // renderRuntimeField：
  // - 运行时表单中的真实输入控件
  // - TemplatePromptRuntimeField 内部负责：解析模板、渲染可点击的变量片段、以及将选择结果拼回最终提示词字符串
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    const c = comp as Extract<UiComponent, { type: "TemplatePrompt" }>;
    return (
      <TemplatePromptRuntimeField
        comp={c}
        value={typeof value === "string" ? value : ""}
        onChange={(v) => onChange(v)}
        LabelComp={LabelComp}
      />
    );
  },
  // renderExtEditor：
  // - 右侧属性面板扩展配置
  // - 用于编辑模板（c.ext.template）和变量字典（c.ext.vars），从而影响运行时拼装逻辑与 UI 展示
  renderExtEditor: (component, onChange) => {
    const c = component as Extract<UiComponent, { type: "TemplatePrompt" }>;
    const vars: TemplatePromptVar[] = c.ext.vars ?? [];
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
          <label className="text-sm text-muted-foreground">动态提示词模板</label>
          <Textarea value={c.ext.template} onChange={(e) => onChange({ ...c, ext: { ...c.ext, template: e.target.value } })} rows={4} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">动态字典</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const next = [...vars, { name: "变量", options: ["选项1"] }];
              onChange({ ...c, ext: { ...c.ext, vars: next } });
            }}
          >
            <Plus className="w-4 h-4" />
            添加
          </Button>
        </div>

        {vars.map((v, idx) => (
          <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">变量 {idx + 1}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  const next = vars.filter((_, i) => i !== idx);
                  onChange({ ...c, ext: { ...c.ext, vars: next } });
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">变量名</label>
              <Input
                value={v.name}
                onChange={(e) => {
                  const next = vars.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x));
                  onChange({ ...c, ext: { ...c.ext, vars: next } });
                }}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">选项（每行一个）</label>
              <OptionsTextarea
                options={v.options ?? []}
                onChange={(options) => {
                  const next = vars.map((x, i) => (i === idx ? { ...x, options } : x));
                  onChange({ ...c, ext: { ...c.ext, vars: next } });
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  },
};
