/** Normalize session/API scopeLevel for merchant/store gating and bindings. */
export function normalizeScopeLevel(scopeLevel: string | null | undefined): string {
  return (scopeLevel || "").trim().toLowerCase();
}

/**
 * 当前 scopeLevel 优先；旧行只有 tenantType/tenantId 时回退。
 * ComfyUI 调用方若还不支持 GLOBAL，应自行丢掉 scopeLevel=global。
 */
export function resolveTenantScopeIds(row: {
  scopeLevel?: string | null;
  tenantType?: string | null;
  merchantId?: string | null;
  storeId?: string | null;
  tenantId?: string | null;
}): { scopeLevel: "global" | "merchant" | "store"; merchantId: string | null; storeId: string | null } | null {
  const explicitLevel = normalizeScopeLevel(row.scopeLevel);
  if (explicitLevel === "global") {
    return { scopeLevel: "global", merchantId: null, storeId: null };
  }
  if (explicitLevel === "merchant") {
    return {
      scopeLevel: "merchant",
      merchantId: row.merchantId ?? row.tenantId ?? null,
      storeId: row.storeId ?? null,
    };
  }
  if (explicitLevel === "store") {
    return {
      scopeLevel: "store",
      merchantId: row.merchantId ?? null,
      storeId: row.storeId ?? row.tenantId ?? null,
    };
  }
  const legacyType = normalizeScopeLevel(row.tenantType);
  if (legacyType === "merchant") {
    return {
      scopeLevel: "merchant",
      merchantId: row.tenantId ?? row.merchantId ?? null,
      storeId: null,
    };
  }
  if (legacyType === "store") {
    return {
      scopeLevel: "store",
      merchantId: row.merchantId ?? null,
      storeId: row.tenantId ?? row.storeId ?? null,
    };
  }
  return null;
}
