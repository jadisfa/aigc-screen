import { useNavigate } from "react-router-dom";
import { CloudOff, RefreshCw, Home } from "lucide-react";

type Props = {
  title?: string;
  description?: string;
  code?: string;
  requestId?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "内容加载失败",
  description = "服务暂时无法响应，请稍后再试。如问题持续存在，请联系系统管理员。",
  code = "500",
  requestId,
  onRetry,
}: Props) {
  const navigate = useNavigate();
  const handleRetry = onRetry ?? (() => window.location.reload());
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  };
  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-sm px-10 py-12 text-center">
        <div className="relative mx-auto mb-6 h-24 w-24">
          <div className="absolute inset-0 rounded-full bg-muted" />
          <div className="absolute inset-2 rounded-full bg-accent" />
          <div className="relative flex h-full w-full items-center justify-center">
            <CloudOff className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
        <div className="mt-6 inline-flex items-center gap-3 rounded-lg bg-muted/70 px-4 py-2 text-xs text-muted-foreground">
          <span>
            错误码：<span className="font-mono text-foreground">{code}</span>
          </span>
          {requestId ? (
            <>
              <span className="h-3 w-px bg-border" />
              <span>
                请求ID：<span className="font-mono text-foreground">{requestId}</span>
              </span>
            </>
          ) : null}
        </div>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            <RefreshCw className="h-4 w-4" />
            刷新页面
          </button>
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition"
          >
            <Home className="h-4 w-4" />
            点击返回
          </button>
        </div>
      </div>
    </div>
  );
}
