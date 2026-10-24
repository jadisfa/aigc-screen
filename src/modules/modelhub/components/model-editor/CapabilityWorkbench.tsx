import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { CapabilityFieldRendererEngine } from "@/modules/modelhub/components/capability-fields";
import {
  getCapabilityFieldValue,
  resolveCapabilitySectionKey,
} from "@/modules/modelhub/types/capabilityConfigUtils";
import type {
  CapabilityConfigSectionKey,
  CapabilityOverview,
  CapabilitySectionDefinition,
  ModelCapabilityConfig,
  ModelCapabilityCode,
} from "@/modules/modelhub/types/modelCapabilityMetadata";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { CapabilityDetailTabId } from "@/modules/modelhub/components/model-editor/modelEditorTypes";

const CAPABILITY_TAB_LABELS: Record<CapabilityDetailTabId, string> = {
  default: "默认配置",
  capability: "能力配置",
  pricing: "定价配置",
};

function toChineseCapabilityValidationIssue(issue: string): string {
  const normalized = issue.trim();
  const exactMessages: Record<string, string> = {
    "Current capability package does not provide pricing templates.": "当前能力包未提供可用的定价模板。",
    "Base price must be greater than 0.": "基础价格必须大于 0。",
    "Pricing unit is required.": "请输入定价单位。",
    "Currency is required.": "请选择币种。",
    "At least one supported GPU type is required.": "至少需要配置一种支持的 GPU 类型。",
    "Max GPU memory must be greater than 0.": "GPU 最大显存必须大于 0。",
    "Default GPU type must be included in supported GPU types.": "默认 GPU 类型必须包含在支持的 GPU 类型中。",
    "Default resolution must be included in supported resolutions.": "默认分辨率必须包含在支持分辨率中。",
    "Default frame rate must be included in supported frame rates.": "默认帧率必须包含在支持帧率中。",
    "Default duration cannot exceed the boundary max duration.": "默认时长不能超过能力边界中配置的最大时长。",
  };

  if (exactMessages[normalized]) {
    return exactMessages[normalized];
  }

  const templateNotRegistered = normalized.match(/^Template (.+) is not registered by the current capability package\.$/);
  if (templateNotRegistered) {
    return `模板 ${templateNotRegistered[1]} 未在当前能力包中注册。`;
  }

  const ruleMissingMetric = normalized.match(/^Rule (\d+) is missing a billing metric\.$/);
  if (ruleMissingMetric) {
    return `第 ${ruleMissingMetric[1]} 条规则缺少计费指标。`;
  }

  const ruleMetricUnregistered = normalized.match(/^Rule (\d+) uses an unregistered billing metric: (.+)\.$/);
  if (ruleMetricUnregistered) {
    return `第 ${ruleMetricUnregistered[1]} 条规则使用了未注册的计费指标：${ruleMetricUnregistered[2]}。`;
  }

  const ruleMissingOperator = normalized.match(/^Rule (\d+) is missing an operator\.$/);
  if (ruleMissingOperator) {
    return `第 ${ruleMissingOperator[1]} 条规则缺少比较运算符。`;
  }

  const ruleMissingValue = normalized.match(/^Rule (\d+) is missing a valid rule value\.$/);
  if (ruleMissingValue) {
    return `第 ${ruleMissingValue[1]} 条规则缺少有效的规则值。`;
  }

  const ruleInvalidMultiplier = normalized.match(/^Rule (\d+) multiplier must be greater than 0\.$/);
  if (ruleInvalidMultiplier) {
    return `第 ${ruleInvalidMultiplier[1]} 条规则的倍率必须大于 0。`;
  }

  return normalized;
}

export type CapabilityWorkbenchSidebarProps = {
  capabilityItems: Array<{
    code: ModelCapabilityCode;
    label: string;
    issueCount: number;
    selected: boolean;
  }>;
  capabilitySummary: string;
  totalCapabilityIssueCount: number;
  availableCapabilities: Array<{ code: ModelCapabilityCode; label: string }>;
  pendingCapabilityCode: ModelCapabilityCode | "";
  onPendingCapabilityCodeChange: (code: ModelCapabilityCode | "") => void;
  onAddCapability: () => void;
  onSelectCapability: (code: ModelCapabilityCode) => void;
  onRemoveCapability: (code: ModelCapabilityCode) => void;
};

export type CapabilityWorkbenchDetailProps = {
  activeCapabilityCode: ModelCapabilityCode | "";
  activeCapabilityMeta: {
    code: ModelCapabilityCode;
    label: string;
    description: string;
  } | null;
  activeCapabilityConfig: ModelCapabilityConfig | null;
  activeCapabilityValidationIssues: string[];
  activeCapabilityOverview: CapabilityOverview | null;
  activeCapabilityTab: CapabilityDetailTabId;
  activeCapabilityTabs: Array<{ id: CapabilityDetailTabId; label: string }>;
  onCapabilityTabChange: (tab: CapabilityDetailTabId) => void;
  activeCapabilitySection: CapabilitySectionDefinition | null;
  activeCapabilityDefaultSection: CapabilitySectionDefinition | null;
  onUpdateActiveCapabilityField: (sectionKey: CapabilityConfigSectionKey, key: string, value: unknown) => void;
};

function renderCapabilitySectionPanel(
  code: ModelCapabilityCode,
  config: ModelCapabilityConfig,
  section: CapabilitySectionDefinition,
  onUpdateField: (sectionKey: CapabilityConfigSectionKey, key: string, value: unknown) => void,
) {
  return (
    <div className="space-y-4 rounded-xl bg-background/70 px-4 py-4">
      <div>
        <h4 className="text-sm font-medium text-foreground">{section.title}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {section.fields.map((field) => {
          const sectionKey = resolveCapabilitySectionKey(section);
          const rawValue = getCapabilityFieldValue(config, sectionKey, field.key);
          const value =
            rawValue !== undefined
              ? rawValue
              : Array.isArray(field.defaultValue)
                ? [...field.defaultValue]
                : field.defaultValue;

          return (
            <CapabilityFieldRendererEngine
              key={field.key}
              code={code}
              config={config}
              sectionKey={sectionKey}
              field={field}
              value={value}
              onChange={(nextValue) => onUpdateField(sectionKey, field.key, nextValue)}
            />
          );
        })}
      </div>
    </div>
  );
}

export function CapabilityWorkbench(props: {
  sidebar: CapabilityWorkbenchSidebarProps;
  detail: CapabilityWorkbenchDetailProps;
  pricingWorkbench: ReactNode;
}) {
  const { sidebar, detail } = props;

  return (
    <section className="space-y-4 rounded-2xl bg-background/85 px-5 py-5">
      <div className="space-y-1">
        <h2 className="text-[15px] font-semibold text-foreground">能力配置</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[210px_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[14px] font-semibold text-foreground">已启用能力</h3>
              <Badge variant="outline">{sidebar.capabilityItems.length} 项</Badge>
            </div>

            {sidebar.capabilityItems.length === 0 ? (
              <div className="rounded-2xl bg-muted/30 px-4 py-5 text-sm text-muted-foreground">暂无已启用能力。</div>
            ) : (
              <div className="space-y-2">
                {sidebar.capabilityItems.map((item) => (
                  <div
                    key={item.code}
                    className={cn(
                      "rounded-2xl px-4 py-4 transition-colors",
                      item.selected ? "bg-primary/5 ring-1 ring-primary/20" : "bg-muted/15",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => sidebar.onSelectCapability(item.code)}>
                        <div className="truncate text-sm font-semibold text-foreground">{item.label}</div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">{item.code}</div>
                        {item.issueCount > 0 ? (
                          <Badge variant="outline" className="mt-3 border-amber-300 text-[10px] text-amber-700">
                            {item.issueCount} 项待修正
                          </Badge>
                        ) : null}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 rounded-full text-muted-foreground"
                        onClick={() => sidebar.onRemoveCapability(item.code)}
                        aria-label={`移除能力 ${item.label}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl bg-muted/20 px-4 py-4">
            <div className="space-y-1">
              <Label className="workflow-form-label">添加能力</Label>
            </div>
            <Select
              value={sidebar.pendingCapabilityCode}
              onValueChange={(value) => sidebar.onPendingCapabilityCodeChange(value as ModelCapabilityCode)}
              disabled={sidebar.availableCapabilities.length === 0}
            >
              <SelectTrigger className="subpage-native-select h-10 w-full">
                <SelectValue placeholder={sidebar.availableCapabilities.length === 0 ? "暂无可添加能力" : "请选择能力"} />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                {sidebar.availableCapabilities.map((item) => (
                  <SelectItem key={item.code} className="subpage-select-item" value={item.code}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              className="subpage-primary-btn !h-10 w-full"
              onClick={sidebar.onAddCapability}
              disabled={!sidebar.pendingCapabilityCode}
            >
              <Plus className="mr-1 h-4 w-4" />
              添加能力
            </Button>
          </div>

          <div className="space-y-3 rounded-2xl bg-muted/30 px-4 py-4 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-foreground">能力摘要</h4>
              <div className="text-sm font-medium text-foreground">{sidebar.capabilityItems.length} 项</div>
            </div>
            <div>{sidebar.capabilityItems.length === 0 ? "暂无已启用能力" : sidebar.capabilitySummary}</div>
            {sidebar.totalCapabilityIssueCount > 0 ? <div>待修正：{sidebar.totalCapabilityIssueCount} 项</div> : null}
          </div>
        </div>

        <div className="min-w-0 xl:-mt-1">
          {!detail.activeCapabilityCode || !detail.activeCapabilityMeta || !detail.activeCapabilityConfig ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-xl bg-muted/15 px-6 text-center">
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">请选择能力</h3>
                <p className="text-sm text-muted-foreground">从左侧选择能力后，在这里直接完成能力、默认配置和定价配置。</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 rounded-xl bg-muted/15 px-4 pb-4 pt-3 md:px-5">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[16px] font-semibold text-foreground">{detail.activeCapabilityMeta.label}</h3>
                  <Badge variant="secondary">{detail.activeCapabilityMeta.code}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{detail.activeCapabilityMeta.description}</p>
              </div>

              {/* {detail.activeCapabilityOverview ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-3">
                    <div className="text-xs text-muted-foreground">能力边界</div>
                    <div className="mt-2 text-sm text-foreground">{detail.activeCapabilityOverview.boundary}</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-3">
                    <div className="text-xs text-muted-foreground">默认参数</div>
                    <div className="mt-2 text-sm text-foreground">{detail.activeCapabilityOverview.defaults}</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-3">
                    <div className="text-xs text-muted-foreground">当前模板</div>
                    <div className="mt-2 text-sm text-foreground">{detail.activeCapabilityOverview.template}</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-3">
                    <div className="text-xs text-muted-foreground">价格表达</div>
                    <div className="mt-2 text-sm text-foreground">{detail.activeCapabilityOverview.pricing}</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-3">
                    <div className="text-xs text-muted-foreground">定价公式</div>
                    <div className="mt-2 text-sm text-foreground">{detail.activeCapabilityOverview.formula}</div>
                  </div>
                </div>
              ) : null} */}

              {detail.activeCapabilityValidationIssues.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="text-sm font-medium text-amber-900">当前配置存在待修正项</div>
                  <div className="mt-2 space-y-1 text-xs text-amber-800">
                    {detail.activeCapabilityValidationIssues.map((issue) => (
                          <div key={issue}>- {toChineseCapabilityValidationIssue(issue)}</div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 rounded-xl bg-background/70 px-4 py-3">
                  {detail.activeCapabilityTabs.map((tab, index) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => detail.onCapabilityTabChange(tab.id)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs transition-colors",
                        detail.activeCapabilityTab === tab.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80",
                      )}
                    >
                      {index + 1}. {CAPABILITY_TAB_LABELS[tab.id]}
                    </button>
                  ))}
                </div>

                {detail.activeCapabilityTab === "capability"
                  ? detail.activeCapabilitySection
                    ? renderCapabilitySectionPanel(
                        detail.activeCapabilityMeta.code,
                        detail.activeCapabilityConfig,
                        detail.activeCapabilitySection,
                        detail.onUpdateActiveCapabilityField,
                      )
                    : (
                        <div className="rounded-2xl bg-background/80 px-4 py-4 text-sm text-muted-foreground">
                          当前能力未配置“能力”分区字段。
                        </div>
                      )
                  : null}

                {detail.activeCapabilityTab === "default" && detail.activeCapabilityDefaultSection
                  ? renderCapabilitySectionPanel(
                      detail.activeCapabilityMeta.code,
                      detail.activeCapabilityConfig,
                      detail.activeCapabilityDefaultSection,
                      detail.onUpdateActiveCapabilityField,
                    )
                  : null}

                {detail.activeCapabilityTab === "pricing" ? props.pricingWorkbench : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
