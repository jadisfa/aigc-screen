import { apiFetch } from "@/shared/api/sys/http";

export type LoginProviderPublic = {
  providerCode: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  sortOrder: number;
};

type LoginProvidersPayload = {
  providers?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readBool(row: Record<string, unknown>, ...keys: string[]): boolean {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
      if (normalized === "false" || normalized === "0" || normalized === "no") return false;
    }
  }
  return false;
}

function readNumber(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function normalizeProvider(raw: unknown): LoginProviderPublic | null {
  const row = asRecord(raw);
  if (!row) return null;
  const providerCode = readString(row, "providerCode", "provider_code", "code");
  if (!providerCode) return null;
  return {
    providerCode,
    name: readString(row, "name") || providerCode,
    enabled: readBool(row, "enabled"),
    isDefault: readBool(row, "isDefault", "is_default", "default"),
    sortOrder: readNumber(row, "sortOrder", "sort_order"),
  };
}

function extractProviderList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const obj = asRecord(data);
  if (!obj) return [];
  if (Array.isArray(obj.providers)) return obj.providers;
  if (Array.isArray(obj.items)) return obj.items;
  if (Array.isArray(obj.list)) return obj.list;
  return [];
}

/**
 * 登录页拉取登录方式公开配置（与登录配置页联动）。
 */
export async function fetchLoginProviders(): Promise<LoginProviderPublic[]> {
  const data = await apiFetch<LoginProvidersPayload | LoginProviderPublic[] | unknown>(
    "/api/auth/login/providers",
    {
      method: "GET",
      withAuth: false,
    }
  );
  return extractProviderList(data)
    .map(normalizeProvider)
    .filter((item): item is LoginProviderPublic => !!item);
}

/** 登录页已实现的 Tab。 */
export type LoginPageTab = "account" | "phone" | "email" | "wechat" | "dingtalk" | "google" | "feishu";

const FALLBACK_TABS: LoginPageTab[] = ["phone", "email", "wechat"];

export function isWechatProviderCode(code: string): boolean {
  return code === "wechat_open" || code === "wechat_mp";
}

export function isSsoLoginTab(tab: LoginPageTab): tab is "dingtalk" | "google" | "feishu" {
  return tab === "dingtalk" || tab === "google" || tab === "feishu";
}

/**
 * 将配置表 provider 映射为登录页 Tab（仅已实现渠道）。
 */
export function mapProviderCodeToLoginTab(code: string): LoginPageTab | null {
  if (code === "account") return "account";
  if (code === "phone") return "phone";
  if (code === "email") return "email";
  if (isWechatProviderCode(code)) return "wechat";
  if (code === "dingtalk") return "dingtalk";
  if (code === "google") return "google";
  if (code === "feishu") return "feishu";
  return null;
}

/**
 * 根据公开配置推导登录页可见 Tab 与默认 Tab。
 * - 接口无数据：回退手机/邮箱/微信，避免只剩一种
 * - 全部关闭：仅保留手机，避免空白页
 * - 单种/多种均由调用方决定是否展示 Tabs
 */
export function resolveLoginPageTabs(providers: LoginProviderPublic[]): {
  tabs: LoginPageTab[];
  defaultTab: LoginPageTab;
} {
  if (!providers.length) {
    return { tabs: [...FALLBACK_TABS], defaultTab: "phone" };
  }

  const enabled = providers
    .filter((p) => p.enabled)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const tabs: LoginPageTab[] = [];
  const pushUnique = (tab: LoginPageTab) => {
    if (!tabs.includes(tab)) tabs.push(tab);
  };

  for (const p of enabled) {
    const tab = mapProviderCodeToLoginTab(p.providerCode);
    if (tab) pushUnique(tab);
  }

  if (tabs.length === 0) {
    return { tabs: ["phone"], defaultTab: "phone" };
  }

  const defaultProvider = enabled.find((p) => p.isDefault) ?? providers.find((p) => p.isDefault && p.enabled);
  const mappedDefault = defaultProvider ? mapProviderCodeToLoginTab(defaultProvider.providerCode) : null;
  const defaultTab = mappedDefault && tabs.includes(mappedDefault) ? mappedDefault : tabs[0];

  return { tabs, defaultTab };
}
