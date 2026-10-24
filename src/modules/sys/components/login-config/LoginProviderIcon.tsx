import type { ReactNode } from "react";
import { Globe, Mail, Smartphone, User } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type LoginProviderIconProps = {
  type: string;
  color: string;
  className?: string;
};

/**
 * 登录方式图标：固定外框尺寸，品牌 SVG 统一铺满，避免视觉大小不一。
 */
export function LoginProviderIcon({ type, color, className }: LoginProviderIconProps) {
  const frameClass = cn("inline-flex items-center justify-center shrink-0 size-5", className);
  const svgClass = "block size-full";

  let glyph: ReactNode;
  if (type === "user") {
    glyph = <User className={svgClass} style={{ color }} strokeWidth={2} />;
  } else if (type === "phone") {
    glyph = <Smartphone className={svgClass} style={{ color }} strokeWidth={2} />;
  } else if (type === "mail") {
    glyph = <Mail className={svgClass} style={{ color }} strokeWidth={2} />;
  } else if (type === "wechat") {
    glyph = (
      <svg className={svgClass} viewBox="0 0 24 24" fill={color} aria-hidden>
        <path d="M9.5 3.5C5.36 3.5 2 6.42 2 10c0 2.02 1.11 3.82 2.83 5.01L4.1 17.7c-.1.3.2.6.5.5l2.7-1.3c.68.19 1.4.3 2.15.3.25 0 .5-.01.74-.04A5.66 5.66 0 0 1 9.5 15.5c0-3.48 3.13-6.3 7-6.3.35 0 .7.02 1.03.06C16.7 5.9 13.4 3.5 9.5 3.5Zm-2.75 4.75a.88.88 0 1 1 0 1.75.88.88 0 0 1 0-1.75Zm4.5 0a.88.88 0 1 1 0 1.75.88.88 0 0 1 0-1.75ZM16.5 10.5c-3.04 0-5.5 2.13-5.5 4.75S13.46 20 16.5 20c.5 0 .98-.06 1.43-.17l1.8.86c.22.1.47-.12.4-.35l-.45-1.5c.95-.8 1.57-1.95 1.57-3.24 0-2.62-2.46-4.75-5.5-4.75Zm-1.75 3.25a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Zm3.5 0a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Z" />
      </svg>
    );
  } else if (type === "dingtalk") {
    glyph = (
      <svg className={svgClass} viewBox="0 0 24 24" fill={color} aria-hidden>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.72 8.97s-1.07.95-2.01 1.8c-.24.21-.32.41-.28.66.06.36.17.83.26 1.17l.01.05c.04.18-.03.26-.17.16l-2.21-1.56a.59.59 0 0 0-.4-.11l-1.06.06c-.07 0-.15-.03-.12-.13.03-.1.95-2.24 2.72-3.38.35-.23.45-.41.45-.41s-.27.06-.71.28c-1.31.66-3.8 2.4-4.43 2.94-.28.24-.57.17-.66-.09-.05-.15-.31-1.05-.4-1.46-.06-.3.06-.5.35-.62 1.01-.4 4.84-1.84 6.36-2.35.45-.15.61-.05.55.17z" />
      </svg>
    );
  } else if (type === "google") {
    glyph = (
      <svg className={svgClass} viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    );
  } else if (type === "kakao") {
    glyph = (
      <svg className={svgClass} viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="#FEE500" />
        <path
          d="M12 7c-3.04 0-5.5 1.94-5.5 4.33 0 1.54 1.02 2.9 2.55 3.67l-.65 2.4c-.05.18.16.33.32.23l2.86-1.9c.14.01.28.02.42.02 3.04 0 5.5-1.94 5.5-4.33S15.04 7 12 7z"
          fill="#3C1E1E"
        />
      </svg>
    );
  } else if (type === "feishu") {
    glyph = (
      <svg className={svgClass} viewBox="0 0 24 24" fill={color} aria-hidden>
        <path d="M5.2 3.5 12 8.1l6.8-4.6V10l-6.8 10L5.2 10V3.5Zm1.3 1.8v4.5l5.5 8.1 5.5-8.1V5.3L12 9.1 6.5 5.3Z" />
      </svg>
    );
  } else {
    glyph = <Globe className={svgClass} style={{ color }} strokeWidth={2} />;
  }

  return (
    <span className={frameClass} aria-hidden>
      {glyph}
    </span>
  );
}
