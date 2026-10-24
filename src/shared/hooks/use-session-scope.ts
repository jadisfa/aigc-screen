import { useMemo } from "react";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";

export type SessionScopeSummary = {
  sessionId: string | null;
  scopeKey: string | null;
  scopeLevel: string | null;
  merchantId: string | null;
  storeId: string | null;
  queryScopeKey: string;
};

export type SessionScopeParams = {
  merchantId?: string;
  storeId?: string;
};

function normalizeValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function buildScopedHashKey(queryScopeKey: string, fileHash: string) {
  return `${queryScopeKey}:${fileHash}`;
}

export function toSessionScopeParams(scope: SessionScopeSummary): SessionScopeParams {
  return {
    ...(scope.merchantId ? { merchantId: scope.merchantId } : {}),
    ...(scope.storeId ? { storeId: scope.storeId } : {}),
  };
}

export function withSessionScope<T extends object>(scope: SessionScopeSummary, payload: T): T & SessionScopeParams {
  return {
    ...toSessionScopeParams(scope),
    ...payload,
  };
}

export function getSessionScopeReadyError(sessionScope: {
  isLoading: boolean;
  isError: boolean;
  fetchStatus: string;
  data?: unknown;
}): string | null {
  if (sessionScope.isLoading || (!sessionScope.data && sessionScope.fetchStatus === "fetching")) {
    return "当前会话作用域加载中，请稍后重试";
  }
  if (sessionScope.isError) {
    return "当前会话作用域加载失败，请刷新后重试";
  }
  return null;
}

export function useSessionScope() {
  const meQuery = useMePermissions();

  const scope = useMemo<SessionScopeSummary>(() => {
    const sessionId = normalizeValue(meQuery.data?.sessionId);
    const scopeKey = normalizeValue(meQuery.data?.scopeKey);
    const scopeLevel = normalizeValue(meQuery.data?.scopeLevel);
    const merchantId = normalizeValue(meQuery.data?.merchantId);
    const storeId = normalizeValue(meQuery.data?.storeId);
    const queryScopeKey = `${sessionId ?? "session:none"}|${scopeKey ?? "scope:none"}`;
    return {
      sessionId,
      scopeKey,
      scopeLevel,
      merchantId,
      storeId,
      queryScopeKey,
    };
  }, [
    meQuery.data?.merchantId,
    meQuery.data?.scopeKey,
    meQuery.data?.scopeLevel,
    meQuery.data?.sessionId,
    meQuery.data?.storeId,
  ]);

  return {
    ...meQuery,
    scope,
  };
}
