import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  ADMIN_FUND_LEDGERS_QUERY_KEY,
  getFundAccountScopedBalanceQueryKey,
  getMerchantFundBalance,
  getStoreFundBalance,
  submitStoreDirectRecharge,
  submitStoreFundDeduct,
  submitStoreTransferRecharge,
} from "@/shared/api/fund/admin-fund";
import { notify } from "@/shared/lib/notify";

const DEFAULT_DIRECT_REMARK = "后台门店直接充值";
const DEFAULT_TRANSFER_REMARK = "后台商户划转门店充值";
const DEFAULT_DEDUCT_REMARK = "后台门店扣款并回加商户";
const DEFAULT_DEDUCT_ONLY_REMARK = "后台门店扣款";

type AdjustAction = "direct" | "transfer" | "deduct";

function defaultRemarkFor(action: AdjustAction, restoreToMerchant: boolean): string {
  if (action === "direct") return DEFAULT_DIRECT_REMARK;
  if (action === "transfer") return DEFAULT_TRANSFER_REMARK;
  return restoreToMerchant ? DEFAULT_DEDUCT_REMARK : DEFAULT_DEDUCT_ONLY_REMARK;
}

export interface StoreBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  merchantId?: string | null;
  merchantName?: string | null;
  onStoreBalanceUpdated?: (balance: number) => void;
  onMerchantBalanceUpdated?: (balance: number) => void;
}

export default function StoreBalanceDialog({
  open,
  onOpenChange,
  storeId,
  storeName,
  merchantId,
  merchantName,
  onStoreBalanceUpdated,
  onMerchantBalanceUpdated,
}: StoreBalanceDialogProps) {
  const queryClient = useQueryClient();
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState<AdjustAction>("direct");
  const [restoreToMerchant, setRestoreToMerchant] = useState(true);
  const [remark, setRemark] = useState(DEFAULT_DIRECT_REMARK);

  const normalizedMerchantId = merchantId?.trim() || "";
  const storeBalanceQueryKey = getFundAccountScopedBalanceQueryKey("store", storeId, {
    merchantId: normalizedMerchantId || null,
    storeId,
  });
  const merchantBalanceQueryKey = getFundAccountScopedBalanceQueryKey("merchant", normalizedMerchantId);

  const storeBalanceQuery = useQuery({
    queryKey: storeBalanceQueryKey,
    enabled: open && Boolean(storeId),
    queryFn: () => getStoreFundBalance(storeId, normalizedMerchantId || null),
    staleTime: 60 * 1000,
  });
  const merchantBalanceQuery = useQuery({
    queryKey: merchantBalanceQueryKey,
    enabled: open && Boolean(normalizedMerchantId),
    queryFn: () => getMerchantFundBalance(normalizedMerchantId),
    staleTime: 60 * 1000,
  });

  const storeBalance = storeBalanceQuery.data?.balance ?? 0;
  const merchantBalance = merchantBalanceQuery.data?.balance ?? 0;
  const currencyLabel = storeBalanceQuery.data?.currency?.trim()
    || merchantBalanceQuery.data?.currency?.trim()
    || "CNY";
  const hasMerchant = Boolean(normalizedMerchantId);

  useEffect(() => {
    if (!open) {
      setAmount("");
      setAction("direct");
      setRestoreToMerchant(true);
      setRemark(DEFAULT_DIRECT_REMARK);
      return;
    }
    const timer = window.setTimeout(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setRemark(defaultRemarkFor(action, restoreToMerchant));
    const timer = window.setTimeout(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [action, restoreToMerchant]);

  const focusAmountInput = () => {
    amountInputRef.current?.focus();
    amountInputRef.current?.select();
  };

  const parseAdjustAction = (value: string): AdjustAction => {
    if (value === "transfer") return "transfer";
    if (value === "deduct") return "deduct";
    return "direct";
  };

  const handleSubmit = async () => {
    if (!storeId) {
      notify.error("缺少门店主体，无法执行资金调整");
      return;
    }
    if (action === "transfer" && !hasMerchant) {
      notify.error("缺少归属商户，无法划转充值");
      return;
    }
    if (action === "deduct" && restoreToMerchant && !hasMerchant) {
      notify.error("缺少归属商户，无法回加商户余额");
      return;
    }

    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      notify.error(action === "direct"
            ? "请输入有效的门店充值金额"
            : action === "transfer"
              ? "请输入有效的划转金额"
              : "请输入有效的门店扣款金额");
      focusAmountInput();
      return;
    }
    if (action === "transfer" && amountValue > merchantBalance) {
      notify.error("商户余额不足，未完成门店充值");
      focusAmountInput();
      return;
    }
    if (action === "deduct" && amountValue > storeBalance) {
      notify.error("门店余额不足，无法完成扣款");
      focusAmountInput();
      return;
    }

    setSubmitting(true);
    try {
      if (action === "transfer") {
        await submitStoreTransferRecharge(storeId, {
          merchantId: normalizedMerchantId,
          amount: amountValue,
          remark: remark.trim() || undefined,
        });
      } else if (action === "direct") {
        await submitStoreDirectRecharge(storeId, {
          merchantId: normalizedMerchantId || undefined,
          amount: amountValue,
          remark: remark.trim() || undefined,
        });
      } else {
        await submitStoreFundDeduct(storeId, {
          merchantId: normalizedMerchantId || undefined,
          amount: amountValue,
          remark: remark.trim() || undefined,
          restoreToMerchant,
        });
      }

      await queryClient.invalidateQueries({ queryKey: storeBalanceQueryKey });
      if (hasMerchant) {
        await queryClient.invalidateQueries({ queryKey: merchantBalanceQueryKey });
      }
      await queryClient.invalidateQueries({ queryKey: ADMIN_FUND_LEDGERS_QUERY_KEY });

      const [refreshedStore, refreshedMerchant] = await Promise.all([
        storeBalanceQuery.refetch(),
        hasMerchant ? merchantBalanceQuery.refetch() : Promise.resolve(undefined),
      ]);
      onStoreBalanceUpdated?.(refreshedStore.data?.balance ?? storeBalance);
      if (hasMerchant) {
        onMerchantBalanceUpdated?.(refreshedMerchant?.data?.balance ?? merchantBalance);
      }
      setAmount("");
      setRemark(defaultRemarkFor(action, restoreToMerchant));
      notify.success(action === "direct"
            ? "门店充值成功"
            : action === "transfer"
              ? "商户划转成功"
              : restoreToMerchant
                ? "门店扣款并回加商户成功"
                : "门店扣款成功");
    } catch (error) {
      notify.error(action === "direct"
            ? "门店充值失败"
            : action === "transfer"
              ? "商户划转失败"
              : restoreToMerchant
                ? "门店扣款回加失败"
                : "门店扣款失败", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDisabled = submitting
    || !amount
    || !storeId
    || (action === "transfer" && (!hasMerchant || merchantBalanceQuery.isLoading))
    || storeBalanceQuery.isLoading;

  const amountLabel =
    action === "direct" ? "充值金额" : action === "transfer" ? "划转金额" : "扣款金额";
  const amountPlaceholder =
    action === "direct"
      ? "请输入要充值到门店的金额"
      : action === "transfer"
        ? "请输入要从商户划转到门店的金额"
        : "请输入要从门店扣减的金额";
  const remarkLabel =
    action === "direct" ? "充值备注" : action === "transfer" ? "划转备注" : "扣款备注";
  const remarkPlaceholder =
    action === "direct"
      ? "如：后台门店直接充值"
      : action === "transfer"
        ? "如：后台商户划转门店充值"
        : "如：后台门店扣款";
  const confirmLabel =
    action === "direct"
      ? "确认门店充值"
      : action === "transfer"
        ? "确认商户划转"
        : restoreToMerchant
          ? "确认扣款并回加商户"
          : "确认门店扣款";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>门店资金账户调整</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-1 py-2">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm text-muted-foreground">门店主体</div>
              <div className="mt-1 text-base font-medium">{storeName || storeId || "-"}</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <span>门店当前余额:</span>
                {storeBalanceQuery.isLoading || storeBalanceQuery.isFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : storeBalanceQuery.isError ? (
                  <span className="text-destructive">加载失败</span>
                ) : (
                  <span className="font-mono font-semibold text-foreground">{storeBalance.toFixed(2)}</span>
                )}
                <span>{currencyLabel}</span>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm text-muted-foreground">所属商户</div>
              <div className="mt-1 text-base font-medium">{merchantName || normalizedMerchantId || "未绑定商户"}</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <span>商户当前余额:</span>
                {!hasMerchant ? (
                  <span className="text-amber-600">缺少归属商户</span>
                ) : merchantBalanceQuery.isLoading || merchantBalanceQuery.isFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : merchantBalanceQuery.isError ? (
                  <span className="text-destructive">加载失败</span>
                ) : (
                  <>
                    <span className="font-mono font-semibold text-foreground">{merchantBalance.toFixed(2)}</span>
                    <span>{currencyLabel}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>调整方式</Label>
              <Tabs value={action} onValueChange={(value) => setAction(parseAdjustAction(value))}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="direct">门店充值</TabsTrigger>
                  <TabsTrigger value="transfer">商户划转</TabsTrigger>
                  <TabsTrigger value="deduct">余额扣减</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <Label>{amountLabel} ({currencyLabel})</Label>
              <Input
                ref={amountInputRef}
                type="number"
                min="0.01"
                step="0.01"
                placeholder={amountPlaceholder}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>

            {action === "deduct" ? (
              <div className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id="restore-to-merchant"
                  checked={restoreToMerchant}
                  onCheckedChange={(checked) => setRestoreToMerchant(checked === true)}
                  disabled={!hasMerchant}
                />
                <div className="space-y-1">
                  <label htmlFor="restore-to-merchant" className="text-sm font-medium leading-none">
                    回加商户余额
                  </label>
                  <p className="text-sm text-muted-foreground">
                    {hasMerchant ? "勾选后，门店扣减金额会同步回加到所属商户余额。" : "当前门店缺少归属商户，无法回加商户余额。"}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>{remarkLabel}</Label>
              <Input
                placeholder={remarkPlaceholder}
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={confirmDisabled}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
