import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, ListChecks, Play, SquareSquare, Settings2, FolderKanban, ChevronDown, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePagedTotal } from "@/shared/hooks/use-paged-total";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { Badge } from "@/shared/ui/badge";
import { hasBackendErrorCode, resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  StatusBadge,
  TableSurface,
  type StatusBadgeTone,
} from "@/shared/components/page";
import { listMerchants, type Merchant } from "@/shared/api/ums/ums-merchant";
import { listStores, type Store } from "@/shared/api/ums/ums-store";
import { listWorkflows, type WorkflowCard } from "@/shared/api/workflow/workflow";
import {
  createComfyUIServer,
  deleteComfyUIServer,
  getComfyUIServer,
  listComfyUIServers,
  setComfyUIServerEnabled,
  stopComfyUIServer,
  checkComfyUIServer,
  setAllComfyUIServerEnabled,
  stopAllComfyUIServer,
  updateComfyUIServer,
  type AppScopeCommand,
  type ComfyUIServer,
  type ComfyUIServerProvider,
  type CreateComfyUIServerCommand,
  type UpdateComfyUIServerCommand,
} from "@/shared/api/comfyui/comfyui-server";
import { listComfyUIServerGroups } from "@/shared/api/comfyui/comfyui-server-group";
import ComfyUIDispatchConfigDialog from "@/modules/integration/components/ComfyUIDispatchConfigDialog";
import ComfyUIServerEditorPage, {
  type ComfyUIServerAuthMethod,
} from "@/modules/integration/components/ComfyUIServerEditorPage";
import ComfyUIServerGroupManagerDialog from "@/modules/integration/components/ComfyUIServerGroupManagerDialog";

function resolveAuthMethod(authType?: string | null): ComfyUIServerAuthMethod {
  return authType === "basic" ? "basic" : "token";
}
import { notify } from "@/shared/lib/notify";

const updateMulti = (value: string, nextChecked: boolean, current: string[], onChange: (next: string[]) => void) => {
  const set = new Set(current);
  if (nextChecked) set.add(value);
  else set.delete(value);
  onChange(Array.from(set));
};

function renderMultiSelect(args: {
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (next: string[]) => void;
  widthClassName?: string;
}) {
  const selectedSet = new Set(args.value);
  const selectedLabels = args.options.filter((o) => selectedSet.has(o.value)).map((o) => o.label);
  const summary = selectedLabels.length ? selectedLabels.join("、") : args.placeholder;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`subpage-native-select h-10 w-full justify-between px-3 font-normal ${args.widthClassName ?? ""}`.trim()}
        >
          <span className="truncate text-left">{summary}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="subpage-select-content w-[420px] max-h-72 overflow-auto">
        {args.options.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">暂无数据</div>}
        {args.options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            className="subpage-select-item"
            checked={selectedSet.has(o.value)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) => updateMulti(o.value, checked === true, args.value, args.onChange)}
          >
            <span className="truncate">{o.label}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function resolveAuthStatusLabel(server: Pick<ComfyUIServer, "hasAuth" | "authType">): string {
  if (!server.hasAuth || server.authType === "none") return "无鉴权";
  if (server.authType === "basic") return "用户名密码";
  if (server.authType === "bearer") return "Bearer Token";
  return "已鉴权";
}

function resolveOnlineStatusMeta(status: string | null | undefined): { label: string; tone: StatusBadgeTone } {
  const s = (status || "unknown").trim().toLowerCase();
  if (s === "online") return { label: "在线", tone: "success" };
  if (s === "offline") return { label: "离线", tone: "danger" };
  if (s === "unknown") return { label: "未知", tone: "neutral" };
  return { label: s || "未知", tone: "neutral" };
}

function resolveLoadStatusMeta(status: string | null | undefined): { label: string; tone: StatusBadgeTone } {
  const raw = (status || "unknown").trim().toLowerCase();
  const s = raw === "busy" ? "normal" : raw === "overloaded" ? "overload" : raw;
  if (s === "idle") return { label: "空闲", tone: "success" };
  if (s === "low") return { label: "较低", tone: "success" };
  if (s === "normal") return { label: "正常", tone: "warning" };
  if (s === "high") return { label: "偏高", tone: "warning" };
  if (s === "overload") return { label: "过载", tone: "danger" };
  if (s === "unknown") return { label: "未知", tone: "neutral" };
  return { label: s || "未知", tone: "neutral" };
}

function toFriendlyCheckDetail(message: string | null | undefined): string | null {
  if (!message) return null;
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length > 80) return null;
  if (/https?:\/\//i.test(normalized)) return null;
  if (/[A-Za-z]:\\/.test(normalized)) return null;
  if (/\b(Exception|Error|Traceback|Stack|Caused by|java\.|org\.|com\.)\b/i.test(normalized)) return null;
  if (/\[(?:no body|empty body)\]/i.test(normalized)) return null;
  if (/\b\d{3}\b/.test(normalized) && /\b(Not Found|Bad Request|Unauthorized|Forbidden|Conflict|Too Many Requests|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout)\b/i.test(normalized)) {
    return null;
  }
  if (/\b(NotFound|BadRequest|Unauthorized|Forbidden|Conflict|Timeout|ConnectException|SocketTimeout|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT)\b/i.test(normalized)) {
    return null;
  }
  return normalized;
}

function buildCheckSuccessMessage(result: { onlineStatus: string | null | undefined; loadStatus: string | null | undefined; errorMessage?: string | null }): string {
  const online = (result.onlineStatus || "").trim().toLowerCase();
  const load = (result.loadStatus || "").trim().toLowerCase();
  const detail = toFriendlyCheckDetail(result.errorMessage);

  if (online === "offline") {
    return detail ?? "服务当前离线，请检查服务进程或网络连接";
  }
  if (load === "overloaded" || load === "overload" || load === "high" || load === "busy") {
    return detail ?? "服务在线，但当前负载较高，建议稍后再试";
  }
  if (online === "online" && (load === "idle" || load === "low" || load === "normal" || load === "")) {
    return "服务在线，状态正常";
  }
  return detail ?? "检测已完成，请查看当前服务状态";
}

function buildCheckErrorMessage(error: unknown): string {
  const resolved = resolveUserErrorMessage(error, "服务检测失败，请稍后重试");
  const friendly = toFriendlyCheckDetail(resolved);
  return friendly ?? "服务检测失败，请稍后重试";
}

function buildComfyUIServerSaveErrorMessage(error: unknown, mode: "create" | "edit"): string {
  const fallback = mode === "create" ? "新增服务失败，请稍后重试" : "更新服务失败，请稍后重试";
  if (hasBackendErrorCode(error, "INTEGRATION-RESOURCE-ALREADY-EXISTS")) {
    return "当前服务名称或服务器地址已存在，请调整后重试";
  }
  if (hasBackendErrorCode(error, "INTEGRATION-COMFYUI-SERVER-BASE-URL-ALREADY-EXISTS")) {
    return "该 ComfyUI 服务地址已存在，请更换地址后重试";
  }
  if (hasBackendErrorCode(error, "INTEGRATION-COMFYUI-SERVER-GROUP-NOT-FOUND")) {
    return "所选分组不存在，请刷新后重新选择";
  }
  if (hasBackendErrorCode(error, "WORKFLOW-RESOURCE-NOT-FOUND")) {
    return "所选应用不存在，请刷新后重新选择";
  }
  if (hasBackendErrorCode(error, "UMS-RESOURCE-NOT-FOUND")) {
    return "所选适用范围不存在，请刷新后重新选择";
  }
  if (hasBackendErrorCode(error, "INTEGRATION-COMFYUI-SERVER-GPU-COUNT-INVALID")) {
    return "GPU 数量必须为非负数";
  }
  if (hasBackendErrorCode(
    error,
    "INTEGRATION-COMFYUI-SERVER-TENANT-TYPE-INVALID",
    "INTEGRATION-COMFYUI-SERVER-SCOPE-BINDING-INVALID",
    "INTEGRATION-COMFYUI-SERVER-SCOPE-LEVEL-INVALID",
    "INTEGRATION-COMFYUI-SERVER-APP-SCOPE-INVALID",
    "INTEGRATION-COMFYUI-SERVER-SCOPE-TYPE-INVALID"
  )) {
    return "适用范围配置无效，请检查专属组织和门店设置后重试";
  }
  if (hasBackendErrorCode(error, "INTEGRATION-COMFYUI-SERVER-NOT-FOUND", "INTEGRATION-RESOURCE-NOT-FOUND")) {
    return "当前服务不存在或已被删除，请刷新列表后重试";
  }
  return resolveUserErrorMessage(error, fallback);
}

function buildComfyUIServerDeleteErrorMessage(error: unknown, force: boolean): string {
  if (force) {
    if (hasBackendErrorCode(error, "INTEGRATION-COMFYUI-SERVER-NOT-FOUND", "INTEGRATION-RESOURCE-NOT-FOUND")) {
      return "当前服务不存在或已被删除，请刷新列表后重试";
    }
    return resolveUserErrorMessage(error, "强制删除失败，仍存在未清理的关联数据，请稍后重试");
  }
  if (hasBackendErrorCode(error, "INTEGRATION-COMFYUI-SERVER-ACTIVE-TASKS-EXIST")) {
    return "当前服务仍有排队或运行中的任务，可改用强制删除自动取消任务并清理关联";
  }
  if (hasBackendErrorCode(
    error,
    "INTEGRATION-COMFYUI-SERVER-SCOPE-BINDING-REFS-EXIST",
    "INTEGRATION-COMFYUI-SERVER-APP-SCOPE-REFS-EXIST",
    "INTEGRATION-COMFYUI-SERVER-DISPATCH-STRATEGY-REFS-EXIST",
    "INTEGRATION-COMFYUI-SERVER-IN-USE"
  )) {
    return "当前服务仍被工作流、适用范围、调度策略或历史素材引用，可改用强制删除自动清理关联";
  }
  if (hasBackendErrorCode(error, "INTEGRATION-COMFYUI-SERVER-NOT-FOUND", "INTEGRATION-RESOURCE-NOT-FOUND")) {
    return "当前服务不存在或已被删除，请刷新列表后重试";
  }
  return resolveUserErrorMessage(error, "删除失败，请稍后重试");
}

export default function ComfyUIServerManagementPage() {
  const queryClient = useQueryClient();

  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editing, setEditing] = useState<ComfyUIServer | null>(null);

  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<"all" | "enabled" | "disabled">("all");
  const enabledParam = enabledFilter === "all" ? undefined : enabledFilter === "enabled";
  const [groupIdFilter, setGroupIdFilter] = useState<string>("all");

  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const applyKeywordSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
    setPageNo(1);
  };

  const listQuery = useQuery({
    queryKey: ["intComfyUIServers", pageNo, pageSize, appliedKeyword, enabledFilter, groupIdFilter],
    queryFn: () =>
      listComfyUIServers({
        pageNo,
        pageSize,
        total: requestTotal,
        keyword: appliedKeyword.trim() ? appliedKeyword.trim() : undefined,
        enabled: enabledParam,
        groupId: groupIdFilter === "all" ? undefined : groupIdFilter,
      }),
    enabled: view === "list",
    retry: false,
    refetchInterval: view === "list" ? 10000 : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  });

  const requestTotal = usePagedTotal(pageNo, listQuery.data?.page?.total);

  const lastListErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (view !== "list") return;
    if (!listQuery.isError) {
      lastListErrorRef.current = null;
      return;
    }
    const e = listQuery.error as unknown;
    const message = resolveUserErrorMessage(e, "请求失败");
    if (lastListErrorRef.current === message) return;
    lastListErrorRef.current = message;
    notify.error("加载失败", { description: message });
  }, [listQuery.error, listQuery.isError, view]);

  const items = listQuery.data?.items ?? [];
  const pageTotal = listQuery.data?.page?.total ?? 0;
  const canNextPage = useMemo(() => {
    if (pageTotal > 0) return pageNo * pageSize < pageTotal;
    return items.length === pageSize;
  }, [items.length, pageNo, pageSize, pageTotal]);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["intComfyUIServers"] });
  };

  const groupsQuery = useQuery({
    queryKey: ["intComfyUIServerGroupsAll"],
    queryFn: () => listComfyUIServerGroups({ pageNo: 1, pageSize: 200 }),
  });

  const groupBarItems = useMemo(() => {
    return [{ id: "all", name: "全部" }, ...(groupsQuery.data?.items ?? [])];
  }, [groupsQuery.data?.items]);

  const groupOptions = useMemo(() => {
    return (groupsQuery.data?.items ?? []).map((g) => ({ value: g.id, label: g.name }));
  }, [groupsQuery.data?.items]);

  const [dispatchConfigOpen, setDispatchConfigOpen] = useState(false);
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const toggleEnabledMutation = useMutation({
    mutationFn: (p: { id: string; enabled: boolean }) => setComfyUIServerEnabled(p.id, p.enabled),
    onSuccess: async (_data, { enabled }) => {
      notify.success(enabled ? "已启用" : "已禁用");
      await refresh();
    },
    onError: (e) => {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (payload: { id: string; force: boolean }) => deleteComfyUIServer(payload.id, { force: payload.force }),
    onSuccess: async () => {
      notify.success("删除成功");
      await refresh();
    },
    onError: (e) => {
      const force = deleteMutation.variables?.force === true;
      notify.error(force ? "强制删除失败" : "删除失败", { description: buildComfyUIServerDeleteErrorMessage(e, force) });
    },
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => stopComfyUIServer(id),
    onSuccess: async () => {
      notify.success("已停止");
      await refresh();
    },
    onError: (e) => {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const checkMutation = useMutation({
    mutationFn: (id: string) => checkComfyUIServer(id),
    onSuccess: async (r) => {
      await refresh();
      const message = buildCheckSuccessMessage(r);
      notify.error("检测完成", { description: message });
    },
    onError: (e) => {
      notify.error("检测失败", { description: buildCheckErrorMessage(e) });
    },
  });
  const [batchChecking, setBatchChecking] = useState(false);

  const runServerCheck = async (id: string) => checkMutation.mutateAsync(id);

  const runBatchCheckCurrentPage = async () => {
    if (items.length === 0 || batchChecking) return;
    setBatchChecking(true);
    try {
      for (const item of items) {
        try {
          await runServerCheck(item.id);
        } catch {
          // 单行检测自己的 onError 已负责提示，这里继续后续服务器检测
        }
      }
    } finally {
      setBatchChecking(false);
    }
  };

  const toggleAllEnabledMutation = useMutation({
    mutationFn: (enabled: boolean) => setAllComfyUIServerEnabled(enabled),
    onSuccess: async (_data, enabled) => {
      notify.success(enabled ? "已全部启用" : "已全部禁用");
      await refresh();
    },
    onError: (e) => {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const stopAllMutation = useMutation({
    mutationFn: () => stopAllComfyUIServer(),
    onSuccess: async () => {
      notify.success("已全部停止");
      await refresh();
    },
    onError: (e) => {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (p: { mode: "create" | "edit"; id?: string; payload: CreateComfyUIServerCommand | UpdateComfyUIServerCommand }) => {
      if (p.mode === "create") {
        return createComfyUIServer(p.payload as CreateComfyUIServerCommand);
      }
      return updateComfyUIServer(p.id!, p.payload as UpdateComfyUIServerCommand);
    },
    onSuccess: async (_data, variables) => {
      notify.success(variables.mode === "create" ? "创建成功" : "保存成功");
      await refresh();
    },
    onError: (e) => {
      const mode = saveMutation.variables?.mode ?? "create";
      notify.error(mode === "create" ? "新增失败" : "更新失败", { description: buildComfyUIServerSaveErrorMessage(e, mode) });
    },
  });

  const [formName, setFormName] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formProvider, setFormProvider] = useState<ComfyUIServerProvider>("self_hosted");
  const [formGpuCount, setFormGpuCount] = useState("0");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formGroupId, setFormGroupId] = useState<string>("none");
  const [formAuthEnabled, setFormAuthEnabled] = useState(false);
  const [formAuthMethod, setFormAuthMethod] = useState<ComfyUIServerAuthMethod>("token");
  const [formAuthUsername, setFormAuthUsername] = useState("");
  const [formAuthPassword, setFormAuthPassword] = useState("");
  const [formAuthToken, setFormAuthToken] = useState("");

  const [merchantIds, setMerchantIds] = useState<string[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [includeWorkflowIds, setIncludeWorkflowIds] = useState<string[]>([]);
  const [excludeWorkflowIds, setExcludeWorkflowIds] = useState<string[]>([]);

  const [formInitialSnapshot, setFormInitialSnapshot] = useState<string | null>(null);
  const [formExitConfirmOpen, setFormExitConfirmOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editDetailAppliedToken, setEditDetailAppliedToken] = useState<string | null>(null);

  const editDetailQuery = useQuery({
    queryKey: ["intComfyUIServerDetail", editing?.id],
    queryFn: () => getComfyUIServer(editing!.id),
    enabled: view === "edit" && !!editing?.id,
  });

  useEffect(() => {
    if (view !== "edit" || !editing?.id || !editDetailQuery.data) return;
    const applyToken = `${editing.id}`;
    if (editDetailAppliedToken === applyToken) return;

    const { server, scopeBindings, appScopes } = editDetailQuery.data;
    const nextGroupId = server.groupId ? server.groupId : "none";
    const nextMerchantIds = (scopeBindings || []).filter((s) => s.scopeLevel === "merchant").map((s) => s.merchantId).filter((v): v is string => !!v);
    const nextStoreIds = (scopeBindings || []).filter((s) => s.scopeLevel === "store").map((s) => s.storeId).filter((v): v is string => !!v);
    const nextIncludeWorkflowIds = (appScopes || []).filter((s) => s.scopeType !== "exclude").map((s) => s.appId);
    const nextExcludeWorkflowIds = (appScopes || []).filter((s) => s.scopeType === "exclude").map((s) => s.appId);

    setFormName(server.name || "");
    setFormBaseUrl(server.baseUrl || "");
    setFormProvider(server.provider === "runninghub" ? "runninghub" : "self_hosted");
    setFormGpuCount(String(server.gpuCount ?? 0));
    setFormEnabled(server.enabled !== false);
    setFormGroupId(nextGroupId);
    setFormAuthEnabled(Boolean(server.hasAuth));
    setFormAuthMethod(resolveAuthMethod(server.authType));
    setFormAuthUsername("");
    setFormAuthPassword("");
    setFormAuthToken("");

    setMerchantIds(nextMerchantIds);
    setStoreIds(nextStoreIds);
    setIncludeWorkflowIds(nextIncludeWorkflowIds);
    setExcludeWorkflowIds(nextExcludeWorkflowIds.filter((x) => !nextIncludeWorkflowIds.includes(x)));

    // 用详情刷新列表行上的认证标记，避免仅靠列表缓存导致开关/方式不同步
    setEditing((prev) =>
      prev && prev.id === server.id
        ? {
            ...prev,
            hasAuth: Boolean(server.hasAuth),
            authType: server.authType ?? prev.authType,
            authMasked: server.authMasked ?? prev.authMasked,
          }
        : prev
    );

    setFormInitialSnapshot(
      JSON.stringify({
        name: (server.name || "").trim(),
        baseUrl: (server.baseUrl || "").trim(),
        provider: server.provider === "runninghub" ? "runninghub" : "self_hosted",
        gpuCount: String(Number(server.gpuCount) || 0),
        enabled: server.enabled !== false,
        groupId: nextGroupId,
        authEnabled: Boolean(server.hasAuth),
        authMethod: resolveAuthMethod(server.authType),
        authUsername: "",
        authPassword: "",
        authToken: "",
        merchantIds: Array.from(new Set(nextMerchantIds)).sort(),
        storeIds: Array.from(new Set(nextStoreIds)).sort(),
        includeWorkflowIds: Array.from(new Set(nextIncludeWorkflowIds)).sort(),
        excludeWorkflowIds: Array.from(new Set(nextExcludeWorkflowIds.filter((x) => !nextIncludeWorkflowIds.includes(x)))).sort(),
      })
    );
    setEditDetailAppliedToken(applyToken);
  }, [
    editDetailAppliedToken,
    editDetailQuery.data,
    editing?.id,
    view,
  ]);

  const merchantListQuery = useQuery({
    queryKey: ["umsMerchants", view],
    queryFn: async () => {
      const res = await listMerchants({ pageNo: 1, pageSize: 200 });
      return res.items ?? [];
    },
    enabled: view === "create" || view === "edit",
  });

  const storeListQuery = useQuery({
    queryKey: ["umsStores", view],
    queryFn: async () => {
      const res = await listStores({ pageNo: 1, pageSize: 200 });
      return res.items ?? [];
    },
    enabled: view === "create" || view === "edit",
  });

  const workflowListQuery = useQuery({
    queryKey: ["workflowList", view],
    queryFn: async () => {
      const res = await listWorkflows({ pageNo: 1, pageSize: 200 });
      return res.items ?? [];
    },
    enabled: view === "create" || view === "edit",
  });

  const merchantOptions = useMemo(
    () => (merchantListQuery.data ?? []).map((m: Merchant) => ({ value: m.id, label: m.name || m.code || m.id })),
    [merchantListQuery.data]
  );
  const storeOptions = useMemo(
    () => (storeListQuery.data ?? []).map((s: Store) => ({ value: s.id, label: s.name || s.code || s.id })),
    [storeListQuery.data]
  );
  const workflowOptions = useMemo(
    () =>
      (workflowListQuery.data ?? []).map((w: WorkflowCard) => ({
        value: w.id,
        label: w.title || w.code || w.id,
      })),
    [workflowListQuery.data]
  );

  const buildSnapshot = (args?: Partial<Record<string, unknown>>) =>
    JSON.stringify({
      name: formName.trim(),
      baseUrl: formBaseUrl.trim(),
      provider: formProvider,
      gpuCount: String(Number(formGpuCount) || 0),
      enabled: formEnabled,
      groupId: formGroupId,
      authEnabled: formAuthEnabled,
      authMethod: formAuthMethod,
      authUsername: formAuthUsername,
      authPassword: formAuthPassword,
      authToken: formAuthToken,
      merchantIds: Array.from(new Set(merchantIds)).sort(),
      storeIds: Array.from(new Set(storeIds)).sort(),
      includeWorkflowIds: Array.from(new Set(includeWorkflowIds)).sort(),
      excludeWorkflowIds: Array.from(new Set(excludeWorkflowIds)).sort(),
      ...(args ?? {}),
    });

  const hasFormChanges = () => {
    if (!formInitialSnapshot) return false;
    return formInitialSnapshot !== buildSnapshot();
  };

  const resetForm = () => {
    setEditing(null);
    setFormName("");
    setFormBaseUrl("");
    setFormProvider("self_hosted");
    setFormGpuCount("0");
    setFormEnabled(true);
    setFormGroupId("none");
    setFormAuthEnabled(false);
    setFormAuthMethod("token");
    setFormAuthUsername("");
    setFormAuthPassword("");
    setFormAuthToken("");
    setMerchantIds([]);
    setStoreIds([]);
    setIncludeWorkflowIds([]);
    setExcludeWorkflowIds([]);
    setFormInitialSnapshot(null);
    setEditDetailAppliedToken(null);
    setFormError(null);
  };

  const openCreate = () => {
    resetForm();
    setView("create");
    setFormInitialSnapshot(
      JSON.stringify({
        name: "",
        baseUrl: "",
        provider: "self_hosted",
        gpuCount: "0",
        enabled: true,
        groupId: "none",
        authEnabled: false,
        authMethod: "token",
        authUsername: "",
        authPassword: "",
        authToken: "",
        merchantIds: [],
        storeIds: [],
        includeWorkflowIds: [],
        excludeWorkflowIds: [],
      })
    );
  };

  const openEdit = (s: ComfyUIServer) => {
    resetForm();
    setEditing(s);
    setView("edit");
    setFormName(s.name || "");
    setFormBaseUrl(s.baseUrl || "");
    setFormProvider(s.provider === "runninghub" ? "runninghub" : "self_hosted");
    setFormGpuCount(String(s.gpuCount ?? 0));
    setFormEnabled(s.enabled !== false);
    setFormGroupId(s.groupId ? s.groupId : "none");
    setFormAuthEnabled(Boolean(s.hasAuth));
    setFormAuthMethod(resolveAuthMethod(s.authType));
  };

  const handleFormBack = () => {
    if (hasFormChanges()) {
      setFormExitConfirmOpen(true);
      return;
    }
    resetForm();
    setView("list");
  };

  const validateAuth = (mode: "create" | "edit") => {
    if (!formAuthEnabled) {
      setFormError(null);
      return true;
    }
    const username = formAuthUsername.trim();
    const password = formAuthPassword;
    const token = formAuthToken.trim();
    const hasAny = Boolean(token || username || password);

    // 编辑且已有认证：全部留空表示保留原配置
    if (mode === "edit" && Boolean(editing?.hasAuth) && !hasAny) {
      return true;
    }

    if (token) {
      if (username || password) {
        // UI 会互斥清空，兜底提示
        setFormError("Token 与用户名密码请二选一");
        return false;
      }
      return true;
    }

    if (username && password) return true;

    if (username || password) {
      setFormError("使用用户名密码认证时，请同时填写用户名和密码");
      return false;
    }

    setFormError(
      mode === "create" || !editing?.hasAuth
        ? "请填写 Bearer Token，或同时填写用户名和密码"
        : "如需覆盖认证，请填写 Token 或用户名+密码",
    );
    return false;
  };

  const buildAuthJsonEnc = () => {
    if (!formAuthEnabled) return null;
    const username = formAuthUsername.trim();
    const password = formAuthPassword;
    const token = formAuthToken.trim();
    // Token 优先；与调度器解析约定一致
    if (token) {
      return JSON.stringify({ token });
    }
    if (username && password) {
      return JSON.stringify({ username, password });
    }
    return null;
  };

  const submitCreate = async () => {
    if (!formName.trim()) {
      setFormError("请输入名称");
      return;
    }
    if (!formBaseUrl.trim()) {
      setFormError("请输入服务器地址（baseUrl）");
      return;
    }
    const gpuCountNum = Number(formGpuCount);
    if (Number.isNaN(gpuCountNum) || gpuCountNum < 0) {
      setFormError("gpuCount 必须是非负数");
      return;
    }
    if (!validateAuth("create")) return;
    setFormError(null);

    const scopeBindings = [
      ...merchantIds.map((id) => ({ scopeLevel: "merchant" as const, merchantId: id, storeId: null })),
      ...storeIds.map((id) => ({ scopeLevel: "store" as const, merchantId: null, storeId: id })),
    ];
    const appScopes: AppScopeCommand[] = [
      ...includeWorkflowIds.map((id) => ({ scopeType: "include" as const, appId: id })),
      ...excludeWorkflowIds.filter((x) => !includeWorkflowIds.includes(x)).map((id) => ({ scopeType: "exclude" as const, appId: id })),
    ];
    const authJsonEnc = buildAuthJsonEnc();
    await saveMutation.mutateAsync({
      mode: "create",
      payload: {
        groupId: formGroupId === "none" ? null : formGroupId,
        name: formName.trim(),
        baseUrl: formBaseUrl.trim(),
        provider: formProvider,
        gpuCount: gpuCountNum,
        enabled: formEnabled,
        authJsonEnc,
        scopeBindings,
        appScopes,
        tagsJson: null,
      },
    });
    resetForm();
    setView("list");
  };

  const submitEdit = async () => {
    if (!editing?.id) return;
    if (!formName.trim()) {
      setFormError("请输入名称");
      return;
    }
    if (!formBaseUrl.trim()) {
      setFormError("请输入服务器地址（baseUrl）");
      return;
    }
    const gpuCountNum = Number(formGpuCount);
    if (Number.isNaN(gpuCountNum) || gpuCountNum < 0) {
      setFormError("gpuCount 必须是非负数");
      return;
    }
    if (!validateAuth("edit")) return;
    setFormError(null);

    const scopeBindings = [
      ...merchantIds.map((id) => ({ scopeLevel: "merchant" as const, merchantId: id, storeId: null })),
      ...storeIds.map((id) => ({ scopeLevel: "store" as const, merchantId: null, storeId: id })),
    ];
    const appScopes: AppScopeCommand[] = [
      ...includeWorkflowIds.map((id) => ({ scopeType: "include" as const, appId: id })),
      ...excludeWorkflowIds.filter((x) => !includeWorkflowIds.includes(x)).map((id) => ({ scopeType: "exclude" as const, appId: id })),
    ];

    const authJsonEnc = buildAuthJsonEnc();
    await saveMutation.mutateAsync({
      mode: "edit",
      id: editing.id,
      payload: {
        groupId: formGroupId === "none" ? null : formGroupId,
        clearGroup: formGroupId === "none" ? true : null,
        name: formName.trim(),
        baseUrl: formBaseUrl.trim(),
        provider: formProvider,
        gpuCount: gpuCountNum,
        enabled: formEnabled,
        authJsonEnc: authJsonEnc ? authJsonEnc : null,
        clearAuth: formAuthEnabled ? null : true,
        scopeBindings,
        appScopes,
        tagsJson: null,
      },
    });
    resetForm();
    setView("list");
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState<ComfyUIServer | null>(null);
  const openDelete = (s: ComfyUIServer) => {
    setDeleting(s);
    setDeleteConfirmOpen(true);
  };
  const handleDelete = async (force: boolean) => {
    if (!deleting) return;
    await deleteMutation.mutateAsync({ id: deleting.id, force });
    setDeleteConfirmOpen(false);
    setDeleting(null);
  };

  if (view === "create" || view === "edit") {
    return (
      <ComfyUIServerEditorPage
        mode={view}
        editServerId={view === "edit" ? editing?.id : null}
        hasAuthOnEdit={Boolean(editing?.hasAuth)}
        authTypeOnEdit={editing?.authType}
        formName={formName}
        setFormName={setFormName}
        formGpuCount={formGpuCount}
        setFormGpuCount={setFormGpuCount}
        formBaseUrl={formBaseUrl}
        setFormBaseUrl={setFormBaseUrl}
        formProvider={formProvider}
        setFormProvider={setFormProvider}
        groupOptions={groupOptions}
        formGroupId={formGroupId}
        setFormGroupId={setFormGroupId}
        formAuthEnabled={formAuthEnabled}
        setFormAuthEnabled={setFormAuthEnabled}
        formAuthMethod={formAuthMethod}
        setFormAuthMethod={setFormAuthMethod}
        formAuthUsername={formAuthUsername}
        setFormAuthUsername={setFormAuthUsername}
        formAuthPassword={formAuthPassword}
        setFormAuthPassword={setFormAuthPassword}
        formAuthToken={formAuthToken}
        setFormAuthToken={setFormAuthToken}
        merchantOptions={merchantOptions}
        merchantIds={merchantIds}
        setMerchantIds={setMerchantIds}
        storeOptions={storeOptions}
        storeIds={storeIds}
        setStoreIds={setStoreIds}
        workflowOptions={workflowOptions}
        includeWorkflowIds={includeWorkflowIds}
        setIncludeWorkflowIds={setIncludeWorkflowIds}
        excludeWorkflowIds={excludeWorkflowIds}
        setExcludeWorkflowIds={setExcludeWorkflowIds}
        renderMultiSelect={renderMultiSelect}
        editDetailIsFetching={editDetailQuery.isFetching}
        editDetailIsError={editDetailQuery.isError}
        savePending={saveMutation.isPending}
        onBack={handleFormBack}
        onSave={view === "create" ? submitCreate : submitEdit}
        formError={formError}
        formExitConfirmOpen={formExitConfirmOpen}
        setFormExitConfirmOpen={setFormExitConfirmOpen}
        onConfirmDiscard={() => {
          resetForm();
          setView("list");
          setFormExitConfirmOpen(false);
        }}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="算力服务"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => refresh()} disabled={listQuery.isFetching}>
              刷新
            </Button>
            <Button
              variant="pageOutline"
              onClick={() => {
                void runBatchCheckCurrentPage();
              }}
              disabled={checkMutation.isPending || batchChecking || items.length === 0}
            >
              <CheckCircle2 className="w-4 h-4" />
              批量验证服务器
            </Button>
            <Button variant="pageOutline" onClick={() => setDispatchConfigOpen(true)}>
              <Settings2 className="w-4 h-4" />
              调度策略配置
            </Button>
            <Button variant="pageOutline" onClick={() => setGroupManagerOpen(true)}>
              <FolderKanban className="w-4 h-4" />
              分组管理
            </Button>
            <Button
              variant="pageOutline"
              onClick={() => toggleAllEnabledMutation.mutate(true)}
              disabled={toggleAllEnabledMutation.isPending}
            >
              <Play className="w-4 h-4" />
              启用所有
            </Button>
            <Button
              variant="pageOutline"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => stopAllMutation.mutate()}
              disabled={stopAllMutation.isPending}
            >
              <SquareSquare className="w-4 h-4" />
              停止所有
            </Button>
            <Button variant="page" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              新增服务
            </Button>
          </>
        }
      />

      <ComfyUIDispatchConfigDialog open={dispatchConfigOpen} onOpenChange={setDispatchConfigOpen} />

      <PageFilterBar className="!flex-nowrap overflow-x-auto">
          <Select
            value={enabledFilter}
            onValueChange={(v: "all" | "enabled" | "disabled") => {
              setEnabledFilter(v);
              setPageNo(1);
            }}
          >
            <SelectTrigger className="subpage-native-select w-32 h-9">
              <SelectValue placeholder="启用状态" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value="all">
                全部
              </SelectItem>
              <SelectItem className="subpage-select-item" value="enabled">
                启用
              </SelectItem>
              <SelectItem className="subpage-select-item" value="disabled">
                禁用
              </SelectItem>
            </SelectContent>
          </Select>
          <SearchField
            wrapClassName="!w-[380px] !max-w-[380px] shrink-0"
            placeholder="搜索名称，回车搜索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyKeywordSearch();
              }
            }}
          />
      </PageFilterBar>

      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {groupBarItems.map((g) => (
          <button
            key={g.id}
            onClick={() => {
              setGroupIdFilter((prev) => {
                if (g.id === "all") return "all";
                return prev === g.id ? "all" : g.id;
              });
              setPageNo(1);
            }}
            className={`subpage-tag-btn ${groupIdFilter === g.id ? "subpage-tag-btn-active" : "subpage-tag-btn-inactive"}`}
          >
            {g.name}
          </button>
        ))}
      </div>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px]">名称</TableHead>
              <TableHead className="min-w-[120px]">提供商</TableHead>
              <TableHead className="min-w-[280px]">服务器地址</TableHead>
              <TableHead className="min-w-[160px]">分组名称</TableHead>
              <TableHead className="w-44 text-center">鉴权</TableHead>
              <TableHead className="w-40 text-center">GPU</TableHead>
              <TableHead className="w-44 text-center">队列</TableHead>
              <TableHead className="w-44 text-center">在线</TableHead>
              <TableHead className="w-44 text-center">负载</TableHead>
              <TableHead className="w-44 text-center">启用</TableHead>
              <TableHead className="w-72">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                  加载中...
                </TableCell>
              </TableRow>
            )}
            {!listQuery.isLoading &&
              items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.provider === "runninghub" ? "RunningHub" : "自建服务器"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.baseUrl}</TableCell>
                  <TableCell className="text-muted-foreground">{groupOptions.find((g) => g.value === s.groupId)?.label || "-"}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{resolveAuthStatusLabel(s)}</TableCell>
                  <TableCell className="text-center">{s.gpuCount ?? 0}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-xs">
                      {s.queueSize ?? 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {(() => {
                      const meta = resolveOnlineStatusMeta(s.onlineStatus);
                      return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
                    })()}
                  </TableCell>
                  <TableCell className="text-center">
                    {(() => {
                      const meta = resolveLoadStatusMeta(s.loadStatus);
                      return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
                    })()}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={s.enabled !== false}
                      onCheckedChange={(v) => toggleEnabledMutation.mutate({ id: s.id, enabled: v })}
                      disabled={toggleEnabledMutation.isPending}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(() => {
                        const checkingCurrent = checkMutation.isPending && checkMutation.variables === s.id;
                        return (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={checkingCurrent ? "检测中" : "检测"}
                        aria-label={checkingCurrent ? "检测中" : "检测"}
                        onClick={() => {
                          void runServerCheck(s.id);
                        }}
                        disabled={checkingCurrent || batchChecking}
                      >
                        {checkingCurrent ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      </Button>
                        );
                      })()}
                      <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="队列入口">
                        <Link to={`/app/scheduler/tasks?queueServerId=${encodeURIComponent(s.queueServerId || s.id)}`}>
                          <ListChecks className="w-4 h-4" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary hover:text-primary"
                        title="编辑"
                        onClick={() => openEdit(s)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        title="删除"
                        onClick={() => openDelete(s)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!listQuery.isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableSurface>

      <CommonPaginationBar
        total={pageTotal || items.length}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={canNextPage}
        onPageNoChange={setPageNo}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPageNo(1);
        }}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              将删除服务器：{deleting?.name || "-"}。如存在工作流、适用范围、调度策略或历史任务关联，可使用强制删除自动清理关联资源。该操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>取消</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void handleDelete(false);
              }}
              disabled={deleteMutation.isPending}
            >
              安全删除
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void handleDelete(true);
              }}
              disabled={deleteMutation.isPending}
            >
              强制删除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ComfyUIServerGroupManagerDialog open={groupManagerOpen} onOpenChange={setGroupManagerOpen} />
    </PageShell>
  );
}
