import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Loader2, Search } from "lucide-react";
import type { PermissionView, RoleView } from "@/shared/api/ums/iam";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
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

type RolePermissionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleView | null;
  loading: boolean;
  saving: boolean;
  permissions: PermissionView[];
  selectedCodes: string[];
  keyword: string;
  onKeywordChange: (value: string) => void;
  onTogglePermission: (permissionCode: string) => void;
  onReplaceSelectedCodes: (permissionCodes: string[]) => void;
  onSubmit: () => void;
};

type RolePermissionTreeResource = {
  key: string;
  resourceName: string;
  resourceKey: string;
  permissions: PermissionView[];
};

type RolePermissionTreeDirectory = {
  key: string;
  directoryName: string;
  directoryKey: string;
  resources: RolePermissionTreeResource[];
};

function getDirectoryName(permission: PermissionView) {
  return permission.directoryName?.trim() || permission.sourceName?.trim() || "未分类目录";
}

function getDirectoryKey(permission: PermissionView) {
  return permission.directoryKey?.trim() || "uncategorized";
}

function getDirectoryGroupKey(permission: PermissionView) {
  return permission.directoryName?.trim() || permission.directoryKey?.trim() || "uncategorized";
}

function getResourceName(permission: PermissionView) {
  return permission.resourceName?.trim() || permission.name?.trim() || permission.code;
}

function getResourceKey(permission: PermissionView) {
  return permission.resourceKey?.trim() || permission.code;
}

function sortPermissionsForTree(a: PermissionView, b: PermissionView) {
  const directoryDiff = getDirectoryName(a).localeCompare(getDirectoryName(b), "zh-CN");
  if (directoryDiff !== 0) {
    return directoryDiff;
  }
  const resourceDiff = getResourceName(a).localeCompare(getResourceName(b), "zh-CN");
  if (resourceDiff !== 0) {
    return resourceDiff;
  }
  const actionDiff = (a.actionKey || a.name || a.code).localeCompare((b.actionKey || b.name || b.code), "zh-CN");
  if (actionDiff !== 0) {
    return actionDiff;
  }
  return a.code.localeCompare(b.code, "zh-CN");
}

export function RolePermissionDialog(props: RolePermissionDialogProps) {
  const {
    open,
    onOpenChange,
    role,
    loading,
    saving,
    permissions,
    selectedCodes,
    keyword,
    onKeywordChange,
    onTogglePermission,
    onReplaceSelectedCodes,
    onSubmit,
  } = props;
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const selectedCodeSet = useMemo(() => new Set(selectedCodes), [selectedCodes]);

  const filteredPermissions = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return permissions.filter((permission) => {
      const matchesKeyword = !normalizedKeyword
        || permission.name.toLowerCase().includes(normalizedKeyword)
        || permission.code.toLowerCase().includes(normalizedKeyword)
        || permission.description?.toLowerCase().includes(normalizedKeyword);
      return matchesKeyword;
    });
  }, [keyword, permissions]);

  const treeData = useMemo<RolePermissionTreeDirectory[]>(() => {
    const directoryMap = new Map<string, {
      node: RolePermissionTreeDirectory;
      resources: Map<string, RolePermissionTreeResource>;
    }>();

    [...filteredPermissions].sort(sortPermissionsForTree).forEach((permission) => {
      const directoryGroupKey = getDirectoryGroupKey(permission);
      const resourceKey = getResourceKey(permission);
      const directoryNodeKey = `directory:${directoryGroupKey}`;
      const resourceNodeKey = `resource:${directoryGroupKey}:${resourceKey}`;

      let directoryEntry = directoryMap.get(directoryNodeKey);
      if (!directoryEntry) {
        directoryEntry = {
          node: {
            key: directoryNodeKey,
            directoryKey: getDirectoryKey(permission),
            directoryName: getDirectoryName(permission),
            resources: [],
          },
          resources: new Map(),
        };
        directoryMap.set(directoryNodeKey, directoryEntry);
      }

      let resourceNode = directoryEntry.resources.get(resourceNodeKey);
      if (!resourceNode) {
        resourceNode = {
          key: resourceNodeKey,
          resourceKey,
          resourceName: getResourceName(permission),
          permissions: [],
        };
        directoryEntry.resources.set(resourceNodeKey, resourceNode);
      }

      resourceNode.permissions.push(permission);
    });

    return Array.from(directoryMap.values()).map((directoryEntry) => ({
      ...directoryEntry.node,
      resources: Array.from(directoryEntry.resources.values()),
    }));
  }, [filteredPermissions]);

  const allTreeKeys = useMemo(
    () => treeData.flatMap((directoryNode) => [directoryNode.key, ...directoryNode.resources.map((resourceNode) => resourceNode.key)]),
    [treeData],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setExpandedKeys(allTreeKeys);
  }, [allTreeKeys, open]);

  const selectedFilteredCount = useMemo(
    () => filteredPermissions.filter((permission) => selectedCodeSet.has(permission.code)).length,
    [filteredPermissions, selectedCodeSet],
  );

  const applyBulkSelection = (permissionCodes: string[], checked: boolean) => {
    const uniqueCodes = Array.from(new Set(permissionCodes.filter(Boolean)));
    if (uniqueCodes.length === 0) {
      return;
    }
    if (checked) {
      onReplaceSelectedCodes(Array.from(new Set([...selectedCodes, ...uniqueCodes])));
      return;
    }
    const uniqueCodeSet = new Set(uniqueCodes);
    onReplaceSelectedCodes(selectedCodes.filter((code) => !uniqueCodeSet.has(code)));
  };

  const getCheckedState = (permissionCodes: string[]) => {
    const checkedCount = permissionCodes.filter((code) => selectedCodeSet.has(code)).length;
    if (checkedCount === 0) {
      return false;
    }
    if (checkedCount === permissionCodes.length) {
      return true;
    }
    return "indeterminate" as const;
  };

  const toggleExpanded = (key: string) => {
    setExpandedKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-[920px]">
        <DialogHeader>
          <DialogTitle>分配角色权限
            <span className="ml-2 min-w-0 truncate text-xs font-normal text-muted-foreground">{role?.name || "-"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 overflow-hidden">
          <div className="rounded-2xl shadow-sm">
            <div className="border-b border-border/70 px-3 py-3">
              <div className="mb-2">
               
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="subpage-search-wrap !w-full md:!w-[320px]">
                  <Search className="subpage-search-icon" />
                  <Input
                    value={keyword}
                    onChange={(event) => onKeywordChange(event.target.value)}
                    placeholder="搜索目录 / 资源 / 权限名称 / 编码"
                    className="subpage-search-input"
                  />
                </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-7 px-2.5 text-[12px]"
                    disabled={loading || filteredPermissions.length === 0 || selectedFilteredCount === filteredPermissions.length}
                    onClick={() => applyBulkSelection(filteredPermissions.map((permission) => permission.code), true)}
                  >
                    全选结果
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-7 px-2.5 text-[12px]"
                    disabled={loading || selectedCodes.length === 0}
                    onClick={() => onReplaceSelectedCodes([])}
                  >
                    清空
                  </Button>
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  <div className="shrink-0 text-xs text-muted-foreground">
                    已选 {selectedCodes.length} / {permissions.length}
                  </div>
                
                </div>
              </div>
            </div>

            <ScrollArea className="h-[520px]">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在加载角色权限...
                </div>
              ) : treeData.length > 0 ? (
                <div className="space-y-3 p-3">
                  {treeData.map((directoryNode) => {
                    const directoryExpanded = expandedKeys.includes(directoryNode.key);
                    const directoryPermissionCodes = directoryNode.resources.flatMap((resourceNode) => (
                      resourceNode.permissions.map((permission) => permission.code)
                    ));
                    const selectedDirectoryCount = directoryPermissionCodes.filter((code) => selectedCodeSet.has(code)).length;

                    return (
                      <section key={directoryNode.key} className="overflow-hidden rounded-xl border border-border/60 bg-background">
                        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/20 px-3 py-3">
                          <Checkbox
                            checked={getCheckedState(directoryPermissionCodes)}
                            onCheckedChange={(checked) => applyBulkSelection(directoryPermissionCodes, checked === true)}
                            aria-label={`选择目录 ${directoryNode.directoryName}`}
                          />
                          <button
                            type="button"
                            onClick={() => toggleExpanded(directoryNode.key)}
                            className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md text-left transition-colors hover:bg-muted/30"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {directoryExpanded ? (
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                              {directoryExpanded ? (
                                <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                              ) : (
                                <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                              <div className="min-w-0">
                                <div className="truncate text-[13px] font-medium text-foreground">{directoryNode.directoryName}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  资源目录 · {directoryNode.resources.length} 个资源
                                </div>
                              </div>
                            </div>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {selectedDirectoryCount}/{directoryPermissionCodes.length}
                            </span>
                          </button>
                        </div>

                        {directoryExpanded ? (
                          <div className="grid gap-3 p-3 md:grid-cols-2">
                            {directoryNode.resources.map((resourceNode) => {
                              const resourceExpanded = expandedKeys.includes(resourceNode.key);
                              const resourcePermissionCodes = resourceNode.permissions.map((permission) => permission.code);
                              const selectedResourceCount = resourcePermissionCodes.filter((code) => selectedCodeSet.has(code)).length;

                              return (
                                <div key={resourceNode.key} className="overflow-hidden rounded-lg border border-border/50 bg-card">
                                  <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2.5">
                                    <Checkbox
                                      checked={getCheckedState(resourcePermissionCodes)}
                                      onCheckedChange={(checked) => applyBulkSelection(resourcePermissionCodes, checked === true)}
                                      aria-label={`选择资源 ${resourceNode.resourceName}`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => toggleExpanded(resourceNode.key)}
                                      className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md text-left transition-colors hover:bg-muted/30"
                                    >
                                      <div className="min-w-0">
                                        <div className="truncate text-[12px] font-medium text-foreground">{resourceNode.resourceName}</div>
                                        <div className="text-[11px] text-muted-foreground">资源节点</div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="shrink-0 text-[11px] text-muted-foreground">
                                          {selectedResourceCount}/{resourcePermissionCodes.length}
                                        </span>
                                        {resourceExpanded ? (
                                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        )}
                                      </div>
                                    </button>
                                  </div>

                                  {resourceExpanded ? (
                                    <div className="space-y-1 p-2">
                                      {resourceNode.permissions.map((permission) => {
                                        const checked = selectedCodeSet.has(permission.code);
                                        const labelId = `role-permission-${permission.permissionId}`;
                                        return (
                                          <label
                                            key={permission.permissionId}
                                            htmlFor={labelId}
                                            className={cn(
                                              "flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-2 transition-colors",
                                              checked ? "border-primary/15 bg-primary/5" : "hover:bg-muted/30",
                                            )}
                                          >
                                            <Checkbox
                                              id={labelId}
                                              checked={checked}
                                              onCheckedChange={() => onTogglePermission(permission.code)}
                                            />
                                            <div className="min-w-0 flex flex-1 items-center gap-2">
                                              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
                                                {permission.actionKey || "manage"}
                                              </span>
                                              <span className="truncate text-[12px] text-foreground/90">
                                                {permission.name}
                                              </span>
                                              <span className="truncate text-[11px] text-muted-foreground">
                                                {permission.code}
                                              </span>
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4">
                  <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
                    当前角色来源下暂无可分配权限，或筛选条件下没有匹配结果。
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-end gap-2">
          <button type="button" className="subpage-outline-btn !h-10 !px-5" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </button>
          <button type="button" className="subpage-primary-btn !h-10 !px-5" onClick={onSubmit} disabled={saving || loading || !role}>
            {saving ? "保存中..." : "保存权限"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
