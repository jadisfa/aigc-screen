export const INITIAL_SCREEN_VERSION_NO = uni.getAppBaseInfo()?.appVersionCode || 1;

/** 出厂 V1 更新说明；升级完成后由本机已安装版本的 changelog 覆盖。 */
export const FACTORY_CHANGELOG_LINES = [
  "-升级到最新版本，享受更丰富、稳定、快速的功能和体验!",
  "-修复部分BUG，提高用户体验",
];

export const FACTORY_CHANGELOG = FACTORY_CHANGELOG_LINES.join("\n");

export const APP_VERSION = {
  current: String(INITIAL_SCREEN_VERSION_NO),
  notes: FACTORY_CHANGELOG_LINES,
};

export type VersionPhase = "available" | "updating" | "latest";
