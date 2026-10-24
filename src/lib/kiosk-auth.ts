import {
  applyVerifiedDeviceContext,
  bootstrapDevice,
  discardMismatchedDevice,
  fetchDeviceContext,
  hasConfiguredDeviceCode,
  isDeviceUnauthorized,
  retryVerify,
} from "@/lib/device-auth";
import { clearStoreCache } from "@/data/store";
import {
  clearDeviceContext,
  clearDeviceSession,
  getFreshDeviceContext,
  isAccessTokenFresh,
  loadDeviceCodeFromFile,
} from "@/lib/device-session";
import { refreshDeviceSession, ScreenHttpError } from "@/lib/screen-http";

export type KioskAuthState = "authorized" | "unauthorized" | "unavailable";

let inFlight: Promise<KioskAuthState> | null = null;
/** 本进程只在启动时重签一次。续票会把旧主体一直带下去。 */
let deviceSessionReady = false;

export async function ensureKioskAuthorized(): Promise<boolean> {
  return (await resolveKioskAuth()) === "authorized";
}

export async function resolveKioskAuth(): Promise<KioskAuthState> {
  if (!inFlight) {
    inFlight = doEnsure().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function doEnsure(): Promise<KioskAuthState> {
  await loadDeviceCodeFromFile();
  discardMismatchedDevice();
  if (!hasConfiguredDeviceCode()) {
    rejectLocalAuth();
    return "unauthorized";
  }

  if (!deviceSessionReady) {
    const reset = await bootstrapWithRetry();
    if (reset !== "authorized") {
      return reset;
    }
    deviceSessionReady = true;
    if (getFreshDeviceContext() && isAccessTokenFresh()) {
      return "authorized";
    }
    return refreshContext();
  }

  const cached = getFreshDeviceContext();
  if (cached && isAccessTokenFresh()) {
    return "authorized";
  }

  if (!isAccessTokenFresh()) {
    const recovered = await recoverAccessToken();
    if (recovered !== "authorized") {
      return recovered;
    }
    if (getFreshDeviceContext() && isAccessTokenFresh()) {
      return "authorized";
    }
  }

  return refreshContext();
}

async function recoverAccessToken(): Promise<KioskAuthState> {
  if (await refreshDeviceSession()) {
    return "authorized";
  }
  return bootstrapWithRetry();
}

async function bootstrapWithRetry(): Promise<KioskAuthState> {
  try {
    await retryVerify(() => bootstrapDevice());
    return "authorized";
  } catch (error) {
    if (isDeviceUnauthorized(error)) {
      rejectLocalAuth();
      return "unauthorized";
    }
    if (getFreshDeviceContext() && isAccessTokenFresh()) {
      return "authorized";
    }
    return "unavailable";
  }
}

async function refreshContext(): Promise<KioskAuthState> {
  try {
    applyVerifiedDeviceContext(await retryVerify(() => fetchDeviceContext()));
    return "authorized";
  } catch (error) {
    if (isDeviceUnauthorized(error)) {
      rejectLocalAuth();
      return "unauthorized";
    }
    if (error instanceof ScreenHttpError && error.status === 401) {
      return recoverExpiredSession();
    }
    if (getFreshDeviceContext() && isAccessTokenFresh()) {
      return "authorized";
    }
    return "unavailable";
  }
}

async function recoverExpiredSession(): Promise<KioskAuthState> {
  try {
    if (!(await refreshDeviceSession())) {
      await retryVerify(() => bootstrapDevice());
    }
    applyVerifiedDeviceContext(await retryVerify(() => fetchDeviceContext()));
    return "authorized";
  } catch (error) {
    if (isDeviceUnauthorized(error)) {
      rejectLocalAuth();
      return "unauthorized";
    }
    if (getFreshDeviceContext() && isAccessTokenFresh()) {
      return "authorized";
    }
    return "unavailable";
  }
}

function rejectLocalAuth(): void {
  clearDeviceSession();
  clearDeviceContext();
  clearStoreCache();
}
