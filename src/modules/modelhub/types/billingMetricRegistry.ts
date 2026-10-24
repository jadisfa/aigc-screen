import type {
  BillingRuleOperator,
  CapabilityPricingRule,
  CapabilityPricingSimulatorInput,
} from "./modelCapabilityMetadata";

export type BillingMetricValueType = "number" | "string";

export type BillingMetricDefinition = {
  id: string;
  label: string;
  valueType: BillingMetricValueType;
  allowedOperators: BillingRuleOperator[];
  aliases?: string[];
  placeholder?: string;
  simulatorFieldKeys?: string[];
  boundaryFieldKeys?: string[];
};

const BILLING_METRIC_REGISTRY: BillingMetricDefinition[] = [
  {
    id: "input_token",
    label: "输入 Tokens",
    valueType: "number",
    allowedOperators: ["eq", "gte"],
    placeholder: "例如：100000",
    simulatorFieldKeys: ["inputTokens", "input_token"],
    aliases: ["inputtoken", "inputtokens"],
  },
  {
    id: "output_token",
    label: "输出 Tokens",
    valueType: "number",
    allowedOperators: ["eq", "gte"],
    placeholder: "例如：4000",
    simulatorFieldKeys: ["outputTokens", "output_token"],
    aliases: ["outputtoken", "outputtokens"],
  },
  {
    id: "reasoning_token",
    label: "推理 Tokens",
    valueType: "number",
    allowedOperators: ["eq", "gte"],
    placeholder: "例如：10000",
    simulatorFieldKeys: ["isReasoning", "reasoningTokens", "reasoning_token"],
    aliases: ["reasoningtoken", "reasoningtokens"],
  },
  {
    id: "cache_hit_token",
    label: "缓存命中 Tokens",
    valueType: "number",
    allowedOperators: ["eq", "gte"],
    placeholder: "例如：50000",
    simulatorFieldKeys: ["cacheHitTokens", "cache_hit_token"],
  },
  {
    id: "resolution",
    label: "分辨率",
    valueType: "string",
    allowedOperators: ["eq", "in"],
    placeholder: "例如：1536x1024 / 1080p",
    simulatorFieldKeys: ["resolution"],
    boundaryFieldKeys: ["supportedResolutions", "resolutions"],
  },
  {
    id: "image_count",
    label: "出图张数",
    valueType: "number",
    allowedOperators: ["eq", "gte"],
    placeholder: "例如：4",
    simulatorFieldKeys: ["imageCount", "image_count"],
    aliases: ["imagecount"],
  },
  {
    id: "frame_rate",
    label: "帧率",
    valueType: "string",
    allowedOperators: ["eq", "in"],
    placeholder: "例如：30",
    simulatorFieldKeys: ["frameRate", "frame_rate", "framerate"],
    boundaryFieldKeys: ["frameRates", "supportedFrameRates"],
    aliases: ["fps", "framerate", "frameRate"],
  },
  {
    id: "duration",
    label: "时长",
    valueType: "number",
    allowedOperators: ["eq", "gte"],
    placeholder: "例如：10",
    simulatorFieldKeys: ["durationSeconds", "durationHours", "duration"],
    aliases: ["durationseconds", "duration_seconds", "durationhours", "duration_hours"],
  },
  {
    id: "task_type",
    label: "任务类型",
    valueType: "string",
    allowedOperators: ["eq", "in"],
    placeholder: "例如：ocr",
    simulatorFieldKeys: ["taskType", "task_type"],
    aliases: ["tasktype"],
  },
  {
    id: "dimension",
    label: "向量维度",
    valueType: "number",
    allowedOperators: ["eq", "gte"],
    placeholder: "例如：1536",
    simulatorFieldKeys: ["dimension"],
    boundaryFieldKeys: ["supportedDimensions"],
  },
  {
    id: "char_count",
    label: "字符数",
    valueType: "number",
    allowedOperators: ["eq", "gte"],
    placeholder: "例如：1000",
    simulatorFieldKeys: ["charCount", "char_count"],
    aliases: ["charcount", "charactercount", "character_count"],
  },
  {
    id: "voice_type",
    label: "音色类型",
    valueType: "string",
    allowedOperators: ["eq", "in"],
    placeholder: "例如：standard_female",
    simulatorFieldKeys: ["voiceType", "voice_type"],
    aliases: ["voicetype"],
  },
  {
    id: "emotion",
    label: "情感风格",
    valueType: "string",
    allowedOperators: ["eq", "in"],
    placeholder: "例如：neutral",
    simulatorFieldKeys: ["emotion"],
  },
  {
    id: "mode",
    label: "模式",
    valueType: "string",
    allowedOperators: ["eq", "in"],
    placeholder: "例如：realtime",
    simulatorFieldKeys: ["mode"],
  },
  {
    id: "gpu_type",
    label: "GPU 型号",
    valueType: "string",
    allowedOperators: ["eq", "in"],
    placeholder: "例如：A100",
    simulatorFieldKeys: ["gpuType", "gpu_type"],
    boundaryFieldKeys: ["supportedGpuTypes"],
    aliases: ["gputype"],
  },
  {
    id: "quality",
    label: "质量档位",
    valueType: "string",
    allowedOperators: ["eq", "in"],
    placeholder: "例如：standard",
    simulatorFieldKeys: ["quality"],
  },
  {
    id: "format",
    label: "输出格式",
    valueType: "string",
    allowedOperators: ["eq", "in"],
    placeholder: "例如：glb",
    simulatorFieldKeys: ["format"],
    aliases: ["outputformat", "output_format"],
  },
  {
    id: "complexity",
    label: "任务复杂度",
    valueType: "string",
    allowedOperators: ["eq", "in"],
    placeholder: "例如：standard",
    simulatorFieldKeys: ["complexity"],
  },
  {
    id: "parallel",
    label: "并行开关",
    valueType: "string",
    allowedOperators: ["eq"],
    placeholder: "例如：yes",
    simulatorFieldKeys: ["parallel", "isParallel"],
  },
  {
    id: "step",
    label: "执行步数",
    valueType: "number",
    allowedOperators: ["eq", "gte"],
    placeholder: "例如：10",
    simulatorFieldKeys: ["stepCount", "step"],
    aliases: ["stepcount", "step_count"],
  },
];

function normalizeMetricToken(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

export function listBillingMetricDefinitions() {
  return BILLING_METRIC_REGISTRY;
}

export function resolveBillingMetricDefinition(metric: unknown) {
  const normalizedMetric = normalizeMetricToken(metric);
  if (!normalizedMetric) return null;

  return (
    BILLING_METRIC_REGISTRY.find((definition) => {
      const candidates = [definition.id, ...(definition.aliases || [])];
      return candidates.some((candidate) => normalizeMetricToken(candidate) === normalizedMetric);
    }) || null
  );
}

export function normalizeBillingMetricId(metric: unknown) {
  return resolveBillingMetricDefinition(metric)?.id || String(metric ?? "").trim();
}

export function getBillingMetricDisplayLabel(metric: unknown) {
  return resolveBillingMetricDefinition(metric)?.label || String(metric ?? "").trim();
}

export function summarizeBillingRuleMetrics(rules: CapabilityPricingRule[]) {
  const labels = Array.from(
    new Set(rules.map((rule) => getBillingMetricDisplayLabel(rule.metric)).filter(Boolean)),
  );

  if (labels.length === 0) return "";
  if (labels.length === 1) return `${labels[0]}倍率`;
  if (labels.length === 2) return `${labels.join(" / ")}倍率`;
  return `${labels.slice(0, 2).join(" / ")} 等倍率`;
}

export function getBillingMetricAllowedOperators(metric: unknown) {
  return resolveBillingMetricDefinition(metric)?.allowedOperators || ["eq"];
}

export function isNumericBillingMetric(metric: unknown) {
  return resolveBillingMetricDefinition(metric)?.valueType === "number";
}

export function getBillingMetricPlaceholder(metric: unknown, fallback: string) {
  return resolveBillingMetricDefinition(metric)?.placeholder || fallback;
}

export function getBillingMetricSimulationValue(
  metric: unknown,
  input: CapabilityPricingSimulatorInput,
  overrides: Record<string, unknown> = {},
) {
  const normalizedMetricId = normalizeBillingMetricId(metric);
  if (normalizedMetricId in overrides) {
    return overrides[normalizedMetricId];
  }

  const definition = resolveBillingMetricDefinition(metric);
  const candidateKeys = Array.from(
    new Set(
      [String(metric ?? "").trim(), normalizedMetricId, ...(definition?.simulatorFieldKeys || [])].filter(Boolean),
    ),
  );

  for (const key of candidateKeys) {
    if (key in input) {
      return input[key];
    }
  }

  return undefined;
}

export function sanitizeCapabilityPricingRule(
  rule: Partial<CapabilityPricingRule>,
  index: number,
): CapabilityPricingRule {
  return {
    id: String(rule.id || `rule-${index + 1}`),
    metric: normalizeBillingMetricId(rule.metric),
    operator: rule.operator || "eq",
    value: rule.value ?? "",
    multiplier: Number(rule.multiplier || 0),
    description: String(rule.description || "").trim(),
  };
}
