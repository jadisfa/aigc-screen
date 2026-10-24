import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, User, PencilLine, ChevronRight, Copy, Coins, Loader2, BookOpen, UserRoundCog } from "lucide-react";
import NotificationPopover from "@/app/layout/NotificationPopover";
import logo from "@/assets/logo.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import { clearAuthSession } from "@/shared/api/auth/auth";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { resolveUserAvatarUrl } from "@/shared/lib/user-avatar";
import {
  getFundAccountBalance,
  getFundAccountScopedBalanceQueryKey,
  resolveFundUserOwnerId,
} from "@/shared/api/fund/admin-fund";
import { getUser, listRoles } from "@/shared/api/ums/iam";
import { handleLogout } from "@/utils/common";
import {
  buildPermissionSetForNamespace,
  CONSOLE_PERMISSION_NAMESPACE,
  CONSOLE_PERMISSIONS,
  CONSOLE_ROUTES,
  hasPermission,
} from "@/shared/lib/permissions";
import { pickHighestPrivilegeRoleName } from "@/shared/lib/role-privilege";
import { Badge } from "@/shared/ui/badge";
import { notify } from "@/shared/lib/notify";

const TopBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: meInfo, refetch: refetchMePermissions } = useMePermissions({ sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode });
  const permissionSet = useMemo(
    () =>
      buildPermissionSetForNamespace(
        CONSOLE_PERMISSION_NAMESPACE,
        meInfo?.permissions ?? [],
      ),
    [meInfo?.permissions],
  );
  const canManageRoles = hasPermission(
    permissionSet,
    CONSOLE_PERMISSIONS.iamRbacManage,
  );
  const canManageAccountBalance = hasPermission(
    permissionSet,
    CONSOLE_PERMISSIONS.opsAccountManage,
  );
  const meProfileQuery = useQuery({
    queryKey: ["topbar-me-profile", meInfo?.userId],
    enabled: Boolean(meInfo?.userId),
    queryFn: () => getUser({ id: String(meInfo?.userId) }),
    staleTime: 5 * 60 * 1000,
  });
  const roleCatalogQuery = useQuery({
    queryKey: ["topbar-role-catalog"],
    queryFn: () => listRoles(),
    enabled: canManageRoles,
    staleTime: 30 * 60 * 1000,
  });

  const roleNames = useMemo(() => {
    const currentRoles = meInfo?.roles ?? [];
    const roleCatalog = roleCatalogQuery.data ?? [];
    if (!currentRoles.length) {
      return [];
    }
    return currentRoles.map((roleCode) => {
      const matchedRole = roleCatalog.find(
        (item) => item.code === roleCode || item.name === roleCode,
      );
      // console.log("matchedRole", matchedRole, roleCode, 100);
      return matchedRole?.name || roleCode;
    });
  }, [meInfo?.roles, roleCatalogQuery.data]);
  const balanceOwnerType = "user";
  const balanceOwnerId = resolveFundUserOwnerId(meInfo?.principalId);
  const balanceQuery = useQuery({
    queryKey: getFundAccountScopedBalanceQueryKey(balanceOwnerType, balanceOwnerId),
    enabled: Boolean(balanceOwnerId) && canManageAccountBalance,
    queryFn: () => getFundAccountBalance(balanceOwnerType, balanceOwnerId),
    staleTime: 60 * 1000,
  });
  const meProfile = meProfileQuery.data;
  const avatarSrc = resolveUserAvatarUrl(
    meInfo?.avatarUrl,
    meInfo?.principalId || "user",
    64,
  );
  const canEditCurrentUser = Boolean(meInfo?.userId);
  const principalId = meInfo?.principalId ?? "";
  const principalIdShort = principalId ? principalId.substring(0, 12) : "未知";
  const displayName =
    meProfile?.nickname?.trim()
    || meProfile?.displayName?.trim()
    || meProfile?.realName?.trim()
    || meProfile?.phone?.trim()
    || principalIdShort;
  const primaryRoleName = useMemo(
    () => pickHighestPrivilegeRoleName(meInfo?.roles ?? [], roleCatalogQuery.data ?? []),
    [meInfo?.roles, roleCatalogQuery.data],
  );
  const accountBalance = typeof balanceQuery.data?.balance === "number"
    ? new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(balanceQuery.data.balance)
    : (!canManageAccountBalance ? "无权限" : (!balanceOwnerId ? "无主体" : "--"));
  const workflowSearchKeyword = useMemo(() => {
    if (location.pathname !== "/app/workflows") {
      return "";
    }
    return new URLSearchParams(location.search).get("keyword")?.trim() ?? "";
  }, [location.pathname, location.search]);
  const [keyword, setKeyword] = useState(workflowSearchKeyword);

  useEffect(() => {
    setKeyword(workflowSearchKeyword);
  }, [workflowSearchKeyword]);

  const handleLogoutFun = () => {
    handleLogout();
    navigate("/", { replace: true });
  };

  const handleEditCurrentUser = () => {
    if (!meInfo?.userId) {
      return;
    }
    navigate(`/ums/users/${meInfo.userId}/edit`);
  };

  const handleCopyPrincipalId = async () => {
    if (!principalId) {
      notify.error("复制失败", { description: "当前用户 UID 不存在" });
      return;
    }
    try {
      await navigator.clipboard.writeText(principalId);
      notify.success("复制成功", { description: "UID 已复制到剪贴板" });
    } catch {
      notify.error("复制失败", { description: "当前环境不支持剪贴板复制" });
    }
  };

  const handleProfileMenuOpenChange = (open: boolean) => {
    if (!open) {
      return;
    }

    const refreshTasks = [refetchMePermissions()];
    if (canManageAccountBalance) {
      refreshTasks.push(balanceQuery.refetch());
    }
    if (meInfo?.userId) {
      refreshTasks.push(meProfileQuery.refetch());
    }

    void Promise.allSettled(refreshTasks);
  };

  const handleSearch = () => {
    const normalizedKeyword = keyword.trim();
    const nextSearchParams = new URLSearchParams();
    if (normalizedKeyword) {
      nextSearchParams.set("keyword", normalizedKeyword);
    }
    navigate({
      pathname: "/app/workflows",
      search: nextSearchParams.toString()
        ? `?${nextSearchParams.toString()}`
        : "",
    });
  };

  const handleGoHome = () => {
    navigate("/custom/home");
  };

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 lg:px-5 bg-background sticky top-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2 min-w-[180px] cursor-pointer" onClick={() => handleGoHome()}>
        <img
          src={logo}
          alt="Logo"
          className="w-[4.75rem] h-auto object-contain cursor-pointer"
        />
        <span className="font-semibold text-foreground text-[18px]">
          AIGC应用平台
        </span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-xl mx-auto">
        <form
          className="relative flex items-center bg-search-bg rounded-full px-4 h-10"
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
        >
          <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
          <input
            type="text"
            placeholder="输入应用名称或应用关键词"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="bg-transparent w-full text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button
            type="submit"
            className="ml-2 px-3 py-1 text-[12px] text-muted-foreground bg-background rounded-full border border-border shrink-0 cursor-pointer hover:text-foreground transition-colors"
          >
            搜索
          </button>
        </form>
      </div>

      {/* Right Actions */}
      <div className="min-w-[180px] flex justify-end items-center gap-3">
        <a
          href={CONSOLE_ROUTES.apiDocs}
          target="_blank"
          rel="noopener noreferrer"
          title="API 接口文档"
          aria-label="打开 API 接口文档"
          className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <BookOpen className="w-4 h-4" />
        </a>
        <NotificationPopover />
        <DropdownMenu onOpenChange={handleProfileMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors overflow-hidden">
              <Avatar className="h-full w-full">
                <AvatarImage src={avatarSrc} alt="" className="object-cover" />
                <AvatarFallback className="bg-muted text-muted-foreground">
                  <User className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={10}
            className="w-[296px] rounded-2xl border border-violet-200/60 bg-popover p-2.5 text-popover-foreground shadow-[0_14px_32px_rgba(88,63,190,0.14)]"
          >
            <div className="px-0.5 py-0.5">
              <div className="flex items-start gap-2.5 px-1 py-1">
                <Avatar className="h-10 w-10 border border-violet-200/60 shadow-sm">
                  <AvatarImage
                    src={avatarSrc}
                    alt=""
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13px] font-semibold leading-5 text-foreground">{displayName}</p>
                    <Badge variant="secondary" className="h-4 rounded-full border border-violet-200/70 bg-violet-100/80 px-1.5 text-[12px] font-medium text-violet-700 hover:bg-violet-100/80">
                      {primaryRoleName}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate">{principalId || "-"}</span>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-violet-700 transition-colors hover:bg-violet-50 hover:text-violet-800"
                      onClick={() => {
                        void handleCopyPrincipalId();
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  {/* <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                    角色：{primaryRoleName}
                  </p> */}
                </div>
              </div>

              {/* <DropdownMenuSeparator className="mx-0 my-2 bg-violet-100" /> */}

              <div className="flex items-center justify-between px-1 py-1.5 text-[12px]">
                <span className="flex items-center gap-2 font-medium leading-none text-foreground">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/12 text-violet-700">
                    <Coins className="h-3.5 w-3.5" />
                  </span>
                  <span className="leading-none">资金余额</span>
                </span>
                <span className="min-w-[72px] text-right text-[12px] font-semibold leading-none tabular-nums text-violet-800">
                  {balanceQuery.isFetching ? (
                    <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-violet-500" />
                  ) : (
                    accountBalance
                  )}
                </span>
              </div>
            </div>

            {/* <DropdownMenuSeparator className="mx-0 my-2 bg-violet-100" /> */}

            <div className="space-y-1">
              {canEditCurrentUser ? (
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg px-2.5 py-2.5 text-[12px] font-medium text-foreground focus:bg-violet-50 focus:text-violet-800"
                  onClick={handleEditCurrentUser}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5 leading-none">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center text-violet-600">
                      <PencilLine className="h-3.5 w-3.5" />
                    </span>
                    <span className="leading-none">完善账号</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </DropdownMenuItem>
              ) : null}
            </div>
            {roleNames.length > 0 &&
              roleNames.find(
                (roleItem) =>
                  roleItem == "platform_admin" || roleItem?.includes("管理员"),
              ) && (
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg px-2.5 py-2.5 text-[12px] font-medium text-foreground focus:bg-violet-50 focus:text-violet-800"
                  onClick={() => navigate("/app/dashboard")}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5 leading-none">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center text-violet-600">
                      <PencilLine className="h-3.5 w-3.5" />
                    </span>
                    <span className="leading-none">管理后台</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </DropdownMenuItem>
              )}
            <DropdownMenuSeparator className="mx-0 my-1.5 bg-violet-100" />
            <button
              type="button"
              className="flex h-9 w-full items-center justify-center rounded-lg text-[12px] font-medium text-foreground transition-colors hover:bg-violet-50 hover:text-violet-800"
              onClick={handleLogoutFun}
            >
              退出登录
            </button>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default TopBar;
