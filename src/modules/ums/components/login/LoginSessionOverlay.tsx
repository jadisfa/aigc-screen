import { memo } from "react";
import { TEXT_MUTED, TEXT_PRIMARY } from "./loginTheme";

export const LoginSessionOverlay = memo(function LoginSessionOverlay() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#F8F6FC]/88">
      <div className="rounded-2xl border border-[#E8E2F4] bg-white px-6 py-5 text-center shadow-[0_20px_48px_-28px_rgba(40,20,80,0.22)]">
        <div className="text-[15px] font-medium" style={{ color: TEXT_PRIMARY }}>正在确认登录状态</div>
        <div className="mt-1.5 text-[13px]" style={{ color: TEXT_MUTED }}>若登录仍有效，将自动进入系统</div>
      </div>
    </div>
  );
});
