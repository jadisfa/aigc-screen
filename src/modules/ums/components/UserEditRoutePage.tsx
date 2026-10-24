import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import UserEditorPage from "@/modules/ums/components/UserEditorPage";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { getUserEditDetail, normalizePrincipalStatus } from "@/shared/api/ums/iam";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import {
  buildPermissionSetForNamespace,
  CONSOLE_PERMISSION_NAMESPACE,
  CONSOLE_PERMISSIONS,
  CONSOLE_ROUTES,
  hasPermission,
} from "@/shared/lib/permissions";
import { Button } from "@/shared/ui/button";
import { notify } from "@/shared/lib/notify";

export default function UserEditRoutePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: meInfo, isLoading: meLoading } = useMePermissions({ sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode });
  const sessionScope = useSessionScope();
  const permissionSet = useMemo(
    () => buildPermissionSetForNamespace(CONSOLE_PERMISSION_NAMESPACE, meInfo?.permissions ?? []),
    [meInfo?.permissions],
  );
  const canManageUser = hasPermission(permissionSet, CONSOLE_PERMISSIONS.userAccountManage);
  const isEditingSelf = Boolean(id && meInfo?.userId && id === meInfo.userId);
  const canAccess = canManageUser || isEditingSelf;

  const userQuery = useQuery({
    queryKey: ["umsUserEditRoute", sessionScope.scope.queryScopeKey, id],
    queryFn: async () => {
      if (!id) {
        throw new Error("缺少用户标识");
      }
      return getUserEditDetail({ id });
    },
    enabled: Boolean(id && canAccess),
    retry: false,
  });

  const handleBack = () => {
    navigate(canManageUser ? CONSOLE_ROUTES.userManagement : "/");
  };

  const handleSuccess = () => {
    if (canManageUser) {
      // 离开当前路由：成功不弹 Toast
      navigate(CONSOLE_ROUTES.userManagement);
      return;
    }
    // 自助编辑仍停留当前页：需成功提示
    notify.success("保存成功");
  };

  if (meLoading || (canAccess && userQuery.isLoading)) {
    return (
      <div className="page-content-shell">
        <div className="rounded-xl border border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
          正在加载用户信息...
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return <Navigate to="/403" replace />;
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <div className="page-content-shell">
        <div className="space-y-4 rounded-xl border border-border/60 bg-muted/10 p-6">
          <div className="text-sm text-destructive">
            {resolveUserErrorMessage(userQuery.error, "用户信息加载失败")}
          </div>
          <div>
            <Button variant="outline" onClick={handleBack}>
              返回用户列表
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <UserEditorPage
      mode="edit"
      user={{
        id: userQuery.data.id,
        principalId: userQuery.data.principalId,
        merchantId: userQuery.data.merchantId,
        storeId: userQuery.data.storeId,
        displayName: userQuery.data.displayName,
        nickname: userQuery.data.nickname ?? userQuery.data.displayName ?? "",
        realName: userQuery.data.realName,
        avatarUrl: userQuery.data.avatarUrl,
        gender: userQuery.data.gender,
        birthday: userQuery.data.birthday,
        phone: userQuery.data.phone ?? "",
        email: userQuery.data.email ?? "",
        status: normalizePrincipalStatus(userQuery.data.principalStatus),
        remark: userQuery.data.remark,
        groups: userQuery.data.groups ?? [],
        wechatOpenId: userQuery.data.wechatOpenId,
        wechatUnionId: userQuery.data.wechatUnionId,
        identifiers: userQuery.data.identifiers ?? [],
      }}
      editScope={isEditingSelf && !canManageUser ? "self" : "admin"}
      onBack={handleBack}
      onSuccess={handleSuccess}
    />
  );
}
