import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FilePenLine,
  Folder,
  FolderOpen,
  GitBranch,
  Plus,
  Power,
  RefreshCw,
  Save,
  Shield,
  Square,
  Trash2,
} from "lucide-react";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
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
import {
  createPermissionMetadata,
  deletePermission,
  deletePermissionMetadata,
  listPermissionMetadata,
  registerPermissionMetadata,
  updatePermissionMetadata,
  type PermissionMetadataItem,
  type UpdatePermissionMetadataCommand,
  type UpsertPermissionMetadataCommand,
} from "@/shared/api/ums/iam";
import { cn } from "@/shared/lib/utils";
import { isHiddenAppSource } from "@/shared/lib/dicts";
import { PageHeader, PageShell } from "@/shared/components/page";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Separator } from "@/shared/ui/separator";
import { PermissionMetadataDialog, type PermissionMetadataForm } from "@/modules/iam/components/PermissionMetadataDialog";
import { DEFAULT_RBAC_SOURCE, formatRbacDateTime, getRbacSourceLabel, RBAC_SOURCE_OPTIONS } from "@/modules/iam/lib/rbac";
import { notify } from "@/shared/lib/notify";

type PermissionResourceNode = {
  key: string;
  resourceKey: string;
  resourceName: string;
  items: PermissionMetadataItem[];
  metadataCount: number;
  enabledCount: number;
  sortOrder: number;
};

type PermissionDirectoryNode = {
  key: string;
  sourceCode: string;
  directoryKey: string;
  directoryName: string;
  resources: PermissionResourceNode[];
  metadataCount: number;
  enabledCount: number;
  sortOrder: number;
};

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

type PermissionSourceNode = {
  key: string;
  sourceCode: string;
  sourceName: string;
  directories: PermissionDirectoryNode[];
  metadataCount: number;
  enabledCount: number;
  sortOrder: number;
};

const SOURCE_ORDER = new Map<string, number>(RBAC_SOURCE_OPTIONS.map((option, index) => [option.value, index]));

function getSourceOrder(sourceCode?: string | null) {
  return SOURCE_ORDER.get(sourceCode ?? "") ?? Number.MAX_SAFE_INTEGER;
}

function getPermissionSortOrder(item: PermissionMetadataItem) {
  return typeof item.sortOrder === "number" ? item.sortOrder : Number.MAX_SAFE_INTEGER;
}

function getPermissionDirectoryKey(item: PermissionMetadataItem) {
  return item.directoryKey?.trim() || "uncategorized";
}

function getPermissionDirectoryName(item: PermissionMetadataItem) {
  return item.directoryName?.trim() || "未归类";
}

function getPermissionDirectoryGroupKey(item: PermissionMetadataItem) {
  return item.directoryName?.trim() || item.directoryKey?.trim() || "uncategorized";
}

function getPermissionResourceKey(item: PermissionMetadataItem) {
  return item.resourceKey?.trim() || item.permissionCode;
}

function getPermissionResourceName(item: PermissionMetadataItem) {
  return item.resourceName?.trim() || item.permissionName || item.permissionCode;
}

function getPermissionTreeSummary(item: PermissionMetadataItem) {
  const resourceKey = getPermissionResourceKey(item);
  const resourceName = getPermissionResourceName(item);
  return `${resourceKey} / ${resourceName}`;
}

function sortPermissions(a: PermissionMetadataItem, b: PermissionMetadataItem) {
  const sourceDiff = getSourceOrder(a.sourceCode) - getSourceOrder(b.sourceCode);
  if (sourceDiff !== 0) {
    return sourceDiff;
  }
  const sortOrderDiff = getPermissionSortOrder(a) - getPermissionSortOrder(b);
  if (sortOrderDiff !== 0) {
    return sortOrderDiff;
  }
  return a.permissionCode.localeCompare(b.permissionCode, "zh-CN");
}

function getCatalogItemKey(item: Pick<PermissionMetadataItem, "sourceCode" | "permissionCode">) {
  return `${item.sourceCode}:${item.permissionCode}`;
}

function parseListInput(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function deriveDirectoryKey(permissionCode: string) {
  const normalized = permissionCode.trim();
  if (!normalized) {
    return "uncategorized";
  }
  const delimiter = normalized.indexOf(".");
  if (delimiter <= 0) {
    return normalized.toLowerCase();
  }
  return normalized.slice(0, delimiter).toLowerCase();
}

function deriveResourceKey(permissionCode: string) {
  const normalized = permissionCode.trim();
  if (!normalized) {
    return "";
  }
  const delimiter = normalized.lastIndexOf(".");
  if (delimiter <= 0) {
    return normalized;
  }
  return normalized.slice(0, delimiter);
}

function deriveActionKey(permissionCode: string) {
  const normalized = permissionCode.trim();
  if (!normalized) {
    return "manage";
  }
  const delimiter = normalized.lastIndexOf(".");
  if (delimiter < 0 || delimiter === normalized.length - 1) {
    return "manage";
  }
  return normalized.slice(delimiter + 1).toLowerCase();
}

function createInitialMetadataForm(): PermissionMetadataForm {
  return {
    permissionCode: "",
    sourceCode: DEFAULT_RBAC_SOURCE,
    directoryKey: "uncategorized",
    directoryName: "",
    resourceKey: "",
    resourceName: "",
    actionKey: "manage",
    identifierKey: "",
    sortOrder: "9999",
    enabled: true,
    scopeLevels: ["GLOBAL"],
    apiGroupsText: "",
    menuPathsText: "",
  };
}

function createFormFromItem(item: PermissionMetadataItem): PermissionMetadataForm {
  return {
    permissionCode: item.permissionCode,
    sourceCode: item.sourceCode,
    directoryKey: item.directoryKey || deriveDirectoryKey(item.permissionCode),
    directoryName: item.directoryName || "",
    resourceKey: item.resourceKey || deriveResourceKey(item.permissionCode),
    resourceName: item.resourceName || item.permissionName || "",
    actionKey: item.actionKey || deriveActionKey(item.permissionCode),
    identifierKey: item.identifierKey || "",
    sortOrder: String(item.sortOrder ?? 9999),
    enabled: item.enabled ?? true,
    scopeLevels: item.scopeLevels?.length ? item.scopeLevels : ["GLOBAL"],
    apiGroupsText: (item.apiGroups ?? []).join("\n"),
    menuPathsText: (item.menuPaths ?? []).join("\n"),
  };
}

function buildMetadataPayload(form: PermissionMetadataForm): UpsertPermissionMetadataCommand {
  return {
    permissionCode: form.permissionCode.trim(),
    sourceCode: form.sourceCode,
    sourceName: getRbacSourceLabel(form.sourceCode),
    directoryKey: form.directoryKey.trim() || deriveDirectoryKey(form.permissionCode),
    directoryName: form.directoryName.trim(),
    resourceKey: form.resourceKey.trim() || deriveResourceKey(form.permissionCode),
    resourceName: form.resourceName.trim(),
    actionKey: form.actionKey.trim() || deriveActionKey(form.permissionCode),
    identifierKey: form.identifierKey.trim() || null,
    scopeLevels: form.scopeLevels,
    apiGroups: parseListInput(form.apiGroupsText),
    menuPaths: parseListInput(form.menuPathsText),
    sortOrder: Number.isNaN(Number(form.sortOrder)) ? 9999 : Number(form.sortOrder),
    enabled: form.enabled,
  };
}

function DetailField(props: { label: string; value?: string | number | null; mono?: boolean; className?: string }) {
  return (
    <div className="space-y-1.5 px-4">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className={cn("break-words text-sm text-foreground", props.mono && "font-mono text-[12px]", props.className)}>
        {props.value === undefined || props.value === null || props.value === "" ? "-" : props.value}
      </div>
    </div>
  );
}

function DetailBadgeList(props: { label: string; items?: string[] | null; mono?: boolean; emptyText?: string }) {
  const items = (props.items ?? []).filter(Boolean);
  return (
    <div className="space-y-2 px-4">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Badge
              key={`${props.label}-${item}`}
              variant="outline"
              className={cn("border-border/70 bg-muted/30 text-foreground", props.mono && "font-mono text-[11px]")}
            >
              {item}
            </Badge>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">{props.emptyText || "-"}</div>
      )}
    </div>
  );
}

export function PermissionManagementPage() {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [items, setItems] = useState<PermissionMetadataItem[]>([]);
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingIdentity, setEditingIdentity] = useState<{ permissionCode: string; sourceCode: string } | null>(null);
  const [form, setForm] = useState<PermissionMetadataForm>(() => createInitialMetadataForm());
  const [deleteMetadataOpen, setDeleteMetadataOpen] = useState(false);
  const [deletePermissionOpen, setDeletePermissionOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listPermissionMetadata();
      setItems((response ?? []).filter((item) => !isHiddenAppSource(item.sourceCode)));
    } catch (err) {
      notify.error("权限目录加载失败", { description: resolveUserErrorMessage(err, "无法加载权限目录") });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const catalogItems = useMemo(() => items, [items]);

  const treeData = useMemo<PermissionSourceNode[]>(() => {
    const sourceMap = new Map<string, {
      node: PermissionSourceNode;
      directories: Map<string, {
        node: PermissionDirectoryNode;
        resources: Map<string, PermissionResourceNode>;
      }>;
    }>();

    [...catalogItems].sort(sortPermissions).forEach((item) => {
      const sourceCode = item.sourceCode || DEFAULT_RBAC_SOURCE;
      const sourceKey = `source:${sourceCode}`;
      const directoryGroupKey = getPermissionDirectoryGroupKey(item);
      const resourceKey = getPermissionResourceKey(item);
      const sortOrder = getPermissionSortOrder(item);

      let sourceEntry = sourceMap.get(sourceKey);
      if (!sourceEntry) {
        sourceEntry = {
          node: {
            key: sourceKey,
            sourceCode,
            sourceName: item.sourceName || getRbacSourceLabel(sourceCode),
            directories: [],
            metadataCount: 0,
            enabledCount: 0,
            sortOrder,
          },
          directories: new Map(),
        };
        sourceMap.set(sourceKey, sourceEntry);
      }

      let directoryEntry = sourceEntry.directories.get(directoryGroupKey);
      if (!directoryEntry) {
        directoryEntry = {
          node: {
            key: `directory:${sourceCode}:${directoryGroupKey}`,
            sourceCode,
            directoryKey: getPermissionDirectoryKey(item),
            directoryName: getPermissionDirectoryName(item),
            resources: [],
            metadataCount: 0,
            enabledCount: 0,
            sortOrder,
          },
          resources: new Map(),
        };
        sourceEntry.directories.set(directoryGroupKey, directoryEntry);
      }

      let resourceNode = directoryEntry.resources.get(resourceKey);
      if (!resourceNode) {
        resourceNode = {
          key: `resource:${sourceCode}:${directoryGroupKey}:${resourceKey}`,
          resourceKey,
          resourceName: getPermissionResourceName(item),
          items: [],
          metadataCount: 0,
          enabledCount: 0,
          sortOrder,
        };
        directoryEntry.resources.set(resourceKey, resourceNode);
      }

      resourceNode.items.push(item);
      resourceNode.metadataCount += 1;
      resourceNode.enabledCount += item.enabled ? 1 : 0;
      resourceNode.sortOrder = Math.min(resourceNode.sortOrder, sortOrder);

      directoryEntry.node.metadataCount += 1;
      directoryEntry.node.enabledCount += item.enabled ? 1 : 0;
      directoryEntry.node.sortOrder = Math.min(directoryEntry.node.sortOrder, sortOrder);

      sourceEntry.node.metadataCount += 1;
      sourceEntry.node.enabledCount += item.enabled ? 1 : 0;
      sourceEntry.node.sortOrder = Math.min(sourceEntry.node.sortOrder, sortOrder);
    });

    return Array.from(sourceMap.values())
      .map((sourceEntry) => ({
        ...sourceEntry.node,
        directories: Array.from(sourceEntry.directories.values())
          .map((directoryEntry) => ({
            ...directoryEntry.node,
            resources: Array.from(directoryEntry.resources.values())
              .map((resourceNode) => ({
                ...resourceNode,
                items: [...resourceNode.items].sort(sortPermissions),
              }))
              .sort((a, b) => a.sortOrder - b.sortOrder || a.resourceName.localeCompare(b.resourceName, "zh-CN")),
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.directoryName.localeCompare(b.directoryName, "zh-CN")),
      }))
      .sort((a, b) => {
        const sourceDiff = getSourceOrder(a.sourceCode) - getSourceOrder(b.sourceCode);
        if (sourceDiff !== 0) {
          return sourceDiff;
        }
        return a.sourceName.localeCompare(b.sourceName, "zh-CN");
      });
  }, [catalogItems]);

  const topStats = useMemo(() => {
    const directoryCount = treeData.reduce((sum, sourceNode) => sum + sourceNode.directories.length, 0);
    const registeredCount = catalogItems.filter((item) => item.registered).length;
    const unregisteredCount = catalogItems.length - registeredCount;
    return [
      {
        key: "catalog-total",
        label: "权限目录总数",
        value: catalogItems.length,
        description: "元数据已挂载条目",
        footnote: "auth_permission_metadata",
        icon: FolderOpen,
        iconClassName: "bg-amber-50 text-amber-600 ring-1 ring-amber-100",
      },
      {
        key: "permission-total",
        label: "权限实例总数",
        value: registeredCount,
        description: "RBAC 权限实例总量",
        footnote: "auth_permissions",
        icon: Shield,
        iconClassName: "bg-violet-50 text-violet-600 ring-1 ring-violet-100",
      },
      {
        key: "registered-total",
        label: "已注册实例",
        value: registeredCount,
        description: "目录-实例已完成映射",
        footnote: "registered",
        icon: CheckCircle2,
        iconClassName: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
      },
      {
        key: "unregistered-total",
        label: "未注册目录",
        value: unregisteredCount,
        description: `目录节点 ${directoryCount} 个`,
        footnote: "pending register",
        icon: Clock3,
        iconClassName: "bg-orange-50 text-orange-600 ring-1 ring-orange-100",
      },
    ];
  }, [catalogItems, treeData]);

  const selectedItem = useMemo(
    () => catalogItems.find((item) => getCatalogItemKey(item) === selectedItemKey) ?? null,
    [catalogItems, selectedItemKey],
  );

  useEffect(() => {
    if (catalogItems.length === 0) {
      setSelectedItemKey(null);
      return;
    }
    if (!selectedItemKey || !catalogItems.some((item) => getCatalogItemKey(item) === selectedItemKey)) {
      setSelectedItemKey(getCatalogItemKey(catalogItems[0]));
    }
  }, [catalogItems, selectedItemKey]);

  useEffect(() => {
    if (!selectedItem) {
      return;
    }
    const requiredKeys = [
      `source:${selectedItem.sourceCode || DEFAULT_RBAC_SOURCE}`,
      `directory:${selectedItem.sourceCode || DEFAULT_RBAC_SOURCE}:${getPermissionDirectoryGroupKey(selectedItem)}`,
    ];
    setExpandedKeys((current) => Array.from(new Set([...current, ...requiredKeys])));
  }, [selectedItem]);

  const toggleExpanded = useCallback((key: string) => {
    setExpandedKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }, []);

  const handlePermissionCodeChange = useCallback((value: string) => {
    setForm((current) => {
      const prevCode = current.permissionCode;
      const next = value;
      const nextDirectoryKey = current.directoryKey === deriveDirectoryKey(prevCode) ? deriveDirectoryKey(next) : current.directoryKey;
      const nextResourceKey = current.resourceKey === deriveResourceKey(prevCode) ? deriveResourceKey(next) : current.resourceKey;
      const nextActionKey = current.actionKey === deriveActionKey(prevCode) ? deriveActionKey(next) : current.actionKey;
      return {
        ...current,
        permissionCode: next,
        directoryKey: nextDirectoryKey,
        resourceKey: nextResourceKey,
        actionKey: nextActionKey,
      };
    });
  }, []);

  const handleScopeLevelToggle = useCallback((scopeLevel: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      scopeLevels: checked
        ? Array.from(new Set([...current.scopeLevels, scopeLevel]))
        : current.scopeLevels.filter((item) => item !== scopeLevel),
    }));
  }, []);

  const openCreateDialog = useCallback(() => {
    setDialogMode("create");
    setEditingIdentity(null);
    setForm(createInitialMetadataForm());
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((item: PermissionMetadataItem) => {
    setDialogMode("edit");
    setEditingIdentity({ permissionCode: item.permissionCode, sourceCode: item.sourceCode });
    setForm(createFormFromItem(item));
    setDialogOpen(true);
  }, []);

  const handleSubmitMetadata = useCallback(async () => {
    const payload = buildMetadataPayload(form);
    if (!payload.permissionCode?.trim() || !payload.directoryName?.trim() || !payload.resourceName?.trim()) {
      setFormError("请填写权限代码、目录和资源名称");
      return;
    }
    if ((payload.scopeLevels ?? []).length === 0) {
      setFormError("请至少选择一个作用域层级");
      return;
    }
    setFormError(null);
    try {
      setSubmitting(true);
      const result = dialogMode === "create"
        ? await createPermissionMetadata(payload)
        : await updatePermissionMetadata({
          ...(payload as UpdatePermissionMetadataCommand),
          currentPermissionCode: editingIdentity?.permissionCode || payload.permissionCode,
          currentSourceCode: editingIdentity?.sourceCode || payload.sourceCode,
        });
      notify.success(dialogMode === "create" ? "新增成功" : "修改成功", { description: dialogMode === "create"
          ? "权限元数据已创建，可继续注册为权限实例。"
          : "权限元数据已更新，已注册实例会同步更新定义。" });
      setDialogOpen(false);
      setSelectedItemKey(getCatalogItemKey(result));
      await refresh();
    } catch (err) {
      notify.error(dialogMode === "create" ? "新增失败" : "修改失败", { description: resolveUserErrorMessage(err, dialogMode === "create" ? "权限元数据创建失败" : "权限元数据更新失败") });
    } finally {
      setSubmitting(false);
    }
  }, [dialogMode, editingIdentity, form, refresh]);

  const handleRegisterPermission = useCallback(async () => {
    if (!selectedItem) {
      return;
    }
    try {
      setRegistering(true);
      const result = await registerPermissionMetadata({
        permissionCode: selectedItem.permissionCode,
        sourceCode: selectedItem.sourceCode,
      });
      notify.success("注册成功", { description: "权限实例已生成，可继续在角色管理中完成分配。" });
      setSelectedItemKey(getCatalogItemKey(result));
      await refresh();
    } catch (err) {
      notify.error("注册失败", { description: resolveUserErrorMessage(err, "权限实例注册失败") });
    } finally {
      setRegistering(false);
    }
  }, [refresh, selectedItem]);

  const handleDeleteMetadata = useCallback(async () => {
    if (!selectedItem) {
      return;
    }
    try {
      setSubmitting(true);
      await deletePermissionMetadata({
        permissionCode: selectedItem.permissionCode,
        sourceCode: selectedItem.sourceCode,
      });
      setDeleteMetadataOpen(false);
      setSelectedItemKey(null);
      notify.success("删除成功");
      await refresh();
    } catch (err) {
      notify.error("删除失败", { description: resolveUserErrorMessage(err, "权限元数据删除失败") });
    } finally {
      setSubmitting(false);
    }
  }, [refresh, selectedItem]);

  const handleDeletePermission = useCallback(async () => {
    if (!selectedItem?.permissionId) {
      return;
    }
    try {
      setSubmitting(true);
      await deletePermission(selectedItem.permissionId);
      setDeletePermissionOpen(false);
      notify.success("删除成功");
      await refresh();
    } catch (err) {
      notify.error("删除失败", { description: resolveUserErrorMessage(err, "权限实例删除失败") });
    } finally {
      setSubmitting(false);
    }
  }, [refresh, selectedItem]);

  const directoryOptions = useMemo(() => {
    const sourceCode = form.sourceCode || DEFAULT_RBAC_SOURCE;
    return Array.from(
      new Set(
        catalogItems
          .filter((item) => item.sourceCode === sourceCode)
          .map((item) => item.directoryName?.trim())
          .filter(Boolean),
      ),
    ) as string[];
  }, [catalogItems, form.sourceCode]);

  return (
    <PageShell className="!overflow-hidden flex min-h-0 flex-1 flex-col">
      <PageHeader
        className="shrink-0"
        title="权限管理"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              刷新
            </Button>
            <Button variant="page" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              新增权限
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
              <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", stat.iconClassName)}>
                <stat.icon className="h-3.5 w-3.5" />
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {loading ? (
          <div className="p-5">
            <EmptyState message="正在加载权限目录..." />
          </div>
        ) : catalogItems.length > 0 ? (
          <div className="grid h-full min-h-0 overflow-hidden rounded-2xl xl:grid-cols-[500px_minmax(0,1fr)]">
            <aside className="flex h-full min-h-0 overflow-hidden flex-col xl:border-r xl:border-border/70">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="text-sm font-semibold text-foreground">权限目录树</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{catalogItems.length} 项</span>
                </div>
              </div>

              <ScrollArea className="min-h-0 flex-1 overflow-hidden">
                <div className="space-y-1.5 px-3 py-3">
                  {treeData.map((sourceNode) => {
                    const sourceExpanded = expandedKeys.includes(sourceNode.key);
                    return (
                      <div key={sourceNode.key} className="rounded-xl bg-background/60">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(sourceNode.key)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {sourceExpanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            {sourceExpanded ? (
                              <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                            ) : (
                              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate text-sm font-medium text-foreground">{sourceNode.sourceName}</span>
                          </div>
                          <Badge variant="outline" className="shrink-0 border-primary/20 bg-primary/5 text-primary">
                            {sourceNode.metadataCount} 项
                          </Badge>
                        </button>

                        {sourceExpanded ? (
                          <div className="space-y-1.5 px-2 pb-2">
                            {sourceNode.directories.map((directoryNode) => {
                              const directoryExpanded = expandedKeys.includes(directoryNode.key);
                              return (
                                <div key={directoryNode.key} className="rounded-lg">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpanded(directoryNode.key)}
                                    className={cn(
                                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                                      directoryExpanded && "bg-muted/20",
                                    )}
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      {directoryExpanded ? (
                                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      )}
                                      <span className="truncate text-sm text-foreground">{directoryNode.directoryName}</span>
                                    </div>
                                    <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700">
                                      {directoryNode.resources.length} 资源
                                    </Badge>
                                  </button>

                                  {directoryExpanded ? (
                                    <div className="space-y-2 pl-7 pr-2 pb-2 pt-1">
                                      {directoryNode.resources.map((resourceNode) => (
                                        <div key={resourceNode.key} className="rounded-lg">
                                          <div className="flex items-center justify-between gap-3 px-2 py-1.5">
                                            <div className="flex min-w-0 items-center gap-2">
                                              <Square className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                              <span className="truncate text-[13px] font-medium text-foreground">{resourceNode.resourceName}</span>
                                            </div>
                                            <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700">
                                              {resourceNode.metadataCount} 项
                                            </Badge>
                                          </div>

                                          <div className="ml-[7px] space-y-1 border-l border-border/60 pl-4">
                                            {resourceNode.items.map((item) => {
                                              const active = getCatalogItemKey(item) === selectedItemKey;
                                              return (
                                                <button
                                                  key={getCatalogItemKey(item)}
                                                  type="button"
                                                  onClick={() => setSelectedItemKey(getCatalogItemKey(item))}
                                                  className={cn(
                                                    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                                                    active
                                                      ? "border-l-2 border-primary bg-primary/10 shadow-sm"
                                                      : "bg-muted/10 hover:bg-muted/30",
                                                  )}
                                                >
                                                  <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                      <Check className={cn("h-3.5 w-3.5 shrink-0", item.registered ? "text-emerald-500" : "text-amber-500")} />
                                                      <span className="truncate text-[13px] font-medium text-primary">
                                                        {item.actionKey || "manage"}
                                                      </span>
                                                    </div>
                                                    <div className="mt-1 truncate text-[12px] text-muted-foreground">
                                                      {getPermissionTreeSummary(item)}
                                                    </div>
                                                  </div>
                                                  <div className="flex shrink-0 items-center gap-2">
                                                    <Badge
                                                      variant="outline"
                                                      className={cn(
                                                        item.registered
                                                          ? "border-blue-200 bg-blue-50 text-blue-700"
                                                          : "border-slate-200 bg-slate-100 text-slate-600",
                                                      )}
                                                    >
                                                      {item.registered ? "已注册" : "未注册"}
                                                    </Badge>
                                                    <Badge
                                                      variant="outline"
                                                      className={cn(
                                                        item.enabled
                                                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                          : "border-amber-200 bg-amber-50 text-amber-700",
                                                      )}
                                                    >
                                                      {item.enabled ? "启用" : "停用"}
                                                    </Badge>
                                                  </div>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </aside>

            <section className="min-w-0 h-full min-h-0 overflow-hidden p-6">
              {selectedItem ? (
                <ScrollArea className="h-full min-h-0 pr-2">
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="space-y-1">
                          <h2 className="text-base font-semibold text-foreground">元数据信息</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                            {selectedItem.sourceName || getRbacSourceLabel(selectedItem.sourceCode)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              selectedItem.enabled
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700",
                            )}
                          >
                            {selectedItem.enabled ? "已启用" : "已停用"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              selectedItem.registered
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-slate-100 text-slate-600",
                            )}
                          >
                            {selectedItem.registered ? "已注册" : "未注册"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" className="h-8 gap-1.5 px-3 text-[12px]" onClick={() => openEditDialog(selectedItem)}>
                          <FilePenLine className="h-2.5 w-2.5" />
                          修改
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "h-8 gap-1.5 px-3 text-[12px]",
                            selectedItem.enabled
                              ? "border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-700"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700",
                          )}
                          onClick={() => notify.success("暂未开放", { description: "启用/禁用动作将在后续版本补齐。" })}
                        >
                          <Power className="h-2.5 w-2.5" />
                          {selectedItem.enabled ? "禁用" : "启用"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 gap-1.5 px-3 text-[12px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteMetadataOpen(true)}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                          删除
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-4">
                      <DetailField label="权限代码" value={selectedItem.permissionCode} mono />
                      <DetailField label="来源系统" value={selectedItem.sourceName || getRbacSourceLabel(selectedItem.sourceCode)} />
                      <DetailField label="目录" value={getPermissionDirectoryName(selectedItem)} />
                      <DetailField label="资源" value={getPermissionResourceName(selectedItem)} />
                      <DetailField label="操作" value={selectedItem.actionKey || "manage"} />
                      <DetailField label="标识字段" value={selectedItem.identifierKey} />
                      <DetailField label="排序" value={selectedItem.sortOrder ?? "-"} />
                      <DetailField label="状态" value={selectedItem.enabled ? "启用" : "停用"} />
                    </div>

                    <DetailBadgeList label="作用域层级" items={selectedItem.scopeLevels} />
                    <DetailBadgeList label="API 组" items={selectedItem.apiGroups} mono emptyText="未配置 API 组" />
                    <DetailBadgeList label="菜单路径" items={selectedItem.menuPaths} mono emptyText="未配置菜单路径" />

                    <Separator />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-foreground">权限实例</h3>
                          <Badge
                            variant="outline"
                            className={cn(
                              selectedItem.registered
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-slate-100 text-slate-600",
                            )}
                          >
                            {selectedItem.registered ? "已注册" : "未注册"}
                          </Badge>
                        </div>
                        {selectedItem.registered ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 gap-1.5 px-3 text-[12px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeletePermissionOpen(true)}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                            删除实例
                          </Button>
                        ) : null}
                      </div>

                      {selectedItem.registered ? (
                        <div className="grid gap-5 md:grid-cols-4">
                          <DetailField label="权限名称" value={selectedItem.permissionName || selectedItem.resourceName} className="font-medium" />
                          <DetailField label="权限 ID" value={selectedItem.permissionId} mono />
                          <DetailField label="来源编码" value={selectedItem.sourceCode} mono />
                          <DetailField label="创建时间" value={formatRbacDateTime(selectedItem.permissionCreatedAt)} />
                          <DetailField label="更新时间" value={formatRbacDateTime(selectedItem.permissionUpdatedAt)} />
                          <DetailField label="权限说明" value={selectedItem.permissionDescription || "-"} />
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium text-orange-700">
                                <AlertTriangle className="h-4 w-4" />
                                此权限目录尚未注册为权限实例
                              </div>
                              <div className="text-sm leading-6 text-orange-900/80">
                                注册后，该权限可被分配角色，参与 RBAC 鉴权流程。
                              </div>
                            </div>
                            <Button className="shrink-0 gap-2" onClick={() => void handleRegisterPermission()} disabled={registering}>
                              {registering ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                              注册为权限实例
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <EmptyState message="请先从左侧权限目录树中选择一个权限节点。" />
              )}
            </section>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState message="当前筛选条件下暂无权限目录数据。" />
          </div>
        )}
      </div>

      <PermissionMetadataDialog
        open={dialogOpen}
        mode={dialogMode}
        form={form}
        submitting={submitting}
        error={formError}
        directoryOptions={directoryOptions}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setFormError(null);
        }}
        onChange={(patch) => {
          setFormError(null);
          setForm((current) => ({ ...current, ...patch }));
        }}
        onPermissionCodeChange={handlePermissionCodeChange}
        onScopeLevelToggle={handleScopeLevelToggle}
        onSubmit={() => void handleSubmitMetadata()}
      />

      <AlertDialog open={deleteMetadataOpen} onOpenChange={setDeleteMetadataOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除权限元数据？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将移除当前权限目录元数据。
              {selectedItem?.registered ? "由于该目录已注册为权限实例，将同步删除 permission 实例及其角色绑定关系。" : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteMetadata();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletePermissionOpen} onOpenChange={setDeletePermissionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除权限实例？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后当前目录会回到“未注册”状态，元数据会继续保留，可稍后重新注册为 permission 实例。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(event) => {
                event.preventDefault();
                void handleDeletePermission();
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
