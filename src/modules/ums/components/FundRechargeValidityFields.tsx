import { useMemo } from "react";
import { DatePicker } from "@/shared/components/DatePicker";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";

export type FundRechargeValidityMode = "permanent" | "expire_at";

export type FundRechargeValidityState = {
  mode: FundRechargeValidityMode;
  /** yyyy-MM-dd，仅 mode=expire_at 时有意义 */
  expireDate: string;
};

export const DEFAULT_FUND_RECHARGE_VALIDITY: FundRechargeValidityState = {
  mode: "permanent",
  expireDate: "",
};

/** 将本地日期转为当天结束时刻（Asia/Shanghai）的 ISO Instant。 */
export function toFundRechargeExpireAtIso(dateYmd: string): string | null {
  const normalized = dateYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }
  const instant = new Date(`${normalized}T23:59:59.999+08:00`);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }
  return instant.toISOString();
}

export function resolveFundRechargeExpireAt(
  state: FundRechargeValidityState,
): { expireAt: string | null; error?: string } {
  if (state.mode !== "expire_at") {
    return { expireAt: null };
  }
  if (!state.expireDate.trim()) {
    return { expireAt: null, error: "请选择到期日期" };
  }
  const expireAt = toFundRechargeExpireAtIso(state.expireDate);
  if (!expireAt) {
    return { expireAt: null, error: "到期日期格式无效" };
  }
  if (new Date(expireAt).getTime() <= Date.now()) {
    return { expireAt: null, error: "到期日期必须晚于当前时间" };
  }
  return { expireAt };
}

type FundRechargeValidityFieldsProps = {
  value: FundRechargeValidityState;
  onChange: (next: FundRechargeValidityState) => void;
  disabled?: boolean;
  /** 仅说明文案，不展示选择器（如门店划转继承商户 Lot） */
  inheritOnly?: boolean;
  inheritHint?: string;
};

export function FundRechargeValidityFields({
  value,
  onChange,
  disabled,
  inheritOnly,
  inheritHint,
}: FundRechargeValidityFieldsProps) {
  const minDate = useMemo(() => {
    const now = new Date();
    const shanghai = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
    shanghai.setDate(shanghai.getDate() + 1);
    const y = shanghai.getFullYear();
    const m = String(shanghai.getMonth() + 1).padStart(2, "0");
    const d = String(shanghai.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const expireEnabled = value.mode === "expire_at";

  if (inheritOnly) {
    return (
      <div className="space-y-2">
        <Label>到账有效期</Label>
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {inheritHint
            || "划转充值将继承商户侧被扣额度 Lot 的有效期（永久/到期日随源 Lot），无需在此单独配置。"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
        <div className="space-y-0.5">
          <Label htmlFor="fund-recharge-expire-switch">指定到期日</Label>
          <p className="text-xs text-muted-foreground">
            {expireEnabled ? "开启后请选择到期日期" : "关闭表示本笔充值永久有效"}
          </p>
        </div>
        <Switch
          id="fund-recharge-expire-switch"
          checked={expireEnabled}
          disabled={disabled}
          onCheckedChange={(checked) =>
            onChange({
              ...value,
              mode: checked ? "expire_at" : "permanent",
              expireDate: checked ? value.expireDate : "",
            })
          }
        />
      </div>
      {expireEnabled ? (
        <div className="space-y-2">
          <Label>到期日期</Label>
          <DatePicker
            value={value.expireDate}
            onChange={(expireDate) => onChange({ ...value, expireDate })}
            placeholder="选择到期日"
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            按北京时间当天 23:59:59 到期；不早于 {minDate}。
          </p>
        </div>
      ) : null}
    </div>
  );
}
