export type OwnerKind = "user" | "device" | "store";

export function isDeviceOwner(ownerKind?: string | null): boolean {
  return (ownerKind || "").trim().toLowerCase() === "device";
}

export function isStoreOwner(ownerKind?: string | null): boolean {
  return (ownerKind || "").trim().toLowerCase() === "store";
}

/** Device: name（code）. Store + screen: storeName（deviceName）. Never use principal uuid. */
export function formatOwnerLabel(input: {
  ownerKind?: string | null;
  ownerName?: string | null;
  deviceName?: string | null;
  deviceCode?: string | null;
}): string {
  if (isDeviceOwner(input.ownerKind)) {
    const name = input.ownerName?.trim() || "设备";
    const code = input.deviceCode?.trim();
    return code ? `${name}（${code}）` : name;
  }
  if (isStoreOwner(input.ownerKind)) {
    const storeName = input.ownerName?.trim() || "门店";
    const deviceLabel = input.deviceName?.trim();
    return deviceLabel ? `${storeName}（${deviceLabel}）` : storeName;
  }
  return input.ownerName?.trim() || "-";
}
