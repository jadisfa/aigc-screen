import type {
  CapabilityPricing,
  CapabilityPricingSimulationResult,
  CapabilityPricingSimulatorFieldDefinition,
  CapabilitySectionDefinition,
  CapabilityTemplatePresetDefinition,
  ModelCapabilityCode,
} from "../modelCapabilityMetadata";
import type { ModelCapabilityBucket, ModelCapabilityCategory } from "../modelCapabilityMetadata";
import type { CapabilityPackage } from "../capabilityPluginTypes";
import {
  buildPricingRateLabel,
  buildScaledPricingFormula,
  convertToBillingQuantity,
  resolvePricingUnitDescriptor,
  type PricingUnitKind,
} from "../pricingUnit";

type SimpleCapabilitySpec = {
  code: ModelCapabilityCode;
  label: string;
  bucket: ModelCapabilityBucket;
  category: ModelCapabilityCategory;
  description: string;
  keywords: RegExp[];
  templateId: string;
  templateLabel: string;
  scenario: string;
  pricingFocus: string;
  unit: string;
  unitKind: PricingUnitKind;
  basePrice: number;
  sections: CapabilitySectionDefinition[];
  simulatorFields: CapabilityPricingSimulatorFieldDefinition[];
  simulatorQuantityKey: string;
  simulatorFallbackQuantity: number;
  ruleMetricSuggestions: string[];
  pricingSummary: string;
};

function createSimpleCapabilityPackage(spec: SimpleCapabilitySpec): CapabilityPackage {
  const templatePresets: CapabilityTemplatePresetDefinition[] = [
    {
      templateId: spec.templateId,
      label: spec.templateLabel,
      scenario: spec.scenario,
      pricingFocus: spec.pricingFocus,
      recommended: true,
    },
  ];

  const buildPricing = (templateId: string): CapabilityPricing => ({
    templateId,
    isCustomized: false,
    basePrice: spec.basePrice,
    unit: spec.unit,
    unitKind: spec.unitKind,
    currency: "CNY",
    rules: [],
  });

  return {
    manifest: {
      code: spec.code,
      label: spec.label,
      bucket: spec.bucket,
      category: spec.category,
      schemaLevel: "full",
      description: spec.description,
      keywords: spec.keywords,
      sections: spec.sections,
      templatePresets,
    },
    templates: {
      ruleMetricSuggestions: spec.ruleMetricSuggestions,
      buildPricing,
    },
    overview: {
      build: (context) => {
        const descriptor = resolvePricingUnitDescriptor(context.config.pricing.unit, spec.unitKind);
        return {
          boundary: spec.description,
          defaults: spec.templateLabel,
          template: context.matchedTemplate
            ? `${context.matchedTemplate.template.label}${context.matchedTemplate.isExactMatch ? "" : "（已微调）"}`
            : "未选择模板",
          pricing:
            context.config.pricing.basePrice > 0
              ? buildPricingRateLabel(context.config.pricing.basePrice, context.config.pricing.unit, spec.unitKind)
              : context.billingSummary || "待补充",
          formula: `总价 = 基础单价 × 折算后的 ${descriptor.displayLabel} 数量`,
        };
      },
      buildPricingSummary: (_basePlugin, config) =>
        config?.pricing ? spec.pricingSummary : spec.pricingSummary,
    },
    simulator: {
      getFields: () => spec.simulatorFields,
      simulate: (config, input): CapabilityPricingSimulationResult | null => {
        const quantity = Math.max(1, Number(input[spec.simulatorQuantityKey] || spec.simulatorFallbackQuantity) || spec.simulatorFallbackQuantity);
        const basePrice = Number(config.pricing.basePrice || 0);
        const descriptor = resolvePricingUnitDescriptor(config.pricing.unit, spec.unitKind);
        const billedQuantity = convertToBillingQuantity(quantity, config.pricing.unit, spec.unitKind);
        const baseAmount = basePrice * billedQuantity;
        return {
          quantity,
          baseAmount,
          total: baseAmount,
          currency: config.pricing.currency || "CNY",
          unit: descriptor.rawQuantityLabel,
          billedQuantity,
          billedUnitLabel: descriptor.displayLabel,
          formula: buildScaledPricingFormula(basePrice, quantity, config.pricing.unit, spec.unitKind),
          hitRules: [],
        };
      },
    },
    pricingEditor: {
      unitPlaceholder: spec.unit,
      ruleValuePlaceholder: "例如：1",
      simulationQuantityLabel: spec.simulatorFields[0]?.label || "用量",
      simulationQuantityUnitLabel: spec.unitKind === "token" ? "Tokens" : spec.unit,
    },
  };
}

export const deepThinkingCapabilityPackage = createSimpleCapabilityPackage({
  code: "deep_thinking",
  label: "深度思考",
  bucket: "text",
  category: "text",
  description: "复杂推理、思维链、长程规划",
  keywords: [/深度思考/i, /推理/i, /reasoning/i, /思维链/i],
  templateId: "standard_deep_thinking",
  templateLabel: "标准深度思考",
  scenario: "复杂推理、代码与长程任务",
  pricingFocus: "按百万 Tokens 计费",
  unit: "1M tokens",
  unitKind: "token",
  basePrice: 8,
  sections: [
    {
      id: "capability",
      target: "boundary",
      title: "能力边界",
      description: "维护深度思考的推理上限。",
      fields: [
        { key: "maxReasoningTokens", label: "最大推理 Token", type: "number", defaultValue: 32000 },
        { key: "supportChainOfThought", label: "支持思维链输出", type: "boolean", defaultValue: true },
      ],
    },
    {
      id: "default",
      target: "defaults",
      title: "默认参数",
      description: "维护深度思考的默认推理强度。",
      fields: [
        {
          key: "defaultReasoningEffort",
          label: "默认推理强度",
          type: "select",
          defaultValue: "medium",
          options: [
            { label: "低", value: "low" },
            { label: "中", value: "medium" },
            { label: "高", value: "high" },
          ],
        },
      ],
    },
  ],
  simulatorFields: [{ key: "inputTokens", label: "推理 Tokens", type: "number", defaultValue: 4000, min: 1, step: 100 }],
  simulatorQuantityKey: "inputTokens",
  simulatorFallbackQuantity: 4000,
  ruleMetricSuggestions: ["reasoning_token"],
  pricingSummary: "按百万 Tokens 计费",
});

export const translationCapabilityPackage = createSimpleCapabilityPackage({
  code: "translation",
  label: "翻译",
  bucket: "text",
  category: "text",
  description: "多语言翻译、文档翻译",
  keywords: [/翻译/i, /translate/i, /多语言/i],
  templateId: "standard_translation",
  templateLabel: "标准翻译",
  scenario: "通用文本与文档翻译",
  pricingFocus: "按百万 Tokens 计费",
  unit: "1M tokens",
  unitKind: "token",
  basePrice: 5,
  sections: [
    {
      id: "capability",
      target: "boundary",
      title: "能力边界",
      description: "维护翻译支持的语言与文档能力。",
      fields: [
        {
          key: "supportedLanguages",
          label: "支持语言",
          type: "multiselect",
          defaultValue: ["zh", "en"],
          options: [
            { label: "中文", value: "zh" },
            { label: "英文", value: "en" },
            { label: "日文", value: "ja" },
            { label: "韩文", value: "ko" },
          ],
        },
        { key: "supportDocument", label: "支持文档翻译", type: "boolean", defaultValue: false },
      ],
    },
    {
      id: "default",
      target: "defaults",
      title: "默认参数",
      description: "维护翻译的默认语言方向。",
      fields: [
        { key: "defaultSourceLang", label: "默认源语言", type: "select", defaultValue: "auto", options: [{ label: "自动检测", value: "auto" }, { label: "中文", value: "zh" }, { label: "英文", value: "en" }] },
        { key: "defaultTargetLang", label: "默认目标语言", type: "select", defaultValue: "en", options: [{ label: "中文", value: "zh" }, { label: "英文", value: "en" }] },
      ],
    },
  ],
  simulatorFields: [{ key: "inputTokens", label: "输入 Tokens", type: "number", defaultValue: 2000, min: 1, step: 100 }],
  simulatorQuantityKey: "inputTokens",
  simulatorFallbackQuantity: 2000,
  ruleMetricSuggestions: ["input_token"],
  pricingSummary: "按百万 Tokens 计费",
});

export const rolePlayCapabilityPackage = createSimpleCapabilityPackage({
  code: "role_play",
  label: "角色扮演",
  bucket: "text",
  category: "text",
  description: "人设对话、多角色扮演",
  keywords: [/角色扮演/i, /人设/i, /role.?play/i],
  templateId: "standard_role_play",
  templateLabel: "标准角色扮演",
  scenario: "人设对话与多角色互动",
  pricingFocus: "按百万 Tokens 计费",
  unit: "1M tokens",
  unitKind: "token",
  basePrice: 6,
  sections: [
    {
      id: "capability",
      target: "boundary",
      title: "能力边界",
      description: "维护角色扮演的人设与角色数量限制。",
      fields: [
        { key: "maxPersonaTokens", label: "最大人设 Token", type: "number", defaultValue: 8000 },
        { key: "supportMultiCharacter", label: "支持多角色", type: "boolean", defaultValue: false },
      ],
    },
    {
      id: "default",
      target: "defaults",
      title: "默认参数",
      description: "维护角色扮演的默认人设。",
      fields: [{ key: "defaultPersona", label: "默认人设", type: "textarea", defaultValue: "", placeholder: "描述默认角色设定" }],
    },
  ],
  simulatorFields: [{ key: "inputTokens", label: "输入 Tokens", type: "number", defaultValue: 2000, min: 1, step: 100 }],
  simulatorQuantityKey: "inputTokens",
  simulatorFallbackQuantity: 2000,
  ruleMetricSuggestions: ["input_token"],
  pricingSummary: "按百万 Tokens 计费",
});

export const multimodalEmbeddingCapabilityPackage = createSimpleCapabilityPackage({
  code: "multimodal_embedding",
  label: "多模态向量",
  bucket: "text",
  category: "vector",
  description: "文本、图像、音频统一向量化",
  keywords: [/多模态向量/i, /multimodal embedding/i, /跨模态检索/i],
  templateId: "standard_multimodal_embedding",
  templateLabel: "标准多模态向量",
  scenario: "跨模态检索与召回",
  pricingFocus: "按百万 Tokens 计费",
  unit: "1M tokens",
  unitKind: "token",
  basePrice: 4,
  sections: [
    {
      id: "capability",
      target: "boundary",
      title: "能力边界",
      description: "维护多模态向量支持的模态与维度。",
      fields: [
        {
          key: "supportedModalities",
          label: "支持模态",
          type: "multiselect",
          defaultValue: ["text", "image"],
          options: [
            { label: "文本", value: "text" },
            { label: "图像", value: "image" },
            { label: "音频", value: "audio" },
          ],
        },
        {
          key: "supportedDimensions",
          label: "支持维度",
          type: "multiselect",
          defaultValue: ["1024", "1536"],
          options: ["512", "768", "1024", "1536", "2048"].map((value) => ({ label: value, value })),
        },
      ],
    },
    {
      id: "default",
      target: "defaults",
      title: "默认参数",
      description: "维护多模态向量的默认维度。",
      fields: [
        {
          key: "defaultDimension",
          label: "默认维度",
          type: "select",
          defaultValue: "1024",
          options: ["512", "768", "1024", "1536", "2048"].map((value) => ({ label: value, value })),
        },
      ],
    },
  ],
  simulatorFields: [{ key: "inputTokens", label: "输入 Tokens", type: "number", defaultValue: 1000, min: 1, step: 100 }],
  simulatorQuantityKey: "inputTokens",
  simulatorFallbackQuantity: 1000,
  ruleMetricSuggestions: ["input_token", "dimension"],
  pricingSummary: "按百万 Tokens 计费",
});

export const aiDubbingCapabilityPackage = createSimpleCapabilityPackage({
  code: "ai_dubbing",
  label: "AI配音",
  bucket: "speech",
  category: "audio",
  description: "文本转配音、音色克隆、口型同步",
  keywords: [/AI配音/i, /配音/i, /dubbing/i, /口型/i],
  templateId: "standard_ai_dubbing",
  templateLabel: "标准 AI 配音",
  scenario: "影视、口播与多语言配音",
  pricingFocus: "按千字符计费",
  unit: "1K chars",
  unitKind: "char",
  basePrice: 0.12,
  sections: [
    {
      id: "capability",
      target: "boundary",
      title: "能力边界",
      description: "维护 AI 配音的音色与口型能力。",
      fields: [
        { key: "supportLipSync", label: "支持口型同步", type: "boolean", defaultValue: false },
        { key: "supportCloning", label: "支持音色克隆", type: "boolean", defaultValue: true },
        { key: "maxChars", label: "最大字符数", type: "number", defaultValue: 8000 },
      ],
    },
    {
      id: "default",
      target: "defaults",
      title: "默认参数",
      description: "维护 AI 配音的默认音色。",
      fields: [
        {
          key: "defaultVoice",
          label: "默认音色",
          type: "select",
          defaultValue: "standard_female",
          options: [
            { label: "标准女声", value: "standard_female" },
            { label: "标准男声", value: "standard_male" },
          ],
        },
      ],
    },
  ],
  simulatorFields: [{ key: "charCount", label: "输入字符数", type: "number", defaultValue: 1000, min: 1, step: 50 }],
  simulatorQuantityKey: "charCount",
  simulatorFallbackQuantity: 1000,
  ruleMetricSuggestions: ["char_count", "voice_type"],
  pricingSummary: "按千字符 / 百万字符计费",
});

export const musicGenerationCapabilityPackage = createSimpleCapabilityPackage({
  code: "music_generation",
  label: "音乐生成",
  bucket: "speech",
  category: "audio",
  description: "歌曲生成、伴奏生成、歌词配乐",
  keywords: [/音乐生成/i, /作曲/i, /伴奏/i, /music/i],
  templateId: "standard_music_generation",
  templateLabel: "标准音乐生成",
  scenario: "歌曲、伴奏与BGM 生成",
  pricingFocus: "默按音频秒计费，也可按任务次或并发通道",
  unit: "second",
  unitKind: "second",
  basePrice: 0.08,
  sections: [
    {
      id: "capability",
      target: "boundary",
      title: "能力边界",
      description: "维护音乐生成的时长与形态。",
      fields: [
        { key: "maxDurationSeconds", label: "最大时长(秒)", type: "number", defaultValue: 180 },
        { key: "supportLyrics", label: "支持歌词生成", type: "boolean", defaultValue: true },
        { key: "supportInstrumental", label: "支持纯伴奏", type: "boolean", defaultValue: true },
        { key: "maxConcurrentChannels", label: "最大并发通道", type: "number", defaultValue: 4 },
      ],
    },
    {
      id: "default",
      target: "defaults",
      title: "默认参数",
      description: "维护音乐生成的默认时长与风格。",
      fields: [
        { key: "defaultDurationSeconds", label: "默认时长(秒)", type: "number", defaultValue: 30 },
        { key: "defaultStyle", label: "默认风格", type: "text", defaultValue: "pop", placeholder: "例如：pop / cinematic" },
      ],
    },
  ],
  simulatorFields: [{ key: "durationSeconds", label: "音频时长(秒)", type: "number", defaultValue: 30, min: 1, step: 1 }],
  simulatorQuantityKey: "durationSeconds",
  simulatorFallbackQuantity: 30,
  ruleMetricSuggestions: ["duration", "request", "concurrent_channel"],
  pricingSummary: "可按音频秒、任务次或并发通道计费",
});
