import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronUp, Coins, Cpu, Search } from "lucide-react";
import { listModelHubCatalogPicker } from "@/shared/api/model-hub/model-hub";
import { getCapabilityRegistryCatalog } from "@/modules/modelhub/types/capabilityRegistryStore";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";
import type { UiComponent } from "../ui-schema";
import { defaultCollectDispatchParamsForComponent } from "./shared";
import type { UiComponentDefinition } from "./types";
import {
  formatPickerPriceLabel,
  modelMatchesQuery,
  modelPickerCatalogQueryKey,
  pickDefaultModel,
  toSelectorCatalog,
  type DisplayModel,
  type DisplayProvider,
} from "@/modules/workflow/runtime-model/catalog";

function pickerCapabilityOptions(): Array<{ value: string; label: string }> {
  return getCapabilityRegistryCatalog()
    .filter((item) => item.bucket !== "resource")
    .map((item) => ({ value: item.code, label: item.label }));
}

function pickerCapabilityLabel(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return "";
  return pickerCapabilityOptions().find((item) => item.value === trimmed)?.label || trimmed;
}

function hashHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function ModelGlyph({ seed, className }: { seed: string; className?: string }) {
  const hue = hashHue(seed || "model");
  return (
    <div
      className={cn(
        "mt-0.5 flex h-7 w-7 shrink-0 items-end justify-center gap-0.5 rounded-md border border-border/80 bg-background px-1 py-1",
        className,
      )}
    >
      <span className="w-1 rounded-sm" style={{ height: "42%", background: `hsl(${hue} 72% 58%)` }} />
      <span className="w-1 rounded-sm" style={{ height: "68%", background: `hsl(${(hue + 18) % 360} 70% 62%)` }} />
      <span className="w-1 rounded-sm" style={{ height: "100%", background: `hsl(${(hue + 36) % 360} 74% 48%)` }} />
    </div>
  );
}

function NewBadge() {
  return (
    <span className="rounded px-1 py-px text-[10px] font-semibold uppercase leading-none bg-emerald-50 text-emerald-600">
      NEW
    </span>
  );
}

function RecommendedBadge() {
  return (
    <span className="rounded-full bg-orange-50 px-1.5 py-px text-[11px] leading-[16px] text-orange-500">推荐</span>
  );
}

function PriceBadge({
  model,
}: {
  model: Pick<DisplayModel, "pricing"> | null | undefined;
}) {
  const label = formatPickerPriceLabel(model);
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-px text-[11px] leading-[16px] text-muted-foreground">
      <Coins className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function CapabilityBadge({ capability }: { capability: string }) {
  return (
    <span className="rounded-full bg-muted px-1.5 py-px text-[11px] leading-[16px] text-muted-foreground">
      {pickerCapabilityLabel(capability)}
    </span>
  );
}

function ModelSummary(props: {
  title: string;
  description?: string | null;
  glyphSeed: string;
  tags?: ReactNode;
}) {
  return (
    <>
      <ModelGlyph seed={props.glyphSeed} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium leading-5 text-foreground">{props.title}</div>
        {props.tags ? <div className="mt-1 flex flex-wrap items-center gap-1">{props.tags}</div> : null}
        {props.description ? (
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-[18px] text-muted-foreground">{props.description}</p>
        ) : null}
      </div>
    </>
  );
}

function readConfiguredDefault(component: Extract<UiComponent, { type: "LlmModelSelector" }>): string {
  return (component.basic?.params?.[0]?.defaultValue ?? "").trim();
}

function withConfiguredDefault(
  component: Extract<UiComponent, { type: "LlmModelSelector" }>,
  modelId: string,
): Extract<UiComponent, { type: "LlmModelSelector" }> {
  const existing = component.basic?.params ?? [];
  const params =
    existing.length === 0
      ? [{ name: "model", inputKey: "model", nodeId: "", required: false, defaultValue: modelId, marks: {} }]
      : existing.map((param, index) => (index === 0 ? { ...param, defaultValue: modelId } : param));
  return {
    ...component,
    basic: { ...component.basic, params },
  };
}

function useLlmModelCatalog(capability: string) {
  return useQuery({
    queryKey: modelPickerCatalogQueryKey(capability),
    queryFn: () => listModelHubCatalogPicker(capability),
    enabled: !!capability,
    staleTime: 60_000,
  });
}

function LlmModelSelectorControl(props: {
  capability: string;
  value: string;
  onChange: (next: string) => void;
  interactive?: boolean;
  autoFill?: boolean;
}) {
  const catalogQuery = useLlmModelCatalog(props.capability);
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [providerId, setProviderId] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const catalog = useMemo(
    () => toSelectorCatalog(catalogQuery.data),
    [catalogQuery.data],
  );

  const selected = useMemo(
    () => catalog.models.find((item) => item.code === props.value),
    [catalog.models, props.value],
  );

  const autoFill = props.autoFill ?? props.interactive !== false;

  useEffect(() => {
    if (!autoFill) return;
    if (props.value.trim()) return;
    const fallback = pickDefaultModel(catalog.models);
    if (fallback?.code) props.onChange(fallback.code);
  }, [autoFill, catalog.models, props.onChange, props.value]);

  const filteredModels = useMemo(
    () => catalog.models.filter((item) => modelMatchesQuery(item, keyword)),
    [catalog.models, keyword],
  );

  const visibleProviders = useMemo(() => {
    if (!keyword.trim()) return catalog.providers;
    const matchedProviderIds = new Set(filteredModels.map((item) => item.providerId));
    return catalog.providers.filter((item) => matchedProviderIds.has(item.id));
  }, [catalog.providers, filteredModels, keyword]);

  useEffect(() => {
    if (visibleProviders.length === 0) {
      setProviderId("");
      return;
    }
    setProviderId((current) => {
      if (current && visibleProviders.some((item) => item.id === current)) return current;
      if (selected?.providerId && visibleProviders.some((item) => item.id === selected.providerId)) {
        return selected.providerId;
      }
      return visibleProviders[0]?.id ?? "";
    });
  }, [selected?.providerId, visibleProviders]);

  const providerModels = useMemo(
    () =>
      filteredModels.filter((item) => item.providerId === providerId),
    [filteredModels, providerId],
  );

  const emptyText = catalogQuery.isLoading
    ? "加载模型中..."
    : catalogQuery.isError
      ? "模型目录加载失败"
      : keyword.trim()
        ? "未找到匹配模型"
        : "暂无可用模型";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (props.interactive === false) return;
        setOpen(next);
        if (next && selected?.providerId) {
          setProviderId(selected.providerId);
        }
        if (!next) setKeyword("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={props.interactive === false}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "flex w-full items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors",
            "hover:border-foreground/20 hover:bg-muted/30",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            "disabled:cursor-default disabled:hover:border-border disabled:hover:bg-background",
            "data-[state=open]:border-foreground/25 data-[state=open]:bg-muted/20",
          )}
        >
          <ModelSummary
            title={selected?.displayName || (props.value.trim() ? props.value : catalogQuery.isLoading ? "加载模型中..." : "请选择模型")}
            description={
              selected?.description
              || (catalogQuery.isError
                ? "模型目录加载失败，请稍后重试。"
                : `请选择具备「${pickerCapabilityLabel(props.capability)}」能力的基础模型。`)
            }
            glyphSeed={selected?.code || selected?.name || "model"}
            tags={
              <>
                <CapabilityBadge capability={props.capability} />
                {selected?.isRecommended ? <RecommendedBadge /> : null}
                <PriceBadge model={selected} />
              </>
            }
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[min(560px,calc(100vw-24px))] p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-[420px] flex-col">
          <div className="border-b border-border px-3 py-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索模型..."
                className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button type="button" className="text-muted-foreground" onClick={() => setOpen(false)} aria-label="收起">
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1">
            <aside className="w-[148px] shrink-0 overflow-y-auto border-r border-border py-2">
              <div className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground">MODELS</div>
              {visibleProviders.length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground">{emptyText}</div>
              ) : (
                visibleProviders.map((provider) => (
                  <ProviderRow
                    key={provider.id}
                    provider={provider}
                    active={provider.id === providerId}
                    onSelect={() => setProviderId(provider.id)}
                  />
                ))
              )}
            </aside>
            <div className="min-w-0 flex-1 overflow-y-auto p-2">
              {providerModels.length === 0 ? (
                <div className="px-2 py-8 text-center text-sm text-muted-foreground">{emptyText}</div>
              ) : (
                providerModels.map((model) => (
                  <ModelRow
                    key={model.id || model.code}
                    model={model}
                    active={model.code === props.value}
                    onSelect={() => {
                      props.onChange(model.code);
                      setOpen(false);
                      setKeyword("");
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ProviderRow(props: { provider: DisplayProvider; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onSelect}
      className={cn(
        "relative flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
        props.active ? "bg-muted font-medium text-foreground" : "text-foreground/80 hover:bg-muted/60",
      )}
    >
      {props.active ? <span className="absolute inset-y-0 left-0 w-0.5 bg-foreground" /> : null}
      {props.provider.logoUrl ? (
        <img src={props.provider.logoUrl} alt="" className="h-4 w-4 rounded-sm object-contain" />
      ) : (
        <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-muted text-[10px] font-semibold text-muted-foreground">
          {props.provider.label.slice(0, 1)}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{props.provider.label}</span>
      {props.provider.isNew ? <NewBadge /> : null}
    </button>
  );
}

function ModelRow(props: {
  model: DisplayModel;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onSelect}
      className={cn(
        "mb-1 flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left",
        props.active ? "bg-muted" : "hover:bg-muted/60",
      )}
    >
      <ModelSummary
        title={props.model.displayName}
        description={props.model.description}
        glyphSeed={props.model.code || props.model.name}
        tags={
          <>
            {props.model.isNew ? <NewBadge /> : null}
            {props.model.isRecommended ? <RecommendedBadge /> : null}
            <PriceBadge model={props.model} />
          </>
        }
      />
    </button>
  );
}

function LlmModelSelectorCanvasPreview({ comp }: { comp: Extract<UiComponent, { type: "LlmModelSelector" }> }) {
  const capability = (comp.ext.capability ?? "").trim();
  const configured = readConfiguredDefault(comp);
  const [value, setValue] = useState(configured);
  useEffect(() => {
    setValue(configured);
  }, [capability, configured]);
  return (
    <LlmModelSelectorControl
      key={capability}
      capability={capability}
      value={value}
      onChange={setValue}
    />
  );
}

function LlmModelSelectorRuntimeField(props: {
  component: Extract<UiComponent, { type: "LlmModelSelector" }>;
  value: unknown;
  onChange: (next: unknown) => void;
  LabelComp: () => ReactNode;
}) {
  const capability = (props.component.ext.capability ?? "").trim();
  const configured = readConfiguredDefault(props.component);
  const selected = typeof props.value === "string" && props.value.trim() ? props.value : configured;

  useEffect(() => {
    if ((props.value == null || props.value === "") && selected) {
      props.onChange(selected);
    }
  }, [props.onChange, props.value, selected]);

  return (
    <div className="space-y-2">
      <props.LabelComp />
      <LlmModelSelectorControl
        key={capability}
        capability={capability}
        value={selected}
        onChange={props.onChange}
      />
    </div>
  );
}

function LlmModelSelectorExtEditor(props: {
  component: Extract<UiComponent, { type: "LlmModelSelector" }>;
  onChange: (next: UiComponent) => void;
}) {
  const capability = (props.component.ext.capability ?? "").trim();
  const configuredDefault = readConfiguredDefault(props.component);
  return (
    <div className="space-y-3 mt-4 mx-2">
      <div className="space-y-1.5">
        <label className="text-sm text-muted-foreground">模型能力</label>
        <Select
          value={capability}
          onValueChange={(nextValue) => {
            props.onChange({
              ...withConfiguredDefault(props.component, ""),
              ext: { ...props.component.ext, capability: nextValue },
            });
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pickerCapabilityOptions().map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          按能力筛选文本、图像、3D、视频、语音等基础模型。
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm text-muted-foreground">默认模型</label>
          {configuredDefault ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => props.onChange(withConfiguredDefault(props.component, ""))}
            >
              清除
            </Button>
          ) : null}
        </div>
        <LlmModelSelectorControl
          key={capability}
          capability={capability}
          value={configuredDefault}
          onChange={(next) => props.onChange(withConfiguredDefault(props.component, next))}
          autoFill={false}
        />
      </div>
    </div>
  );
}

function createPreviewModel(): DisplayModel {
  return {
    id: "preview",
    code: "preview-model",
    name: "示例模型",
    providerId: "preview-provider",
    providerCode: "preview",
    description: "按模型能力筛选文本、图像、视频、3D 或语音基础模型。",
    status: "enabled",
    createdAt: "2026-05-20T10:14:12+08:00",
    pricing: { unitPrice: 1.2, pricingUnit: "token", quantityKey: null, rateCard: [] },
    displayName: "示例模型",
    providerLabel: "示例厂商",
    isNew: false,
    isRecommended: true,
  };
}

export const llmModelSelectorDefinition: UiComponentDefinition = {
  type: "LlmModelSelector",
  iconName: "cpu",
  palette: { id: "llm-model-selector", label: "选择模型", category: "选择", badge: "Biz", order: 35 },
  renderPaletteHoverPreview: () => {
    const preview = createPreviewModel();
    return (
      <div className="w-[360px]">
        <div className="mb-3 flex items-center gap-1.5">
          <Cpu className="h-4 w-4 text-foreground" />
          <span className="text-sm font-medium text-foreground">选择模型</span>
          <span className="text-[11px] text-muted-foreground">文本 / 图像 / 视频 / 3D</span>
        </div>
        <div className="flex w-full items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
          <ModelSummary
            title={preview.displayName}
            description={preview.description}
            glyphSeed={preview.code}
            tags={
              <>
                <CapabilityBadge capability="text_generation" />
                <RecommendedBadge />
                <PriceBadge model={preview} />
              </>
            }
          />
        </div>
      </div>
    );
  },
  createInitialRuntimeValue: (component) => {
    const current = component as Extract<UiComponent, { type: "LlmModelSelector" }>;
    return readConfiguredDefault(current);
  },
  collectDispatchParams: (component, values) => defaultCollectDispatchParamsForComponent(component, values),
  renderCanvasPreview: (component): ReactNode => {
    return <LlmModelSelectorCanvasPreview comp={component as Extract<UiComponent, { type: "LlmModelSelector" }>} />;
  },
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    return (
      <LlmModelSelectorRuntimeField
        component={comp as Extract<UiComponent, { type: "LlmModelSelector" }>}
        value={value}
        onChange={onChange}
        LabelComp={LabelComp}
      />
    );
  },
  renderExtEditor: (component, onChange) => {
    return (
      <LlmModelSelectorExtEditor
        component={component as Extract<UiComponent, { type: "LlmModelSelector" }>}
        onChange={onChange}
      />
    );
  },
};
