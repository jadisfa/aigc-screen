import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * 标准页头：标题 + 可选 titleExtra + 右侧 actions。
 * 间距/字号真源：`index.css` → `.page-header` / `.page-title` / `.page-description`
 */
export type PageHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title: ReactNode;
  /** 标题旁附加内容（如未读 Badge） */
  titleExtra?: ReactNode;
  /** 标题下方说明，不与标题同行 */
  description?: ReactNode;
  /** 右侧操作区（刷新 / 次按钮 / 主按钮） */
  actions?: ReactNode;
};

export function PageHeader({
  title,
  titleExtra,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <>
      <div className={cn("page-header", className)} {...props}>
        <div className="page-header-start">
          {typeof title === "string" ? <h1 className="page-title">{title}</h1> : title}
          {titleExtra}
        </div>
        {actions ? <div className="page-header-end">{actions}</div> : null}
      </div>
      {description ? (
        typeof description === "string" ? (
          <p className="page-description">{description}</p>
        ) : (
          <div className="page-description">{description}</div>
        )
      ) : null}
    </>
  );
}
