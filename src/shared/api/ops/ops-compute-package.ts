import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export const COMPUTE_PACKAGE_TYPE = {
  RECHARGE: "recharge",
  REGISTRATION: "registration",
  LOGIN_REWARD: "login_reward",
} as const;

export type ComputePackageType =
  (typeof COMPUTE_PACKAGE_TYPE)[keyof typeof COMPUTE_PACKAGE_TYPE];

export const COMPUTE_PACKAGE_TYPES = Object.values(COMPUTE_PACKAGE_TYPE) as ComputePackageType[];

export const COMPUTE_PACKAGE_TYPE_OPTIONS: Array<{ value: ComputePackageType; label: string }> = [
  { value: COMPUTE_PACKAGE_TYPE.RECHARGE, label: "充值套餐" },
  { value: COMPUTE_PACKAGE_TYPE.REGISTRATION, label: "注册赠送" },
  { value: COMPUTE_PACKAGE_TYPE.LOGIN_REWARD, label: "登录活动" },
];

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type ComputePackage = {
  id: string;
  name: string;
  coverUrl: string | null;
  amount: number;
  currency: string;
  computeQuota: number;
  bonusCompute: number;
  exclusiveMerchantId: string | null;
  isExclusive: boolean;
  validityDays: number | null;
  onlineRecharge: boolean;
  creditTarget: ComputePackageCreditTarget | null;
  packageType: ComputePackageType;
  enabled: boolean;
  sortNo: number;
  description: string | null;
  detailContent: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export const COMPUTE_PACKAGE_CREDIT_TARGET = {
  USER: "user",
  STORE: "store",
  MERCHANT: "merchant",
} as const;

export type ComputePackageCreditTarget =
  (typeof COMPUTE_PACKAGE_CREDIT_TARGET)[keyof typeof COMPUTE_PACKAGE_CREDIT_TARGET];

export const COMPUTE_PACKAGE_CREDIT_TARGET_OPTIONS: Array<{
  value: ComputePackageCreditTarget;
  label: string;
}> = [
  { value: COMPUTE_PACKAGE_CREDIT_TARGET.USER, label: "个人账户" },
  { value: COMPUTE_PACKAGE_CREDIT_TARGET.STORE, label: "门店账户" },
  { value: COMPUTE_PACKAGE_CREDIT_TARGET.MERCHANT, label: "商户账户" },
];

export function normalizeComputePackageCreditTarget(
  raw: string | null | undefined,
): ComputePackageCreditTarget | null {
  if (raw == null || !String(raw).trim()) return null;
  const value = String(raw).trim().toLowerCase().replace(/-/g, "_");
  // legacy aliases from early personal/enterprise naming
  if (value === "personal") return COMPUTE_PACKAGE_CREDIT_TARGET.USER;
  if (value === "enterprise") return COMPUTE_PACKAGE_CREDIT_TARGET.MERCHANT;
  if ((Object.values(COMPUTE_PACKAGE_CREDIT_TARGET) as string[]).includes(value)) {
    return value as ComputePackageCreditTarget;
  }
  throw new Error(`invalid compute package credit target: ${raw ?? ""}`);
}

export function getComputePackageCreditTargetLabel(raw: string | null | undefined): string {
  const normalized = normalizeComputePackageCreditTarget(raw);
  return (
    COMPUTE_PACKAGE_CREDIT_TARGET_OPTIONS.find((option) => option.value === normalized)?.label ??
    normalized ??
    "-"
  );
}

export type CreateComputePackageCommand = Omit<
  ComputePackage,
  "id" | "createdAt" | "updatedAt" | "updatedBy"
>;

export type UpdateComputePackageCommand = Partial<CreateComputePackageCommand>;

export function normalizeComputePackageType(raw: string | null | undefined): ComputePackageType {
  const value = (raw || "").trim().toLowerCase().replace(/-/g, "_");
  if (COMPUTE_PACKAGE_TYPES.includes(value as ComputePackageType)) {
    return value;
  }
  throw new Error(`invalid compute package type: ${raw ?? ""}`);
}

export function isRechargeComputePackageType(packageType: string | null | undefined): boolean {
  return normalizeComputePackageType(packageType) === COMPUTE_PACKAGE_TYPE.RECHARGE;
}

export function isRewardComputePackageType(packageType: string | null | undefined): boolean {
  const normalized = normalizeComputePackageType(packageType);
  return (
    normalized === COMPUTE_PACKAGE_TYPE.REGISTRATION ||
    normalized === COMPUTE_PACKAGE_TYPE.LOGIN_REWARD
  );
}

export function getComputePackageTypeLabel(packageType: string | null | undefined): string {
  const normalized = normalizeComputePackageType(packageType);
  return COMPUTE_PACKAGE_TYPE_OPTIONS.find((option) => option.value === normalized)?.label ?? normalized;
}

export async function listComputePackages(params: {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  packageType?: string;
}): Promise<{ page: PageResult; items: ComputePackage[] }> {
  const qs = buildPageSearchParams(params);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.packageType) qs.set("packageType", params.packageType);

  const response = await apiFetch<{ page: PageResult; items: ComputePackage[] }>(
    `/api/admin/ops/computePackages?${qs.toString()}`,
    { method: "GET" }
  );
  return {
    ...response,
    items: (response.items || []).map((item) => ({
      ...item,
      packageType: normalizeComputePackageType(item.packageType),
      creditTarget: item.creditTarget
        ? normalizeComputePackageCreditTarget(item.creditTarget)
        : null,
    })),
  };
}

export async function getComputePackage(id: string): Promise<ComputePackage> {
  const response = await apiFetch<ComputePackage>(`/api/admin/ops/computePackages/${encodeURIComponent(id)}`, {
    method: "GET",
  });
  return {
    ...response,
    packageType: normalizeComputePackageType(response.packageType),
    creditTarget: response.creditTarget
      ? normalizeComputePackageCreditTarget(response.creditTarget)
      : null,
  };
}

export async function createComputePackage(cmd: CreateComputePackageCommand): Promise<ComputePackage> {
  return apiFetch<ComputePackage>("/api/admin/ops/computePackages", {
    method: "POST",
    body: JSON.stringify(cmd),
  });
}

export async function updateComputePackage(
  id: string,
  cmd: UpdateComputePackageCommand
): Promise<ComputePackage> {
  return apiFetch<ComputePackage>(`/api/admin/ops/computePackages/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(cmd),
  });
}

export async function setComputePackageEnabled(id: string, enabled: boolean): Promise<ComputePackage> {
  return apiFetch<ComputePackage>(`/api/admin/ops/computePackages/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

export async function deleteComputePackage(id: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/ops/computePackages/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
