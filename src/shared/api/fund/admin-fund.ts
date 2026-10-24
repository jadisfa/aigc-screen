import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";
import type {
  BillingDeductionSourceCode,
  BillingDirectionCode,
} from "@/shared/lib/billing-dicts";
import {
  BILLING_DEDUCTION_SOURCE_OPTIONS,
  BILLING_DIRECTION_OPTIONS,
  getBillingDeductionSourceLabel,
  getBillingDirectionLabel,
} from "@/shared/lib/billing-dicts";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type FundAccountOwnerType = "merchant" | "store" | "user";

export type FundAccountBalance = {
  accountId: string | null;
  accountType?: string | null;
  ownerType: string;
  ownerId: string;
  principalId: string | null;
  merchantId?: string | null;
  storeId?: string | null;
  balance: number;
  currency: string | null;
  status?: string | null;
  availableBalance: number | null;
  frozenBalance: number | null;
};

export type FundAccountScope = {
  subjectScope?: string | null;
  merchantId?: string | null;
  storeId?: string | null;
};

export type FundUserSubjectScope = "store_user" | "merchant_user" | "c_end_user" | "platform_user";

export type ManualFundRechargeCommand = {
  amount: number;
  remark?: string;
  currency?: string;
  operatorId?: string;
  /** ISO-8601 Instant；省略或空表示永久有效 Lot（仅用户账户） */
  expireAt?: string | null;
  /** 仅 store：true/缺省=商户划转；false=门店直接充值 */
  transferFromMerchant?: boolean | null;
};

export type ManualFundDeductCommand = ManualFundRechargeCommand;

export type ManualFundAdjustResult = {
  orderId: string | null;
  requestId?: string | null;
  accountId: string | null;
  balanceAfter: number;
  ledgerId: string | null;
  currency: string | null;
};

export type MerchantFundAdjustCommand = ManualFundRechargeCommand;

export type StoreFundTransferRechargeCommand = ManualFundRechargeCommand & {
  merchantId: string;
};

export type StoreFundDirectRechargeCommand = ManualFundRechargeCommand & {
  merchantId?: string | null;
};

export type StoreFundDeductCommand = ManualFundDeductCommand & {
  merchantId?: string | null;
  restoreToMerchant?: boolean;
};

export type StoreFundTransferRechargeResult = {
  merchantDeductResult: ManualFundAdjustResult;
  storeRechargeResult: ManualFundAdjustResult;
  balanceAfter: number;
  currency: string | null;
};

export type StoreFundDeductResult = {
  storeDeductResult: ManualFundAdjustResult;
  merchantRechargeResult: ManualFundAdjustResult | null;
  balanceAfter: number;
  currency: string | null;
};

export type AdminFundLedger = {
  id: string;
  ledgerId: string;
  accountId: string | null;
  requestId: string | null;
  orderId: string | null;
  source: string | null;
  bizContext: string | null;
  principalId: string | null;
  ownerId: string | null;
  ownerType: string | null;
  ownerTypeLabel: string | null;
  ownerName: string | null;
  deviceName?: string | null;
  deviceCode?: string | null;
  userNickname: string | null;
  userAvatar: string | null;
  deductionSource: BillingDeductionSourceCode | string;
  deductionSourceLabel: string | null;
  resourceId: string | null;
  amount: number;
  billDirection: BillingDirectionCode | string;
  billDirectionLabel: string | null;
  currentBalance: number;
  appName: string | null;
  platformName: string | null;
  modelName: string | null;
  consumptionTime: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  remark: string | null;
  bizDomain: string | null;
  bizDomainLabel: string | null;
  bizType: string | null;
  bizTypeLabel: string | null;
  actionType: string | null;
  actionTypeLabel: string | null;
  currency: string | null;
};

export type ListAdminFundLedgersParams = {
  pageNo: number;
  pageSize: number;
  total?: number;
  principalId?: string;
  billDirection?: BillingDirectionCode;
  deductionSource?: BillingDeductionSourceCode;
  keyword?: string;
  startTime?: string;
  endTime?: string;
};

export const ADMIN_FUND_LEDGERS_QUERY_KEY = ["admin-fund-ledgers"] as const;

const ADMIN_FUND_BASE_PATH = "/api/admin/fund";

const BILLING_DEDUCTION_SOURCE_SET = new Set<BillingDeductionSourceCode>(
  BILLING_DEDUCTION_SOURCE_OPTIONS.map((option) => option.value),
);
const BILLING_DIRECTION_SET = new Set<BillingDirectionCode>(BILLING_DIRECTION_OPTIONS.map((option) => option.value));
const FUND_BIZ_DOMAIN_LABEL_MAP: Record<string, string> = {
  workflow: "工作流",
  model_hub: "模型中枢",
  activity: "活动",
  recharge: "充值",
  admin_adjust: "后台调账",
};
const FUND_BIZ_TYPE_LABEL_MAP: Record<string, string> = {
  APP_RUN: "应用运行",
  TEXT_GENERATION: "文本生成",
  EMBEDDING: "向量嵌入",
  IMAGE_GENERATION: "图片生成",
  AUDIO_SYNTHESIS: "语音合成",
  AUDIO_TRANSCRIPTION: "语音转写",
  VIDEO_GENERATION: "视频生成",
  THREE_D_GENERATION: "3D生成",
  REGISTRATION_REWARD: "注册赠送",
  LOGIN_REWARD: "登录赠送",
  ONLINE_RECHARGE: "线上充值",
  MANUAL_RECHARGE: "人工充值",
  MANUAL_DEDUCT: "人工扣减",
  WALLET_TRANSFER: "钱包划拨",
  WALLET_FREEZE: "钱包冻结",
  WALLET_RECYCLE: "钱包回收",
};
const FUND_ACTION_LABEL_MAP: Record<string, string> = {
  DEDUCT: "自动扣减",
  MANUAL_RECHARGE: "人工充值",
  MANUAL_DEDUCT: "人工扣减",
  ONLINE_RECHARGE: "线上充值",
  GIFT: "赠送",
  REFUND: "任务失败退还",
  TRANSFER: "钱包划拨",
  FREEZE: "钱包冻结",
  RECYCLE: "钱包回收",
};

function asNullableString(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeDeductionSource(value: unknown): BillingDeductionSourceCode | string {
  const normalized = asNullableString(value);
  if (!normalized) {
    return "";
  }
  return BILLING_DEDUCTION_SOURCE_SET.has(normalized as BillingDeductionSourceCode)
    ? (normalized as BillingDeductionSourceCode)
    : normalized;
}

function normalizeBillDirection(value: unknown): BillingDirectionCode | string {
  const normalized = asNullableString(value);
  if (!normalized) {
    return "";
  }
  return BILLING_DIRECTION_SET.has(normalized as BillingDirectionCode)
    ? (normalized as BillingDirectionCode)
    : normalized;
}

function normalizeOwnerTypeLabel(value: unknown): string | null {
  const normalized = asNullableString(value);
  if (!normalized) {
    return "未知主体";
  }
  if (normalized.toLowerCase() === "user") {
    return "用户账户";
  }
  if (normalized.toLowerCase() === "store") {
    return "门店账户";
  }
  if (normalized.toLowerCase() === "merchant") {
    return "商户账户";
  }
  if (normalized.toLowerCase() === "device") {
    return "设备";
  }
  return normalized;
}

function normalizeBizDomainLabel(value: unknown): string | null {
  const normalized = asNullableString(value);
  if (!normalized) {
    return null;
  }
  return FUND_BIZ_DOMAIN_LABEL_MAP[normalized] ?? normalized;
}

function normalizeBizTypeLabel(value: unknown): string | null {
  const normalized = asNullableString(value);
  if (!normalized) {
    return null;
  }
  return FUND_BIZ_TYPE_LABEL_MAP[normalized] ?? normalized;
}

function normalizeActionTypeLabel(value: unknown): string | null {
  const normalized = asNullableString(value);
  if (!normalized) {
    return null;
  }
  return FUND_ACTION_LABEL_MAP[normalized] ?? normalized;
}

function trimToUndefined(value: string | undefined | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function inferFundUserSubjectScope(scope?: FundAccountScope): FundUserSubjectScope {
  const explicitScope = trimToUndefined(scope?.subjectScope);
  if (explicitScope === "store_user" || explicitScope === "merchant_user" || explicitScope === "c_end_user" || explicitScope === "platform_user") {
    return explicitScope;
  }
  if (trimToUndefined(scope?.storeId)) {
    return "store_user";
  }
  if (trimToUndefined(scope?.merchantId)) {
    return "merchant_user";
  }
  return "platform_user";
}

export function resolveFundUserOwnerId(principalId?: string | null): string {
  return principalId?.trim() || "";
}

export function getFundAccountScopedBalanceQueryKey(
  ownerType: FundAccountOwnerType | string,
  ownerId: string,
  scope?: FundAccountScope,
) {
  return [
    "admin-fund-account-balance",
    ownerType,
    ownerId,
    trimToUndefined(scope?.subjectScope) ?? null,
    trimToUndefined(scope?.merchantId ?? undefined) ?? null,
    trimToUndefined(scope?.storeId ?? undefined) ?? null,
  ] as const;
}

export function normalizeAdminFundLedgersParams(params: ListAdminFundLedgersParams): ListAdminFundLedgersParams {
  const principalId = trimToUndefined(params.principalId);
  const keyword = trimToUndefined(params.keyword);

  return {
    ...params,
    principalId,
    keyword,
    startTime: trimToUndefined(params.startTime),
    endTime: trimToUndefined(params.endTime),
  };
}

export function getAdminFundLedgersQueryKey(params: ListAdminFundLedgersParams) {
  return [...ADMIN_FUND_LEDGERS_QUERY_KEY, normalizeAdminFundLedgersParams(params)] as const;
}

function buildFundBalancePath(ownerType: string, ownerId: string): string {
  return `${ADMIN_FUND_BASE_PATH}/accounts/${encodeURIComponent(ownerType)}/${encodeURIComponent(ownerId)}/balance`;
}

function buildManualRechargePath(ownerType: string, ownerId: string): string {
  return `${ADMIN_FUND_BASE_PATH}/accounts/${encodeURIComponent(ownerType)}/${encodeURIComponent(ownerId)}/manual-recharges`;
}

function buildManualDeductPath(ownerType: string, ownerId: string): string {
  return `${ADMIN_FUND_BASE_PATH}/accounts/${encodeURIComponent(ownerType)}/${encodeURIComponent(ownerId)}/manual-deductions`;
}

function buildFundAccountScopeQuery(scope?: FundAccountScope): string {
  const qs = new URLSearchParams();
  const subjectScope = trimToUndefined(scope?.subjectScope ?? undefined);
  const merchantId = trimToUndefined(scope?.merchantId ?? undefined);
  const storeId = trimToUndefined(scope?.storeId ?? undefined);
  if (subjectScope) qs.set("subjectScope", subjectScope);
  if (merchantId) qs.set("merchantId", merchantId);
  if (storeId) qs.set("storeId", storeId);
  const query = qs.toString();
  return query ? `?${query}` : "";
}

function normalizeFundAccountBalance(raw: Partial<FundAccountBalance>, ownerType: string, ownerId: string): FundAccountBalance {
  return {
    accountId: asNullableString(raw.accountId),
    accountType: asNullableString(raw.accountType),
    ownerType: asNullableString(raw.ownerType) ?? ownerType,
    ownerId: asNullableString(raw.ownerId) ?? ownerId,
    principalId: asNullableString(raw.principalId),
    merchantId: asNullableString(raw.merchantId),
    storeId: asNullableString(raw.storeId),
    balance: asNumber(raw.balance),
    currency: asNullableString(raw.currency),
    status: asNullableString(raw.status),
    availableBalance: raw.availableBalance == null ? null : asNumber(raw.availableBalance),
    frozenBalance: raw.frozenBalance == null ? null : asNumber(raw.frozenBalance),
  };
}

function normalizeManualFundAdjustResult(raw: Partial<ManualFundAdjustResult>): ManualFundAdjustResult {
  return {
    orderId: asNullableString(raw.orderId),
    requestId: asNullableString(raw.requestId),
    accountId: asNullableString(raw.accountId),
    balanceAfter: asNumber(raw.balanceAfter),
    ledgerId: asNullableString(raw.ledgerId),
    currency: asNullableString(raw.currency),
  };
}

function normalizeStoreTransferRechargeResult(raw: {
  orderId?: unknown;
  accountId?: unknown;
  balanceAfter?: unknown;
  ledgerId?: unknown;
  currency?: unknown;
  merchantDeductResult?: Partial<ManualFundAdjustResult> | null;
}): StoreFundTransferRechargeResult {
  const storeRechargeResult = normalizeManualFundAdjustResult({
    orderId: raw.orderId,
    accountId: raw.accountId,
    balanceAfter: raw.balanceAfter,
    ledgerId: raw.ledgerId,
    currency: raw.currency,
  });
  return {
    merchantDeductResult: normalizeManualFundAdjustResult(raw.merchantDeductResult ?? {}),
    storeRechargeResult,
    balanceAfter: storeRechargeResult.balanceAfter,
    currency: storeRechargeResult.currency,
  };
}

function normalizeStoreFundDeductResult(raw: {
  requestId?: unknown;
  accountId?: unknown;
  balanceAfter?: unknown;
  ledgerId?: unknown;
  currency?: unknown;
  merchantRechargeResult?: Partial<ManualFundAdjustResult> | null;
}): StoreFundDeductResult {
  const storeDeductResult = normalizeManualFundAdjustResult({
    requestId: raw.requestId,
    accountId: raw.accountId,
    balanceAfter: raw.balanceAfter,
    ledgerId: raw.ledgerId,
    currency: raw.currency,
  });
  return {
    storeDeductResult,
    merchantRechargeResult: raw.merchantRechargeResult
      ? normalizeManualFundAdjustResult(raw.merchantRechargeResult)
      : null,
    balanceAfter: storeDeductResult.balanceAfter,
    currency: storeDeductResult.currency,
  };
}

function normalizeFundLedger(raw: Partial<AdminFundLedger>): AdminFundLedger {
  const ledgerId = asNullableString(raw.ledgerId) ?? asNullableString(raw.id) ?? "";
  const principalId = asNullableString(raw.principalId);
  const ownerType = asNullableString(raw.ownerType);
  const bizDomain = asNullableString(raw.bizDomain);
  const bizType = asNullableString(raw.bizType);
  const actionType = asNullableString(raw.actionType);
  const deductionSource = normalizeDeductionSource(raw.deductionSource);
  const billDirection = normalizeBillDirection(raw.billDirection);
  const currentBalanceSource = raw.currentBalance;
  const consumptionTime = asNullableString(raw.consumptionTime) ?? "";
  const createdAt = asNullableString(raw.createdAt) ?? consumptionTime;
  const updatedAt = asNullableString(raw.updatedAt) ?? createdAt;

  return {
    id: ledgerId,
    ledgerId,
    accountId: asNullableString(raw.accountId),
    requestId: asNullableString(raw.requestId),
    orderId: asNullableString(raw.orderId),
    source: asNullableString(raw.source),
    bizContext: asNullableString(raw.bizContext),
    principalId,
    ownerId: asNullableString(raw.ownerId),
    ownerType,
    ownerTypeLabel: normalizeOwnerTypeLabel(ownerType),
    ownerName: asNullableString(raw.ownerName),
    deviceName: asNullableString((raw as { deviceName?: unknown }).deviceName),
    deviceCode: asNullableString((raw as { deviceCode?: unknown }).deviceCode),
    userNickname: asNullableString(raw.userNickname),
    userAvatar: asNullableString(raw.userAvatar),
    deductionSource,
    deductionSourceLabel: getBillingDeductionSourceLabel(deductionSource),
    resourceId:
      asNullableString((raw as { resourceId?: unknown }).resourceId)
      ?? asNullableString((raw as { resourcePackageId?: unknown }).resourcePackageId),
    amount: asNumber(raw.amount),
    billDirection,
    billDirectionLabel: getBillingDirectionLabel(billDirection),
    currentBalance: asNumber(currentBalanceSource),
    appName: asNullableString(raw.appName),
    platformName: asNullableString(raw.platformName),
    modelName: asNullableString(raw.modelName),
    consumptionTime,
    createdAt,
    updatedAt,
    updatedBy: asNullableString(raw.updatedBy),
    remark: asNullableString(raw.remark),
    bizDomain,
    bizDomainLabel: normalizeBizDomainLabel(bizDomain),
    bizType,
    bizTypeLabel: normalizeBizTypeLabel(bizType),
    actionType,
    actionTypeLabel: normalizeActionTypeLabel(actionType),
    currency: asNullableString(raw.currency),
  };
}

export async function getFundAccountBalance(
  ownerType: FundAccountOwnerType | string,
  ownerId: string,
  scope?: FundAccountScope,
): Promise<FundAccountBalance> {
  const result = await apiFetch<FundAccountBalance>(`${buildFundBalancePath(ownerType, ownerId)}${buildFundAccountScopeQuery(scope)}`, {
    method: "GET",
  });
  return normalizeFundAccountBalance(result ?? {}, ownerType, ownerId);
}

export async function submitManualFundRecharge(
  ownerType: FundAccountOwnerType | string,
  ownerId: string,
  cmd: ManualFundRechargeCommand,
  scope?: FundAccountScope,
): Promise<ManualFundAdjustResult> {
  const body: Record<string, unknown> = {
    amount: cmd.amount,
    remark: cmd.remark,
    currency: cmd.currency,
    operatorId: cmd.operatorId,
  };
  const expireAt = trimToUndefined(cmd.expireAt ?? undefined);
  if (expireAt) {
    body.expireAt = expireAt;
  }
  if (typeof cmd.transferFromMerchant === "boolean") {
    body.transferFromMerchant = cmd.transferFromMerchant;
  }
  const result = await apiFetch<ManualFundAdjustResult>(`${buildManualRechargePath(ownerType, ownerId)}${buildFundAccountScopeQuery(scope)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return normalizeManualFundAdjustResult(result ?? {});
}

export async function submitManualFundDeduct(
  ownerType: FundAccountOwnerType | string,
  ownerId: string,
  cmd: ManualFundDeductCommand,
  scope?: FundAccountScope,
): Promise<ManualFundAdjustResult> {
  const result = await apiFetch<ManualFundAdjustResult>(`${buildManualDeductPath(ownerType, ownerId)}${buildFundAccountScopeQuery(scope)}`, {
    method: "POST",
    body: JSON.stringify(cmd),
  });
  return normalizeManualFundAdjustResult(result ?? {});
}

export async function getMerchantFundBalance(merchantId: string): Promise<FundAccountBalance> {
  return getFundAccountBalance("merchant", merchantId);
}

export async function submitMerchantFundRecharge(
  merchantId: string,
  cmd: MerchantFundAdjustCommand,
): Promise<ManualFundAdjustResult> {
  return submitManualFundRecharge("merchant", merchantId, cmd);
}

export async function submitMerchantFundDeduct(
  merchantId: string,
  cmd: MerchantFundAdjustCommand,
): Promise<ManualFundAdjustResult> {
  return submitManualFundDeduct("merchant", merchantId, cmd);
}

export async function getStoreFundBalance(
  storeId: string,
  merchantId?: string | null,
): Promise<FundAccountBalance> {
  return getFundAccountBalance("store", storeId, {
    merchantId: trimToUndefined(merchantId ?? undefined) ?? null,
    storeId,
  });
}

export async function submitStoreTransferRecharge(
  storeId: string,
  cmd: StoreFundTransferRechargeCommand,
): Promise<StoreFundTransferRechargeResult> {
  const merchantId = trimToUndefined(cmd.merchantId);
  if (!merchantId) {
    throw new Error("缺少归属商户，无法划转充值");
  }

  const result = await apiFetch<StoreFundTransferRechargeResult>(
    `${buildManualRechargePath("store", storeId)}${buildFundAccountScopeQuery({ merchantId, storeId })}`,
    {
      method: "POST",
      body: JSON.stringify({
        amount: cmd.amount,
        remark: cmd.remark,
        currency: cmd.currency,
        transferFromMerchant: true,
      }),
    },
  );
  return normalizeStoreTransferRechargeResult(result ?? {});
}

/** 门店直接充值：不扣商户余额，永久 Lot。 */
export async function submitStoreDirectRecharge(
  storeId: string,
  cmd: StoreFundDirectRechargeCommand,
): Promise<ManualFundAdjustResult> {
  const merchantId = trimToUndefined(cmd.merchantId ?? undefined) ?? null;
  return submitManualFundRecharge(
    "store",
    storeId,
    {
      amount: cmd.amount,
      remark: cmd.remark,
      currency: cmd.currency,
      operatorId: cmd.operatorId,
      transferFromMerchant: false,
    },
    { merchantId, storeId },
  );
}

export async function submitStoreFundDeduct(
  storeId: string,
  cmd: StoreFundDeductCommand,
): Promise<StoreFundDeductResult> {
  const merchantId = trimToUndefined(cmd.merchantId ?? undefined) ?? null;
  if (Boolean(cmd.restoreToMerchant) && !merchantId) {
    throw new Error("缺少归属商户，无法回加商户余额");
  }
  const result = await apiFetch<StoreFundDeductResult>(
    `${buildManualDeductPath("store", storeId)}${buildFundAccountScopeQuery({ merchantId, storeId })}`,
    {
      method: "POST",
      body: JSON.stringify({
        amount: cmd.amount,
        remark: cmd.remark,
        currency: cmd.currency,
        restoreToMerchant: Boolean(cmd.restoreToMerchant),
      }),
    },
  );
  return normalizeStoreFundDeductResult(result ?? {});
}

export async function listAdminFundLedgers(
  params: ListAdminFundLedgersParams,
): Promise<{ page: PageResult; items: AdminFundLedger[] }> {
  const normalizedParams = normalizeAdminFundLedgersParams(params);
  const qs = buildPageSearchParams(normalizedParams);
  if (normalizedParams.principalId) qs.append("principalId", normalizedParams.principalId);
  if (normalizedParams.billDirection) qs.append("billDirection", normalizedParams.billDirection);
  if (normalizedParams.deductionSource) qs.append("deductionSource", normalizedParams.deductionSource);
  if (normalizedParams.keyword) qs.append("keyword", normalizedParams.keyword);
  if (normalizedParams.startTime) qs.append("startTime", normalizedParams.startTime);
  if (normalizedParams.endTime) qs.append("endTime", normalizedParams.endTime);

  const response = await apiFetch<{ page: PageResult; items: AdminFundLedger[] }>(
    `${ADMIN_FUND_BASE_PATH}/ledgers?${qs.toString()}`,
    { method: "GET" },
  );

  return {
    page: response?.page ?? {
      pageNo: normalizedParams.pageNo,
      pageSize: normalizedParams.pageSize,
      total: 0,
    },
    items: Array.isArray(response?.items) ? response.items.map(normalizeFundLedger) : [],
  };
}
