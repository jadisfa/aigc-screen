import type { PermissionView, RoleGrant, RoleView } from "@/shared/api/ums/iam";
import { lockedGrantFields } from "@/shared/lib/role-privilege";

export const DEFAULT_RBAC_SOURCE = "ai_admin";

export const RBAC_SOURCE_OPTIONS = [
  { value: "all", label: "全部来源" },
  { value: "ai_admin", label: "AI 中台" },
  { value: "ai_portal", label: "AI 门户" },
  { value: "store_ops", label: "门店运营" },
  { value: "store_screen", label: "门店大屏" },
] as const;

export const ROLE_SCOPE_OPTIONS = [
  { value: "all", label: "全部作用域" },
  { value: "global", label: "全局" },
  { value: "merchant", label: "商户" },
  { value: "store", label: "门店" },
] as const;

export const toRoleKey = (sourceCode: string, roleCode: string) => `${sourceCode}:${roleCode}`;

export function getRbacSourceLabel(sourceCode?: string | null) {
  if (!sourceCode) {
    return "未指定";
  }
  return RBAC_SOURCE_OPTIONS.find((option) => option.value === sourceCode)?.label ?? sourceCode;
}

export function getRoleScopeLabel(scopeLevel?: string | null) {
  if (!scopeLevel) {
    return "未指定";
  }
  return ROLE_SCOPE_OPTIONS.find((option) => option.value === scopeLevel)?.label ?? scopeLevel;
}

export function normalizeGrantScopeLevel(scopeLevel?: string | null, merchantId?: string | null, storeId?: string | null) {
  if (scopeLevel && scopeLevel.trim()) {
    return scopeLevel.trim().toLowerCase();
  }
  if (storeId) {
    return "store";
  }
  if (merchantId) {
    return "merchant";
  }
  return "global";
}

export function normalizeRoleGrant(grant: RoleGrant): RoleGrant {
  const merchantId = grant.merchantId || null;
  const storeId = grant.storeId || null;
  return {
    roleCode: grant.roleCode,
    sourceCode: grant.sourceCode,
    scopeLevel: normalizeGrantScopeLevel(grant.scopeLevel, merchantId, storeId),
    merchantId,
    storeId,
  };
}

export function buildDefaultRoleGrant(role: RoleView, merchantId?: string | null, storeId?: string | null): RoleGrant {
  const locked = lockedGrantFields(role.code, role, merchantId, storeId);
  return {
    roleCode: role.code,
    sourceCode: role.sourceCode,
    scopeLevel: locked.scopeLevel,
    merchantId: locked.merchantId,
    storeId: locked.storeId,
  };
}

export function describeRoleGrantScope(grant: RoleGrant) {
  const scopeLevel = normalizeGrantScopeLevel(grant.scopeLevel, grant.merchantId, grant.storeId);
  if (scopeLevel === "store") {
    return `store:${grant.merchantId || "-"}:${grant.storeId || "-"}`;
  }
  if (scopeLevel === "merchant") {
    return `merchant:${grant.merchantId || "-"}`;
  }
  return "global";
}

export function extractPermissionCodes(permissions: PermissionView[]) {
  return Array.from(
    new Set(
      permissions
        .map((permission) => permission.code?.trim())
        .filter((code): code is string => Boolean(code)),
    ),
  );
}

export function formatRbacDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}
