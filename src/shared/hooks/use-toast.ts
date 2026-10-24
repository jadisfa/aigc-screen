import type { ReactNode } from "react";
import { notify } from "@/shared/lib/notify";

type ToastVariant = "default" | "destructive";

type ToastInput = {
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  duration?: number;
};

function nodeToText(node: ReactNode | undefined): string | undefined {
  if (node == null || node === false) return undefined;
  if (typeof node === "string" || typeof node === "number") return String(node);
  return undefined;
}

/**
 * 兼容旧 useToast / toast API，底层统一走 `notify`。
 * 新代码请直接使用 `@/shared/lib/notify`：
 * - success / info / warning / error|fail / exception / fromError
 */
function toast({ title, description, variant, duration }: ToastInput) {
  const message = nodeToText(title) ?? (variant === "destructive" ? "操作失败" : "操作成功");
  const desc = nodeToText(description);
  const options = { description: desc, duration };

  if (variant === "destructive") {
    const id = notify.error(message, options);
    return {
      id: String(id ?? ""),
      dismiss: () => notify.dismiss(id),
      update: () => undefined,
    };
  }

  const id = notify.success(message, options);
  return {
    id: String(id ?? ""),
    dismiss: () => notify.dismiss(id),
    update: () => undefined,
  };
}

function useToast() {
  return {
    toasts: [] as Array<{ id: string }>,
    toast,
    dismiss: (toastId?: string) => {
      notify.dismiss(toastId);
    },
  };
}

export { useToast, toast };
