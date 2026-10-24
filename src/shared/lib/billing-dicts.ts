export type BillingOption<T extends string = string> = {
  value: T;
  label: string;
};

export const BILLING_CONSUMPTION_TYPE_OPTIONS = [
  { value: "BALANCE", label: "余额" },
  { value: "RESOURCE_PACKAGE", label: "资源包" },
] as const satisfies readonly BillingOption[];

export const BILLING_DEDUCTION_SOURCE_OPTIONS = [
  { value: "APP_CALL", label: "应用调用" },
  { value: "MODEL_CALL", label: "模型调用" },
  { value: "ADMIN_RECHARGE", label: "后台人工充值" },
  { value: "ONLINE_RECHARGE", label: "线上充值" },
  { value: "ADMIN_DEDUCT", label: "后台人工扣减" },
  { value: "REGISTRATION_REWARD", label: "注册赠送" },
  { value: "LOGIN_REWARD", label: "登录赠送" },
  { value: "TASK_REFUND", label: "任务失败退还" },
  { value: "WALLET_TRANSFER", label: "钱包划拨" },
  { value: "WALLET_FREEZE", label: "钱包冻结" },
  { value: "WALLET_RECYCLE", label: "钱包回收" },
] as const satisfies readonly BillingOption[];

export const BILLING_DIRECTION_OPTIONS = [
  { value: "IN", label: "收入" },
  { value: "OUT", label: "支出" },
] as const satisfies readonly BillingOption[];

export type BillingConsumptionTypeCode = (typeof BILLING_CONSUMPTION_TYPE_OPTIONS)[number]["value"];
export type BillingDeductionSourceCode = (typeof BILLING_DEDUCTION_SOURCE_OPTIONS)[number]["value"];
export type BillingDirectionCode = (typeof BILLING_DIRECTION_OPTIONS)[number]["value"];

const CONSUMPTION_TYPE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  BILLING_CONSUMPTION_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<string, string>;

const DEDUCTION_SOURCE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  BILLING_DEDUCTION_SOURCE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<string, string>;

const BILL_DIRECTION_LABEL_MAP: Record<string, string> = Object.fromEntries(
  BILLING_DIRECTION_OPTIONS.map((option) => [option.value, option.label]),
) as Record<string, string>;

export function getBillingConsumptionTypeLabel(code: BillingConsumptionTypeCode | string | null | undefined): string {
  if (!code) {
    return "-";
  }
  return CONSUMPTION_TYPE_LABEL_MAP[code] ?? code;
}

export function getBillingDeductionSourceLabel(code: BillingDeductionSourceCode | string | null | undefined): string {
  if (!code) {
    return "-";
  }
  return DEDUCTION_SOURCE_LABEL_MAP[code] ?? code;
}

export function getBillingDirectionLabel(code: BillingDirectionCode | string | null | undefined): string {
  if (!code) {
    return "-";
  }
  return BILL_DIRECTION_LABEL_MAP[code] ?? code;
}

export function isIncomeBillDirection(code: BillingDirectionCode | string | null | undefined): boolean {
  return code === "IN";
}

export function isExpenseBillDirection(code: BillingDirectionCode | string | null | undefined): boolean {
  return code === "OUT";
}
