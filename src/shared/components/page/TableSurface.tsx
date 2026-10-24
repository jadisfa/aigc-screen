import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * 表格外层容器。默认无外边框，仅提供横向滚动。
 * 视觉真源：`index.css` → `.page-table-scroll`；可选卡片壳 → `.page-table-surface`
 */
export type TableSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** 可选：带圆角边框的卡片壳（默认关闭，列表页不加外边框） */
  bordered?: boolean;
};

export function TableSurface({ children, bordered = false, className, ...props }: TableSurfaceProps) {
  return (
    <div className={cn(bordered && "page-table-surface", className)} {...props}>
      <div className="page-table-scroll">{children}</div>
    </div>
  );
}
