export type RolePrivilegeLevel = "platform" | "merchant" | "store" | "member";

export type RoleCatalogLike = {
  code?: string | null;
  name?: string | null;
  scopeLevel?: string | null;
  scope?: string | null;
};

export const ROLE_PRIVILEGE_LABELS: Record<RolePrivilegeLevel, string> = {
  platform: "平台",
  merchant: "商户",
  store: "门店",
  member: "普通会员",
};

const LEVEL_RANK: Record<RolePrivilegeLevel, number> = {
  platform: 0,
  merchant: 1,
  store: 2,
  member: 3,
};

const BUILTIN_ROLE_LABELS: Record<string, string> = {
  platform_admin: "平台管理员",
  platform_user: "平台用户",
  merchant_admin: "商户管理员",
  merchant_user: "商户用户",
  store_admin: "门店管理员",
  store_user: "门店用户",
  default_member: "普通会员",
};

function normalize(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function findCatalogItem(roleCode: string, catalog: RoleCatalogLike[]): RoleCatalogLike | undefined {
  const code = normalize(roleCode);
  return catalog.find((item) => normalize(item.code) === code || item.name === roleCode);
}

function isAdminRole(roleCode: string, displayName: string): boolean {
  return normalize(roleCode).endsWith("_admin") || displayName.includes("管理员");
}

export function resolveRolePrivilegeLevel(
  roleCode: string,
  catalogItem?: RoleCatalogLike | null,
): RolePrivilegeLevel {
  const code = normalize(roleCode);
  const name = (catalogItem?.name || roleCode).trim();
  const scope = normalize(catalogItem?.scopeLevel || catalogItem?.scope);

  if (
    code === "default_member"
    || code.endsWith(".default_member")
    || name === "普通会员"
    || name === "普通用户"
  ) {
    return "member";
  }

  if (
    code === "platform_admin"
    || code === "platform_user"
    || code.startsWith("platform_")
    || name.includes("平台")
  ) {
    return "platform";
  }

  if (
    code === "merchant_admin"
    || code === "merchant_user"
    || code.startsWith("merchant_")
    || name.includes("商户")
    || name.includes("代理商")
  ) {
    return "merchant";
  }

  if (
    code === "store_admin"
    || code === "store_user"
    || code.startsWith("store_")
    || name.includes("门店")
  ) {
    return "store";
  }

  if (scope === "merchant") {
    return "merchant";
  }
  if (scope === "store") {
    return "store";
  }
  if (scope === "global") {
    return "platform";
  }

  return "member";
}

export function resolveRoleDisplayName(roleCode: string, catalogItem?: RoleCatalogLike | null): string {
  const catalogName = catalogItem?.name?.trim();
  if (catalogName) {
    return catalogName;
  }
  return BUILTIN_ROLE_LABELS[normalize(roleCode)] || roleCode.trim() || ROLE_PRIVILEGE_LABELS.member;
}

export function pickHighestPrivilegeRoleName(
  roleCodes: string[],
  catalog: RoleCatalogLike[] = [],
): string {
  const roles = roleCodes.map((roleCode) => roleCode?.trim()).filter(Boolean);
  if (!roles.length) {
    return ROLE_PRIVILEGE_LABELS.member;
  }

  let best: { rank: number; admin: boolean; name: string } | null = null;
  for (const roleCode of roles) {
    const catalogItem = findCatalogItem(roleCode, catalog);
    const level = resolveRolePrivilegeLevel(roleCode, catalogItem);
    const name = resolveRoleDisplayName(roleCode, catalogItem);
    const candidate = {
      rank: LEVEL_RANK[level],
      admin: isAdminRole(roleCode, name),
      name,
    };
    if (
      !best
      || candidate.rank < best.rank
      || (candidate.rank === best.rank && candidate.admin && !best.admin)
    ) {
      best = candidate;
    }
  }

  return best?.name ?? ROLE_PRIVILEGE_LABELS.member;
}

export type AffiliationGrantSpec = {
  roleCode: string;
  roleName?: string | null;
  roleScopeLevel?: string | null;
  merchantId?: string | null;
  storeId?: string | null;
};

function blankToNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function affiliationGrantConflictMessage(
  grant: AffiliationGrantSpec | null | undefined,
  homeMerchantId?: string | null,
  homeStoreId?: string | null,
): string | null {
  if (!grant) {
    return null;
  }
  const catalogItem: RoleCatalogLike = {
    code: grant.roleCode,
    name: grant.roleName,
    scopeLevel: grant.roleScopeLevel,
  };
  const level = resolveRolePrivilegeLevel(grant.roleCode, catalogItem);
  const homeMerchant = blankToNull(homeMerchantId);
  const homeStore = blankToNull(homeStoreId);
  const grantMerchant = blankToNull(grant.merchantId);
  const grantStore = blankToNull(grant.storeId);

  if (level === "platform" || level === "member") {
    if (grantMerchant || grantStore) {
      return "平台级或普通会员角色不能绑定商户/门店";
    }
    return null;
  }
  if (!homeMerchant) {
    return "请先设置组织归属，再授予商户或门店角色";
  }
  if (level === "merchant") {
    if (homeStore) {
      return "当前用户归属到门店，不能授予商户角色；请先将组织归属提升到商户";
    }
    if (!grantMerchant) {
      return "商户角色必须绑定组织归属商户";
    }
    if (homeMerchant !== grantMerchant) {
      return "商户角色只能授予组织归属所在商户，不能跨商户授权";
    }
    if (grantStore) {
      return "商户角色不能绑定门店";
    }
    return null;
  }
  if (!grantMerchant || !grantStore) {
    return "门店角色必须绑定组织归属商户及其门店";
  }
  if (homeMerchant !== grantMerchant) {
    return "门店角色只能授予组织归属商户下的门店";
  }
  if (homeStore && homeStore !== grantStore) {
    return "已归属到指定门店时，门店角色只能授予该门店";
  }
  return null;
}

export function affiliationChangeConflictMessage(
  grants: AffiliationGrantSpec[] | null | undefined,
  newHomeMerchantId?: string | null,
  newHomeStoreId?: string | null,
): string | null {
  if (!grants?.length) {
    return null;
  }
  for (const grant of grants) {
    const message = affiliationGrantConflictMessage(grant, newHomeMerchantId, newHomeStoreId);
    if (message) {
      return `组织归属与已有角色授权冲突：${message}。请先清理不兼容的授权后再改归属`;
    }
  }
  return null;
}

export function canAssignRoleForAffiliation(
  roleCode: string,
  catalogItem: RoleCatalogLike | null | undefined,
  homeMerchantId?: string | null,
  homeStoreId?: string | null,
): boolean {
  const level = resolveRolePrivilegeLevel(roleCode, catalogItem);
  if (level === "platform" || level === "member") {
    return true;
  }
  if (!homeMerchantId?.trim()) {
    return false;
  }
  if (level === "merchant") {
    return !homeStoreId?.trim();
  }
  return true;
}

export type LockedRoleGrantFields = {
  scopeLevel: "global" | "merchant" | "store";
  merchantId: string | null;
  storeId: string | null;
};

export function grantScopeLevelForPrivilege(level: RolePrivilegeLevel): LockedRoleGrantFields["scopeLevel"] {
  if (level === "merchant") {
    return "merchant";
  }
  if (level === "store") {
    return "store";
  }
  return "global";
}

/**
 * 按权限级别生成授权行。目录 scopeLevel=global 的商户/门店角色仍落到归属商户/门店。
 */
export function lockedGrantFields(
  roleCode: string,
  catalogItem: RoleCatalogLike | null | undefined,
  homeMerchantId?: string | null,
  homeStoreId?: string | null,
): LockedRoleGrantFields {
  const level = resolveRolePrivilegeLevel(roleCode, catalogItem);
  const scopeLevel = grantScopeLevelForPrivilege(level);
  if (scopeLevel === "merchant") {
    return { scopeLevel, merchantId: blankToNull(homeMerchantId), storeId: null };
  }
  if (scopeLevel === "store") {
    return {
      scopeLevel,
      merchantId: blankToNull(homeMerchantId),
      storeId: blankToNull(homeStoreId),
    };
  }
  return { scopeLevel: "global", merchantId: null, storeId: null };
}

export type RoleGrantLike = {
  roleCode: string;
  scopeLevel?: string | null;
  merchantId?: string | null;
  storeId?: string | null;
};

/**
 * 把已有授权行对齐到权限级别：补齐归属商户/门店，清掉平台/会员角色上的租户字段。
 */
export function alignRoleGrantToAffiliation(
  grant: RoleGrantLike,
  catalogItem: RoleCatalogLike | null | undefined,
  homeMerchantId?: string | null,
  homeStoreId?: string | null,
): LockedRoleGrantFields {
  const catalog: RoleCatalogLike = catalogItem ?? {
    code: grant.roleCode,
    scopeLevel: grant.scopeLevel,
  };
  const locked = lockedGrantFields(grant.roleCode, catalog, homeMerchantId, homeStoreId);
  if (locked.scopeLevel === "global") {
    return { scopeLevel: "global", merchantId: null, storeId: null };
  }
  if (locked.scopeLevel === "merchant") {
    return {
      scopeLevel: "merchant",
      merchantId: blankToNull(grant.merchantId) ?? locked.merchantId,
      storeId: null,
    };
  }
  return {
    scopeLevel: "store",
    merchantId: blankToNull(grant.merchantId) ?? locked.merchantId,
    storeId: blankToNull(grant.storeId) ?? locked.storeId,
  };
}

