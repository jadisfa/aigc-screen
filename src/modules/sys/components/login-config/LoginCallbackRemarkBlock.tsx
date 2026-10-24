import { buildAbsoluteCallbackUrl, type LoginCallbackRemark } from "./login-provider-meta";

type LoginCallbackRemarkBlockProps = {
  callbacks: LoginCallbackRemark[];
  origin?: string;
  className?: string;
};

/**
 * 对话框内回调地址备注（精简：一行标签 + 一行完整 URL）。
 */
export function LoginCallbackRemarkBlock({ callbacks, origin, className }: LoginCallbackRemarkBlockProps) {
  if (!callbacks.length) return null;
  return (
    <div className={className ?? "rounded-md border border-border bg-muted/40 px-3 py-2 space-y-2"}>
      <div className="text-xs font-medium text-foreground">回调地址</div>
      {callbacks.map((item) => (
        <div key={item.path} className="space-y-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-muted-foreground shrink-0">{item.label}</span>
            <code className="text-[11px] text-muted-foreground font-mono">{item.path}</code>
          </div>
          <code className="block text-[12px] text-foreground break-all leading-snug">
            {buildAbsoluteCallbackUrl(item.path, origin)}
          </code>
          {item.note ? <p className="text-[11px] text-muted-foreground leading-relaxed">{item.note}</p> : null}
        </div>
      ))}
    </div>
  );
}
