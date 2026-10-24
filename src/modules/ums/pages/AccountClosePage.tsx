import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, PageShell } from "@/shared/components/page";
import { Button } from "@/shared/ui/button";
import { notify } from "@/shared/lib/notify";
import { apiFetch } from "@/shared/api/sys/http";
import { clearAccessToken, clearRefreshToken, clearScopeContext } from "@/shared/api/auth/auth";

export default function AccountClosePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleClose = async () => {
    setLoading(true);
    try {
      await apiFetch<void>("/api/admin/iam/me/close", { method: "POST" });
      clearAccessToken();
      clearRefreshToken();
      clearScopeContext();
      notify.success("账号已销户");
      navigate("/login");
    } catch (e) {
      notify.fromError(e, "销户失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <PageHeader title="账号销户" />
      <div className="rounded-lg border bg-background p-6 max-w-[520px]">
        <p className="text-[14px] text-muted-foreground leading-relaxed">
          销户将软删除您的账号并阻断后续访问。历史数据会保留用于审计。
        </p>
        <div className="mt-6">
          <Button variant="destructive" onClick={handleClose} disabled={loading}>
            {loading ? "处理中..." : "确认销户"}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
