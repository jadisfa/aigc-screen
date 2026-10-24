import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe2, KeyRound, LayoutGrid, Pencil, Plus, RefreshCw, Shield, ShieldCheck, Trash2 } from "lucide-react";
import { hasBackendErrorCode, resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import {
  createRole,
  deleteRole,
  listPermissions,
  listRolePermissions,
  listRoles,
  replaceRolePermissions,
  updateRole,
  type CreateRoleCommand,
  type PermissionView,
  type RoleView,
} from "@/shared/api/ums/iam";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
} from "@/shared/components/page";
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
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { CreateRoleDialog } from "@/modules/iam/components/CreateRoleDialog";
import { RolePermissionDialog } from "@/modules/iam/components/RolePermissionDialog";
import {
  DEFAULT_RBAC_SOURCE,
  extractPermissionCodes,
  formatRbacDateTime,
  getRbacSourceLabel,
  getRoleScopeLabel,
  normalizeGrantScopeLevel,
  RBAC_SOURCE_OPTIONS,
  ROLE_SCOPE_OPTIONS,
} from "@/modules/iam/lib/rbac";
import { notify } from "@/shared/lib/notify";

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function buildDefaultRoleForm(): CreateRoleCommand {
  return {
    sourceCode: DEFAULT_RBAC_SOURCE,
    scopeLevel: "global",
    code: "",
    name: "",
    description: "",
    isTemplate: true,
  };
}

function resolveRoleMutationErrorMessage(error: unknown, fallback: string, mode: "create" | "edit") {
  if (hasBackendErrorCode(error, "IAM-RESOURCE-ALREADY-EXISTS")) {
    return mode === "edit"
      ? "当前来源下角色编码已存在，请更换角色编码后再保存"
      : "当前来源下角色编码已存在，请更换角色编码后再创建";
  }
  return resolveUserErrorMessage(error, fallback);
}

export function RoleManagementPage() {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleView[]>([]);
  const [permissions, setPermissions] = useState<PermissionView[]>([]);
  const [rolePermissionCounts, setRolePermissionCounts] = useState<Record<string, number>>({});
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [roleDialogMode, setRoleDialogMode] = useState<"create" | "edit">("create");
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [permissionDialogLoading, setPermissionDialogLoading] = useState(false);
  const [permissionDialogSaving, setPermissionDialogSaving] = useState(false);
  const [permissionKeyword, setPermissionKeyword] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleChangeConfirmOpen, setRoleChangeConfirmOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<RoleView | null>(null);
  const [editingRole, setEditingRole] = useState<RoleView | null>(null);
  const [pendingRoleSubmit, setPendingRoleSubmit] = useState<CreateRoleCommand | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<RoleView | null>(null);
  const [selectedPermissionCodes, setSelectedPermissionCodes] = useState<string[]>([]);
  const [createForm, setCreateForm] = useState<CreateRoleCommand>(buildDefaultRoleForm);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const sourceQuery = sourceFilter === "all" ? undefined : { sourceCode: sourceFilter };
      const [roleList, permissionList] = await Promise.all([listRoles(sourceQuery), listPermissions(sourceQuery)]);
      setRoles(roleList ?? []);
      setPermissions(permissionList ?? []);

      const countEntries = await Promise.all(
        (roleList ?? []).map(async (role) => {
          try {
            const rolePermissions = await listRolePermissions(role.roleId);
            return [role.roleId, rolePermissions.length] as const;
          } catch {
            return [role.roleId, 0] as const;
          }
        }),
      );
      setRolePermissionCounts(Object.fromEntries(countEntries));
    } catch (err) {
      notify.error("角色列表加载失败", { description: resolveUserErrorMessage(err, "无法加载角色与权限数据") });
    } finally {
      setLoading(false);
    }
  }, [sourceFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyKeywordSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
  };

  const filteredRoles = useMemo(() => {
    const normalizedKeyword = appliedKeyword.trim().toLowerCase();
    return roles.filter((role) => {
      const roleScopeLevel = normalizeGrantScopeLevel(role.scopeLevel ?? role.scope ?? null, null, null);
      const matchesSource = sourceFilter === "all" || role.sourceCode === sourceFilter;
      const matchesScope = scopeFilter === "all" || roleScopeLevel === scopeFilter;
      const matchesKeyword = !normalizedKeyword
        || role.name.toLowerCase().includes(normalizedKeyword)
        || role.code.toLowerCase().includes(normalizedKeyword)
        || role.description?.toLowerCase().includes(normalizedKeyword);
      return matchesSource && matchesScope && matchesKeyword;
    });
  }, [appliedKeyword, roles, scopeFilter, sourceFilter]);

  const topStats = useMemo(() => {
    const globalRoleCount = roles.filter((role) => (
      normalizeGrantScopeLevel(role.scopeLevel ?? role.scope ?? null, null, null) === "global"
    )).length;
    const templateRoleCount = roles.filter((role) => role.isTemplate).length;
    const permissionBindingCount = Object.values(rolePermissionCounts).reduce((sum, count) => sum + count, 0);
    const sourceCount = new Set(roles.map((role) => role.sourceCode).filter(Boolean)).size;

    return [
      {
        key: "role-total",
        label: "角色总数",
        value: roles.length,
        description: "当前系统内可被授权的全部角色",
        footnote: "auth_roles",
        icon: Shield,
        iconClassName: "bg-violet-50 text-violet-600 ring-1 ring-violet-100",
      },
      {
        key: "global-role-total",
        label: "全局角色",
        value: globalRoleCount,
        description: "作用域为 GLOBAL 的角色数量",
        footnote: "scope global",
        icon: Globe2,
        iconClassName: "bg-sky-50 text-sky-600 ring-1 ring-sky-100",
      },
      {
        key: "template-role-total",
        label: "模板角色",
        value: templateRoleCount,
        description: "可复用的默认角色模板数量",
        footnote: "role template",
        icon: LayoutGrid,
        iconClassName: "bg-amber-50 text-amber-600 ring-1 ring-amber-100",
      },
      {
        key: "permission-binding-total",
        label: "关联权限数",
        value: permissionBindingCount,
        description: `涉及 ${sourceCount} 个来源系统`,
        footnote: "role_permissions",
        icon: KeyRound,
        iconClassName: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
      },
    ];
  }, [rolePermissionCounts, roles]);

  const openCreateRoleDialog = useCallback(() => {
    setRoleDialogMode("create");
    setEditingRole(null);
    setPendingRoleSubmit(null);
    setRoleChangeConfirmOpen(false);
    setCreateForm(buildDefaultRoleForm());
    setCreateDialogOpen(true);
  }, []);

  const openEditRoleDialog = useCallback((role: RoleView) => {
    setRoleDialogMode("edit");
    setEditingRole(role);
    setCreateForm({
      sourceCode: role.sourceCode || DEFAULT_RBAC_SOURCE,
      scopeLevel: role.scopeLevel || role.scope || "global",
      code: role.code || "",
      name: role.name || "",
      description: role.description || "",
      isTemplate: role.isTemplate ?? true,
    });
    setCreateDialogOpen(true);
  }, []);

  const submitRole = useCallback(async (payload: CreateRoleCommand) => {
    try {
      setSubmitting(true);
      if (roleDialogMode === "edit" && editingRole) {
        await updateRole(editingRole.roleId, payload);
      } else {
        await createRole(payload);
      }
      notify.success(roleDialogMode === "edit" ? "保存成功" : "新增成功", { description: roleDialogMode === "edit" ? "角色信息已更新" : "角色已创建，可继续分配权限" });
      setCreateDialogOpen(false);
      setRoleChangeConfirmOpen(false);
      setPendingRoleSubmit(null);
      setEditingRole(null);
      setRoleDialogMode("create");
      setCreateForm(buildDefaultRoleForm());
      await refresh();
    } catch (err) {
      notify.error(roleDialogMode === "edit" ? "保存失败" : "新增失败", { description: resolveRoleMutationErrorMessage(
          err,
          roleDialogMode === "edit" ? "角色更新失败" : "角色创建失败",
          roleDialogMode,
        ) });
    } finally {
      setSubmitting(false);
    }
  }, [editingRole, refresh, roleDialogMode]);

  const handleSubmitRole = useCallback(async () => {
    const roleCode = createForm.code?.trim();
    if (!createForm.name?.trim() || !roleCode) {
      setFormError("请填写角色名称与角色编码");
      return;
    }
    setFormError(null);
    const payload = {
      code: roleCode,
      name: createForm.name.trim(),
      description: createForm.description?.trim() || null,
      sourceCode: createForm.sourceCode || DEFAULT_RBAC_SOURCE,
      scopeLevel: createForm.scopeLevel || "global",
      isTemplate: createForm.isTemplate ?? true,
    };
    if (roleDialogMode === "edit" && editingRole) {
      const sourceChanged = payload.sourceCode !== (editingRole.sourceCode || DEFAULT_RBAC_SOURCE);
      const scopeChanged = payload.scopeLevel !== (editingRole.scopeLevel || editingRole.scope || "global");
      if (sourceChanged || scopeChanged) {
        setPendingRoleSubmit(payload);
        setRoleChangeConfirmOpen(true);
        return;
      }
    }
    await submitRole(payload);
  }, [createForm, editingRole, roleDialogMode, submitRole]);

  const openRolePermissionDialog = useCallback(async (role: RoleView) => {
    setPermissionDialogOpen(true);
    setPermissionDialogLoading(true);
    setPermissionKeyword("");
    setActiveRole(role);
    try {
      const rolePermissions = await listRolePermissions(role.roleId);
      setSelectedPermissionCodes(extractPermissionCodes(rolePermissions ?? []));
    } catch (err) {
      notify.error("角色权限加载失败", { description: resolveUserErrorMessage(err, "无法加载当前角色权限") });
      setPermissionDialogOpen(false);
      setActiveRole(null);
    } finally {
      setPermissionDialogLoading(false);
    }
  }, []);

  const handleTogglePermission = useCallback((permissionCode: string) => {
    setSelectedPermissionCodes((current) => (
      current.includes(permissionCode)
        ? current.filter((code) => code !== permissionCode)
        : [...current, permissionCode]
    ));
  }, []);

  const handleSaveRolePermissions = useCallback(async () => {
    if (!activeRole) {
      return;
    }
    try {
      setPermissionDialogSaving(true);
      await replaceRolePermissions(activeRole.roleId, selectedPermissionCodes);
      setRolePermissionCounts((current) => ({
        ...current,
        [activeRole.roleId]: selectedPermissionCodes.length,
      }));
      notify.success("权限保存成功");
      setPermissionDialogOpen(false);
      setActiveRole(null);
    } catch (err) {
      notify.error("保存失败", { description: resolveUserErrorMessage(err, "角色权限保存失败") });
    } finally {
      setPermissionDialogSaving(false);
    }
  }, [activeRole, selectedPermissionCodes]);

  const handleDeleteRole = useCallback(async () => {
    if (!roleToDelete) {
      return;
    }
    try {
      setSubmitting(true);
      await deleteRole(roleToDelete.roleId);
      setRolePermissionCounts((current) => {
        const next = { ...current };
        delete next[roleToDelete.roleId];
        return next;
      });
      if (activeRole?.roleId === roleToDelete.roleId) {
        setPermissionDialogOpen(false);
        setActiveRole(null);
        setPermissionKeyword("");
        setSelectedPermissionCodes([]);
      }
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
      notify.success("删除成功");
      await refresh();
    } catch (err) {
      notify.error("删除失败", { description: resolveUserErrorMessage(err, "角色删除失败") });
    } finally {
      setSubmitting(false);
    }
  }, [activeRole, refresh, roleToDelete]);

  const rolePermissions = useMemo(() => {
    if (!activeRole) {
      return [];
    }
    return permissions.filter((permission) => permission.sourceCode === activeRole.sourceCode);
  }, [activeRole, permissions]);

  return (
    <PageShell className="!overflow-hidden flex min-h-0 flex-1 flex-col">
      <PageHeader
        className="shrink-0"
        title="角色管理"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              刷新
            </Button>
            <Button variant="page" onClick={openCreateRoleDialog}>
              <Plus className="h-4 w-4" />
              新增角色
            </Button>
          </>
        }
      />

      <div className="mb-4 grid shrink-0 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        {topStats.map((stat) => (
          <section key={stat.key} className="rounded-xl border border-border/70 bg-card px-3.5 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-xs font-medium text-muted-foreground">{stat.label}</div>
                  <div className="shrink-0 text-[11px] text-muted-foreground/90">{stat.footnote}</div>
                </div>
                <div className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em] text-foreground tabular-nums">
                  {stat.value}
                </div>
                <div className="mt-2 truncate text-[11px] text-muted-foreground">{stat.description}</div>
              </div>
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${stat.iconClassName}`}>
                <stat.icon className="h-3.5 w-3.5" />
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col overflow-hidden shadow-sm">

          <PageFilterBar className="!mb-0 shrink-0 border-b border-border/70 px-2 py-4">
            <SearchField
              wrapClassName="!w-[380px] !max-w-[380px] shrink-0"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyKeywordSearch();
                }
              }}
              placeholder="搜索角色名称 / 编码 / 说明，回车搜索"
            />
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="subpage-native-select h-10 w-[180px]">
                <SelectValue placeholder="筛选来源" />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                {RBAC_SOURCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="subpage-select-item">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={scopeFilter} onValueChange={setScopeFilter}>
              <SelectTrigger className="subpage-native-select h-10 w-[180px]">
                <SelectValue placeholder="筛选作用域" />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                {ROLE_SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="subpage-select-item">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PageFilterBar>

          {loading ? (
            <div className="p-5">
              <EmptyState message="正在加载角色列表..." />
            </div>
          ) : filteredRoles.length > 0 ? (
            <ScrollArea className="min-h-0 flex-1">
              <div className="min-w-[1280px]">
                <Table className="text-[13px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">角色名称</TableHead>
                      <TableHead className="min-w-[220px]">角色编码</TableHead>
                      <TableHead className="w-[140px]">来源</TableHead>
                      <TableHead className="w-[140px]">作用域</TableHead>
                      <TableHead className="w-[120px]">权限数</TableHead>
                      <TableHead className="w-[120px]">角色类型</TableHead>
                      <TableHead className="min-w-[280px]">角色说明</TableHead>
                      <TableHead className="w-[180px]">创建时间</TableHead>
                      <TableHead className="sticky right-0 z-20 w-[140px] min-w-[140px] max-w-[140px] bg-card shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRoles.map((role) => (
                      <TableRow key={role.roleId}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">{role.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {role.isTemplate ? "支持复用的模板角色" : "普通业务角色"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[12px] text-muted-foreground">{role.code}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                            {getRbacSourceLabel(role.sourceCode)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                            {getRoleScopeLabel(role.scopeLevel ?? role.scope)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                            {rolePermissionCounts[role.roleId] ?? 0} 项
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={role.isTemplate
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-slate-100 text-slate-600"}
                          >
                            {role.isTemplate ? "模板" : "普通"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm leading-6 text-muted-foreground">{role.description || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatRbacDateTime(role.createdAt)}</TableCell>
                        <TableCell className="sticky right-0 z-10 w-[140px] min-w-[140px] max-w-[140px] bg-card px-3 py-2 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 gap-1.5 px-2.5 text-[12px]"
                              onClick={() => void openRolePermissionDialog(role)}
                              title="分配权限"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-primary hover:bg-primary/5 hover:text-primary"
                              onClick={() => openEditRoleDialog(role)}
                              title="编辑角色"
                              disabled={submitting}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => {
                                setRoleToDelete(role);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={submitting}
                              title="删除角色"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          ) : (
            <div className="p-5">
              <EmptyState message="当前筛选条件下暂无角色数据。" />
            </div>
          )}
        </div>
      </div>

      <CreateRoleDialog
        open={createDialogOpen}
        onOpenChange={(nextOpen) => {
          setCreateDialogOpen(nextOpen);
          if (!nextOpen && !submitting) {
            setEditingRole(null);
            setRoleDialogMode("create");
            setRoleChangeConfirmOpen(false);
            setPendingRoleSubmit(null);
            setCreateForm(buildDefaultRoleForm());
          }
        }}
        mode={roleDialogMode}
        form={createForm}
        codeDisabled={roleDialogMode === "edit" && editingRole?.isSystem === true}
        codeHint={roleDialogMode === "edit" && editingRole?.isSystem === true ? "系统角色允许编辑，但不允许修改角色编码" : undefined}
        submitting={submitting}
        error={formError}
        onChange={(patch) => {
          setFormError(null);
          setCreateForm((current) => ({ ...current, ...patch }));
        }}
        onSubmit={() => void handleSubmitRole()}
      />

      <RolePermissionDialog
        open={permissionDialogOpen}
        onOpenChange={(nextOpen) => {
          setPermissionDialogOpen(nextOpen);
          if (!nextOpen) {
            setActiveRole(null);
            setPermissionKeyword("");
            setSelectedPermissionCodes([]);
          }
        }}
        role={activeRole}
        loading={permissionDialogLoading}
        saving={permissionDialogSaving}
        permissions={rolePermissions}
        selectedCodes={selectedPermissionCodes}
        keyword={permissionKeyword}
        onKeywordChange={setPermissionKeyword}
        onTogglePermission={handleTogglePermission}
        onReplaceSelectedCodes={setSelectedPermissionCodes}
        onSubmit={() => void handleSaveRolePermissions()}
      />

      <AlertDialog
        open={roleChangeConfirmOpen}
        onOpenChange={(nextOpen) => {
          setRoleChangeConfirmOpen(nextOpen);
          if (!nextOpen && !submitting) {
            setPendingRoleSubmit(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认变更来源或作用域？</AlertDialogTitle>
            <AlertDialogDescription>
              你正在修改角色的来源或作用域。继续保存后，角色定义将立即更新，请确认该调整符合当前业务授权范围。
              {editingRole && pendingRoleSubmit ? ` 来源：${getRbacSourceLabel(editingRole.sourceCode)} -> ${getRbacSourceLabel(pendingRoleSubmit.sourceCode)}；作用域：${getRoleScopeLabel(editingRole.scopeLevel ?? editingRole.scope)} -> ${getRoleScopeLabel(pendingRoleSubmit.scopeLevel)}。` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting || !pendingRoleSubmit}
              onClick={(event) => {
                event.preventDefault();
                if (!pendingRoleSubmit) {
                  return;
                }
                void submitRole(pendingRoleSubmit);
              }}
            >
              {submitting ? "保存中..." : "确认变更"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(nextOpen) => {
          setDeleteDialogOpen(nextOpen);
          if (!nextOpen && !submitting) {
            setRoleToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除角色？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将同步清理该角色的权限绑定关系，以及主体与该角色之间的授权数据。此操作不可逆，请谨慎确认。
              {roleToDelete ? ` 当前角色：${roleToDelete.name}（${roleToDelete.code}）。` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting || !roleToDelete}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteRole();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
