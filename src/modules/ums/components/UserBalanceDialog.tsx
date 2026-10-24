import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import {
  ADMIN_FUND_LEDGERS_QUERY_KEY,
  getFundAccountBalance,
  getFundAccountScopedBalanceQueryKey,
  inferFundUserSubjectScope,
  resolveFundUserOwnerId,
  submitManualFundDeduct,
  submitManualFundRecharge,
} from "@/shared/api/fund/admin-fund";
import { Loader2 } from "lucide-react";
import { getUserAvatarFallback, resolveUserAvatarUrl } from "@/shared/lib/user-avatar";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  DEFAULT_FUND_RECHARGE_VALIDITY,
  FundRechargeValidityFields,
  resolveFundRechargeExpireAt,
  type FundRechargeValidityState,
} from "@/modules/ums/components/FundRechargeValidityFields";
import { notify } from "@/shared/lib/notify";

const DEFAULT_REMARK = "后台人工充值";
const DEFAULT_DEDUCT_REMARK = "后台人工扣减";

export interface UserBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  principalId: string;
  merchantId?: string;
  storeId?: string;
  nickname: string;
  avatarUrl: string;
  onBalanceUpdated?: (balance: number) => void;
}

export default function UserBalanceDialog({
  open,
  onOpenChange,
  principalId,
  merchantId,
  storeId,
  nickname,
  avatarUrl,
  onBalanceUpdated,
}: UserBalanceDialogProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [remark, setRemark] = useState<string>(DEFAULT_REMARK);
  const [action, setAction] = useState<"recharge" | "deduct">("recharge");
  const [validity, setValidity] = useState<FundRechargeValidityState>(DEFAULT_FUND_RECHARGE_VALIDITY);

  const ownerType = "user";
  const ownerId = resolveFundUserOwnerId(principalId);
  const fundScope = {
    subjectScope: inferFundUserSubjectScope({ merchantId: merchantId ?? null, storeId: storeId ?? null }),
    merchantId: merchantId ?? null,
    storeId: storeId ?? null,
  };
  const balanceQueryKey = getFundAccountScopedBalanceQueryKey(ownerType, ownerId, fundScope);
  const balanceQuery = useQuery({
    queryKey: balanceQueryKey,
    enabled: open && Boolean(ownerId),
    queryFn: () => getFundAccountBalance(ownerType, ownerId, fundScope),
    staleTime: 60 * 1000,
  });
  const currentBalance = balanceQuery.data?.balance ?? 0;
  const currencyLabel = balanceQuery.data?.currency?.trim() || "CNY";

  useEffect(() => {
    if (!open) {
      setAmount("");
      setRemark(DEFAULT_REMARK);
      setAction("recharge");
      setValidity(DEFAULT_FUND_RECHARGE_VALIDITY);
    }
  }, [open]);

  useEffect(() => {
    setRemark(action === "deduct" ? DEFAULT_DEDUCT_REMARK : DEFAULT_REMARK);
    if (action === "recharge") {
      setValidity(DEFAULT_FUND_RECHARGE_VALIDITY);
    }
  }, [action]);

  const handleSubmit = async () => {
    if (!ownerId) {
      notify.error("缺少资金账户主体，无法执行充值");
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      notify.error("请输入有效的充值金额");
      return;
    }

    let expireAt: string | null | undefined;
    if (action === "recharge") {
      const resolved = resolveFundRechargeExpireAt(validity);
      if (resolved.error) {
        notify.error(resolved.error);
        return;
      }
      expireAt = resolved.expireAt;
    }

    setSubmitting(true);
    try {
      const result = action === "deduct"
        ? await submitManualFundDeduct(ownerType, ownerId, {
            amount: amountNum,
            remark: remark.trim() || undefined,
          }, fundScope)
        : await submitManualFundRecharge(ownerType, ownerId, {
            amount: amountNum,
            remark: remark.trim() || undefined,
            expireAt,
          }, fundScope);
      await queryClient.invalidateQueries({ queryKey: balanceQueryKey });
      await queryClient.invalidateQueries({ queryKey: ADMIN_FUND_LEDGERS_QUERY_KEY });
      const refreshed = await balanceQuery.refetch();
      const balance = refreshed.data?.balance ?? result.balanceAfter;
      onBalanceUpdated?.(balance);
      setAmount("");
      setRemark(action === "deduct" ? DEFAULT_DEDUCT_REMARK : DEFAULT_REMARK);
      setValidity(DEFAULT_FUND_RECHARGE_VALIDITY);
      notify.success(action === "deduct" ? "手工扣减成功" : "手工充值成功");
    } catch (e) {
      notify.error(action === "deduct" ? "手工扣减失败" : "手工充值失败", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[575px]">
        <DialogHeader>
          <DialogTitle>用户资金账户调整</DialogTitle>
        </DialogHeader>

        <div className="py-6 px-4 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border">
              <AvatarImage src={resolveUserAvatarUrl(avatarUrl, nickname || String(ownerId), 64)} alt={nickname} className="object-cover" />
              <AvatarFallback>{getUserAvatarFallback(nickname || ownerId)}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="font-medium">{nickname}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                当前资金余额:
                {balanceQuery.isLoading || balanceQuery.isFetching ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : balanceQuery.isError ? (
                  <span className="text-destructive">加载失败</span>
                ) : (
                  <span className="text-foreground font-semibold font-mono">
                    {currentBalance.toFixed(2)}
                  </span>
                )}
                <span>{currencyLabel}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>调整方式</Label>
              <Tabs value={action} onValueChange={(value) => setAction(value === "deduct" ? "deduct" : "recharge")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="recharge">余额充值</TabsTrigger>
                  <TabsTrigger value="deduct">余额扣减</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <Label>{action === "deduct" ? "扣减金额" : "充值金额"} ({currencyLabel})</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder={action === "deduct" ? "请输入要扣减的金额" : "请输入要充值的金额"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {action === "recharge" ? (
              <FundRechargeValidityFields
                value={validity}
                onChange={setValidity}
                disabled={submitting}
              />
            ) : null}

            <div className="space-y-2">
              <Label>{action === "deduct" ? "扣减备注" : "充值备注"}</Label>
              <Input
                placeholder={action === "deduct" ? "如：后台人工扣减" : "如：后台人工充值"}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !amount || !ownerId}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {action === "deduct" ? "确认扣减" : "确认充值"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
