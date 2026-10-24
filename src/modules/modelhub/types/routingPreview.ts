import {
  ENTRY_LABEL,
  REGION_LABEL,
  TENANT_LABEL,
  buildPoolLabelMap,
  type PoolId,
  type PoolOption,
  type RegionLevel,
  type RouteEntryCode,
  type RouteEntryPolicyValue,
  type StrategySource,
  type TenantLevel,
  type UnmatchedBehavior,
} from "@/modules/modelhub/types/routingManagementTypes";

export type RoutingPreviewSummary = {
  matched: boolean;
  rangeMatched: boolean;
  sourceSummary: string;
  decisionSummary: string;
  reasonSummary: string;
  nextActionSummary: string;
};

export function buildRoutingPreviewSummary(input: {
  applicableTenantLevels: TenantLevel[];
  applicableRegions: RegionLevel[];
  entries: Record<RouteEntryCode, RouteEntryPolicyValue>;
  simulateEntry: RouteEntryCode;
  simulateTenantLevel: TenantLevel;
  simulateRegionLevel: RegionLevel;
  simulateStrategySource: StrategySource;
  unmatchedBehavior: UnmatchedBehavior;
  fallbackPoolId: PoolId;
  poolOptions?: PoolOption[];
}): RoutingPreviewSummary {
  const poolLabels = buildPoolLabelMap(input.poolOptions || []);
  const rangeMatched =
    input.applicableTenantLevels.includes(input.simulateTenantLevel) &&
    input.applicableRegions.includes(input.simulateRegionLevel);
  const activeEntryPolicy = input.entries[input.simulateEntry];
  const targetPool = poolLabels[activeEntryPolicy.targetPoolId] || activeEntryPolicy.targetPoolId;
  const scopeLabel = `${TENANT_LABEL[input.simulateTenantLevel]} / ${REGION_LABEL[input.simulateRegionLevel]}`;
  const matched = input.simulateStrategySource === "api_key_assigned" || (input.simulateStrategySource === "tenant_default" && rangeMatched);

  const sourceSummary =
    input.simulateStrategySource === "api_key_assigned"
      ? "预览前提：当前请求已由 API Key 显式挂载该策略。"
      : input.simulateStrategySource === "api_key_other_assigned"
        ? "预览前提：当前请求的 API Key 已挂载其他策略。"
        : "预览前提：当前请求走租户 / 区域默认策略映射链。";

  const decisionSummary = matched
    ? `当前预览会命中该策略，${ENTRY_LABEL[input.simulateEntry]} 将先进入“${targetPool}”。`
    : "当前预览不会命中该策略。";

  const reasonSummary =
    input.simulateStrategySource === "api_key_other_assigned"
      ? "未命中原因：该请求的 API Key 已显式挂载其他策略，当前页策略不会进入本次策略选择链。"
      : rangeMatched
        ? `命中原因：当前策略已声明适用于 ${scopeLabel}，且可参与当前入口的默认策略链。`
        : `未命中原因：当前策略未声明适用于 ${scopeLabel}，因此不会进入当前默认策略链。`;

  const nextActionSummary =
    input.simulateStrategySource === "api_key_other_assigned"
      ? "后续处理：请求会优先进入 API Key 已挂载的其他策略；当前页策略只在挂载关系被切换后才可能生效。"
      : matched
        ? "后续处理：本预览只解释策略选择结果，不展开池内评分、渠道健康度和运行时调度。"
        : input.unmatchedBehavior === "fallback_to_system_default"
          ? `后续处理：当前场景未命中时将回落系统默认策略；最终兜底池为“${poolLabels[input.fallbackPoolId] || input.fallbackPoolId}”。`
          : "后续处理：当前场景未命中时将直接拒绝。";

  return {
    matched,
    rangeMatched,
    sourceSummary,
    decisionSummary,
    reasonSummary,
    nextActionSummary,
  };
}
