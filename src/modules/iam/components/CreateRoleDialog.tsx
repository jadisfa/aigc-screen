import type { CreateRoleCommand } from "@/shared/api/ums/iam";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import {
  DEFAULT_RBAC_SOURCE,
  RBAC_SOURCE_OPTIONS,
  ROLE_SCOPE_OPTIONS,
} from "@/modules/iam/lib/rbac";

type CreateRoleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "create" | "edit";
  form: CreateRoleCommand;
  codeDisabled?: boolean;
  codeHint?: string;
  submitting: boolean;
  error?: string | null;
  onChange: (patch: Partial<CreateRoleCommand>) => void;
  onSubmit: () => void;
};

export function CreateRoleDialog(props: CreateRoleDialogProps) {
  const { open, onOpenChange, mode = "create", form, codeDisabled = false, codeHint, submitting, error, onChange, onSubmit } = props;
  const title = mode === "edit" ? "编辑角色" : "新增角色";
  const description = mode === "edit"
    ? "调整角色定义后，将保留该角色现有的权限与主体授权关系。"
    : "角色定义完成后，可继续在角色管理页内分配权限并在用户管理内进行主体授权。";
  const submitLabel = mode === "edit" ? "保存修改" : "确认新增";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">所属来源</div>
              <Select value={form.sourceCode || DEFAULT_RBAC_SOURCE} onValueChange={(value) => onChange({ sourceCode: value })}>
                <SelectTrigger className="subpage-native-select h-10">
                  <SelectValue placeholder="选择来源" />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {RBAC_SOURCE_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                    <SelectItem key={option.value} value={option.value} className="subpage-select-item">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">作用域</div>
              <Select value={form.scopeLevel || "global"} onValueChange={(value) => onChange({ scopeLevel: value })}>
                <SelectTrigger className="subpage-native-select h-10">
                  <SelectValue placeholder="选择作用域" />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {ROLE_SCOPE_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                    <SelectItem key={option.value} value={option.value} className="subpage-select-item">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">角色名称</div>
              <Input value={form.name || ""} onChange={(event) => onChange({ name: event.target.value })} placeholder="例如：平台运营管理员" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">角色编码</div>
              <Input
                value={form.code || ""}
                onChange={(event) => onChange({ code: event.target.value })}
                placeholder="例如：ops.admin"
                disabled={codeDisabled}
              />
              {codeHint ? (
                <div className="text-xs leading-5 text-muted-foreground">{codeHint}</div>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">角色说明</div>
            <Textarea
              value={form.description || ""}
              onChange={(event) => onChange({ description: event.target.value })}
              placeholder="说明当前角色的职责、适用范围和默认配置"
              className="min-h-[96px]"
            />
          </div>
        </div>
        <div className="mt-2 flex flex-col items-end gap-2">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <button type="button" className="subpage-outline-btn !h-10 !px-5" onClick={() => onOpenChange(false)} disabled={submitting}>
              取消
            </button>
            <button type="button" className="subpage-primary-btn !h-10 !px-5" onClick={onSubmit} disabled={submitting}>
              {submitting ? "提交中..." : submitLabel}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
