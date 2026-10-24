import type { ReactNode } from "react";
import { useMemo } from "react";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { Dices } from "lucide-react";
import type { UiComponent } from "../ui-schema";
import type { UiComponentDefinition } from "./types";
import { getParamAlias } from "../param-utils";
import { readRuntimeComponentValue } from "./shared";

export function SeedRuntimeField({
  comp,
  value,
  onChange,
}: {
  comp: Extract<UiComponent, { type: "Seed" }>;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const seedLength = comp.ext?.seedLength || 9;

  const parsed = useMemo(() => {
    let seedStr = "";
    let fixed = false;
    if (typeof value === "object" && value !== null) {
      seedStr = String((value as { seed?: unknown }).seed ?? "");
      fixed = (value as { fixed?: unknown }).fixed === true;
    } else if (typeof value === "string" || typeof value === "number") {
      seedStr = String(value);
      fixed = true;
    }
    return { seedStr, fixed };
  }, [value]);

  const handleRefresh = () => {
    let s = "";
    for (let i = 0; i < seedLength; i++) {
      s += Math.floor(Math.random() * 10).toString();
    }
    onChange({ seed: s, fixed: false });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            className="workflow-form-input font-mono pr-10"
            value={parsed.seedStr}
            onChange={(e) => onChange({ seed: e.target.value, fixed: true })}
            placeholder="请输入随机种子"
          />
          <button
            type="button"
            disabled={parsed.fixed}
            className={`absolute right-0 top-0 bottom-0 px-3 flex items-center justify-center text-muted-foreground ${
              parsed.fixed ? "opacity-50 cursor-not-allowed" : "hover:text-foreground"
            }`}
            onClick={handleRefresh}
          >
            <Dices className="w-4 h-4" />
          </button>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                <Checkbox
                  checked={parsed.fixed}
                  onCheckedChange={(c) => onChange({ seed: parsed.seedStr, fixed: c === true })}
                  className="w-5 h-5 rounded-md"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>固定随机种子</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

export const seedDefinition: UiComponentDefinition = {
  type: "Seed",
  iconName: "seed",
  palette: { id: "seed", label: "随机种子", category: "基础", order: 10 },
  // renderPaletteHoverPreview：
  // - 左侧组件面板 hover 预览
  // - 这里使用“接近真实控件”的静态布局，快速传达该组件形态（输入框 + 随机按钮 + 固定开关）
  renderPaletteHoverPreview: () => {
    return (
      <div className="w-[260px]">
        <div className="flex items-center gap-1.5 mb-2">
          <Dices className="w-4 h-4 text-foreground" />
          <span className="text-sm font-medium text-foreground">随机种子</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-9 rounded-md border border-input bg-background px-3 flex items-center text-sm text-muted-foreground">
            610538102
          </div>
          <button className="h-9 w-9 rounded-md border border-input bg-background flex items-center justify-center hover:bg-accent transition-colors">
            <Dices className="w-4 h-4 text-foreground" />
          </button>
          <div className="w-4 h-4 rounded border border-input bg-background" />
        </div>
      </div>
    );
  },
  // createInitialRuntimeValue：
  // - 为运行时 value 提供初始值
  // - 若配置了默认值则固定；否则生成一个随机种子并标记为非固定（fixed=false）
  createInitialRuntimeValue: (component) => {
    const c = component as Extract<UiComponent, { type: "Seed" }>;
    const def = c.basic?.params?.[0]?.defaultValue;
    if (def) return { seed: def, fixed: true };
    const len = c.ext?.seedLength || 9;
    let s = "";
    for (let i = 0; i < len; i++) {
      s += Math.floor(Math.random() * 10).toString();
    }
    return { seed: s, fixed: false };
  },
  // prepareRuntimeValueBeforeDispatch：
  // - 在提交/运行工作流前对 value 做一次“按规则补全”
  // - 当 fixed=false 时，这里会重新生成一个随机种子，确保每次运行都不同
  prepareRuntimeValueBeforeDispatch: (component, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const c = component as Extract<UiComponent, { type: "Seed" }>;
    const fixed = (value as { fixed?: unknown }).fixed === true;
    if (fixed) return undefined;
    const len = c.ext?.seedLength || 9;
    let s = "";
    for (let i = 0; i < len; i++) {
      s += Math.floor(Math.random() * 10).toString();
    }
    return { seed: s, fixed: false };
  },
  // collectDispatchParams：
  // - 将运行时 value 组装成后端/调度所需的参数
  // - 这里把 {seed, fixed} 结构转换为最终 seed 数值（或字符串），并写入 basic.params[0].name 对应的 key
  collectDispatchParams: (component, values) => {
    const params = component.basic?.params ?? [];
    const key0 = getParamAlias(params[0]);
    if (!key0) return {};

    const readSeedObject = (v: unknown): { seed: string; fixed: boolean } | null => {
      if (typeof v !== "object" || v == null) return null;
      const seed = (v as { seed?: unknown }).seed;
      const fixed = (v as { fixed?: unknown }).fixed;
      return {
        seed: seed == null ? "" : String(seed),
        fixed: fixed === true,
      };
    };

    const val = readRuntimeComponentValue(component, values).value;
    let seedValue = "";

    const parsed = readSeedObject(val);
    if (parsed) {
      seedValue = parsed.seed || "";
    } else if (val !== undefined && val !== "") {
      seedValue = String(val);
    }

    if (!seedValue || seedValue === "-1") {
      return {};
    }
    const numSeed = Number(seedValue);
    return { [key0]: Number.isFinite(numSeed) ? numSeed : seedValue };
  },
  // renderCanvasPreview：
  // - 画布中的静态预览
  // - 仅用于展示组件外观与配置，不承载真实交互（真实交互在 renderRuntimeField）
  renderCanvasPreview: (component): ReactNode => {
    const c = component as Extract<UiComponent, { type: "Seed" }>;
    const def = c.basic?.params?.[0]?.defaultValue;
    const displayValue = def || "123456789";
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input value={displayValue} className="h-9 font-mono pr-10" readOnly />
            <button
              type="button"
              disabled
              className="absolute right-0 top-0 bottom-0 px-3 flex items-center justify-center text-muted-foreground opacity-50 cursor-not-allowed"
            >
              <Dices className="w-4 h-4" />
            </button>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <Checkbox className="w-5 h-5 rounded-md" disabled />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>固定随机种子</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    );
  },
  // renderRuntimeField：
  // - 运行时表单中的真实输入控件
  // - 复用 SeedRuntimeField，实现“输入 seed / 切换 fixed / 点击生成随机”的交互
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    const c = comp as Extract<UiComponent, { type: "Seed" }>;
    return (
      <div className="space-y-2">
        <LabelComp />
        <SeedRuntimeField comp={c} value={value} onChange={onChange} />
      </div>
    );
  },
  // renderExtEditor：
  // - 右侧属性面板扩展配置
  // - 用于编辑 c.ext.seedLength（随机种子长度），影响随机生成逻辑
  renderExtEditor: (component, onChange) => {
    const c = component as Extract<UiComponent, { type: "Seed" }>;
    return (
      <div className="space-y-1.5 mt-4 mx-2">
        <label className="text-sm text-muted-foreground">随机种子长度</label>
        <Input
          value={String(c.ext.seedLength)}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange({ ...c, ext: { ...c.ext, seedLength: Number.isFinite(v) ? v : c.ext.seedLength } });
          }}
          className="h-9"
        />
      </div>
    );
  },
};
