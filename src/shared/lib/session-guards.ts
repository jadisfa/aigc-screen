import { HttpError } from "@/shared/api/sys/http";
import { hasBackendErrorCode } from "@/shared/api/sys/error-message";

export function getHttpStatus(error: unknown): number | null {
  if (error instanceof HttpError) {
    return error.status;
  }
  if (error && typeof error === "object" && "status" in error && typeof (error as { status?: unknown }).status === "number") {
    return (error as { status: number }).status;
  }
  return null;
}

/**
 * 拉取「当前用户权限」失败时是否应强制回到登录。
 * - 401：会话失效
 * - 账号禁用：无法继续使用控制台
 * - 普通 403：视为无权限/接口异常，交给页面重试，避免误踢登录
 */
export function shouldForceLoginOnPermissionsError(error: unknown): boolean {
  const status = getHttpStatus(error);
  if (status === 401) {
    return true;
  }
  return hasBackendErrorCode(error, "AUTH-ACCOUNT-DISABLED");
}
