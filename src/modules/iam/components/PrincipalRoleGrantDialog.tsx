import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Search, Shield, Trash2 } from "lucide-react";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import {
  listPrincipalRoles,
  listRoles,
  updatePrincipalRoles,
  type RoleGrant,
  type RoleView,
} from "@/shared/api/ums/iam";
import { getMerchant, listMerchants, type Merchant } from "@/shared/api/ums/ums-merchant";
import { getStore, listStores, type Store } from "@/shared/api/ums/ums-store";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  buildDefaultRoleGrant,
  getRbacSourceLabel,
  getRoleScopeLabel,
  normalizeGrantScopeLevel,
  normalizeRoleGrant,
  ROLE_SCOPE_OPTIONS,
  RBAC_SOURCE_OPTIONS,
  toRoleKey,
} from "@/modules/iam/lib/rbac";
import { affiliationGrantConflictMessage, alignRoleGrantToAffiliation, canAssignRoleForAffiliation, grantScopeLevelForPrivilege, resolveRolePrivilegeLevel } from "@/shared/lib/role-privilege";
import { notify } from "@/shared/lib/notify";

type EditableRoleGrant = RoleGrant & {
  grantId: string;
};

type CatalogRole = {
  roleKey: string;
  name: string;
  code: string;
  sourceCode: string;
  sourceLabel: string;
  scopeLabel: string;
};

export type PrincipalRoleGrantUser = {
  id: string;
  principalId?: string;
  merchantId?: string;
  storeId?: string;
  nickname?: string;
  displayName?: string;
  realName?: string;
  roles?: string[];
};

type PrincipalRoleGrantDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: PrincipalRoleGrantUser | null;
  onSaved?: () => void;
};

const ROLE_ROW_PX = 56;
const ROLE_OVERSCAN = 10;

function stubMerchant(id: string): Merchant {
  return { id, code: id, name: id };
}

function stubStore(id: string, merchantId: string): Store {
  return { id, code: id, name: id, merchantId };
}

const RoleCatalogRow = memo(function RoleCatalogRow(props: {
  role: CatalogRole;
  checked: boolean;
  onToggle: (roleKey: string) => void;
}) {
  const { role, checked, onToggle } = props;
  const inputId = `principal-role-${role.roleKey}`;
  return (
    <label
      htmlFor={inputId}
      className="flex h-[56px] cursor-pointer items-center gap-3 border-b border-border/60 px-2.5 hover:bg-muted/40"
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(role.roleKey)}
        className="h-4 w-4 shrink-0 accent-foreground"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{role.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {role.sourceLabel} · {role.scopeLabel} · {role.sourceCode}:{role.code}
        </div>
      </div>
    </label>
  );
});

const RoleCatalogList = memo(function RoleCatalogList(props: {
  roles: CatalogRole[];
  selectedRoleKeySet: Set<string>;
  onToggle: (roleKey: string) => void;
}) {
  const { roles, selectedRoleKeySet, onToggle } = props;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 24 });

  const syncRange = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const start = Math.max(0, Math.floor(el.scrollTop / ROLE_ROW_PX) - ROLE_OVERSCAN);
    const visible = Math.ceil(el.clientHeight / ROLE_ROW_PX) + ROLE_OVERSCAN * 2;
    const end = Math.min(roles.length, start + Math.max(visible, 1));
    setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [roles.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) {
      el.scrollTop = 0;
    }
    syncRange();
  }, [roles, syncRange]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(() => syncRange());
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncRange]);

  const visibleRoles = roles.slice(range.start, range.end);

  return (
    <div
      ref={scrollerRef}
      className="min-h-0 flex-1 overflow-y-auto pr-1"
      onScroll={syncRange}
    >
      <div style={{ height: roles.length * ROLE_ROW_PX }} className="relative">
        <div className="absolute inset-x-0" style={{ transform: `translateY(${range.start * ROLE_ROW_PX}px)` }}>
          {visibleRoles.map((role) => (
            <RoleCatalogRow
              key={role.roleKey}
              role={role}
              checked={selectedRoleKeySet.has(role.roleKey)}
              onToggle={onToggle}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

export default function PrincipalRoleGrantDialog(props: PrincipalRoleGrantDialogProps) {
  const { open, onOpenChange, user, onSaved } = props;
  const grantSequenceRef = useRef(0);
  const storeLoadedRef = useRef(new Set<string>());
  const storeInflightRef = useRef(new Set<string>());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleView[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [storeOptionsByMerchant, setStoreOptionsByMerchant] = useState<Record<string, Store[]>>({});
  const [roleGrantDrafts, setRoleGrantDrafts] = useState<EditableRoleGrant[]>([]);
  const [keyword, setKeyword] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");

  const affiliationMerchantId = user?.merchantId?.trim() || "";
  const affiliationStoreId = user?.storeId?.trim() || "";

  const buildEditableGrant = useCallback((grant: RoleGrant): EditableRoleGrant => {
    grantSequenceRef.current += 1;
    return {
      grantId: `grant-${grantSequenceRef.current}`,
      ...normalizeRoleGrant(grant),
    };
  }, []);

  const ensureStoreOptionsLoaded = useCallback((merchantId?: string | null, lockedStoreId?: string | null) => {
    const normalizedMerchantId = merchantId?.trim();
    if (!normalizedMerchantId) {
      return;
    }
    if (storeLoadedRef.current.has(normalizedMerchantId) || storeInflightRef.current.has(normalizedMerchantId)) {
      return;
    }
    storeInflightRef.current.add(normalizedMerchantId);
    const preferredStoreId = lockedStoreId?.trim();
    const request = preferredStoreId
      ? getStore(preferredStoreId)
        .then((store) => (store ? [store] : [stubStore(preferredStoreId, normalizedMerchantId)]))
        .catch(() => [stubStore(preferredStoreId, normalizedMerchantId)])
      : listStores({ merchantId: normalizedMerchantId, pageNo: 1, pageSize: 200 })
        .then((res) => res.items ?? []);

    void request
      .then((items) => {
        storeLoadedRef.current.add(normalizedMerchantId);
        setStoreOptionsByMerchant((latest) => ({
          ...latest,
          [normalizedMerchantId]: items,
        }));
      })
      .catch(() => {
        notify.error("门店列表加载失败", { description: "无法加载当前商户的门店选项，请稍后重试" });
      })
      .finally(() => {
        storeInflightRef.current.delete(normalizedMerchantId);
      });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFormError(null);

    const loadMerchants = affiliationMerchantId
      ? getMerchant(affiliationMerchantId)
        .then((merchant) => [merchant])
        .catch(() => [stubMerchant(affiliationMerchantId)])
      : listMerchants({ pageNo: 1, pageSize: 200 }).then((res) => res.items ?? []);

    const load = async () => {
      try {
        const [roleList, grants, merchantItems] = await Promise.all([
          listRoles(),
          user?.principalId ? listPrincipalRoles(undefined, user.principalId) : Promise.resolve([] as RoleGrant[]),
          loadMerchants,
        ]);
        if (cancelled) {
          return;
        }
        const nextRoles = roleList ?? [];
        const roleByKey = new Map(nextRoles.map((role) => [toRoleKey(role.sourceCode, role.code), role]));
        grantSequenceRef.current = 0;
        setRoles(nextRoles);
        setMerchants(merchantItems);
        setRoleGrantDrafts((grants ?? []).map((grant) => {
          const role = roleByKey.get(toRoleKey(grant.sourceCode, grant.roleCode));
          const aligned = alignRoleGrantToAffiliation(grant, role, user?.merchantId, user?.storeId);
          return buildEditableGrant({ ...grant, ...aligned });
        }));
      } catch (err) {
        if (!cancelled) {
          notify.error("授权数据加载失败", { description: resolveUserErrorMessage(err, "无法加载角色授权信息") });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [affiliationMerchantId, buildEditableGrant, open, user?.merchantId, user?.principalId, user?.storeId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const merchantIds = new Set<string>();
    if (affiliationMerchantId) {
      merchantIds.add(affiliationMerchantId);
    }
    roleGrantDrafts.forEach((grant) => {
      const merchantId = grant.merchantId?.trim();
      if (merchantId) {
        merchantIds.add(merchantId);
      }
    });
    merchantIds.forEach((merchantId) => ensureStoreOptionsLoaded(merchantId, affiliationStoreId || null));
  }, [affiliationMerchantId, affiliationStoreId, ensureStoreOptionsLoaded, open, roleGrantDrafts]);

  const roleMap = useMemo(
    () => new Map(roles.map((role) => [toRoleKey(role.sourceCode, role.code), role])),
    [roles],
  );

  const selectedRoleKeySet = useMemo(
    () => new Set(roleGrantDrafts.map((grant) => toRoleKey(grant.sourceCode, grant.roleCode))),
    [roleGrantDrafts],
  );
  const selectedRoleKeys = useMemo(() => Array.from(selectedRoleKeySet), [selectedRoleKeySet]);

  const roleGrantDraftsByKey = useMemo(() => {
    const grouped = new Map<string, EditableRoleGrant[]>();
    roleGrantDrafts.forEach((grant) => {
      const key = toRoleKey(grant.sourceCode, grant.roleCode);
      const entries = grouped.get(key) || [];
      entries.push(grant);
      grouped.set(key, entries);
    });
    return grouped;
  }, [roleGrantDrafts]);

  const selectedRoleGrants = useMemo<RoleGrant[]>(
    () => roleGrantDrafts.map(({ grantId: _grantId, ...grant }) => normalizeRoleGrant(grant)),
    [roleGrantDrafts],
  );

  const lockedMerchantOptions = useMemo(
    () => (affiliationMerchantId ? merchants.filter((merchant) => merchant.id === affiliationMerchantId) : []),
    [affiliationMerchantId, merchants],
  );
  const affiliationMerchantName = lockedMerchantOptions[0]?.name || affiliationMerchantId || "未设置";
  const affiliationStoreName = useMemo(() => {
    if (!affiliationStoreId) {
      return "未设置";
    }
    const stores = affiliationMerchantId ? storeOptionsByMerchant[affiliationMerchantId] || [] : [];
    return stores.find((store) => store.id === affiliationStoreId)?.name || affiliationStoreId;
  }, [affiliationMerchantId, affiliationStoreId, storeOptionsByMerchant]);

  const grantConflictMessage = useCallback((grant: RoleGrant) => {
    const role = roleMap.get(toRoleKey(grant.sourceCode, grant.roleCode));
    return affiliationGrantConflictMessage(
      {
        roleCode: grant.roleCode,
        roleName: role?.name,
        roleScopeLevel: role?.scopeLevel ?? role?.scope ?? grant.scopeLevel,
        merchantId: grant.merchantId,
        storeId: grant.storeId,
      },
      user?.merchantId,
      user?.storeId,
    );
  }, [roleMap, user?.merchantId, user?.storeId]);

  const filteredRoles = useMemo<CatalogRole[]>(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const catalog: CatalogRole[] = [];
    for (const role of roles) {
      const matchesSource = sourceFilter === "all" || role.sourceCode === sourceFilter;
      const roleGrantScope = grantScopeLevelForPrivilege(resolveRolePrivilegeLevel(role.code, role));
      const matchesScope = scopeFilter === "all" || roleGrantScope === scopeFilter;
      const matchesKeyword = !normalizedKeyword
        || role.name.toLowerCase().includes(normalizedKeyword)
        || role.code.toLowerCase().includes(normalizedKeyword)
        || role.description?.toLowerCase().includes(normalizedKeyword);
      const matchesAffiliation = canAssignRoleForAffiliation(
        role.code,
        role,
        affiliationMerchantId,
        affiliationStoreId,
      );
      if (!matchesSource || !matchesScope || !matchesKeyword || !matchesAffiliation) {
        continue;
      }
      catalog.push({
        roleKey: toRoleKey(role.sourceCode, role.code),
        name: role.name,
        code: role.code,
        sourceCode: role.sourceCode,
        sourceLabel: getRbacSourceLabel(role.sourceCode),
        scopeLabel: getRoleScopeLabel(roleGrantScope),
      });
    }
    return catalog;
  }, [affiliationMerchantId, affiliationStoreId, keyword, roles, scopeFilter, sourceFilter]);

  const addRoleGrantDraft = useCallback((roleKey: string) => {
    const role = roleMap.get(roleKey);
    if (!role) {
      return;
    }
    if (!canAssignRoleForAffiliation(role.code, role, user?.merchantId, user?.storeId)) {
      notify.error("无法授权", {
        description: user?.storeId
          ? "门店归属用户只能授予门店角色或平台/会员角色；商户角色需先将组织归属提升到商户"
          : "请先在用户编辑页设置组织归属，再授予商户或门店角色",
      });
      return;
    }
    const draft = buildDefaultRoleGrant(role, user?.merchantId, user?.storeId);
    if (draft.merchantId) {
      ensureStoreOptionsLoaded(draft.merchantId, user?.storeId);
    }
    setRoleGrantDrafts((current) => [...current, buildEditableGrant(draft)]);
  }, [buildEditableGrant, ensureStoreOptionsLoaded, roleMap, user?.merchantId, user?.storeId]);

  const toggleRole = useCallback((roleKey: string) => {
    if (selectedRoleKeySet.has(roleKey)) {
      setRoleGrantDrafts((current) => current.filter((grant) => toRoleKey(grant.sourceCode, grant.roleCode) !== roleKey));
      return;
    }
    addRoleGrantDraft(roleKey);
  }, [addRoleGrantDraft, selectedRoleKeySet]);

  const removeRoleGrantDraft = useCallback((grantId: string) => {
    setRoleGrantDrafts((current) => current.filter((grant) => grant.grantId !== grantId));
  }, []);

  const updateRoleGrantDraft = useCallback((grantId: string, patch: Partial<RoleGrant>) => {
    setRoleGrantDrafts((current) => current.map((grant) => {
      if (grant.grantId !== grantId) {
        return grant;
      }
      const role = roleMap.get(toRoleKey(grant.sourceCode, grant.roleCode));
      const requiredScope = grantScopeLevelForPrivilege(resolveRolePrivilegeLevel(grant.roleCode, role));
      const nextMerchantId = patch.merchantId !== undefined ? (patch.merchantId || null) : (grant.merchantId || null);
      let nextStoreId = patch.storeId !== undefined ? (patch.storeId || null) : (grant.storeId || null);
      if (patch.merchantId !== undefined && nextMerchantId !== (grant.merchantId || null)) {
        nextStoreId = null;
      }
      if (requiredScope === "global") {
        return { ...grant, merchantId: null, storeId: null, scopeLevel: "global" };
      }
      if (requiredScope === "merchant") {
        return { ...grant, merchantId: nextMerchantId, storeId: null, scopeLevel: "merchant" };
      }
      return { ...grant, merchantId: nextMerchantId, storeId: nextStoreId, scopeLevel: "store" };
    }));
    if (patch.merchantId) {
      ensureStoreOptionsLoaded(patch.merchantId, affiliationStoreId || null);
    }
  }, [affiliationStoreId, ensureStoreOptionsLoaded, roleMap]);

  const validateSelectedGrants = useCallback(() => {
    const duplicateGrantKeys = new Set<string>();
    const duplicateGrant = selectedRoleGrants.find((grant) => {
      const dedupeKey = [
        grant.sourceCode,
        grant.roleCode,
        normalizeGrantScopeLevel(grant.scopeLevel, grant.merchantId, grant.storeId),
        grant.merchantId || "",
        grant.storeId || "",
      ].join(":");
      if (duplicateGrantKeys.has(dedupeKey)) {
        return true;
      }
      duplicateGrantKeys.add(dedupeKey);
      return false;
    });
    if (duplicateGrant) {
      const role = roleMap.get(toRoleKey(duplicateGrant.sourceCode, duplicateGrant.roleCode));
      return `${role?.name || duplicateGrant.roleCode} 存在重复的授权范围，请删除重复行`;
    }

    const invalidGrant = selectedRoleGrants.find((grant) => {
      const scopeLevel = normalizeGrantScopeLevel(grant.scopeLevel, grant.merchantId, grant.storeId);
      if (scopeLevel === "store") {
        return !grant.merchantId || !grant.storeId;
      }
      if (scopeLevel === "merchant") {
        return !grant.merchantId || !!grant.storeId;
      }
      if (grant.merchantId || grant.storeId) {
        return true;
      }
      return false;
    });
    if (invalidGrant) {
      const role = roleMap.get(toRoleKey(invalidGrant.sourceCode, invalidGrant.roleCode));
      return `${role?.name || invalidGrant.roleCode} 的授权范围不完整，请先补齐商户或门店`;
    }

    const affiliationConflict = selectedRoleGrants.find((grant) => Boolean(grantConflictMessage(grant)));
    if (affiliationConflict) {
      const role = roleMap.get(toRoleKey(affiliationConflict.sourceCode, affiliationConflict.roleCode));
      return `${role?.name || affiliationConflict.roleCode}：${grantConflictMessage(affiliationConflict)}`;
    }

    return null;
  }, [grantConflictMessage, roleMap, selectedRoleGrants]);

  const handleSave = useCallback(async () => {
    if (!user?.principalId) {
      notify.error("无法授权", { description: "当前用户缺少主体标识 principalId，暂时无法进行角色授权" });
      return;
    }
    const validationError = validateSelectedGrants();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    try {
      setSaving(true);
      await updatePrincipalRoles(undefined, user.principalId, selectedRoleGrants);
      notify.success("授权成功");
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      notify.error("授权失败", { description: resolveUserErrorMessage(err, "角色授权保存失败") });
    } finally {
      setSaving(false);
    }
  }, [onOpenChange, onSaved, selectedRoleGrants, user, validateSelectedGrants]);

  const selectedGrantCount = selectedRoleGrants.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] min-h-0 flex-col overflow-hidden duration-0 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[50%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[50%] sm:max-w-[1200px]">
        <DialogHeader>
          <DialogTitle>角色授权</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <section className="shrink-0 rounded-2xl border border-border bg-muted/20 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>{user?.displayName || user?.nickname || user?.realName || "-"}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  组织归属：{affiliationMerchantName} / {affiliationStoreName}。商户与门店角色锁定在归属机构；平台角色不带商户。
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">已选角色 {selectedRoleKeys.length}</Badge>
                <Badge variant="outline">授权条目 {selectedGrantCount}</Badge>
              </div>
            </div>
            {!user?.principalId ? (
              <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                当前记录缺少 `principalId`，无法保存角色授权，请先补齐主体信息。
              </div>
            ) : null}
          </section>

          <section className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[400px_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col space-y-3 rounded-2xl border border-border bg-card p-3">
              <div className="shrink-0 space-y-2">
                <div className="text-sm font-medium text-foreground">可分配角色</div>
                <div className="grid gap-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="subpage-search-wrap !w-full">
                    <Search className="subpage-search-icon" />
                    <Input
                      value={keyword}
                      onChange={(event) => setKeyword(event.target.value)}
                      placeholder="角色名称/编码"
                      className="subpage-search-input"
                    />
                  </div>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="subpage-native-select h-10">
                      <SelectValue placeholder="选择来源" />
                    </SelectTrigger>
                    <SelectContent className="subpage-select-content">
                      {RBAC_SOURCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="subpage-select-item">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={scopeFilter} onValueChange={setScopeFilter}>
                    <SelectTrigger className="subpage-native-select h-10">
                      <SelectValue placeholder="作用域" />
                    </SelectTrigger>
                    <SelectContent className="subpage-select-content">
                      {ROLE_SCOPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="subpage-select-item">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loading ? (
                <div className="flex min-h-0 flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在加载角色...
                </div>
              ) : filteredRoles.length > 0 ? (
                <RoleCatalogList
                  roles={filteredRoles}
                  selectedRoleKeySet={selectedRoleKeySet}
                  onToggle={toggleRole}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  当前筛选条件下暂无可分配角色
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-col space-y-3 rounded-2xl border border-border bg-card p-3">
              <div className="shrink-0 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">授权范围明细</div>
                  <div className="text-xs text-muted-foreground">
                    商户/门店角色跟随组织归属锁定；同一角色不再跨商户追加范围。
                  </div>
                </div>
              </div>

              {selectedRoleKeys.length > 0 ? (
                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                  {selectedRoleKeys.map((roleKey) => {
                    const role = roleMap.get(roleKey);
                    const grants = roleGrantDraftsByKey.get(roleKey) || [];
                    const roleScopeLevel = grantScopeLevelForPrivilege(
                      resolveRolePrivilegeLevel(role?.code || grants[0]?.roleCode || "", role),
                    );
                    const merchantSelectOptions = affiliationMerchantId
                      ? (lockedMerchantOptions.length
                        ? lockedMerchantOptions
                        : [{ id: affiliationMerchantId, code: affiliationMerchantId, name: affiliationMerchantName }])
                      : merchants;
                    const allowMultiple = false;
                    return (
                      <div key={roleKey} className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                              <span>{role?.name || grants[0]?.roleCode || roleKey}</span>
                              <Badge variant="outline" className="text-[11px]">
                                {getRbacSourceLabel(role?.sourceCode || grants[0]?.sourceCode)}
                              </Badge>
                              <Badge variant="outline" className="text-[11px]">
                                {getRoleScopeLabel(roleScopeLevel)}
                              </Badge>
                            </div>
                            <div className="mt-1 break-all text-xs text-muted-foreground">{roleKey}</div>
                          </div>
                          {allowMultiple ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 px-3 text-[12px]"
                              onClick={() => addRoleGrantDraft(roleKey)}
                              disabled={saving}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              新增范围
                            </Button>
                          ) : null}
                        </div>

                        <div className="mt-2.5 space-y-2.5">
                          {grants.map((grant) => {
                            const merchantOptions = grant.merchantId ? storeOptionsByMerchant[grant.merchantId] || [] : [];
                            const storeOptions = affiliationStoreId
                              ? merchantOptions.filter((store) => store.id === affiliationStoreId)
                              : merchantOptions;
                            const conflict = grantConflictMessage(grant);
                            return (
                              <div
                                key={grant.grantId}
                                className={`grid gap-2.5 rounded-xl border bg-background/80 p-2.5 md:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_36px] ${
                                  conflict ? "border-destructive/50" : "border-border/60"
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground">授权范围</div>
                                  <div className="h-9 rounded-md border border-input bg-muted/30 px-3 text-sm leading-9 text-foreground">
                                    {getRoleScopeLabel(grant.scopeLevel)}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground">所属商户</div>
                                  <Select
                                    value={grant.merchantId || "none"}
                                    onValueChange={(value) => updateRoleGrantDraft(grant.grantId, { merchantId: value === "none" ? null : value })}
                                    disabled={roleScopeLevel === "global" || !!affiliationMerchantId}
                                  >
                                    <SelectTrigger className="subpage-native-select h-9">
                                      <SelectValue placeholder="选择商户" />
                                    </SelectTrigger>
                                    <SelectContent className="subpage-select-content">
                                      <SelectItem value="none" className="subpage-select-item">
                                        {roleScopeLevel === "global" ? "不适用" : "(空)"}
                                      </SelectItem>
                                      {(merchantSelectOptions).map((merchant) => (
                                        <SelectItem key={merchant.id} value={merchant.id} className="subpage-select-item">
                                          {merchant.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground">所属门店</div>
                                  <Select
                                    value={grant.storeId || "none"}
                                    onValueChange={(value) => updateRoleGrantDraft(grant.grantId, { storeId: value === "none" ? null : value })}
                                    disabled={roleScopeLevel !== "store" || !grant.merchantId || !!affiliationStoreId}
                                  >
                                    <SelectTrigger className="subpage-native-select h-9">
                                      <SelectValue placeholder={roleScopeLevel === "store" ? "选择门店" : "不适用"} />
                                    </SelectTrigger>
                                    <SelectContent className="subpage-select-content">
                                      <SelectItem value="none" className="subpage-select-item">
                                        {roleScopeLevel === "store" ? "(空)" : "不适用"}
                                      </SelectItem>
                                      {storeOptions.map((store) => (
                                        <SelectItem key={store.id} value={store.id} className="subpage-select-item">
                                          {store.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-end justify-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-muted-foreground"
                                    onClick={() => removeRoleGrantDraft(grant.grantId)}
                                    disabled={saving}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                {conflict ? (
                                  <div className="md:col-span-4 text-xs text-destructive">{conflict}</div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
                  勾选左侧角色后，可在这里补充商户或门店作用域。
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-2 flex shrink-0 flex-col items-end gap-2 border-t border-border/70 bg-background pt-3">
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <button type="button" className="subpage-outline-btn !h-10 !px-5" onClick={() => onOpenChange(false)} disabled={saving}>
              取消
            </button>
            <button type="button" className="subpage-primary-btn !h-10 !px-5" onClick={() => void handleSave()} disabled={saving || loading || !user?.principalId}>
              {saving ? "保存中..." : "保存授权"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
