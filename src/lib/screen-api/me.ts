import { screenRequest } from "@/lib/screen-http";

export type ScreenAccount = {
  merchantId?: string;
  storeId?: string;
  deviceId?: string;
  deviceCode?: string;
  currency?: string;
  balanceAmount?: number | string | null;
};

export type ScreenStore = {
  id?: string;
  name?: string;
  address?: string;
};

const admin = { requireAdmin: true as const };

export function fetchScreenAccount() {
  return screenRequest<ScreenAccount>("/api/screen/me/account", admin);
}

export function fetchScreenStore() {
  return screenRequest<ScreenStore>("/api/screen/me/store");
}

export function patchScreenStore(data: { name: string; address: string }) {
  return screenRequest<ScreenStore>("/api/screen/me/store", { ...admin, method: "PATCH", data });
}
