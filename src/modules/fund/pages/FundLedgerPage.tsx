import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  getAdminFundLedgersQueryKey,
  listAdminFundLedgers,
  type AdminFundLedger as FundLedger,
  type ListAdminFundLedgersParams as ListFundLedgersParams,
} from "@/shared/api/fund/admin-fund";
import { getAuditSourceLabel } from "@/shared/api/sys/logs";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { formatDateTime } from "@/shared/lib/datetime";
import { formatMoney } from "@/shared/lib/format";
import { formatOwnerLabel, isStoreOwner } from "@/shared/lib/owner-display";
import { DatePicker } from "@/shared/components/DatePicker";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import {
  buildPermissionSetForNamespace,
  CONSOLE_PERMISSION_NAMESPACE,
  CONSOLE_PERMISSIONS,
  CONSOLE_ROUTES,
  hasPermission,
  type PermissionRequirement,
} from "@/shared/lib/permissions";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  TableSurface,
} from "@/shared/components/page";
import {
  BILLING_DIRECTION_OPTIONS,
  BILLING_DEDUCTION_SOURCE_OPTIONS,
  type BillingDirectionCode,
  isExpenseBillDirection,
  isIncomeBillDirection,
  type BillingDeductionSourceCode,
} from "@/shared/lib/billing-dicts";
import { getUserAvatarFallback, resolveUserAvatarUrl } from "@/shared/lib/user-avatar";
import { Monitor, RefreshCw } from "lucide-react";
import { notify } from "@/shared/lib/notify";

type LedgerBizContext = Record<string, unknown>;
const APP_RUN_BIZ_TYPE = "APP_RUN";
const MODEL_CALL_BIZ_TYPES = new Set([
  "TEXT_GENERATION",
  "EMBEDDING",
  "IMAGE_GENERATION",
  "AUDIO_SYNTHESIS",
  "AUDIO_TRANSCRIPTION",
  "VIDEO_GENERATION",
  "THREE_D_GENERATION",
]);
const ACTIVITY_BIZ_TYPES = new Set(["REGISTRATION_REWARD", "LOGIN_REWARD"]);
const ADJUST_BIZ_TYPES = new Set([
  "MANUAL_RECHARGE",
  "MANUAL_DEDUCT",
  "WALLET_TRANSFER",
  "WALLET_FREEZE",
  "WALLET_RECYCLE",
]);
const RESOURCE_TYPE_LABEL_MAP: Record<string, string> = {
  compute_unit: "算力消耗",
};

const getDisplayValue = (value: string | null | undefined, fallback = "-") => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const getBizDomainLabel = (value: string | null | undefined) => {
  return value || "-";
};

const getBizTypeLabel = (value: string | null | undefined) => {
  return value || "-";
};

const getLedgerBizTypeDisplay = (item: FundLedger) => {
  const backendLabel = getDisplayValue(item.bizTypeLabel, "");
  if (backendLabel !== "") {
    return backendLabel;
  }
  return getBizTypeLabel(item.bizType);
};

const getLedgerDeductionSourceDisplay = (item: FundLedger) => getDisplayValue(item.deductionSourceLabel, item.deductionSource || "-");

const getLedgerBillDirectionDisplay = (item: FundLedger) => getDisplayValue(item.billDirectionLabel, item.billDirection || "-");

const getLedgerActionTypeDisplay = (item: FundLedger) => getDisplayValue(item.actionTypeLabel, item.actionType || "-");

const getOwnerDisplayName = (item: FundLedger) => {
  if (isStoreOwner(item.ownerType)) {
    const bizContext = parseLedgerBizContext(item.bizContext);
    return formatOwnerLabel({
      ownerKind: "store",
      ownerName: item.ownerName,
      deviceName: item.deviceName || getBizContextString(bizContext, "deviceName"),
    });
  }
  return getDisplayValue(item.ownerName || item.userNickname, item.ownerTypeLabel || "未知主体");
};

const hasScreenDevice = (item: FundLedger) => {
  if (!isStoreOwner(item.ownerType)) {
    return false;
  }
  const bizContext = parseLedgerBizContext(item.bizContext);
  return Boolean(
    item.deviceName?.trim()
    || getBizContextString(bizContext, "deviceName"),
  );
};

const getLedgerSourceDisplay = (item: FundLedger) => {
  const normalized = item.source?.trim();
  if (!normalized) {
    return null;
  }
  return getAuditSourceLabel(normalized);
};

const parseLedgerBizContext = (value: string | null | undefined): LedgerBizContext => {
  const normalized = value?.trim();
  if (!normalized) {
    return {};
  }
  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as LedgerBizContext;
    }
  } catch {
    return {};
  }
  return {};
};

const getBizContextString = (context: LedgerBizContext, key: string) => {
  const value =
    context[key] ??
    context[key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())] ??
    context[key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)];
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }
    if (key === "resourceType") {
      return RESOURCE_TYPE_LABEL_MAP[normalized] ?? normalized;
    }
    return normalized;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
};

const pushLedgerDetail = (
  details: Array<{ label: string; value: string }>,
  label: string,
  value: string | null | undefined,
) => {
  const normalized = value?.trim();
  if (normalized) {
    details.push({ label, value: normalized });
  }
};

const firstDetailValue = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (normalized) {
      return normalized;
    }
  }
  return null;
};

const getLedgerDetailItems = (item: FundLedger) => {
  const bizContext = parseLedgerBizContext(item.bizContext);
  const details: Array<{ label: string; value: string }> = [];
  pushLedgerDetail(details, "业务系统", getLedgerSourceDisplay(item));
  pushLedgerDetail(details, "交易动作", item.actionTypeLabel || item.actionType);
  if (item.bizType && ACTIVITY_BIZ_TYPES.has(item.bizType)) {
    pushLedgerDetail(
      details,
      "活动名称",
      firstDetailValue(getBizContextString(bizContext, "activityName"), getBizContextString(bizContext, "bizName")),
    );
    pushLedgerDetail(details, "注册礼包", getBizContextString(bizContext, "registrationPackageName"));
    pushLedgerDetail(details, "活动周期", getBizContextString(bizContext, "periodKey"));
  } else if (item.bizType === APP_RUN_BIZ_TYPE) {
    pushLedgerDetail(
      details,
      "应用名称",
      firstDetailValue(
        getBizContextString(bizContext, "bizName"),
        getBizContextString(bizContext, "workflowTitle"),
        item.appName,
      ),
    );
    pushLedgerDetail(
      details,
      "设备名称",
      firstDetailValue(item.deviceName, getBizContextString(bizContext, "deviceName")),
    );
    pushLedgerDetail(details, "资源类型", getBizContextString(bizContext, "resourceType"));
  } else if (item.bizType && MODEL_CALL_BIZ_TYPES.has(item.bizType)) {
    pushLedgerDetail(details, "API Key ID", getBizContextString(bizContext, "apiKeyId"));
    pushLedgerDetail(details, "平台", item.platformName || getBizContextString(bizContext, "platformName"));
    pushLedgerDetail(
      details,
      "模型",
      firstDetailValue(item.modelName, getBizContextString(bizContext, "modelName"), getBizContextString(bizContext, "bizName")),
    );
    pushLedgerDetail(details, "场景", getBizContextString(bizContext, "sceneCode"));
    pushLedgerDetail(details, "渠道", getBizContextString(bizContext, "channelCode"));
  } else if (item.bizType === "ONLINE_RECHARGE") {
    pushLedgerDetail(details, "套餐", getBizContextString(bizContext, "packageName"));
    pushLedgerDetail(
      details,
      "支付渠道",
      firstDetailValue(getBizContextString(bizContext, "payChannel"), getBizContextString(bizContext, "bizName")),
    );
  } else if (item.bizType && ADJUST_BIZ_TYPES.has(item.bizType)) {
    pushLedgerDetail(details, "调账事由", getBizContextString(bizContext, "bizName"));
  } else {
    pushLedgerDetail(details, "支付渠道", getBizContextString(bizContext, "payChannel"));
  }
  pushLedgerDetail(details, "交易备注", item.remark);
  return details;
};

const ALL_FILTER_VALUE = "all";

interface FundLedgerpageProps {
  custom?: boolean
}

export default function FundLedgerPage({ custom = false }: FundLedgerpageProps = {}) {
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [billDirection, setBillDirection] = useState<BillingDirectionCode | typeof ALL_FILTER_VALUE>(ALL_FILTER_VALUE);
  const [deductionSource, setDeductionSource] = useState<BillingDeductionSourceCode | typeof ALL_FILTER_VALUE>(ALL_FILTER_VALUE);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const { data: meInfo, refetch: refetchMePermissions } = useMePermissions({
    sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode,
  });

  const queryParams = useMemo<ListFundLedgersParams>(() => {
    const params: ListFundLedgersParams = { pageNo, pageSize };
    if (appliedKeyword.trim()) params.keyword = appliedKeyword.trim();
    if (custom) {
      params.keyword = meInfo?.principalId
    }
    if (billDirection !== ALL_FILTER_VALUE) params.billDirection = billDirection;
    if (deductionSource !== ALL_FILTER_VALUE) params.deductionSource = deductionSource;
    if (startTime) params.startTime = `${startTime} 00:00:00`;
    if (endTime) params.endTime = `${endTime} 23:59:59`;
    return params;
  }, [appliedKeyword, billDirection, deductionSource, endTime, pageNo, pageSize, startTime]);

  const billsQuery = useQuery({
    queryKey: getAdminFundLedgersQueryKey(queryParams),
    queryFn: () => listAdminFundLedgers(queryParams),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!billsQuery.isError) {
      return;
    }
    const message = resolveUserErrorMessage(billsQuery.error, "请求失败");
    notify.error("加载统一资金流水失败", { description: message });
  }, [billsQuery.error, billsQuery.isError]);

  const items: FundLedger[] = billsQuery.data?.items ?? [];
  const total = billsQuery.data?.page.total ?? 0;
  const loading = billsQuery.isLoading;
  const refreshing = billsQuery.isFetching;
  const errorMessage = billsQuery.isError ? resolveUserErrorMessage(billsQuery.error, "请求失败") : "";

  const handleSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
    setPageNo(1);
  };

  const handleReset = () => {
    setKeyword("");
    setAppliedKeyword("");
    setBillDirection(ALL_FILTER_VALUE);
    setDeductionSource(ALL_FILTER_VALUE);
    setStartTime("");
    setEndTime("");
    setPageNo(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canNextPage = pageNo < totalPages;

  return (
    <PageShell>
      {!custom && (
        <PageHeader
        title="资金流水"
        actions={
          <>
            <Button variant="pageOutline" onClick={handleReset} disabled={refreshing}>
              重置
            </Button>
            <Button variant="pageOutline" onClick={() => void billsQuery.refetch()} disabled={refreshing}>
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
          </>
        }
      />
      )}

      <PageFilterBar end={custom ? <><Button variant="pageOutline" onClick={handleReset} disabled={refreshing}>
              重置
            </Button>
            <Button variant="pageOutline" onClick={() => void billsQuery.refetch()} disabled={refreshing}>
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button></> : null}>
        <Select
          value={billDirection}
          onValueChange={(value) => {
            setBillDirection(value);
            setPageNo(1);
          }}
        >
          <SelectTrigger className="subpage-native-select w-[140px]">
            <SelectValue placeholder="流水方向" />
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value={ALL_FILTER_VALUE}>全部</SelectItem>
            {BILLING_DIRECTION_OPTIONS.map((option) => (
              <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={deductionSource}
          onValueChange={(value) => {
            setDeductionSource(value);
            setPageNo(1);
          }}
        >
          <SelectTrigger className="subpage-native-select w-[160px]">
            <SelectValue placeholder="扣费来源" />
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value={ALL_FILTER_VALUE}>全部</SelectItem>
            {BILLING_DEDUCTION_SOURCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <DatePicker
            value={startTime}
            onChange={(value) => {
              setStartTime(value);
              setPageNo(1);
            }}
            placeholder="开始时间"
            className="w-[150px] h-9 bg-background"
          />
          <span className="text-muted-foreground">-</span>
          <DatePicker
            value={endTime}
            onChange={(value) => {
              setEndTime(value);
              setPageNo(1);
            }}
            placeholder="结束时间"
            className="w-[150px] h-9 bg-background"
          />
        </div>

        {!custom && (
          <SearchField
          wrapClassName="!max-w-[300px]"
          placeholder="搜索主体ID/流水ID/请求ID，回车搜索"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSearch();
            }
          }}
        />
        )}
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">主体信息</TableHead>
              <TableHead className="min-w-[240px]">账单语义</TableHead>
              <TableHead className="min-w-[180px]">交易金额</TableHead>
              <TableHead className="min-w-[160px]">账户余额</TableHead>
              <TableHead className="min-w-[380px]">交易详情</TableHead>
              <TableHead className="min-w-[200px]">时间信息</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  正在加载统一资金流水...
                </TableCell>
              </TableRow>
            ) : errorMessage && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="space-y-2">
                    <div className="font-medium text-destructive">统一资金流水加载失败</div>
                    <div className="text-sm text-muted-foreground">{errorMessage}</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  暂无统一资金流水
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const detailItems = getLedgerDetailItems(item);
                return (
                  <TableRow key={item.id} className="align-top">
                  <TableCell>
                    <div className="flex min-w-[200px] items-start gap-3">
                      {hasScreenDevice(item) ? (
                        <div className="h-12 w-12 shrink-0 rounded-full bg-muted flex items-center justify-center">
                          <Monitor className="h-5 w-5 text-muted-foreground" />
                        </div>
                      ) : (
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarImage
                            src={resolveUserAvatarUrl(item.userAvatar, item.ownerName || item.userNickname || "U", 64)}
                            alt={getOwnerDisplayName(item)}
                          />
                          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                            {getUserAvatarFallback(item.ownerName || item.userNickname || "", "?")}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="max-w-[220px] font-medium text-foreground">
                            {getOwnerDisplayName(item)}
                          </div>
                         
                        </div>
                        <div className="text-xs text-muted-foreground"> <Badge variant="outline">{item.ownerTypeLabel || "未知主体"}</Badge></div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="min-w-[240px] space-y-3">
                      <div className="grid gap-2 text-xs">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground">业务场景:</span>
                          <span className="font-medium text-foreground">{getLedgerBizTypeDisplay(item)}</span>
                        </div>
                          <div className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground">业务类型:</span>
                          <span className="font-medium text-foreground">{getBizDomainLabel(item.bizDomainLabel || item.bizDomain)}</span>
                        </div>
                      </div>
                       <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                          {getLedgerDeductionSourceDisplay(item)}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="min-w-[180px] space-y-2">
                      <div
                        className={
                          isIncomeBillDirection(item.billDirection)
                            ? "text-emerald-600 font-semibold"
                            : isExpenseBillDirection(item.billDirection)
                              ? "text-destructive font-semibold"
                              : "font-semibold text-foreground"
                        }
                      >
                        {isIncomeBillDirection(item.billDirection) ? "+" : isExpenseBillDirection(item.billDirection) ? "-" : ""}
                        {formatMoney(item.amount, item.currency)}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={isIncomeBillDirection(item.billDirection) ? "default" : "outline"}>
                          {getLedgerBillDirectionDisplay(item)}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="min-w-[160px] space-y-1.5 font-medium">
                      <div>{formatMoney(item.currentBalance, item.currency)}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {item.ownerTypeLabel || "未知主体"}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-xs leading-5">
                    <div className="min-w-[380px] space-y-1.5">
                      {detailItems.length > 0 ? (
                        detailItems.map((detail) => (
                          <div key={`${item.id}-${detail.label}`} className="flex items-start gap-1">
                            <span className="shrink-0 text-muted-foreground">{detail.label}：</span>
                            <span className="break-all text-foreground">{detail.value}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-foreground">-</div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="min-w-[200px] space-y-1.5 text-xs leading-5">
                      <div className="flex items-center gap-1">
                        <div className="shrink-0 text-muted-foreground">消费时间：</div>
                        <div className="text-foreground">{formatDateTime(item.consumptionTime)}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="shrink-0 text-muted-foreground">创建时间：</div>
                        <div className="text-foreground">{formatDateTime(item.createdAt)}</div>
                      </div>
                    </div>
                  </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableSurface>

      <CommonPaginationBar
        total={total}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={canNextPage}
        onPageNoChange={setPageNo}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPageNo(1);
        }}
        showLastButton={true}
        disabled={refreshing}
      />
    </PageShell>
  );
}
