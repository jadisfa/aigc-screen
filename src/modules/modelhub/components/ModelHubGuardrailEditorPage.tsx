import { ArrowLeft, ChevronDown, ChevronRight, ClipboardPaste, Save, Sparkles, Tags, X } from "lucide-react";
import { useEffect, useState } from "react";
import { EditorSection, FieldGroup } from "@/modules/modelhub/components/EditorFormSection";
import { fetchGuardrailRuleDetail, saveGuardrailRule } from "@/modules/modelhub/services/guardrailManagementService";
import { resolveModelHubErrorMessage } from "@/modules/modelhub/services/modelhubAdminUi";
import {
  buildGuardrailImpactBadges,
  buildGuardrailImpactDescriptions,
  buildGuardrailValidationIssues,
  normalizeGuardrailMatchItems,
} from "@/modules/modelhub/types/guardrailManagementHelpers";
import {
  GUARDRAIL_ACTION_OPTIONS,
  GUARDRAIL_BASELINE_OPTIONS,
  GUARDRAIL_RISK_OPTIONS,
  GUARDRAIL_STATUS_OPTIONS,
  type GuardrailAction,
  type GuardrailBaselineSelectValue,
  type GuardrailRiskLevel,
  type GuardrailStatus,
} from "@/modules/modelhub/types/guardrailManagementTypes";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { notify } from "@/shared/lib/notify";

const GUARDRAIL_MATCH_TEMPLATE_GROUPS = [
  {
    key: "general_chat",
    title: "通用对话助手",
    description: "适合客服、Copilot、聊天问答等开放对话场景",
    items: ["辱骂", "脏话", "人身攻击", "恶意挑衅", "涉黄", "暴恐"],
  },
  {
    key: "customer_service",
    title: "客服服务台",
    description: "适合在线客服、工单机器人，强调辱骂与投诉升级治理",
    items: ["辱骂", "威胁投诉", "恶意刷屏", "挑衅客服", "人身攻击"],
  },
  {
    key: "community_content",
    title: "社区内容发布",
    description: "适合 UGC 社区、评论区、帖子流，强调低俗与违法传播治理",
    items: ["色情", "裸露", "低俗擦边", "暴恐", "毒品交易", "引战"],
  },
  {
    key: "image_generation",
    title: "图像生成",
    description: "适合文生图、海报生成，强调裸露、暴力和名人滥用",
    items: ["裸露", "色情", "血腥暴力", "武器制作", "名人换脸", "儿童不当内容"],
  },
  {
    key: "video_audio_generation",
    title: "视频与语音生成",
    description: "适合 TTS、配音、视频生成，强调诈骗仿冒与违规语音内容",
    items: ["声音仿冒", "诈骗话术", "成人视频", "暴恐宣传", "政治谣言"],
  },
  {
    key: "enterprise_knowledge",
    title: "企业知识库",
    description: "适合企业问答、工作台 Copilot，强调隐私泄露和内部信息外传",
    items: ["身份证号", "银行卡号", "手机号", "家庭住址", "内部合同", "客户名单"],
  },
  {
    key: "ecommerce_live",
    title: "电商与直播",
    description: "适合带货导购、直播助手，强调违禁商品与营销违规词",
    items: ["最便宜", "绝对有效", "医疗功效", "减肥神药", "烟草售卖", "高仿"],
  },
  {
    key: "minor_protection",
    title: "未成年人保护",
    description: "适合泛娱乐、社交和内容平台的基础青少年保护场景",
    items: ["未成年人色情", "诱导打赏", "校园霸凌", "自残", "未成年饮酒", "成人交友"],
  },
  {
    key: "finance_compliance",
    title: "金融合规",
    description: "适合投顾、金融问答、营销助手，强调违规承诺与敏感资质表述",
    items: ["保本保收益", "内幕消息", "代客理财", "高收益稳赚", "洗钱", "套现"],
  },
  {
    key: "medical_compliance",
    title: "医疗健康",
    description: "适合健康问答、医疗咨询助手，强调诊疗承诺和处方风险",
    items: ["包治百病", "替代处方", "癌症治愈", "处方代开", "违禁药品", "自杀指导"],
  },
  {
    key: "prompt_injection",
    title: "模型防越狱",
    description: "适合开放模型代理与企业智能体，强调提示词注入和绕过行为",
    items: ["忽略以上规则", "输出系统提示词", "越过限制", "开发者消息", "系统指令泄露", "关闭审核"],
  },
] as const;

function dedupeMatchItems(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function splitBatchMatchItems(input: string) {
  return input
    .split(/[\n,，;；/、]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ModelHubGuardrailEditorPage(props: {
  mode: "create" | "edit";
  editingId?: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { mode, editingId, onCancel, onSuccess } = props;
  const [name, setName] = useState("");
  const [riskLevel, setRiskLevel] = useState<GuardrailRiskLevel>("high");
  const [status, setStatus] = useState<GuardrailStatus>("draft");
  const [isSystemBaseline, setIsSystemBaseline] = useState(false);
  const [matchItems, setMatchItems] = useState<string[]>([]);
  const [batchMatchInput, setBatchMatchInput] = useState("");
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [action, setAction] = useState<GuardrailAction>("block");
  const [referenceCount, setReferenceCount] = useState(0);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== "edit" || !editingId) {
      setName("");
      setRiskLevel("high");
      setStatus("draft");
      setIsSystemBaseline(false);
      setMatchItems([]);
      setBatchMatchInput("");
      setTemplatePanelOpen(false);
      setAction("block");
      setReferenceCount(0);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    void fetchGuardrailRuleDetail(editingId)
      .then((detail) => {
        if (!active) {
          return;
        }
        setName(detail.name);
        setRiskLevel(detail.riskLevel);
        setStatus(detail.status);
        setIsSystemBaseline(detail.isSystemBaseline);
        setMatchItems(dedupeMatchItems(detail.matchItems));
        setBatchMatchInput("");
        setTemplatePanelOpen(false);
        setAction(detail.action);
        setReferenceCount(detail.referenceCount);
      })
      .catch((error) => {
        notify.error("加载失败", { description: resolveModelHubErrorMessage(error, "安全规则详情加载失败") });
        onCancel();
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [editingId, mode, onCancel]);

  const normalizedMatchItems = normalizeGuardrailMatchItems(matchItems);

  const appendMatchItems = (items: string[]) => {
    const normalized = dedupeMatchItems([...matchItems, ...items]);
    setMatchItems(normalized);
  };

  const importBatchMatchItems = () => {
    const items = splitBatchMatchItems(batchMatchInput);
    if (items.length === 0) {
      notify.success("没有可添加的关键词", { description: "请输入一条或多条关键词后再添加，支持按换行、逗号或顿号分隔。" });
      return;
    }
    appendMatchItems(items);
    setBatchMatchInput("");
  };

  const handleSystemBaselineChange = (value: GuardrailBaselineSelectValue) => {
    const next = value === "true";
    setIsSystemBaseline(next);
    if (next && status !== "enabled") {
      setStatus("enabled");
    }
  };

  const removeMatchItem = (value: string) => {
    setMatchItems((prev) => prev.filter((item) => item !== value));
  };

  const impactBadges = buildGuardrailImpactBadges({ isSystemBaseline, referenceCount });
  const impactDescriptions = buildGuardrailImpactDescriptions({ isSystemBaseline, referenceCount });
  const validationIssues = buildGuardrailValidationIssues({
    name,
    normalizedMatchItems,
    action,
    isSystemBaseline,
    status,
  });

  const handleSave = async () => {
    if (validationIssues.length > 0) {
      notify.success("保存前请先处理以下问题", { description: validationIssues[0] });
      return;
    }

    setSaving(true);
    try {
      await saveGuardrailRule(
        mode,
        {
          name,
          riskLevel,
          status,
          isSystemBaseline,
          matchItems,
          action,
        },
        editingId,
      );
      notify.success(mode === "create" ? "新增成功" : "保存成功");
      onSuccess();
    } catch (error) {
      notify.error("保存失败", { description: resolveModelHubErrorMessage(error, "安全规则保存失败") });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content-shell">
        <div className="subpage-toolbar mb-7">
          <div className="subpage-toolbar-start">
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-[18px] font-semibold text-foreground">{mode === "create" ? "新增安全规则" : "编辑安全规则"}</h1>
          </div>
        </div>
        <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">正在加载安全规则详情...</div>
      </div>
    );
  }

  return (
    <div className="page-content-shell">
      <div className="subpage-toolbar mb-7">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-[18px] font-semibold text-foreground">{mode === "create" ? "新增安全规则" : "编辑安全规则"}</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1080px] space-y-5">
        <EditorSection title="基础信息">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 px-4">
            <FieldGroup label="规则名称" className="xl:col-span-2">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 文本安全基线" className="workflow-form-input" />
            </FieldGroup>
            <FieldGroup label="风险等级">
              <Select value={riskLevel} onValueChange={(value) => setRiskLevel(value as GuardrailRiskLevel)}>
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {GUARDRAIL_RISK_OPTIONS.map((option) => (
                    <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="状态">
              <Select value={status} onValueChange={(value) => setStatus(value as GuardrailStatus)}>
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {GUARDRAIL_STATUS_OPTIONS.filter((option) => !isSystemBaseline || option.value === "enabled").map((option) => (
                    <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="系统默认基线" className="md:col-span-2 xl:col-span-2">
              <Select value={isSystemBaseline ? "true" : "false"} onValueChange={(value) => handleSystemBaselineChange(value as GuardrailBaselineSelectValue)}>
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {GUARDRAIL_BASELINE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-[12px] text-muted-foreground">
                系统默认基线最多一条；标记为默认基线后，该规则必须保持启用。
              </div>
            </FieldGroup>
          </div>
        </EditorSection>

        <EditorSection title="匹配条件">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 px-4">
            <FieldGroup label="配置方式" className="md:col-span-2 xl:col-span-4">
              <div className="grid gap-3 xl:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Tags className="h-4 w-4 text-primary" />
                    已配置关键词
                  </div>
                  <div className="mt-2 text-[22px] font-semibold leading-none text-foreground">{normalizedMatchItems.length}</div>
                  <div className="mt-2 text-[12px] text-muted-foreground">建议至少维护 3-5 条核心词，覆盖主要高风险表达。</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    匹配方式
                  </div>
                  <div className="mt-2 text-sm font-medium text-foreground">当前仅支持关键词命中</div>
                  <div className="mt-2 text-[12px] text-muted-foreground">适合先把高频风险词、行业黑词、敏感实体沉淀成规则。</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <ClipboardPaste className="h-4 w-4 text-emerald-500" />
                    录入建议
                  </div>
                  <div className="mt-2 text-sm font-medium text-foreground">优先批量导入，再做微调</div>
                  <div className="mt-2 text-[12px] text-muted-foreground">适合同步风控词库、运营黑名单或历史命中词。</div>
                </div>
              </div>
            </FieldGroup>

            <FieldGroup label="场景模板（可选）" className="md:col-span-2 xl:col-span-4">
              <div className="rounded-xl border border-border/70 bg-muted/10">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                  onClick={() => setTemplatePanelOpen((prev) => !prev)}
                  aria-expanded={templatePanelOpen}
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">按业务场景快速生成初始词库</div>
                    <div className="mt-1 text-[12px] text-muted-foreground">
                      默认收起，避免打断主流程。需要时可展开，从 {GUARDRAIL_MATCH_TEMPLATE_GROUPS.length} 个场景模板中选择批量带入。
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Badge variant="outline" className="rounded-md px-2 py-0.5 font-normal">
                      {GUARDRAIL_MATCH_TEMPLATE_GROUPS.length} 个模板
                    </Badge>
                    {templatePanelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </button>
                {templatePanelOpen ? (
                  <div className="border-t border-border/70 px-4 py-4">
                    <div className="grid gap-3 lg:grid-cols-2">
                      {GUARDRAIL_MATCH_TEMPLATE_GROUPS.map((group) => (
                        <div key={group.key} className="rounded-xl border border-border/70 bg-background px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-foreground">{group.title}</div>
                              <div className="mt-1 text-[12px] text-muted-foreground">{group.description}</div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 shrink-0 rounded-lg px-3 text-[12px]"
                              onClick={() => appendMatchItems([...group.items])}
                            >
                              带入模板
                            </Button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {group.items.map((item) => (
                              <Badge key={item} variant="outline" className="rounded-md px-2 py-0.5 text-[11px] font-normal">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </FieldGroup>

            <FieldGroup label="添加关键词" className="md:col-span-2 xl:col-span-4">
              <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 px-4 py-4">
                <Textarea
                  value={batchMatchInput}
                  onChange={(event) => setBatchMatchInput(event.target.value)}
                  placeholder={"支持单条输入或批量粘贴，按换行、逗号、顿号自动拆分\n例如：涉黄，裸露，成人视频"}
                  className="min-h-[128px] resize-y bg-background"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[12px] text-muted-foreground">
                    一个输入框同时支持单条补充和批量导入，适合直接粘贴风控词库、运营整理词表或临时补充新词。
                  </div>
                  <Button type="button" variant="outline" className="h-9 shrink-0 px-4" onClick={importBatchMatchItems}>
                    <ClipboardPaste className="mr-1 h-4 w-4" />
                    添加到关键词
                  </Button>
                </div>
              </div>
            </FieldGroup>

            <FieldGroup label="当前关键词" className="md:col-span-2 xl:col-span-4">
              <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-4">
                {normalizedMatchItems.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {normalizedMatchItems.map((item) => (
                      <div
                        key={item}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[12px] text-foreground"
                      >
                        <span>{item}</span>
                        <button
                          type="button"
                          className="rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          onClick={() => removeMatchItem(item)}
                          aria-label={`移除关键词 ${item}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/80 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
                    还没有配置关键词。可以先选择上方模板，或把现有词表批量粘贴进来。
                  </div>
                )}
                {/* <div className="mt-3 text-[12px] text-muted-foreground">
                  系统会按关键词列表做命中判断；重复词会自动去重，保存时只提交有效项。
                </div> */}
              </div>
            </FieldGroup>
          </div>
        </EditorSection>

        <EditorSection title="处置动作">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 px-4">
            <FieldGroup label="处置动作">
              <Select value={action} onValueChange={(value) => setAction(value as GuardrailAction)}>
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {GUARDRAIL_ACTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>
          </div>
        </EditorSection>

        <EditorSection title="当前影响">
          <div className="rounded-md border border-border/60 bg-muted/10 px-4 py-4">
            <div className="mb-2 flex items-center gap-2">
              {impactBadges.map((badge) => (
                <Badge key={badge} variant={badge === "系统默认基线" ? "secondary" : referenceCount > 0 ? "outline" : "secondary"}>
                  {badge}
                </Badge>
              ))}
              {referenceCount > 0 ? <span className="text-sm text-muted-foreground">{referenceCount} 个 API Key 正在使用</span> : null}
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              {impactDescriptions.map((description) => (
                <div key={description}>{description}</div>
              ))}
            </div>
            {validationIssues.length > 0 ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                <div className="font-medium text-amber-900">当前还有待处理项</div>
                <div className="mt-2 space-y-1">
                  {validationIssues.map((issue) => (
                    <div key={issue}>- {issue}</div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </EditorSection>

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" className="subpage-outline-btn !h-10 !px-5" onClick={onCancel}>
            取消
          </Button>
          <Button className="subpage-primary-btn !h-10 !px-5" onClick={() => void handleSave()} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
