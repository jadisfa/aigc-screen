import { memo, useCallback, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/shared/ui/button";
import {
  beginOtpCooldown,
  remainingOtpCooldown,
  subscribeOtpCooldown,
  type OtpChannel,
} from "./otpCooldown";
import { SOFT_OTP_BTN } from "./loginTheme";

type OtpSendButtonProps = {
  channel: OtpChannel;
  /** 返回 false 表示未发送（校验失败或接口失败），不进入冷却 */
  onSend: () => Promise<boolean | void>;
  disabled?: boolean;
};

export const OtpSendButton = memo(function OtpSendButton({ channel, onSend, disabled }: OtpSendButtonProps) {
  const [sending, setSending] = useState(false);
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeOtpCooldown(channel, onStoreChange),
    [channel],
  );
  const getSnapshot = useCallback(() => remainingOtpCooldown(channel), [channel]);
  const cooldown = useSyncExternalStore(subscribe, getSnapshot, () => 0);
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;

  const busy = sending || cooldown > 0;

  const handleClick = async () => {
    if (disabled || busy) return;
    setSending(true);
    try {
      const ok = await onSendRef.current();
      if (ok === false) return;
      beginOtpCooldown(channel);
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={SOFT_OTP_BTN}
      onClick={() => void handleClick()}
      disabled={disabled || busy}
      aria-busy={sending}
    >
      {sending ? "发送中…" : cooldown > 0 ? `${cooldown}s 后重发` : "获取验证码"}
    </Button>
  );
});
