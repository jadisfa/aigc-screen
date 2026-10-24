import { notify } from "@/shared/lib/notify";

/**
 * @deprecated 请优先使用 `notify.fromError(...)`。
 * 保留此函数以兼容旧调用。
 */
export function showUserErrorToast(
  error: unknown,
  fallbackDescription: string,
  fallbackTitle = "操作失败"
) {
  notify.fromError(error, fallbackDescription, fallbackTitle);
}
