import { toast as sonnerToast } from "sonner";
import { resolveUserErrorNotice } from "@/shared/api/sys/error-message";

/** 各提示类型默认展示时长（毫秒） */
export const NOTIFY_DURATION = {
  /** 成功：短，避免挡操作 */
  success: 2000,
  /** 信息：中性说明 */
  info: 3000,
  /** 警告：需留意但仍可继续 */
  warning: 4000,
  /** 失败：业务拒绝 / 请求失败 */
  error: 5000,
  /** 异常：未预期系统错误，稍长便于阅读 */
  exception: 6000,
} as const;

export type NotifyKind = keyof typeof NOTIFY_DURATION;

export type NotifyOptions = {
  description?: string;
  duration?: number;
  id?: string | number;
};

function resolveDuration(kind: NotifyKind, options?: NotifyOptions) {
  return options?.duration ?? NOTIFY_DURATION[kind];
}

/**
 * 全局轻提示统一入口（右下角 Sonner）。
 *
 * | 方法 | 场景 | 样式 |
 * | --- | --- | --- |
 * | success | 仍在当前路由页的成功（含关弹窗后回父页） | 绿 |
 * | info | 中性状态说明 | 蓝 |
 * | warning | 可继续，但需注意 | 琥珀 |
 * | error / fail | 业务失败、操作失败 | 红 |
 * | exception | 系统异常、未预期错误 | 红（更长） |
 * | fromError | 解析 unknown 错误后按失败弹出 | 红 |
 *
 * 判定：成功后 navigate/切路由 → 不弹 success；仍在当前路由页（含关 Dialog）→ 成败都要弹。
 * 表单校验请用行内 `formError`，不要弹 Toast。
 */
export const notify = {
  success(title: string, options?: NotifyOptions) {
    return sonnerToast.success(title, {
      duration: resolveDuration("success", options),
      ...options,
    });
  },

  info(title: string, options?: NotifyOptions) {
    return sonnerToast.info(title, {
      duration: resolveDuration("info", options),
      ...options,
    });
  },

  warning(title: string, options?: NotifyOptions) {
    return sonnerToast.warning(title, {
      duration: resolveDuration("warning", options),
      ...options,
    });
  },

  /** 业务失败 / 操作失败 */
  error(title: string, options?: NotifyOptions) {
    return sonnerToast.error(title, {
      duration: resolveDuration("error", options),
      ...options,
    });
  },

  /** error 的语义别名，便于业务侧表达「失败」 */
  fail(title: string, options?: NotifyOptions) {
    return notify.error(title, options);
  },

  /** 系统异常 / 未预期错误（展示更久） */
  exception(title: string, options?: NotifyOptions) {
    return sonnerToast.error(title, {
      duration: resolveDuration("exception", options),
      ...options,
    });
  },

  /**
   * 从未知错误解析用户可读文案并弹出失败提示。
   * 优先用于 catch 块，避免各页手写 error.message。
   */
  fromError(error: unknown, fallbackDescription: string, fallbackTitle = "操作失败") {
    const notice = resolveUserErrorNotice(error, fallbackDescription, fallbackTitle);
    return notify.error(notice.title, { description: notice.description });
  },

  dismiss(id?: string | number) {
    sonnerToast.dismiss(id);
  },
};
