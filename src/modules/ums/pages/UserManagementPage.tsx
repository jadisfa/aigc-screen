import { Pencil, Trash2, Download, KeyRound, Users, Ban, Unlock, Wallet, Plus, Shield } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePagedTotal } from "@/shared/hooks/use-paged-total";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/ui/table";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Checkbox } from "@/shared/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { deleteUser, isPrincipalLoginEnabled, listUsers, normalizePrincipalStatus, resetUserPassword, updateUserStatus, updateUserGroups } from "@/shared/api/ums/iam";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { APP_CLIENT_OPTIONS } from "@/shared/lib/dicts";
import { listAppClients, type DictOption } from "@/shared/api/ums/iam";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  StatusBadge,
  TableSurface,
} from "@/shared/components/page";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import {
  buildPermissionSetForNamespace,
  CONSOLE_PERMISSION_NAMESPACE,
  CONSOLE_PERMISSIONS,
  hasPermission,
} from "@/shared/lib/permissions";
import PrincipalRoleGrantDialog from "@/modules/iam/components/PrincipalRoleGrantDialog";
import UserEditorPage from "../components/UserEditorPage";
import UserBalanceDialog from "../components/UserBalanceDialog";
import { getUserAvatarFallback, normalizeAvatarUrl, resolveUserAvatarUrl } from "@/shared/lib/user-avatar";
import { notify } from "@/shared/lib/notify";

interface UserRow {
  id: string;
  principalId?: string;
  merchantId?: string;
  storeId?: string;
  avatarUrl?: string;
  nickname: string;
  displayName: string;
  realName?: string;
  gender?: string;
  birthday?: string;
  remark?: string;
  roles?: string[];
  groups?: string[];
  org?: string;
  status: "启用" | "禁用" | "已注销";
  banned: boolean;
  email: string;
  phone: string;
  balance: number;
}

const avatarColors = [
  "bg-muted text-muted-foreground",
  "bg-primary/20 text-primary",
  "bg-destructive/20 text-destructive",
  "bg-green-100 text-green-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
];

const toStatusLabel = (principalStatus?: string, loginEnabled?: boolean) => {
  const normalized = normalizePrincipalStatus(principalStatus);
  if (normalized === "closed") {
    return "已注销" as const;
  }
  return isPrincipalLoginEnabled(principalStatus, loginEnabled) ? "启用" : "禁用";
};

/*
const parseCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
};

const normalizeImportKey = (k: string) => {
  const raw = k.trim();
  if (!raw) return null;
  const v = raw.replaceAll(" ", "").replaceAll("-", "_");
  const lower = v.toLowerCase();
  if (lower === "principalid" || lower === "principal_id") return "principalId";
  if (lower === "merchantid" || lower === "merchant_id") return "merchantId";
  if (lower === "storeid" || lower === "store_id") return "storeId";
  if (lower === "realname" || lower === "real_name" || lower === "name") return "realName";
  if (lower === "gender") return "gender";
  if (lower === "birthday") return "birthday";
  if (lower === "avatarurl" || lower === "avatar_url") return "avatarUrl";
  if (lower === "phone" || lower === "mobile") return "phone";
  if (lower === "email") return "email";
  if (lower === "wechatid" || lower === "wechat_id" || lower === "wechat_openid") return "wechatId";
  if (lower === "password") return "password";
  if (lower === "status") return "status";
  if (lower === "remark") return "remark";
  return null;
};
*/

const downloadCsv = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const UserManagement = () => {
  const navigate = useNavigate();
  const permissionsQuery = useMePermissions({ sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode });
  const permissionSet = useMemo(
    () => buildPermissionSetForNamespace(CONSOLE_PERMISSION_NAMESPACE, permissionsQuery.data?.permissions ?? []),
    [permissionsQuery.data?.permissions],
  );
  const canManageAccountBalance = hasPermission(permissionSet, CONSOLE_PERMISSIONS.opsAccountManage);
  const canManageRbac = hasPermission(permissionSet, CONSOLE_PERMISSIONS.iamRbacManage);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [appClients, setAppClients] = useState<DictOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [appliedOrgFilter, setAppliedOrgFilter] = useState("");
  const [activeGroupId, setActiveGroupId] = useState<string>("all");
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [banConfirmOpen, setBanConfirmOpen] = useState(false);
  const [userToBan, setUserToBan] = useState<UserRow | null>(null);

  const [groupSettingOpen, setGroupSettingOpen] = useState(false);
  const [groupSettingUser, setGroupSettingUser] = useState<UserRow | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [balanceDialogUser, setBalanceDialogUser] = useState<UserRow | null>(null);
  const [roleGrantDialogOpen, setRoleGrantDialogOpen] = useState(false);
  const [roleGrantUser, setRoleGrantUser] = useState<UserRow | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const sessionScope = useSessionScope();

  useEffect(() => {
    const loadClients = async () => {
      try {
        const data = await listAppClients();
        setAppClients(data);
      } catch (err) {
        console.error("加载客户端失败", err);
      }
    };
    loadClients();
  }, []);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["iamUsers", sessionScope.scope.queryScopeKey, currentPage, pageSize, appliedSearchQuery],
    queryFn: () =>
      listUsers({
        pageNo: currentPage,
        pageSize,
        total: requestTotal,
        keyword: appliedSearchQuery.trim() || undefined,
      }),
  });

  useEffect(() => {
    const items = data?.items ?? [];
    setUsers(
      items.map((u) => ({
        id: u.id || String(u.userId || Math.random()),
        principalId: u.principalId,
        merchantId: u.merchantId,
        storeId: u.storeId,
        avatarUrl: normalizeAvatarUrl(u.avatarUrl),
        nickname: u.nickname ?? u.displayName ?? "",
        displayName: u.displayName ?? u.nickname ?? u.realName ?? u.phone ?? u.email ?? String(u.id),
        realName: u.realName,
        gender: u.gender,
        birthday: u.birthday,
        remark: u.remark,
        roles: u.roles || [],
        groups: u.groups || [],
        org: u.org || "",
        status: toStatusLabel(u.principalStatus, u.loginEnabled),
        banned: !isPrincipalLoginEnabled(u.principalStatus, u.loginEnabled),
        email: u.email ?? "",
        phone: u.phone ?? "",
        balance: u.balance ?? 0,
      }))
    );
  }, [data]);

  useEffect(() => {
    if (!isError) return;
    notify.fromError(error, "请求失败", "加载失败");
  }, [error, isError]);

  const applyFilters = () => {
    const normalizedKeyword = searchQuery.trim();
    const normalizedOrg = orgFilter.trim();
    setSearchQuery(normalizedKeyword);
    setAppliedSearchQuery(normalizedKeyword);
    setOrgFilter(normalizedOrg);
    setAppliedOrgFilter(normalizedOrg);
    setCurrentPage(1);
  };

  const filteredUsers = users.filter((u) => {
    const matchesOrg = !appliedOrgFilter || u.org.toLowerCase().includes(appliedOrgFilter.toLowerCase());
    const matchesGroup = activeGroupId === "all" || (u.groups && u.groups.includes(activeGroupId));
    return matchesOrg && matchesGroup;
  });

  const total = data?.page?.total ?? 0;
  const requestTotal = usePagedTotal(currentPage, data?.page?.total);
  const totalPages = Math.ceil(total / pageSize);
  const paginatedUsers = filteredUsers;

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser(undefined, userToDelete);
      notify.success("删除成功");
      refetch();
    } catch (e: unknown) {
      notify.error("删除失败", { description: (e as Error).message });
    } finally {
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
    }
  };

  const handleResetPassword = async (id: string) => {
    try {
      await resetUserPassword(undefined, id);
      notify.success("密码重置成功", { description: "密码已重置为：Naidu@123" });
    } catch (e: unknown) {
      notify.error("重置失败", { description: (e as Error).message });
    }
  };

  const handleBan = async () => {
    if (!userToBan) return;
    try {
      const isBanned = userToBan.banned;
      const targetStatus = isBanned ? "active" : "disabled";
      await updateUserStatus({ id: userToBan.id, status: targetStatus });

      notify.success(isBanned ? "启用成功" : "禁用成功", { description: isBanned ? "用户已恢复登录" : "用户已被禁用并强制下线" });
      refetch();
    } catch (e: unknown) {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "操作失败") });
    } finally {
      setBanConfirmOpen(false);
      setUserToBan(null);
    }
  };

  /*
  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ["text/csv", ".csv"];
    const isValid = validTypes.some((t) => file.type === t || file.name.endsWith(t));
    if (!isValid) {
      notify.error("错误", { description: "请选择CSV文件（.csv）" });
      e.target.value = "";
      return;
    }
    if (!tenantId) {
      notify.error("错误", { description: "缺少 tenantId" });
      e.target.value = "";
      return;
    }
    notify.success("处理中", { description: `已选择文件: ${file.name}，正在导入...` });
    try {
      const text = await file.text();
      const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        throw new Error("CSV 内容为空");
      }
      const header = parseCsvLine(lines[0]).map(normalizeImportKey);
      const items = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const row: Record<string, string> = {};
        for (let j = 0; j < cols.length && j < header.length; j++) {
          const key = header[j];
          if (!key) continue;
          const val = cols[j];
          if (val == null || !val.trim()) continue;
          row[key] = val.trim();
        }
        items.push(row);
      }
      const r = await importUmsUsers({ tenantId, items });
      notify.success("导入完成", { description: `总计 ${r.total}，成功 ${r.success}，失败 ${r.failed}` });
    } catch (err) {
      notify.error("导入失败", { description: (err as Error)?.message || "导入失败" });
    }
    e.target.value = "";
  };
  */

  const handleSaveGroups = async () => {
    if (!groupSettingUser) return;
    try {
      await updateUserGroups({
        id: groupSettingUser.id,
        groups: selectedGroups,
      });
      notify.success("分组设置成功", { description: "用户分组已更新" });
      refetch();
    } catch (e: unknown) {
      notify.error("分组设置失败", { description: (e as Error).message });
    } finally {
      setGroupSettingOpen(false);
      setGroupSettingUser(null);
    }
  };

  const roleColorMap: Record<string, string> = {
    admin: "bg-green-100 text-green-700 border-green-200",
    creator: "bg-muted text-foreground border-border",
    user: "bg-muted text-foreground border-border",
  };

  const handleBalanceUpdated = useCallback((balance: number) => {
    if (!balanceDialogUser) {
      return;
    }
    setUsers((current) =>
      current.map((user) =>
        user.id === balanceDialogUser.id ? { ...user, balance } : user
      )
    );
  }, [balanceDialogUser]);

  const handleEditorBack = useCallback(() => {
    setView("list");
    setEditUser(null);
  }, []);

  const handleEditorSuccess = useCallback(() => {
    notify.success(view === "create" ? "创建成功" : "保存成功");
    refetch();
    setView("list");
    setEditUser(null);
  }, [refetch, view]);

  if (view === "create" || (view === "edit" && editUser)) {
    return (
      <UserEditorPage
        mode={view}
        user={editUser}
        onBack={handleEditorBack}
        onSuccess={handleEditorSuccess}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="用户管理"
        actions={
          <>
            <Button
              variant="pageOutline"
              onClick={() => downloadCsv("users.csv", "principalId,realName,phone,email,wechatId,status,remark\n")}
            >
              <Download className="w-4 h-4" />
              下载CSV
            </Button>
            <Button
              variant="page"
              onClick={() => {
                setEditUser(null);
                setView("create");
              }}
            >
              <Plus className="w-4 h-4" />
              添加用户
            </Button>
          </>
        }
      />

      <PageFilterBar>
        <SearchField
          wrapClassName="!w-[380px] !max-w-[380px] shrink-0"
          placeholder="搜索昵称/姓名/手机/邮箱，回车搜索"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyFilters();
            }
          }}
        />
        <SearchField
          wrapClassName="!w-[240px] !max-w-[240px] shrink-0"
          placeholder="组织架构，回车搜索"
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyFilters();
            }
          }}
        />
      </PageFilterBar>

      <div className="flex items-center gap-1 mb-7 overflow-x-auto pb-1">
        <button
          onClick={() => { setActiveGroupId("all"); setCurrentPage(1); }}
          className={`subpage-tag-btn ${activeGroupId === "all" ? "subpage-tag-btn-active" : "subpage-tag-btn-inactive"}`}
        >
          全部
        </button>
        {(appClients.length ? appClients : APP_CLIENT_OPTIONS).map((t) => (
          <button
            key={t.value}
            onClick={() => { setActiveGroupId(t.value); setCurrentPage(1); }}
            className={`subpage-tag-btn ${activeGroupId === t.value ? "subpage-tag-btn-active" : "subpage-tag-btn-inactive"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <TableSurface>
        <Table className="min-w-[1200px] text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-25">头像</TableHead>
              <TableHead className="min-w-[140px]">昵称</TableHead>
              <TableHead className="w-32">真实姓名</TableHead>
              <TableHead className="min-w-[120px]">角色</TableHead>
              <TableHead className="w-24">组织</TableHead>
              <TableHead className="min-w-[40px] text-center">登录状态</TableHead>
              <TableHead className="min-w-[120px]">邮箱</TableHead>
              <TableHead className="min-w-[100px]">手机</TableHead>
              <TableHead className="w-40">资金余额</TableHead>
              <TableHead className="sticky right-0 z-20 w-[120px] min-w-[160px] max-w-[160px] bg-background shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                  加载中...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && paginatedUsers.map((user, idx) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={resolveUserAvatarUrl(user.avatarUrl, user.displayName || String(user.id), 64)} alt={user.displayName} />
                    <AvatarFallback className={avatarColors[idx % avatarColors.length]}>{getUserAvatarFallback(user.nickname || user.displayName)}</AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="font-medium">{user.nickname || user.displayName || "-"}</TableCell>
                <TableCell className="text-muted-foreground">{user.realName || "-"}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {user.roles && user.roles.map((role) => (
                      <Badge key={role} variant="outline" className={`text-xs ${roleColorMap[role] || ""}`}>
                        {role}
                      </Badge>
                    ))}
                    {(!user.roles || user.roles.length === 0) && <span className="text-muted-foreground">-</span>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{user.org || "-"}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    {user.status === "启用" && <StatusBadge tone="success">启用</StatusBadge>}
                    {user.status === "禁用" && <StatusBadge tone="danger">禁用</StatusBadge>}
                    {user.status === "已注销" && <StatusBadge tone="neutral">已注销</StatusBadge>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{user.email || "-"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{user.phone || "-"}</TableCell>
                <TableCell className="font-medium">{user.balance.toFixed(2)}</TableCell>
                <TableCell className="sticky right-0 z-10 w-[160px] min-w-[160px] max-w-[160px] bg-background px-3 py-2 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                  <div className="flex flex-wrap items-center gap-1">
                    {canManageRbac ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                        title="角色授权"
                        onClick={() => {
                          setRoleGrantUser(user);
                          setRoleGrantDialogOpen(true);
                        }}
                      >
                        <Shield className="w-4 h-4" />
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-primary hover:text-primary"
                      title="编辑"
                      onClick={() => navigate(`/ums/users/${user.id}/edit`)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-primary hover:text-primary"
                      title="分组设置"
                      onClick={() => {
                        setGroupSettingUser(user);
                        setSelectedGroups(user.groups || []);
                        setGroupSettingOpen(true);
                      }}
                    >
                      <Users className="w-4 h-4" />
                    </Button>
                    {canManageAccountBalance ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                        title="资金充值"
                        onClick={() => {
                          setBalanceDialogUser(user);
                          setBalanceDialogOpen(true);
                        }}
                      >
                        <Wallet className="w-4 h-4" />
                      </Button>
                    ) : null}
                   <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    title="重置密码"
                    onClick={() => handleResetPassword(user.id)}
                   >
                    <KeyRound className="w-4 h-4" />
                   </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                      onClick={() => {
                        setUserToBan(user);
                        setBanConfirmOpen(true);
                      }}
                      title={user.banned ? "启用" : "禁用"}
                    >
                      {user.banned ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    </Button>
                  <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setUserToDelete(user.id);
                        setDeleteConfirmOpen(true);
                      }}
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && paginatedUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                  暂无用户数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableSurface>

      <CommonPaginationBar
        total={total}
        pageNo={currentPage}
        pageSize={pageSize}
        canNextPage={totalPages > 0 && currentPage < totalPages}
        onPageNoChange={setCurrentPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setCurrentPage(1);
        }}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除用户？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可逆。删除后，该用户将无法登录系统，与其相关的部分数据可能会受到影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={banConfirmOpen} onOpenChange={setBanConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认{userToBan?.banned ? "启用" : "禁用"}用户？</AlertDialogTitle>
            <AlertDialogDescription>
              {userToBan?.banned
                ? "启用后，该用户将可以正常登录系统并操作数据。"
                : "禁用后，该用户将立即被强制下线，并无法再以任何形式登录系统，无法操作任何页面和数据。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToBan(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBan}
              className={userToBan?.banned ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-orange-500 text-white hover:bg-orange-600"}
            >
              确认{userToBan?.banned ? "启用" : "禁用"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={groupSettingOpen} onOpenChange={setGroupSettingOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>设置用户分组</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex flex-col gap-4">
              {(appClients.length ? appClients : APP_CLIENT_OPTIONS).map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`group-${option.value}`}
                    checked={selectedGroups.includes(option.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedGroups([...selectedGroups, option.value]);
                      } else {
                        setSelectedGroups(selectedGroups.filter((g) => g !== option.value));
                      }
                    }}
                  />
                  <label
                    htmlFor={`group-${option.value}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupSettingOpen(false)}>取消</Button>
            <Button onClick={handleSaveGroups}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {roleGrantDialogOpen ? (
        <PrincipalRoleGrantDialog
          open={roleGrantDialogOpen}
          onOpenChange={(open) => {
            setRoleGrantDialogOpen(open);
            if (!open) {
              setRoleGrantUser(null);
            }
          }}
          user={roleGrantUser}
          onSaved={() => {
            void refetch();
          }}
        />
      ) : null}

      {canManageAccountBalance ? (
        <UserBalanceDialog
          open={balanceDialogOpen}
          onOpenChange={setBalanceDialogOpen}
          principalId={balanceDialogUser?.principalId ?? ""}
          merchantId={balanceDialogUser?.merchantId}
          storeId={balanceDialogUser?.storeId}
          nickname={balanceDialogUser?.nickname ?? balanceDialogUser?.displayName ?? ""}
          avatarUrl={balanceDialogUser?.avatarUrl ?? ""}
          onBalanceUpdated={handleBalanceUpdated}
        />
      ) : null}
    </PageShell>
  );
};

export default UserManagement;
