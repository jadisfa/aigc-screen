import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * 列表页筛选行。默认同一行（窄屏横向滚动）。
 * 间距真源：`index.css` → `.page-filter-bar` / `.page-filter-start`
 */
export type PageFilterBarProps = HTMLAttributes<HTMLDivElement> & {
  /** 左侧筛选控件；默认包在 page-filter-start 内 */
  children?: ReactNode;
  /** 右侧筛选附属操作（少用） */
  end?: ReactNode;
  /** 是否由调用方完全自定义内部布局（跳过 page-filter-start） */
  bare?: boolean;
};

export function PageFilterBar({ children, end, bare = false, className, ...props }: PageFilterBarProps) {
  return (
    <div className={cn("page-filter-bar", className)} {...props}>
      {bare ? children : <div className="page-filter-start">{children}</div>}
      {end ? <div className="page-filter-end">{end}</div> : null}
    </div>
  );
}
