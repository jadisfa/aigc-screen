import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type OnlineRechargeStoreOption = {
  storeId: string;
  storeName: string | null;
  merchantId: string | null;
};

export type PurchaseContext = {
  purchasable: boolean;
  storeSelectionRequired: boolean;
  creditTarget: string | null;
  ownerType: string | null;
  ownerId: string | null;
  merchantId: string | null;
  storeId: string | null;
  principalId: string | null;
  availableStores: OnlineRechargeStoreOption[];
  message: string | null;
};

export type OnlineRechargeOrder = {
  orderId: string;
  orderNo: string;
  status: string;
  payChannel: string | null;
  amount: number;
  currency: string | null;
  payAmountFen: number | null;
  codeUrl: string | null;
  packageId: string | null;
  packageName: string | null;
  creditTarget: string | null;
  merchantId: string | null;
  storeId: string | null;
  principalId: string | null;
  payOrderNo: string | null;
  createdAt: string | null;
  paidAt: string | null;
  remark: string | null;
};

const BASE = "/api/admin/fund/online-recharges";

export async function getPurchaseContext(params: {
  principalId: string;
  packageId: string;
}): Promise<PurchaseContext> {
  const qs = new URLSearchParams();
  qs.set("principalId", params.principalId);
  qs.set("packageId", params.packageId);
  return apiFetch<PurchaseContext>(`${BASE}/purchase-context?${qs.toString()}`, { method: "GET" });
}

export async function listOnlineRecharges(params: {
  pageNo: number;
  pageSize: number;
  total?: number;
  status?: string;
  payChannel?: string;
  orderNo?: string;
  principalId?: string;
}): Promise<{ page: PageResult; items: OnlineRechargeOrder[] }> {
  const qs = buildPageSearchParams(params);
  if (params.status) qs.set("status", params.status);
  if (params.payChannel) qs.set("payChannel", params.payChannel);
  if (params.orderNo) qs.set("orderNo", params.orderNo);
  if (params.principalId) qs.set("principalId", params.principalId);
  return apiFetch<{ page: PageResult; items: OnlineRechargeOrder[] }>(`${BASE}?${qs.toString()}`, {
    method: "GET",
  });
}

export async function createOnlineRecharge(cmd: {
  principalId: string;
  packageId: string;
  payChannel: string;
  storeId?: string;
}): Promise<OnlineRechargeOrder> {
  return apiFetch<OnlineRechargeOrder>(BASE, {
    method: "POST",
    body: JSON.stringify(cmd),
  });
}

export async function syncOnlineRechargeStatus(orderNo: string): Promise<OnlineRechargeOrder> {
  return apiFetch<OnlineRechargeOrder>(`${BASE}/${encodeURIComponent(orderNo)}/sync-status`, {
    method: "POST",
  });
}

/** 关闭未支付线上单（切换支付渠道前调用）。 */
export async function closeOnlineRecharge(orderNo: string): Promise<OnlineRechargeOrder> {
  return apiFetch<OnlineRechargeOrder>(`${BASE}/${encodeURIComponent(orderNo)}/close`, {
    method: "POST",
  });
}

export function creditTargetLabel(code: string | null | undefined): string {
  switch ((code || "").toLowerCase()) {
    case "user":
    case "personal":
      return "个人账户";
    case "store":
      return "门店账户";
    case "merchant":
    case "enterprise":
      return "商户账户";
    default:
      return code || "-";
  }
}

export function orderStatusLabel(status: string | null | undefined): string {
  switch ((status || "").toLowerCase()) {
    case "created":
      return "已创建";
    case "paying":
      return "支付中";
    case "paid":
      return "已支付";
    case "failed":
      return "失败";
    case "closed":
      return "已关闭";
    default:
      return status || "-";
  }
}
