import * as React from "react";

import { cn } from "@/shared/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-[14px] text-foreground ring-offset-background placeholder:text-muted-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors duration-150 hover:border-foreground/35 focus:border-foreground/55 focus:outline-none focus:ring-0 focus:ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };




