const HIDDEN_APP_SOURCES = new Set(
  String(import.meta.env.VITE_HIDDEN_APP_SOURCES ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);

export function isHiddenAppSource(code: string | null | undefined): boolean {
  return Boolean(code && HIDDEN_APP_SOURCES.has(code));
}

export const APP_CLIENT_OPTIONS = [
  { value: "ai_admin", label: "AI中台" },
  { value: "ai_portal", label: "AI应用门户" },
  { value: "store_ops", label: "门店运营系统" },
  { value: "store_screen", label: "门店电子屏" },
  { value: "design_tools", label: "小满AI工作台" },
].filter((item) => !isHiddenAppSource(item.value));
