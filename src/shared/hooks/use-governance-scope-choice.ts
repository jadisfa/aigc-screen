import { useEffect, useMemo, useRef, useState } from "react";
import { listMerchants, type Merchant } from "@/shared/api/ums/ums-merchant";
import { listStores, type Store } from "@/shared/api/ums/ums-store";
import { useSessionScope, type SessionScopeSummary } from "@/shared/hooks/use-session-scope";
import { normalizeScopeLevel } from "@/shared/lib/scope-level";

export type GovernanceOrgOption = { id: string; label: string };

export type GovernanceScopeIds = {
  merchantId: string | null;
  storeId: string | null;
  principalId: null;
};

export { normalizeScopeLevel };

/**
 * GLOBAL / 无锁定商户可选商户；MERCHANT 锁定商户可选门店；STORE 全锁定。
 * allowChoose=false 用于编辑态：作用域只读。
 */
export function sessionScopeChoiceFlags(
  scope: SessionScopeSummary,
  options?: {
    allowChoose?: boolean;
    extraFixedMerchantId?: string | null;
    extraFixedStoreId?: string | null;
  },
) {
  const allowChoose = options?.allowChoose ?? true;
  const scopeLevel = normalizeScopeLevel(scope.scopeLevel);
  const canChooseMerchant = allowChoose && (scopeLevel === "global" || !scope.merchantId);
  const canChooseStore = allowChoose && (canChooseMerchant || scopeLevel === "merchant");
  return {
    scopeLevel,
    canChooseMerchant,
    canChooseStore,
    fixedMerchantId: scope.merchantId || options?.extraFixedMerchantId || "",
    fixedStoreId: scope.storeId || options?.extraFixedStoreId || "",
  };
}

type UseGovernanceScopeChoiceOptions = {
  allowChoose?: boolean;
  extraFixedMerchantId?: string | null;
  extraFixedStoreId?: string | null;
  merchantId?: string;
  storeId?: string;
  onMerchantIdChange?: (id: string) => void;
  onStoreIdChange?: (id: string) => void;
  merchantLabel?: (item: Merchant) => string;
  storeLabel?: (item: Store) => string;
  onMerchantLoadError?: (error: unknown) => void;
  onStoreLoadError?: (error: unknown) => void;
  /** 商户为空时清空已选门店（筛选页/渠道编辑）。 */
  clearStoreWhenMerchantEmpty?: boolean;
  /** 默认仅 canChooseStore 时拉门店；模型池页锁定商户仍需门店列表。 */
  requireCanChooseStore?: boolean;
};

function defaultMerchantLabel(item: Merchant): string {
  const extraName = (item as Merchant & { merchantName?: string | null }).merchantName;
  return extraName || item.name || item.code || item.id;
}

function defaultStoreLabel(item: Store): string {
  const extraName = (item as Store & { storeName?: string | null }).storeName;
  return extraName || item.name || item.code || item.id;
}

/**
 * 加载商户/门店下拉并计算当前治理作用域。
 * 不传 merchantId 时内部持有筛选态；编辑表单可传入受控 merchantId/storeId。
 */
export function useGovernanceScopeChoice(options: UseGovernanceScopeChoiceOptions = {}) {
  const sessionScope = useSessionScope();
  const flags = sessionScopeChoiceFlags(sessionScope.scope, options);
  const controlled = options.merchantId !== undefined;
  const requireCanChooseStore = options.requireCanChooseStore ?? true;
  const clearStoreWhenMerchantEmpty = options.clearStoreWhenMerchantEmpty ?? false;
  const [internalMerchantId, setInternalMerchantId] = useState("");
  const [internalStoreId, setInternalStoreId] = useState("");
  const selectedMerchantId = controlled ? options.merchantId ?? "" : internalMerchantId;
  const selectedStoreId = controlled ? options.storeId ?? "" : internalStoreId;
  const setSelectedMerchantId = controlled
    ? (id: string) => options.onMerchantIdChange?.(id)
    : setInternalMerchantId;
  const setSelectedStoreId = controlled
    ? (id: string) => options.onStoreIdChange?.(id)
    : setInternalStoreId;

  const merchantLabelRef = useRef(options.merchantLabel ?? defaultMerchantLabel);
  const storeLabelRef = useRef(options.storeLabel ?? defaultStoreLabel);
  const onMerchantLoadErrorRef = useRef(options.onMerchantLoadError);
  const onStoreLoadErrorRef = useRef(options.onStoreLoadError);
  const setSelectedStoreIdRef = useRef(setSelectedStoreId);
  merchantLabelRef.current = options.merchantLabel ?? defaultMerchantLabel;
  storeLabelRef.current = options.storeLabel ?? defaultStoreLabel;
  onMerchantLoadErrorRef.current = options.onMerchantLoadError;
  onStoreLoadErrorRef.current = options.onStoreLoadError;
  setSelectedStoreIdRef.current = setSelectedStoreId;

  const [merchantOptions, setMerchantOptions] = useState<GovernanceOrgOption[]>([]);
  const [storeOptions, setStoreOptions] = useState<GovernanceOrgOption[]>([]);

  const { canChooseMerchant, canChooseStore, fixedMerchantId, fixedStoreId } = flags;
  const activeMerchantId = (canChooseMerchant ? selectedMerchantId : fixedMerchantId).trim();

  useEffect(() => {
    if (!canChooseMerchant) {
      setMerchantOptions([]);
      return;
    }
    void listMerchants({ pageNo: 1, pageSize: 200 })
      .then((result) =>
        setMerchantOptions(result.items.map((item) => ({ id: item.id, label: merchantLabelRef.current(item) }))),
      )
      .catch((error) => {
        setMerchantOptions([]);
        onMerchantLoadErrorRef.current?.(error);
      });
  }, [canChooseMerchant]);

  useEffect(() => {
    const canListStores = requireCanChooseStore ? canChooseStore : Boolean(activeMerchantId);
    if (!canListStores || !activeMerchantId) {
      setStoreOptions([]);
      if (!activeMerchantId && clearStoreWhenMerchantEmpty) {
        setSelectedStoreIdRef.current("");
      }
      return;
    }
    void listStores({ merchantId: activeMerchantId, pageNo: 1, pageSize: 200 })
      .then((result) =>
        setStoreOptions(result.items.map((item) => ({ id: item.id, label: storeLabelRef.current(item) }))),
      )
      .catch((error) => {
        setStoreOptions([]);
        onStoreLoadErrorRef.current?.(error);
      });
  }, [activeMerchantId, canChooseStore, clearStoreWhenMerchantEmpty, requireCanChooseStore]);

  const activeScope = useMemo<GovernanceScopeIds>(
    () => ({
      merchantId: (canChooseMerchant ? selectedMerchantId : fixedMerchantId) || null,
      storeId: (canChooseStore ? selectedStoreId : fixedStoreId) || null,
      principalId: null,
    }),
    [canChooseMerchant, canChooseStore, fixedMerchantId, fixedStoreId, selectedMerchantId, selectedStoreId],
  );

  const isPlatformScoped = !activeScope.merchantId?.trim() && !activeScope.storeId?.trim();

  return {
    sessionScope,
    ...flags,
    selectedMerchantId,
    selectedStoreId,
    setSelectedMerchantId,
    setSelectedStoreId,
    merchantOptions,
    storeOptions,
    activeMerchantId,
    activeScope,
    isPlatformScoped,
  };
}

export type GovernanceScopeChoice = ReturnType<typeof useGovernanceScopeChoice>;
