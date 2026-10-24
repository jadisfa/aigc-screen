import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";
import type {
  BillingConsumptionTypeCode,
  BillingDeductionSourceCode,
  BillingDirectionCode,
} from "@/shared/lib/billing-dicts";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type Plan = {
  planId: string;
  name: string;
  computeValue: number;
  price: number;
};

export type Order = {
  orderId: string;
  orderNo: string;
  status: string;
  amount: number;
  createdAt: string | null;
  paidAt: string | null;
};

export type OrderCreated = {
  orderId: string;
  orderNo: string;
  channel: string;
  amountCents: number;
  currency: string;
  status: string;
};

export type ConsumptionBill = {
  id: string;
  userId: string;
  userNickname: string | null;
  userAvatar: string | null;
  consumptionType: BillingConsumptionTypeCode;
  billingMode: string;
  deductionSource: BillingDeductionSourceCode;
  resourcePackageId: string | null;
  amount: number;
  billDirection: BillingDirectionCode;
  currentBalance: number;
  appName: string | null;
  platformName: string | null;
  modelName: string | null;
  consumptionTime: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type ListConsumptionBillsParams = {
  pageNo: number;
  pageSize: number;
  total?: number;
  userId?: string;
  consumptionType?: BillingConsumptionTypeCode;
  deductionSource?: BillingDeductionSourceCode;
  keyword?: string;
  startTime?: string;
  endTime?: string;
};

export async function listPlans(): Promise<{ items: Plan[] }> {
  return apiFetch<{ items: Plan[] }>("/api/admin/ops/plans", { method: "GET" });
}

export async function listOrders(params: { pageNo: number; pageSize: number; total?: number }): Promise<{ page: PageResult; items: Order[] }> {
  const qs = buildPageSearchParams(params);
  return apiFetch<{ page: PageResult; items: Order[] }>(`/api/admin/ops/orders?${qs.toString()}`, { method: "GET" });
}

export async function createOrder(params: { planId: string; channel: string }): Promise<OrderCreated> {
  return apiFetch<OrderCreated>("/api/admin/ops/orders", { method: "POST", body: JSON.stringify(params) });
}

export async function listConsumptionBills(params: ListConsumptionBillsParams): Promise<{ page: PageResult; items: ConsumptionBill[] }> {
  const qs = buildPageSearchParams(params);
  if (params.userId) qs.append("userId", params.userId);
  if (params.consumptionType) qs.append("consumptionType", params.consumptionType);
  if (params.deductionSource) qs.append("deductionSource", params.deductionSource);
  if (params.keyword) qs.append("keyword", params.keyword);
  if (params.startTime) qs.append("startTime", params.startTime);
  if (params.endTime) qs.append("endTime", params.endTime);
  return apiFetch<{ page: PageResult; items: ConsumptionBill[] }>(`/api/admin/ops/consumptionBill?${qs.toString()}`, { method: "GET" });
}