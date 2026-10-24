import type {
  ModelEditorValue,
  ModelStatus,
  ModelType,
  ProviderOption,
} from "@/modules/modelhub/components/model-editor/modelEditorTypes";
import { getModelTypeOptions } from "@/modules/modelhub/types/modelTypeProfiles";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";

type SectionProps = {
  form: ModelEditorValue;
  onChange: (updates: Partial<ModelEditorValue>) => void;
};

function parseTokenLikeNumber(value: string) {
  const normalized = value.replace(/,/g, "").trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  if (normalized.endsWith("K")) {
    const base = Number(normalized.slice(0, -1));
    return Number.isFinite(base) ? base * 1000 : null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildModelCommonParamSummary(form: ModelEditorValue) {
  const contextWindow = parseTokenLikeNumber(form.contextWindow);
  const maxInputTokens = parseTokenLikeNumber(form.maxInputTokens);
  const maxOutputTokens = parseTokenLikeNumber(form.maxOutputTokens);

  const contextSummary =
    contextWindow == null
      ? "上下文窗口尚未明确，当前还无法判断更偏长上下文还是标准上下文。"
      : contextWindow >= 100000
        ? "当前模型偏长上下文，适合多轮对话、长文本理解和复杂上下文承接。"
        : contextWindow >= 32000
          ? "当前模型属于中长上下文，适合大多数通用问答和结构化生成场景。"
          : "当前模型更偏短上下文，适合轻量请求和成本敏感场景。";

  const balanceSummary =
    maxInputTokens == null || maxOutputTokens == null
      ? "输入 / 输出边界尚未补齐，当前还无法判断调用边界是否平衡。"
      : maxInputTokens >= maxOutputTokens * 2
        ? "当前输入侧容量明显高于输出侧，更适合理解、总结和检索增强类场景。"
        : maxOutputTokens > maxInputTokens
          ? "当前输出侧容量高于输入侧，更适合生成密集、长回复或创作类场景。"
          : "当前输入 / 输出边界相对平衡，适合通用对话与标准生成任务。";

  const modelTypeSummaryMap: Record<ModelType, string> = {
    language: "模型类型为语言模型，应优先关注上下文承接能力、输入输出边界和生成体验。",
    vision: "模型类型为视觉模型，核心能力应回到图片、视频生成配置判断。",
    three_d: "模型类型为 3D 模型，核心能力应回到三维生成、贴图与绑定配置判断。",
    multimodal: "模型类型为多模态模型，应同时关注文本理解与视觉理解能力边界。",
    vector: "模型类型为向量模型，应更关注输入承接上限、维度档位和稳定成本。",
    speech: "模型类型为语音模型，具体识别、合成、配音或音乐生成能力仍应在能力配置中确认。",
  };

  return {
    contextSummary,
    balanceSummary,
    modelTypeSummary: modelTypeSummaryMap[form.modelType],
  };
}

export function ModelBasicInfoSection(props: SectionProps & {
  capabilitySummary: string;
  providers: ProviderOption[];
}) {
  return (
    <section className="space-y-4 rounded-2xl bg-background/85 px-5 py-5">
      <div className="space-y-1">
        <h2 className="text-[15px] font-semibold text-foreground">基础信息</h2>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 px-4">
        <div className="space-y-2">
          <Label className="workflow-form-label">模型编码</Label>
          <Input
            value={props.form.code}
            onChange={(event) => props.onChange({ code: event.target.value })}
            placeholder="可选，留空时由系统自动生成"
          />
        </div>

        <div className="space-y-2">
          <Label className="workflow-form-label">模型名称</Label>
          <Input
            value={props.form.name}
            onChange={(event) => props.onChange({ name: event.target.value })}
            placeholder="用于后台识别的展示名称"
          />
        </div>

        <div className="space-y-2">
          <Label className="workflow-form-label">状态</Label>
          <Select value={props.form.status} onValueChange={(value) => props.onChange({ status: value as ModelStatus })}>
            <SelectTrigger className="subpage-native-select h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem value="启用" className="subpage-select-item">
                启用
              </SelectItem>
              <SelectItem value="维护中" className="subpage-select-item">
                维护中
              </SelectItem>
              <SelectItem value="下线" className="subpage-select-item">
                下线
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="workflow-form-label">供应商</Label>
          <Select value={props.form.providerId} onValueChange={(value) => props.onChange({ providerId: value })}>
            <SelectTrigger className="subpage-native-select h-10 w-full">
              <SelectValue placeholder="请选择供应商" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              {props.providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id} className="subpage-select-item">
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="workflow-form-label">模型类型</Label>
          <Select value={props.form.modelType} onValueChange={(value) => props.onChange({ modelType: value as ModelType })}>
            <SelectTrigger className="subpage-native-select h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              {getModelTypeOptions().map((option) => (
                <SelectItem key={option.value} value={option.value} className="subpage-select-item">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2 xl:col-span-3">
          <Label className="workflow-form-label">模型描述</Label>
          <Textarea
            value={props.form.description}
            onChange={(event) => props.onChange({ description: event.target.value })}
            placeholder="用于补充模型定位、能力特点和适用场景"
            className="min-h-[96px] resize-y"
          />
        </div>

        {/* <div className="space-y-2 md:col-span-2 xl:col-span-3">
          <Label className="workflow-form-label">能力矩阵摘要</Label>
          <div className="min-h-10 rounded-md border border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
            {props.capabilitySummary || "暂无已启用能力"}
          </div>
        </div> */}
      </div>
    </section>
  );
}

export function ModelCommonParamsSection(props: SectionProps) {
  const summary = buildModelCommonParamSummary(props.form);

  return (
    <section className="space-y-4 rounded-2xl bg-background/85 px-5 py-5">
      <div className="space-y-1">
        <h2 className="text-[15px] font-semibold text-foreground">通用参数</h2>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 px-4">
        <div className="space-y-2">
          <Label className="workflow-form-label">上下文窗口</Label>
          <Input
            value={props.form.contextWindow}
            onChange={(event) => props.onChange({ contextWindow: event.target.value })}
            placeholder="例如 128K"
          />
        </div>
        <div className="space-y-2">
          <Label className="workflow-form-label">最大输入 Tokens</Label>
          <Input
            value={props.form.maxInputTokens}
            onChange={(event) => props.onChange({ maxInputTokens: event.target.value })}
            placeholder="例如 64000"
          />
        </div>
        <div className="space-y-2">
          <Label className="workflow-form-label">最大输出 Tokens</Label>
          <Input
            value={props.form.maxOutputTokens}
            onChange={(event) => props.onChange({ maxOutputTokens: event.target.value })}
            placeholder="例如 16000"
          />
        </div>
      </div>

      {/* <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
        <div className="text-sm font-medium text-foreground">模型级派生说明</div>
        <div className="mt-3 space-y-2">
          <div>{summary.contextSummary}</div>
          <div>{summary.balanceSummary}</div>
          <div>{summary.modelTypeSummary}</div>
        </div>
      </div> */}
    </section>
  );
}
