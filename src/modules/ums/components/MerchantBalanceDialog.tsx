import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  ADMIN_FUND_LEDGERS_QUERY_KEY,
  getFundAccountScopedBalanceQueryKey,
  getMerchantFundBalance,
  submitMerchantFundDeduct,
  submitMerchantFundRecharge,
} from "@/shared/api/fund/admin-fund";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { notify } from "@/shared/lib/notify";

const DEFAULT_RECHARGE_REMARK = "后台商户充值";
const DEFAULT_DEDUCT_REMARK = "后台商户扣款";

export interface MerchantBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantId: string;
  merchantName: string;
  onBalanceUpdated?: (balance: number) => void;
}

export default function MerchantBalanceDialog({
  open,
  onOpenChange,
  merchantId,
  merchantName,
  onBalanceUpdated,
}: MerchantBalanceDialogProps) {
  const queryClient = useQueryClient();
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState(DEFAULT_RECHARGE_REMARK);
  const [action, setAction] = useState<"recharge" | "deduct">("recharge");

  const balanceQueryKey = getFundAccountScopedBalanceQueryKey("merchant", merchantId);
  const balanceQuery = useQuery({
    queryKey: balanceQueryKey,
    enabled: open && Boolean(merchantId),
    queryFn: () => getMerchantFundBalance(merchantId),
    staleTime: 60 * 1000,
  });

  const currentBalance = balanceQuery.data?.balance ?? 0;
  const currencyLabel = balanceQuery.data?.currency?.trim() || "CNY";

  useEffect(() => {
    if (!open) {
      setAmount("");
      setAction("recharge");
      setRemark(DEFAULT_RECHARGE_REMARK);
      return;
    }
    const timer = window.setTimeout(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setRemark(action === "deduct" ? DEFAULT_DEDUCT_REMARK : DEFAULT_RECHARGE_REMARK);
    const timer = window.setTimeout(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [action]);

  const focusAmountInput = () => {
    amountInputRef.current?.focus();
    amountInputRef.current?.select();
  };

  const handleSubmit = async () => {
    if (!merchantId) {
      notify.error("缺少商户主体，无法执行资金调整");
      return;
    }

    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      notify.error(action === "deduct" ? "请输入有效的商户扣款金额" : "请输入有效的商户充值金额");
      focusAmountInput();
      return;
    }

    setSubmitting(true);
    try {
      const result = action === "deduct"
        ? await submitMerchantFundDeduct(merchantId, {
            amount: amountValue,
            remark: remark.trim() || undefined,
          })
        : await submitMerchantFundRecharge(merchantId, {
            amount: amountValue,
            remark: remark.trim() || undefined,
          });
      await queryClient.invalidateQueries({ queryKey: balanceQueryKey });
      await queryClient.invalidateQueries({ queryKey: ADMIN_FUND_LEDGERS_QUERY_KEY });
      const refreshed = await balanceQuery.refetch();
      onBalanceUpdated?.(refreshed.data?.balance ?? result.balanceAfter);
      setAmount("");
      setRemark(action === "deduct" ? DEFAULT_DEDUCT_REMARK : DEFAULT_RECHARGE_REMARK);
      notify.success(action === "deduct" ? "商户扣款成功" : "商户充值成功");
    } catch (error) {
      notify.error(action === "deduct" ? "商户扣款失败" : "商户充值失败", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>商户资金账户调整</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-1 py-2">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="text-base font-medium">{merchantName || merchantId || "-"}</div>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span>当前商户余额:</span>
              {balanceQuery.isLoading || balanceQuery.isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : balanceQuery.isError ? (
                <span className="text-destructive">加载失败</span>
              ) : (
                <span className="font-mono font-semibold text-foreground">{currentBalance.toFixed(2)}</span>
              )}
              <span>{currencyLabel}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>调整方式</Label>
              <Tabs value={action} onValueChange={(value) => setAction(value === "deduct" ? "deduct" : "recharge")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="recharge">商户余额充值</TabsTrigger>
                  <TabsTrigger value="deduct">商户余额扣减</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <Label>{action === "deduct" ? "商户扣款金额" : "商户充值金额"} ({currencyLabel})</Label>
              <Input
                ref={amountInputRef}
                type="number"
                min="0.01"
                step="0.01"
                placeholder={action === "deduct" ? "请输入要扣减的商户金额" : "请输入要充值的商户金额"}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{action === "deduct" ? "扣款备注" : "充值备注"}</Label>
              <Input
                placeholder={action === "deduct" ? "如：后台商户扣款" : "如：后台商户充值"}
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
          <Button onClick={handleSubmit} disabled={submitting || !merchantId || !amount}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {action === "deduct" ? "确认商户扣款" : "确认商户充值"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
