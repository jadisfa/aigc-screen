export function toChineseBusinessLabel(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return normalized;
  }

  const exactMessages: Record<string, string> = {
    "Deep complexity analysis": "深度复杂度分析",
    "Parallel execution": "并行执行",
    "Intent recognition": "意图识别",
    "Multi-turn audio conversation": "多轮语音对话",
    "High quality mesh": "高质量网格",
    "GLB export": "GLB 导出",
    "Emotion voice": "情感音色",
    "Cloned voice": "克隆音色",
    "Realtime mode": "实时模式",
    "Batch mode": "批量模式",
    "A100 GPU": "A100 GPU",
    "High resolution analysis": "高分辨率分析",
    "OCR": "OCR 文字识别",
    "Summarization": "摘要",
    "Classification": "分类",
    "Moderation": "审核",
    "Input tokens": "输入 tokens",
    "Output tokens": "输出 tokens",
    "Reasoning tokens": "推理 tokens",
    "missing template catalog": "模板目录缺失",
    "capability package does not provide templates for this capability": "当前能力包未提供该能力的模板定义",
    "no template selected": "未选择模板",
    "pending pricing": "待补充定价",
    "use default template values": "使用默认模板值",
    "Duration": "时长",
    "Resolution": "分辨率",
    "Frame Rate": "帧率",
    "Only enabled boundary resolutions are available here.": "仅可选择能力边界中已启用的分辨率。",
    "Only enabled boundary frame rates are available here.": "仅可选择能力边界中已启用的帧率。",
  };

  if (exactMessages[normalized]) {
    return exactMessages[normalized];
  }

  const dimensions = normalized.match(/^(\d+)\s+dimensions$/i);
  if (dimensions) {
    return `${dimensions[1]} 维向量`;
  }

  if (normalized.includes(";")) {
    return normalized
      .split(";")
      .map((item) => toChineseBusinessLabel(item))
      .join("；");
  }

  return normalized;
}

export function formatCapabilityTemplateText(label: string, isExactMatch: boolean): string {
  const normalizedLabel = toChineseBusinessLabel(label);
  return isExactMatch ? normalizedLabel : `${normalizedLabel}（已微调）`;
}

export function formatCapabilitySummary(labels: string[], maxVisible: number): string {
  if (labels.length <= maxVisible) {
    return labels.join(" / ");
  }
  return `${labels.slice(0, maxVisible).join(" / ")} 等 ${labels.length} 项`;
}
