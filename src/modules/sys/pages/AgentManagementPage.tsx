import {
  Store, Plus, ArrowLeft, Pencil, ExternalLink, Eye, EyeOff,
  ChevronDown, ChevronRight, HelpCircle, Bot, FileText, Zap, Brain,
  Settings, Wrench, BookOpen, Calendar, Sparkles, X, Trash2
} from "lucide-react";
import { useState } from "react";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
} from "@/shared/components/page";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Switch } from "@/shared/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { notify } from "@/shared/lib/notify";
interface Agent {
  id: string;
  name: string;
  description: string;
  date: string;
  visible: boolean;
}

const mockAgents: Agent[] = [
  { id: "1", name: "翻译", description: "中译英", date: "2025/7/18", visible: true },
  { id: "2", name: "测试", description: "", date: "2025/9/21", visible: false },
  { id: "3", name: "智能产品宣传图生成器", description: "根据用户上传的产品图片，自动分析产品特征并生成产品宣传图文案及配图。支持自定义文案风格，主要应用于电商商品上架、产品宣传册制作等场景，批量帮助提升营销内容创作效率。", date: "2026/3/11", visible: true },
  { id: "4", name: "微信公众号发布", description: "根据主题写出图文并茂的公众号并发布", date: "2026/3/11", visible: true },
  { id: "5", name: "分镜大师-把故事设计为分镜头片段", description: "把你的故事拆分为电影级的分镜头片段", date: "2026/3/11", visible: true },
  { id: "6", name: "首页搭建助手", description: "专业的网页首页搭建 AI 助手，可以通过对话方式帮你设计和修改首页布局、组件和样式。", date: "2026/3/11", visible: true },
];

interface SkillItem {
  id: string;
  name: string;
}

interface ToolItem {
  id: string;
  name: string;
  tag?: string;
}

const AgentManagement = () => {
  const [view, setView] = useState<"list" | "create">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Create form state
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-3-pro");
  const [userPromptTemplate, setUserPromptTemplate] = useState("");
  const [skills, setSkills] = useState<SkillItem[]>([
    { id: "1", name: "公众号配图 (gongzhonghaopeitu)" },
  ]);
  const [tools, setTools] = useState<ToolItem[]>([
    { id: "1", name: "MCP 工具", tag: "全部" },
  ]);
  const [maxLoops, setMaxLoops] = useState("10");
  const [hideSkillDetails, setHideSkillDetails] = useState(false);
  const [enableGetPost, setEnableGetPost] = useState(false);
  const [allowScript, setAllowScript] = useState(false);
  const [enableInternalApi, setEnableInternalApi] = useState(false);

  // Collapsible sections
  const [sections, setSections] = useState({
    model: true,
    userPrompt: true,
    skills: true,
    tools: true,
    knowledge: true,
    advanced: true,
    internalApi: true,
    guidePrompt: true,
  });

  const toggleSection = (key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hasFormContent = () => {
    return systemPrompt.trim() !== "" || userPromptTemplate.trim() !== "";
  };

  const resetForm = () => {
    setSystemPrompt("");
    setSelectedModel("gemini-3-pro");
    setUserPromptTemplate("");
    setSkills([{ id: "1", name: "公众号配图 (gongzhonghaopeitu)" }]);
    setTools([{ id: "1", name: "MCP 工具", tag: "全部" }]);
    setMaxLoops("10");
    setHideSkillDetails(false);
    setEnableGetPost(false);
    setAllowScript(false);
    setEnableInternalApi(false);
  };

  const handleBack = () => {
    if (hasFormContent()) {
      setCancelDialogOpen(true);
    } else {
      resetForm();
      setView("list");
    }
  };

  const handleCancel = () => {
    if (hasFormContent()) {
      setCancelDialogOpen(true);
    } else {
      resetForm();
      setView("list");
    }
  };

  const handleCancelConfirm = () => {
    setCancelDialogOpen(false);
    resetForm();
    setView("list");
  };

  const handlePublish = () => {
    if (!systemPrompt.trim()) {
      notify.error("请填写系统提示词");
      return;
    }
    // TODO: save agent
    notify.success("智能体发布成功");
    resetForm();
    setView("list");
  };

  const removeSkill = (id: string) => setSkills((prev) => prev.filter((s) => s.id !== id));
  const removeTool = (id: string) => setTools((prev) => prev.filter((t) => t.id !== id));

  // Create view
  if (view === "create") {
    return (
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-semibold text-foreground">创建智能体</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              取 消
            </Button>
            <Button size="sm" onClick={handlePublish}>
              保存
            </Button>
          </div>
        </div>

        {/* Three-column layout */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left column: System Prompt */}
          <div className="w-[360px] border-r border-border flex flex-col shrink-0">
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">系统提示词</span>
                <span className="text-destructive text-xs">*</span>
              </div>
              <button className="text-xs text-primary hover:underline flex items-center gap-1">
                + 变量
              </button>
            </div>
            <div className="flex-1 px-5 pb-4 overflow-y-auto">
              <Textarea
                placeholder="请输入系统提示词，定义 Agent 的角色、目标和行为规范"
                className="min-h-[400px] resize-none border-none shadow-none p-0 focus-visible:ring-0 text-sm"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
            </div>
            {/* Recommendation templates */}
            <div className="px-5 py-4 border-t border-border">
              <span className="text-xs text-muted-foreground mb-3 block">推荐</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { title: "通用结构", desc: "适用于多种场景的提示词结构，可以根据具体场景去套用模板" },
                  { title: "任务执行", desc: "适用于有明确的工作步骤的任务执行场景，适合明确每一步需的工作要求..." },
                  { title: "角色扮演", desc: "适用于聊天陪伴、互动模拟场景，可帮助配置一个性化角色..." },
                ].map((tpl) => (
                  <div
                    key={tpl.title}
                    className="border border-border rounded-lg p-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                  >
                    <p className="text-xs font-medium text-foreground mb-1">{tpl.title}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{tpl.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Middle column: 编排 */}
          <div className="flex-1 overflow-y-auto border-r border-border">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">编排</span>
            </div>

            <div className="p-5 space-y-0">
              {/* 模型 */}
              <CollapsibleSection
                icon={<Brain className="w-4 h-4" />}
                title="模型"
                expanded={sections.model}
                onToggle={() => toggleSection("model")}
              >
                <div className="px-4 pb-4">
                  <label className="text-sm text-foreground mb-1.5 block">
                    大模型 <span className="text-destructive">*</span>
                  </label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-3-pro">Gemini-3 Pro 预览版</SelectItem>
                      <SelectItem value="gemini-2.5-flash">Gemini-2.5 Flash</SelectItem>
                      <SelectItem value="gpt-5">GPT-5</SelectItem>
                      <SelectItem value="gpt-5-mini">GPT-5 Mini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleSection>

              {/* 用户提示词模板 */}
              <CollapsibleSection
                icon={<FileText className="w-4 h-4" />}
                title="用户提示词模板"
                expanded={sections.userPrompt}
                onToggle={() => toggleSection("userPrompt")}
                extra={
                  <button className="text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                    + 变量
                  </button>
                }
              >
                <div className="px-4 pb-4">
                  <Textarea
                    placeholder="用户提示词模板，可以使用{{变量名}}的方式引用"
                    rows={4}
                    value={userPromptTemplate}
                    onChange={(e) => setUserPromptTemplate(e.target.value)}
                  />
                </div>
              </CollapsibleSection>

              {/* 技能 */}
              <CollapsibleSection
                icon={<Zap className="w-4 h-4" />}
                title="技能"
                expanded={sections.skills}
                onToggle={() => toggleSection("skills")}
                hasInfo
                extra={
                  <button className="text-xs text-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
                    +
                  </button>
                }
              >
                <div className="px-4 pb-4 space-y-2">
                  {skills.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无技能，点击右上角 + 号添加</p>
                  ) : (
                    skills.map((skill) => (
                      <div key={skill.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border">
                        <Zap className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-sm text-foreground">{skill.name}</span>
                        <button onClick={() => removeSkill(skill.id)} className="text-destructive hover:text-destructive/80">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </CollapsibleSection>

              {/* 工具与能力 */}
              <CollapsibleSection
                icon={<Wrench className="w-4 h-4" />}
                title="工具与能力"
                expanded={sections.tools}
                onToggle={() => toggleSection("tools")}
                hasInfo
                extra={
                  <button className="text-xs text-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
                    +
                  </button>
                }
              >
                <div className="px-4 pb-4 space-y-2">
                  {tools.map((tool) => (
                    <div key={tool.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border">
                      <Wrench className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm text-foreground">{tool.name}</span>
                      {tool.tag && (
                        <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">{tool.tag}</span>
                      )}
                      <button onClick={() => removeTool(tool.id)} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              {/* 知识库 */}
              <CollapsibleSection
                icon={<BookOpen className="w-4 h-4" />}
                title="知识库"
                expanded={sections.knowledge}
                onToggle={() => toggleSection("knowledge")}
                extra={
                  <button className="text-xs text-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
                    +
                  </button>
                }
              >
                <div className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground text-center py-4">暂无知识库，点击右上角 + 号添加</p>
                </div>
              </CollapsibleSection>

              {/* 高级设置 */}
              <CollapsibleSection
                icon={<Settings className="w-4 h-4" />}
                title="高级设置"
                expanded={sections.advanced}
                onToggle={() => toggleSection("advanced")}
              >
                <div className="px-4 pb-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      最大回环次数
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <Input
                      value={maxLoops}
                      onChange={(e) => setMaxLoops(e.target.value)}
                      className="w-20 text-right text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      隐藏技能调用详情
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <Switch checked={hideSkillDetails} onCheckedChange={setHideSkillDetails} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      启用 GET 和 POST 工具
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <Switch checked={enableGetPost} onCheckedChange={setEnableGetPost} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      允许脚本执行
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <Switch checked={allowScript} onCheckedChange={setAllowScript} />
                  </div>
                </div>
              </CollapsibleSection>

              {/* 内部 API 调用 */}
              <CollapsibleSection
                icon={<span className="text-xs font-bold text-muted-foreground">API</span>}
                title="内部 API 调用"
                expanded={sections.internalApi}
                onToggle={() => toggleSection("internalApi")}
              >
                <div className="px-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      启用内部 API 调用
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <Switch checked={enableInternalApi} onCheckedChange={setEnableInternalApi} />
                  </div>
                </div>
              </CollapsibleSection>

              {/* 配置使用指导提示 */}
              <CollapsibleSection
                icon={<BookOpen className="w-4 h-4" />}
                title="配置使用指导提示"
                expanded={sections.guidePrompt}
                onToggle={() => toggleSection("guidePrompt")}
                hasInfo
                extra={
                  <button className="text-destructive hover:text-destructive/80" onClick={(e) => e.stopPropagation()}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                }
              >
                <div className="px-4 pb-4">
                  <div className="flex items-center gap-3">
                    <Select defaultValue="image">
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">图片描述</SelectItem>
                        <SelectItem value="text">文字描述</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="显示在右侧为使用者的使用指导文和注意事项描述" className="flex-1" />
                    <Button variant="outline" size="sm">+ 上传</Button>
                  </div>
                </div>
              </CollapsibleSection>
            </div>
          </div>

          {/* Right column: Preview */}
          <div className="w-[320px] shrink-0 flex flex-col">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">预览与调试</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6">
              <Bot className="w-16 h-16 mb-3 opacity-30" />
              <p className="text-sm">预览与调试功能即将上线</p>
            </div>
          </div>
        </div>

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认取消</AlertDialogTitle>
              <AlertDialogDescription>
                确定要取消创建智能体吗？已填写的内容将不会保存。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>继续编辑</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelConfirm}>确认取消</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  const applyKeywordSearch = () => {
    const normalized = searchQuery.trim();
    setSearchQuery(normalized);
    setAppliedSearchQuery(normalized);
  };

  // List view
  const filteredAgents = mockAgents.filter(
    (a) => a.name.includes(appliedSearchQuery) || a.description.includes(appliedSearchQuery)
  );

  return (
    <PageShell>
      <PageHeader
        title="智能体管理"
        actions={
          <Button variant="page">
            <Store className="w-4 h-4" />
            智能体商店
          </Button>
        }
      />
      <PageFilterBar>
        <SearchField
          wrapClassName="!max-w-[280px]"
          placeholder="搜索智能体，回车搜索"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyKeywordSearch();
            }
          }}
        />
      </PageFilterBar>

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Create Agent Card */}
        <div
          onClick={() => setView("create")}
          className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <Plus className="w-5 h-5 text-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-sm font-medium text-primary">创建智能体</span>
          </div>
          <p className="text-sm text-muted-foreground mb-8">
            创建自定义智能体，配置提示词和技能
          </p>
          <div className="border-t border-border pt-3 flex items-center gap-4">
            <span className="flex items-center gap-1 text-xs text-primary">
              <FileText className="w-3.5 h-3.5" />
              提示词
            </span>
            <span className="flex items-center gap-1 text-xs text-primary">
              <Zap className="w-3.5 h-3.5" />
              技能
            </span>
            <span className="flex items-center gap-1 text-xs text-primary">
              <BookOpen className="w-3.5 h-3.5" />
              知识库
            </span>
          </div>
        </div>

        {/* Existing Agents */}
        {filteredAgents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-background" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{agent.name}</span>
                  {agent.visible ? (
                    <Eye className="w-3.5 h-3.5 text-primary shrink-0" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6 line-clamp-2 min-h-[40px]">
              {agent.description || "暂无描述"}
            </p>
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                {agent.date}
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                  <Pencil className="w-3.5 h-3.5" />
                  编辑
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                  <ExternalLink className="w-3.5 h-3.5" />
                  访问
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
};

// Collapsible section sub-component
interface CollapsibleSectionProps {
  icon: React.ReactNode;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  hasInfo?: boolean;
  extra?: React.ReactNode;
  children: React.ReactNode;
}

const CollapsibleSection = ({ icon, title, expanded, onToggle, hasInfo, extra, children }: CollapsibleSectionProps) => (
  <div className="border border-border rounded-lg overflow-hidden mb-3">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        {title}
        {hasInfo && <HelpCircle className="w-3.5 h-3.5 text-primary" />}
      </div>
      <div className="flex items-center gap-2">
        {extra}
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </div>
    </button>
    {expanded && children}
  </div>
);

export default AgentManagement;

