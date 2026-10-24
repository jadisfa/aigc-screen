import { Store, Plus, FileText, Image, Code, Pencil, ArrowLeft, Upload, Settings } from "lucide-react";
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

interface Skill {
  id: string;
  name: string;
  description: string;
  citations: number;
  resources: number;
  scripts: number;
}

const mockSkills: Skill[] = [
  {
    id: "1",
    name: "Markdown渲染echart图表",
    description: "用以将数据在Markdown中渲染为echart图表",
    citations: 1,
    resources: 0,
    scripts: 0,
  },
  {
    id: "2",
    name: "公众号配图",
    description: "根据用户提供的公众号文章段落内容，为每一段自动生成一张高质量、风格一致的配图，确保视觉统一性和品牌调性。",
    citations: 0,
    resources: 0,
    scripts: 0,
  },
];

const SkillManagement = () => {
  const [view, setView] = useState<"list" | "create">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Create form state
  const [skillName, setSkillName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [skillDesc, setSkillDesc] = useState("");
  const [skillCommand, setSkillCommand] = useState("");


  const resetForm = () => {
    setSkillName("");
    setDisplayName("");
    setSkillDesc("");
    setSkillCommand("");
  };

  const handleCreate = () => {
    // TODO: save skill
    resetForm();
    setView("list");
  };

  const handleCancelConfirm = () => {
    setCancelDialogOpen(false);
    resetForm();
    setView("list");
  };

  if (view === "create") {
    return (
      <PageShell>
        <PageHeader
          title={
            <div className="page-header-start">
              <Button variant="ghost" size="icon" onClick={() => setView("list")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="page-title">创建技能</h1>
            </div>
          }
        />

        <div className="max-w-[960px] mx-auto space-y-8">
          {/* 基本信息 */}
          <div>
            <h3 className="text-base font-semibold text-foreground mb-6">基本信息</h3>
            <div className="space-y-5 pl-2">
              {/* 技能名称 */}
              <div className="flex items-center gap-4">
                <label className="w-[120px] text-sm text-foreground text-right shrink-0">
                  <span className="text-destructive">*</span> 技能名称
                </label>
                <Input
                  className="max-w-[400px]"
                  placeholder="输入技能名称"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                />
              </div>
              {/* 显示名称 */}
              <div className="flex items-center gap-4">
                <label className="w-[120px] text-sm text-foreground text-right shrink-0">
                  显示名称
                </label>
                <Input
                  className="max-w-[400px]"
                  placeholder="输入显示名称"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              {/* 技能描述 */}
              <div className="flex items-start gap-4">
                <label className="w-[120px] text-sm text-foreground text-right shrink-0 mt-2">
                  <span className="text-destructive">*</span> 技能描述
                </label>
                <Textarea
                  className="max-w-[400px]"
                  placeholder="简短描述技能的功能"
                  rows={2}
                  value={skillDesc}
                  onChange={(e) => setSkillDesc(e.target.value)}
                />
              </div>
              {/* 技能指令 */}
              <div className="flex items-start gap-4">
                <label className="w-[120px] text-sm text-foreground text-right shrink-0 mt-2">
                  <span className="text-destructive">*</span> 技能指令
                </label>
                <Textarea
                  className="max-w-[560px]"
                  placeholder="完整的技能指令（SKILL.md 内容）"
                  rows={6}
                  value={skillCommand}
                  onChange={(e) => setSkillCommand(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 引用文档 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">引用文档</h3>
              <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                <FileText className="w-3.5 h-3.5" />
                新建
              </button>
            </div>
            <div className="border border-border rounded-lg p-8 flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">暂无引用文档，点击上方按钮新建</p>
            </div>
          </div>

          {/* 静态资源 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">静态资源</h3>
              <button className="flex items-center gap-1 text-xs text-foreground hover:underline">
                <Plus className="w-3.5 h-3.5" />
                新增
              </button>
            </div>
            <div className="border border-border rounded-lg p-8 flex flex-col items-center justify-center text-muted-foreground">
              <Image className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">暂无静态资源</p>
            </div>
          </div>

          {/* 脚本 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">脚本</h3>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-1 text-xs text-foreground hover:underline">
                  <Plus className="w-3.5 h-3.5" />
                  新增
                </button>
                <button className="flex items-center gap-1 text-xs text-foreground hover:underline">
                  <Upload className="w-3.5 h-3.5" />
                  上传
                </button>
                <button className="flex items-center gap-1 text-xs text-foreground hover:underline">
                  <Settings className="w-3.5 h-3.5" />
                  脚本沙箱环境管理
                </button>
              </div>
            </div>
            <div className="border border-border rounded-lg p-8 flex flex-col items-center justify-center text-muted-foreground">
              <Code className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">暂无脚本</p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 mt-8 pb-8">
            <Button variant="pageOutline" onClick={() => setCancelDialogOpen(true)}>
              取 消
            </Button>
            <Button variant="page" onClick={handleCreate}>
              创建技能
            </Button>
          </div>
        </div>

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认取消</AlertDialogTitle>
              <AlertDialogDescription>
                确定要取消创建技能吗？已填写的内容将不会保存。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>继续编辑</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelConfirm}>确认取消</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageShell>
    );
  }

  // List view
  const applyKeywordSearch = () => {
    const normalized = searchQuery.trim();
    setSearchQuery(normalized);
    setAppliedSearchQuery(normalized);
  };

  return (
    <PageShell>
      <PageHeader
        title="技能管理"
        actions={
          <Button variant="page">
            <Store className="w-4 h-4" />
            技能商店
          </Button>
        }
      />
      <PageFilterBar>
        <SearchField
          wrapClassName="!max-w-[280px]"
          placeholder="搜索技能，回车搜索"
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

      {/* Skill Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Create Skill Card */}
        <div
          onClick={() => setView("create")}
          className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <Plus className="w-5 h-5 text-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-sm font-medium text-foreground">创建技能</span>
          </div>
          <p className="text-sm text-muted-foreground mb-8">
            创建自定义技能，为智能体添加专业能力
          </p>
          <div className="border-t border-border pt-3 flex items-center gap-4">
            <span className="flex items-center gap-1 text-xs text-primary">
              <FileText className="w-3.5 h-3.5" />
              指令
            </span>
            <span className="flex items-center gap-1 text-xs text-primary">
              <FileText className="w-3.5 h-3.5" />
              引用
            </span>
            <span className="flex items-center gap-1 text-xs text-primary">
              <Image className="w-3.5 h-3.5" />
              资源
            </span>
            <span className="flex items-center gap-1 text-xs text-primary">
              <Code className="w-3.5 h-3.5" />
              脚本
            </span>
          </div>
        </div>

        {/* Existing Skills */}
        {mockSkills
          .filter((s) => s.name.includes(appliedSearchQuery) || s.description.includes(appliedSearchQuery))
          .map((skill) => (
            <div
              key={skill.id}
              className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-foreground flex items-center justify-center">
                  <svg className="w-5 h-5 text-background" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-foreground">{skill.name}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-8 line-clamp-2">
                {skill.description}
              </p>
              <div className="border-t border-border pt-3 flex items-center gap-4">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="w-3.5 h-3.5" />
                  引用{skill.citations}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Image className="w-3.5 h-3.5" />
                  资源{skill.resources}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Code className="w-3.5 h-3.5" />
                  脚本{skill.scripts}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto cursor-pointer hover:text-foreground">
                  <Pencil className="w-3.5 h-3.5" />
                  修改
                </span>
              </div>
            </div>
          ))}
      </div>
    </PageShell>
  );
};

export default SkillManagement;

