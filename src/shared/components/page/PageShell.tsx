import type { HTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * 列表/编辑页唯一内容外壳。
 * 视觉与留白真源：`index.css` → `.page-content-shell`
 */
export type PageShellProps = HTMLAttributes<HTMLDivElement>;

export function PageShell({ className, ...props }: PageShellProps) {
  return <div className={cn("page-content-shell", className)} {...props} />;
}
