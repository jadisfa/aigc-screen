import { Search } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/utils";

/**
 * 标准搜索框（图标 + input）。样式真源：`index.css` → `.subpage-search-*`
 */
export type SearchFieldProps = Omit<ComponentPropsWithoutRef<"input">, "size"> & {
  /** 外层宽度，默认沿用 .subpage-search-wrap */
  wrapClassName?: string;
  /** 是否显示左侧搜索图标，默认 true */
  showIcon?: boolean;
};

export function SearchField({
  className,
  wrapClassName,
  showIcon = true,
  ...props
}: SearchFieldProps) {
  return (
    <div className={cn("subpage-search-wrap", wrapClassName)}>
      {showIcon ? <Search className="subpage-search-icon" aria-hidden /> : null}
      <Input
        className={cn(
          "subpage-search-input border bg-background text-foreground w-full",
          !showIcon && "pl-3",
          className,
        )}
        {...props}
      />
    </div>
  );
}
