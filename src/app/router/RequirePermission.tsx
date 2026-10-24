import { Navigate, useLocation } from "react-router-dom";
import { clearAuthSession, getAccessToken } from "@/shared/api/auth/auth";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import {
  buildPermissionSetForNamespace,
  CONSOLE_PERMISSION_NAMESPACE,
  CONSOLE_ROUTES,
  hasPermission,
  type PermissionRequirement,
} from "@/shared/lib/permissions";
import { shouldForceLoginOnPermissionsError } from "@/shared/lib/session-guards";

function PermissionsLoadError({ onRetry, onRelogin }: { onRetry: () => void; onRelogin: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="text-center">
        <p className="mb-4 text-xl text-muted-foreground">权您无权限，请刷新页面或重新登录</p>
        <div className="flex items-center justify-center gap-4">
          <button type="button" onClick={onRetry} className="text-primary underline hover:text-primary/90">
            重试
          </button>
          <button type="button" onClick={onRelogin} className="text-primary underline hover:text-primary/90">
            重新登录
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RequirePermission({
  children,
  permissionCode,
}: {
  children: React.ReactNode;
  permissionCode: PermissionRequirement;
}) {
  const location = useLocation();
  const token = getAccessToken();
  const permissionsQuery = useMePermissions({ sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode });

  if (!token) {
    return <Navigate to={CONSOLE_ROUTES.login} replace state={{ from: location.pathname }} />;
  }

  if (permissionsQuery.isLoading) {
    return null;
  }

  if (permissionsQuery.isError) {
    if (shouldForceLoginOnPermissionsError(permissionsQuery.error)) {
      clearAuthSession();
      return <Navigate to={CONSOLE_ROUTES.login} replace state={{ from: location.pathname }} />;
    }

    return (
      <PermissionsLoadError
        onRetry={() => {
          void permissionsQuery.refetch();
        }}
        onRelogin={() => {
          clearAuthSession();
          window.location.replace(CONSOLE_ROUTES.login);
        }}
      />
    );
  }

  const permissionSet = buildPermissionSetForNamespace(
    CONSOLE_PERMISSION_NAMESPACE,
    permissionsQuery.data?.permissions ?? [],
  );
  if (!hasPermission(permissionSet, permissionCode)) {
    return <Navigate to={CONSOLE_ROUTES.forbidden} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
