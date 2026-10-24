import { memo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { getPublicPrivacyPolicy, getPublicUserAgreement } from "@/shared/api/sys/system-config";
import { BRAND_PURPLE, TEXT_MUTED } from "./loginTheme";

type LegalKind = "agreement" | "privacy";

export const LoginLegalLinks = memo(function LoginLegalLinks() {
  const [kind, setKind] = useState<LegalKind | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const open = async (next: LegalKind) => {
    setKind(next);
    setLoading(true);
    setTitle(next === "agreement" ? "服务条款" : "隐私政策");
    setContent("");
    try {
      const doc = next === "agreement" ? await getPublicUserAgreement() : await getPublicPrivacyPolicy();
      setTitle(doc.title?.trim() || (next === "agreement" ? "服务条款" : "隐私政策"));
      setContent(doc.content?.trim() || "暂无已发布内容，请稍后再试。");
    } catch {
      setContent("暂无法加载文档，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <p className="text-center text-[11px] leading-5" style={{ color: TEXT_MUTED }}>
        登录即表示同意
        <button
          type="button"
          className="mx-0.5 underline underline-offset-2 hover:opacity-80"
          style={{ color: BRAND_PURPLE }}
          onClick={() => void open("agreement")}
        >
          服务条款
        </button>
        与
        <button
          type="button"
          className="mx-0.5 underline underline-offset-2 hover:opacity-80"
          style={{ color: BRAND_PURPLE }}
          onClick={() => void open("privacy")}
        >
          隐私政策
        </button>
      </p>
      <Dialog open={kind != null} onOpenChange={(openState) => { if (!openState) setKind(null); }}>
        <DialogContent className="max-h-[min(80dvh,36rem)] max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle>{loading ? "加载中…" : title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[min(60dvh,28rem)] overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
            {loading ? "正在获取最新版本…" : content}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
