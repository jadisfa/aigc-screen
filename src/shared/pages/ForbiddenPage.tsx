import { Link, useNavigate } from "react-router-dom";
import { clearAuthSession } from "@/shared/api/auth/auth";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import {
  buildPermissionSetForNamespace,
  CONSOLE_PERMISSION_NAMESPACE,
  CONSOLE_ROUTES,
  getDefaultAuthorizedRoute,
} from "@/shared/lib/permissions";

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const permissionsQuery = useMePermissions({ sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode });
  const permissionSet = buildPermissionSetForNamespace(
    CONSOLE_PERMISSION_NAMESPACE,
    permissionsQuery.data?.permissions ?? [],
  );
  const homeRoute = getDefaultAuthorizedRoute(permissionSet);
  const canGoHome = homeRoute !== CONSOLE_ROUTES.forbidden;

  const handleRelogin = () => {
    clearAuthSession();
    navigate(CONSOLE_ROUTES.login, { replace: true });
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">403</h1>
        <p className="mb-4 text-xl text-muted-foreground">无权限访问</p>
        <div className="flex items-center justify-center gap-4">
          {canGoHome ? (
            <Link to={homeRoute} className="text-primary underline hover:text-primary/90">
              返回首页
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleRelogin}
            className="text-primary underline hover:text-primary/90"
          >
            重新登录
          </button>
        </div>
      </div>
    </div>
  );
}
