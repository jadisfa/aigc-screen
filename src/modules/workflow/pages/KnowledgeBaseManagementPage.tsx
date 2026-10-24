import { Plus, Settings, ArrowLeft, Upload, FileText, Globe, ChevronDown, Star, X, CloudUpload, CheckSquare, Square, AlertTriangle } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
} from "@/shared/components/page";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
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

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: string;
}

const KnowledgeBaseManagement = () => {
  const [view, setView] = useState<"list" | "create" | "config">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const applyKeywordSearch = () => {
    setSearchQuery(searchQuery.trim());
  };

  // Create form state
  const [selectedService, setSelectedService] = useState("dify");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Config form state
  const [segmentDelimiter, setSegmentDelimiter] = useState("\\n\\n");
  const [maxLength, setMaxLength] = useState("1024");
  const [overlapLength, setOverlapLength] = useState("50");
  const [replaceSpaces, setReplaceSpaces] = useState(true);
  const [removeUrls, setRemoveUrls] = useState(false);
  const [useQA, setUseQA] = useState(false);
  const [indexMode, setIndexMode] = useState<"quality" | "economy">("quality");
  const [embeddingModel, setEmbeddingModel] = useState("");

  const supportedFormats = ["PDF", "DOCX", "TXT", "MD", "XLSX", "CSV", "HTML", "+更多"];

  const resetForm = () => {
    setSelectedService("dify");
    setUploadedFiles([]);
    setSegmentDelimiter("\\n\\n");
    setMaxLength("1024");
    setOverlapLength("50");
    setReplaceSpaces(true);
    setRemoveUrls(false);
    setUseQA(false);
    setIndexMode("quality");
    setEmbeddingModel("");
  };

  const handleCancelConfirm = () => {
    setCancelDialogOpen(false);
    resetForm();
    setView("list");
  };

  const handleSave = () => {
    resetForm();
    setView("list");
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const newFiles: UploadedFile[] = files.map((f, i) => ({
      id: `${Date.now()}-${i}`,
      name: f.name,
      size: f.size < 1024 ? `${f.size} B` : f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(2)} KB` : `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
      type: f.name.split(".").pop()?.toUpperCase() || "FILE",
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newFiles: UploadedFile[] = files.map((f, i) => ({
      id: `${Date.now()}-${i}`,
      name: f.name,
      size: f.size < 1024 ? `${f.size} B` : f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(2)} KB` : `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
      type: f.name.split(".").pop()?.toUpperCase() || "FILE",
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Config view (Step 2)
  if (view === "config") {
    return (
      <PageShell>
        <PageHeader
          title={
            <div className="page-header-start">
              <Button variant="ghost" size="icon" onClick={() => setView("create")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="page-title">文档处理配置</h1>
            </div>
          }
        />

        <div className="max-w-[960px] mx-auto space-y-8">
          {/* 分段设置 */}
          <div>
            <h3 className="text-base font-semibold text-foreground mb-6">分段设置</h3>
            <div className="space-y-5 pl-2">
              <div className="flex items-center gap-4">
                <label className="w-[120px] text-sm text-foreground text-right shrink-0">分段标识符</label>
                <Input
                  className="max-w-[400px]"
                  value={segmentDelimiter}
                  onChange={(e) => setSegmentDelimiter(e.target.value)}
                  placeholder="默认为: \n\n"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="w-[120px] text-sm text-foreground text-right shrink-0">分段最大长度</label>
                <div className="flex items-center gap-2">
                  <Input
                    className="max-w-[400px]"
                    value={maxLength}
                    onChange={(e) => setMaxLength(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">characters</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-[120px] text-sm text-foreground text-right shrink-0">分段重叠长度</label>
                <div className="flex items-center gap-2">
                  <Input
                    className="max-w-[400px]"
                    value={overlapLength}
                    onChange={(e) => setOverlapLength(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">characters</span>
                </div>
              </div>
            </div>
          </div>

          {/* 文本处理规则 */}
          <div>
            <h3 className="text-base font-semibold text-foreground mb-6">文本处理规则</h3>
            <div className="space-y-3 pl-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={replaceSpaces} onCheckedChange={(v) => setReplaceSpaces(!!v)} />
                替换连续的空格、换行符和制表符
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={removeUrls} onCheckedChange={(v) => setRemoveUrls(!!v)} />
                删除所有 URL 和电子邮件地址
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={useQA} onCheckedChange={(v) => setUseQA(!!v)} />
                <span>使用 Q&A 分段，语言</span>
                <span className="px-2 py-0.5 rounded bg-secondary text-xs">简体中文</span>
              </label>
              <button className="text-xs text-primary mt-1 hover:underline">重置为默认设置</button>
            </div>
          </div>

          {/* 索引方式 */}
          <div>
            <h3 className="text-base font-semibold text-foreground mb-6">索引方式</h3>
            <div className="grid grid-cols-2 gap-4 pl-2">
              <div
                onClick={() => setIndexMode("quality")}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  indexMode === "quality" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-primary" />
                  <span className="font-medium text-sm text-foreground">高质量</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">推荐</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  调用嵌入模型处理文档以实现更精确的检索，可以帮助 LLM 生成高质量的答案。
                </p>
              </div>
              <div
                onClick={() => setIndexMode("economy")}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  indexMode === "economy" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium text-sm text-foreground">经济</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  每个数据块使用 10 个关键词进行检索，不会消耗任何 tokens，但会以降低检索准确性为代价。
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg border border-border bg-secondary/50 mt-4 ml-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                使用高质量模式进行嵌入后，无法切换回经济模式。
              </p>
            </div>
          </div>

          {/* Embedding 模型 */}
          <div>
            <h3 className="text-base font-semibold text-foreground mb-6">Embedding 模型</h3>
            <div className="space-y-5 pl-2">
              <div className="flex items-center gap-4">
                <label className="w-[120px] text-sm text-foreground text-right shrink-0">模型选择</label>
                <Select value={embeddingModel} onValueChange={setEmbeddingModel}>
                  <SelectTrigger className="max-w-[400px]">
                    <SelectValue placeholder="选择 Embedding 模型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text-embedding-3-small">text-embedding-3-small</SelectItem>
                    <SelectItem value="text-embedding-3-large">text-embedding-3-large</SelectItem>
                    <SelectItem value="text-embedding-ada-002">text-embedding-ada-002</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 mt-8 pb-8">
            <Button variant="pageOutline" onClick={() => setCancelDialogOpen(true)}>
              取 消
            </Button>
            <Button variant="page" onClick={handleSave}>
              保存并处理
            </Button>
          </div>
        </div>

        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认取消</AlertDialogTitle>
              <AlertDialogDescription>
                确定要取消创建知识库吗？已填写的内容将不会保存。
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

  // Create view (Step 1)
  if (view === "create") {
    return (
      <PageShell>
        <PageHeader
          title={
            <div className="page-header-start">
              <Button variant="ghost" size="icon" onClick={() => setView("list")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="page-title">创建知识库</h1>
            </div>
          }
        />

        <div className="max-w-[960px] mx-auto space-y-8">
          {/* 知识库服务 */}
          <div>
            <h3 className="text-base font-semibold text-foreground mb-6">知识库服务</h3>
            <div className="space-y-5 pl-2">
              <div className="flex items-center gap-4">
                <label className="w-[120px] text-sm text-foreground text-right shrink-0">
                  <span className="text-destructive">*</span> 服务类型
                </label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger className="max-w-[400px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dify">dify知识库</SelectItem>
                    <SelectItem value="custom">自定义知识库</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 文件上传 */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-semibold text-foreground">文件上传</h3>
              <button
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <FileText className="w-3.5 h-3.5" />
                创建空知识库
              </button>
            </div>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver ? "border-primary bg-primary/5" : "border-border"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
            >
              <CloudUpload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm font-medium text-foreground mb-1">
                拖拽文件至此，或者 <button onClick={() => fileInputRef.current?.click()} className="text-primary hover:underline">点击选择文件</button>
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                支持多文件上传，也可以使用 <kbd className="px-1 py-0.5 rounded bg-secondary text-xs">Ctrl+V</kbd> 粘贴
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {supportedFormats.map((fmt) => (
                  <span key={fmt} className="px-2.5 py-1 rounded-full border border-border text-xs text-muted-foreground">
                    {fmt}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">单个文件不超过 15MB</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.docx,.txt,.md,.xlsx,.csv,.html"
              />
            </div>
          </div>

          {/* 已上传文件 */}
          {uploadedFiles.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-foreground mb-6">已上传文件 ({uploadedFiles.length})</h3>
              <div className="space-y-2">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
                    <FileText className="w-8 h-8 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{file.type}</span>
                        <span className="text-xs text-muted-foreground">{file.size}</span>
                      </div>
                    </div>
                    <button onClick={() => removeFile(file.id)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 mt-8 pb-8">
            <Button variant="pageOutline" onClick={() => setCancelDialogOpen(true)}>
              取 消
            </Button>
            <Button variant="page" onClick={() => setView("config")} disabled={uploadedFiles.length === 0}>
              下一步
            </Button>
          </div>
        </div>

        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认取消</AlertDialogTitle>
              <AlertDialogDescription>
                确定要取消创建知识库吗？已填写的内容将不会保存。
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
  return (
    <PageShell>
      <PageHeader
        title="知识库管理"
        actions={
          <Button variant="pageOutline">
            <Settings className="w-4 h-4" />
            管理服务配置
          </Button>
        }
      />
      <PageFilterBar>
        <SearchField
          wrapClassName="!max-w-[280px]"
          placeholder="搜索知识库，回车搜索"
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Create Card */}
        <div
          onClick={() => setView("create")}
          className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center">
              <Plus className="w-5 h-5 text-background" />
            </div>
            <span className="text-sm font-medium text-foreground">创建知识库</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            导入自己的文本数据以增强LLM上下文
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-xs text-primary">
              <Upload className="w-3.5 h-3.5" />
              上传文档
            </span>
            <span className="flex items-center gap-1 text-xs text-primary">
              <FileText className="w-3.5 h-3.5" />
              文本输入
            </span>
            <span className="flex items-center gap-1 text-xs text-destructive">
              <Globe className="w-3.5 h-3.5" />
              网页抓取
            </span>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default KnowledgeBaseManagement;

