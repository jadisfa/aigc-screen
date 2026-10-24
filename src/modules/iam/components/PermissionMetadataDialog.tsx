import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { RBAC_SOURCE_OPTIONS } from "@/modules/iam/lib/rbac";

export type PermissionMetadataForm = {
  permissionCode: string;
  sourceCode: string;
  directoryKey: string;
  directoryName: string;
  resourceKey: string;
  resourceName: string;
  actionKey: string;
  identifierKey: string;
  sortOrder: string;
  enabled: boolean;
  scopeLevels: string[];
  apiGroupsText: string;
  menuPathsText: string;
};

type PermissionMetadataDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  form: PermissionMetadataForm;
  submitting: boolean;
  directoryOptions: string[];
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<PermissionMetadataForm>) => void;
  onPermissionCodeChange: (value: string) => void;
  onScopeLevelToggle: (scopeLevel: string, checked: boolean) => void;
  onSubmit: () => void;
  error?: string | null;
};

export function PermissionMetadataDialog(props: PermissionMetadataDialogProps) {
  const title = props.mode === "create" ? "新增权限元数据" : "修改权限元数据";
  const description = props.mode === "create"
    ? "先创建权限目录元数据，后续可按需注册为权限实例。"
    : "修改后将同步更新目录信息；若已注册为权限实例，会同步更新实例定义。";
  const directoryDatalistId = "permission-directory-options";

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[68vh] pr-4">
          <div className="space-y-5 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm text-foreground">权限代码</div>
                <Input
                  value={props.form.permissionCode}
                  onChange={(event) => props.onPermissionCodeChange(event.target.value)}
                  placeholder="例如：workflow.app.manage"
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm text-foreground">所属系统</div>
                <Select value={props.form.sourceCode} onValueChange={(value) => props.onChange({ sourceCode: value })}>
                  <SelectTrigger className="subpage-native-select h-10">
                    <SelectValue placeholder="选择来源系统" />
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
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm text-foreground">目录</div>
                <Input
                  list={directoryDatalistId}
                  value={props.form.directoryName}
                  onChange={(event) => props.onChange({ directoryName: event.target.value })}
                  placeholder="支持选择已有目录或自定义新目录"
                />
                <datalist id={directoryDatalistId}>
                  {props.directoryOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-foreground">资源</div>
                <Input
                  value={props.form.resourceName}
                  onChange={(event) => props.onChange({ resourceName: event.target.value })}
                  placeholder="例如：应用管理"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="text-sm text-foreground">操作</div>
                <Input
                  value={props.form.actionKey}
                  onChange={(event) => props.onChange({ actionKey: event.target.value })}
                  placeholder="例如：manage"
                />
              </div>
              
              <div className="space-y-2">
                <div className="text-sm text-foreground">标识字段</div>
                <Input
                  value={props.form.identifierKey}
                  onChange={(event) => props.onChange({ identifierKey: event.target.value })}
                  placeholder="例如：workflowId"
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm text-foreground">排序</div>
                <Input
                  type="number"
                  value={props.form.sortOrder}
                  onChange={(event) => props.onChange({ sortOrder: event.target.value })}
                  placeholder="例如：30"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-muted/20 py-3">
                <div className="mb-3 text-sm text-foreground">启用状态</div>
                <label className="flex items-center gap-3 text-sm text-foreground">
                  <Switch checked={props.form.enabled} onCheckedChange={(checked) => props.onChange({ enabled: checked })} />
                  <span>{props.form.enabled ? "已启用" : "已停用"}</span>
                </label>
              </div>
              <div className="rounded-2xl bg-muted/20 py-3">
                <div className="mb-3 text-sm text-foreground">作用域</div>
                <div className="flex flex-wrap items-center gap-4">
                  {["GLOBAL", "MERCHANT", "STORE"].map((scopeLevel) => (
                    <label key={scopeLevel} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={props.form.scopeLevels.includes(scopeLevel)}
                        onCheckedChange={(checked) => props.onScopeLevelToggle(scopeLevel, checked === true)}
                      />
                      <span>{scopeLevel}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm text-foreground">API 组</div>
                <Textarea
                  value={props.form.apiGroupsText}
                  onChange={(event) => props.onChange({ apiGroupsText: event.target.value })}
                  placeholder="每行一个 API 路径，例如：/api/app/workflow/**"
                  className="min-h-[120px]"
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm text-foreground">菜单路径</div>
                <Textarea
                  value={props.form.menuPathsText}
                  onChange={(event) => props.onChange({ menuPathsText: event.target.value })}
                  placeholder="每行一个菜单路径，例如：/app/workflows"
                  className="min-h-[120px]"
                />
              </div>
            </div>
          </div>
        </ScrollArea>
        <div className="mt-2 flex flex-col items-end gap-2">
          {props.error ? <p className="text-sm text-destructive">{props.error}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <button type="button" className="subpage-outline-btn !h-10 !px-5" onClick={() => props.onOpenChange(false)} disabled={props.submitting}>
              取消
            </button>
            <button type="button" className="subpage-primary-btn !h-10 !px-5" onClick={props.onSubmit} disabled={props.submitting}>
              {props.submitting ? "提交中..." : props.mode === "create" ? "保存元数据" : "确认修改"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
