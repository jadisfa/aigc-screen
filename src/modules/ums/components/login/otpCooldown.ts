export type OtpChannel = "sms" | "email";

const CHANNELS: OtpChannel[] = ["sms", "email"];
const SMS_UNTIL_STORAGE_KEY = "aigc.login.otp.sms.until";
export const OTP_SMS_COOLDOWN_SECONDS = 60;

const endsAt: Record<OtpChannel, number> = { sms: 0, email: 0 };
const lastShown: Record<OtpChannel, number> = { sms: 0, email: 0 };
const listeners: Record<OtpChannel, Set<() => void>> = {
  sms: new Set(),
  email: new Set(),
};

let ticker: number | null = null;

function readStoredSmsUntil(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(SMS_UNTIL_STORAGE_KEY);
    const until = raw ? Number(raw) : 0;
    if (!Number.isFinite(until) || until <= Date.now()) {
      if (raw) window.localStorage.removeItem(SMS_UNTIL_STORAGE_KEY);
      return 0;
    }
    return until;
  } catch {
    return 0;
  }
}

function persistSmsUntil(until: number) {
  if (typeof window === "undefined") return;
  try {
    if (until > Date.now()) {
      window.localStorage.setItem(SMS_UNTIL_STORAGE_KEY, String(until));
    } else {
      window.localStorage.removeItem(SMS_UNTIL_STORAGE_KEY);
    }
  } catch {
    // private mode / quota
  }
}

export function remainingOtpCooldown(channel: OtpChannel): number {
  const until = endsAt[channel];
  if (until <= 0) return 0;
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

function emit(channel: OtpChannel) {
  listeners[channel].forEach((fn) => fn());
}

function tick() {
  let active = false;
  for (const channel of CHANNELS) {
    const next = remainingOtpCooldown(channel);
    if (next > 0) active = true;
    if (next !== lastShown[channel]) {
      lastShown[channel] = next;
      emit(channel);
    }
    if (channel === "sms" && next === 0 && endsAt.sms > 0 && endsAt.sms <= Date.now()) {
      endsAt.sms = 0;
      persistSmsUntil(0);
    }
  }
  if (!active && ticker != null) {
    window.clearInterval(ticker);
    ticker = null;
  }
}

function ensureTicker() {
  if (ticker != null) return;
  ticker = window.setInterval(tick, 1000);
}

export function beginOtpCooldown(channel: OtpChannel, seconds = OTP_SMS_COOLDOWN_SECONDS) {
  endsAt[channel] = Date.now() + seconds * 1000;
  lastShown[channel] = Math.max(0, seconds);
  if (channel === "sms") persistSmsUntil(endsAt.sms);
  emit(channel);
  ensureTicker();
}

export function subscribeOtpCooldown(channel: OtpChannel, onStoreChange: () => void): () => void {
  listeners[channel].add(onStoreChange);
  if (remainingOtpCooldown(channel) > 0) ensureTicker();
  return () => {
    listeners[channel].delete(onStoreChange);
  };
}

const storedSmsUntil = readStoredSmsUntil();
if (storedSmsUntil > 0) {
  endsAt.sms = storedSmsUntil;
  lastShown.sms = remainingOtpCooldown("sms");
}
