import { ArrowLeft, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
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
import ModelHubVendorEditorDialog, { getVendorFallback, type VendorFormValue, type VendorStatus } from "@/modules/modelhub/components/ModelHubVendorEditorDialog";

type VendorItem = {
  id: string;
  name: string;
  logoUrl: string;
  description: string;
  status: VendorStatus;
  updatedAt: string;
  modelCount: number;
};

const STATUS_FILTER_OPTIONS: Array<{ value: "all" | VendorStatus; label: string }> = [
  { value: "all", label: "全部" },
  { value: "启用", label: "启用" },
  { value: "停用", label: "停用" },
];

const EMPTY_FORM: VendorFormValue = {
  name: "",
  logoUrl: "",
  description: "",
  status: "启用",
};

export default function ModelHubVendorManagerPage(props: {
  items: VendorItem[];
  onBack: () => void;
  onSave: (value: VendorFormValue) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [activeStatus, setActiveStatus] = useState<"all" | VendorStatus>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<VendorFormValue>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<VendorItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const applyKeywordSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
  };

  const filteredItems = useMemo(() => {
    const trimmedKeyword = appliedKeyword.trim();
    return props.items.filter((item) => {
      const matchesKeyword = !trimmedKeyword
        || [item.name, item.description, item.id].some((value) => value.toLowerCase().includes(trimmedKeyword.toLowerCase()));
      const matchesStatus = activeStatus === "all" || item.status === activeStatus;
      return matchesKeyword && matchesStatus;
    });
  }, [activeStatus, appliedKeyword, props.items]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (item: VendorItem) => {
    setForm({
      id: item.id,
      name: item.name,
      logoUrl: item.logoUrl,
      description: item.description,
      status: item.status,
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      await props.onDelete(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    await props.onSave({
      ...form,
      name: form.name.trim(),
      logoUrl: form.logoUrl.trim(),
      description: form.description.trim(),
    });
    setDialogOpen(false);
    resetForm();
  };

  return (
    <>
      <div className="page-content-shell">
        <div className="subpage-toolbar mb-7">
          <div className="subpage-toolbar-start">
            <Button variant="ghost" size="icon" onClick={props.onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-[18px] font-semibold text-foreground">厂商配置</h1>
          </div>
          <div className="subpage-toolbar-end">
            <Button className="subpage-primary-btn" onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-1" />
              新增厂商
            </Button>
          </div>
        </div>

        <div className="subpage-toolbar mb-4">
          <div className="subpage-toolbar-start !flex-nowrap">
            <Select value={activeStatus} onValueChange={(value: "all" | VendorStatus) => setActiveStatus(value)}>
              <SelectTrigger className="subpage-native-select w-[140px] shrink-0">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="subpage-search-wrap !w-[380px] !max-w-[380px] shrink-0">
              <Search className="subpage-search-icon" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyKeywordSearch();
                  }
                }}
                placeholder="搜索厂商名称 / 说明 / 编号，回车搜索"
                className="subpage-search-input"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[980px] text-[13px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">厂商</TableHead>
                <TableHead className="min-w-[280px]">说明</TableHead>
                <TableHead className="w-[140px]">关联基础模型</TableHead>
                <TableHead className="w-[120px] text-center">状态</TableHead>
                <TableHead className="min-w-[160px]">更新时间</TableHead>
                <TableHead className="sticky right-0 z-20 w-[120px] min-w-[120px] bg-background shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    暂无厂商信息
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 rounded-md">
                          <AvatarImage src={item.logoUrl || undefined} alt={item.name} className="object-cover" />
                          <AvatarFallback className="rounded-md bg-primary/10 text-primary text-xs font-medium">
                            {getVendorFallback(item.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">{item.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{item.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground leading-6">{item.description || "-"}</TableCell>
                    <TableCell className="font-medium">{item.modelCount}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        {item.status === "启用" ? (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50">
                            启用
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-slate-700 border-slate-300 bg-slate-50">
                            停用
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.updatedAt}</TableCell>
                    <TableCell className="sticky right-0 z-10 w-[120px] min-w-[120px] bg-background px-3 py-2 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-primary hover:text-primary"
                          title="编辑"
                          aria-label="编辑"
                          onClick={() => openEditDialog(item)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-rose-600 hover:text-rose-700"
                          title={item.modelCount > 0 ? `该厂商仍被 ${item.modelCount} 个基础模型引用，无法删除` : "删除"}
                          aria-label="删除"
                          disabled={deleting || item.modelCount > 0}
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ModelHubVendorEditorDialog
        open={dialogOpen}
        form={form}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
        onFormChange={setForm}
        onSubmit={submit}
      />
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除厂商「{deleteTarget?.name}」？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? "删除中" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
