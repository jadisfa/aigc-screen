import { Plus, Pencil, Trash2, ArrowLeft, Save, Check, ChevronsUpDown, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePagedTotal } from "@/shared/hooks/use-paged-total";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { cn } from "@/shared/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  TableSurface,
} from "@/shared/components/page";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import {
  buildPermissionSetForNamespace,
  CONSOLE_PERMISSION_NAMESPACE,
  CONSOLE_PERMISSIONS,
  hasPermission,
} from "@/shared/lib/permissions";
import {
  listStores,
  createStore,
  updateStore,
  deleteStore,
  type Store,
  type CreateStoreCommand,
  type UpdateStoreCommand,
} from "@/shared/api/ums/ums-store";
import { listMerchants } from "@/shared/api/ums/ums-merchant";
import StoreBalanceDialog from "../components/StoreBalanceDialog";
import { notify } from "@/shared/lib/notify";

const storeTypeOptions = [
  { value: "direct", label: "直营店" },
  { value: "franchise", label: "加盟店" },
];

export default function StoreManagementPage() {
  const queryClient = useQueryClient();
  const permissionsQuery = useMePermissions({ sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode });
  const permissionSet = useMemo(
    () => buildPermissionSetForNamespace(CONSOLE_PERMISSION_NAMESPACE, permissionsQuery.data?.permissions ?? []),
    [permissionsQuery.data?.permissions],
  );
  const canManageAccountBalance = hasPermission(permissionSet, CONSOLE_PERMISSIONS.opsAccountManage);

  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");

  const applyKeywordSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
    setPageNo(1);
  };
  const [storeTypeFilter, setStoreTypeFilter] = useState<string>("all");
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [balanceDialogStore, setBalanceDialogStore] = useState<Store | null>(null);

  const listQuery = useQuery({
    queryKey: ["umsStores", pageNo, pageSize, appliedKeyword, storeTypeFilter],
    queryFn: () =>
      listStores({
        pageNo,
        pageSize,
        total: requestTotal,
        keyword: appliedKeyword.trim() ? appliedKeyword.trim() : undefined,
        storeType: storeTypeFilter === "all" ? undefined : storeTypeFilter,
      }),
  });

  const requestTotal = usePagedTotal(pageNo, listQuery.data?.page?.total);

  const [merchantSearchKeyword, setMerchantSearchKeyword] = useState("");
  const [debouncedMerchantKeyword, setDebouncedMerchantKeyword] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMerchantKeyword(merchantSearchKeyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [merchantSearchKeyword]);

  const merchantsQuery = useQuery({
    queryKey: ["umsMerchants", debouncedMerchantKeyword],
    queryFn: () => listMerchants({ pageNo: 1, pageSize: 50, keyword: debouncedMerchantKeyword || undefined }),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!listQuery.isError) return;
    notify.fromError(listQuery.error, "请求失败", "加载失败");
  }, [listQuery.error, listQuery.isError]);

  const items = listQuery.data?.items ?? [];
  const pageTotal = listQuery.data?.page?.total ?? 0;
  const merchants = merchantsQuery.data?.items ?? [];
  
  const getMerchantName = (store: Store) => {
    return store.merchantName || store.merchantId;
  };

  const getStoreTypeName = (type?: string | null) => {
    if (!type) return "-";
    const opt = storeTypeOptions.find(o => o.value === type);
    return opt ? opt.label : type;
  };

  const canNextPage = useMemo(() => {
    if (pageTotal > 0) return pageNo * pageSize < pageTotal;
    return items.length === pageSize;
  }, [items.length, pageNo, pageSize, pageTotal]);
  const totalPages = pageTotal > 0 ? Math.ceil(pageTotal / pageSize) : 0;
  const pageFrom = pageTotal > 0 ? (pageNo - 1) * pageSize + 1 : 0;
  const pageTo = pageTotal > 0 ? Math.min(pageNo * pageSize, pageTotal) : 0;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["umsStores"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStore(id),
    onSuccess: async () => {
      notify.success("删除成功");
      await refresh();
    },
    onError: (e) => {
      notify.error("删除失败", { description: e instanceof Error ? e.message : "请求失败" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (p: { mode: "create" | "edit"; id?: string; payload: CreateStoreCommand | UpdateStoreCommand }) => {
      if (p.mode === "create") {
        return createStore(p.payload as CreateStoreCommand);
      }
      return updateStore(p.id!, p.payload as UpdateStoreCommand);
    },
    onSuccess: async () => {
      notify.success("保存成功");
      await refresh();
    },
    onError: (e) => {
      notify.error("保存失败", { description: e instanceof Error ? e.message : "请求失败" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (p: { id: string; status: string }) => updateStore(p.id, { status: p.status }),
    onSuccess: async (_data, variables) => {
      notify.success(variables.status === "normal" ? "门店已启用" : "门店已禁用");
      await refresh();
    },
    onError: (e) => {
      notify.error("操作失败", { description: e instanceof Error ? e.message : "请求失败" });
    },
  });

  const [editing, setEditing] = useState<Store | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formMerchantId, setFormMerchantId] = useState("");
  const [formMerchantName, setFormMerchantName] = useState("");
  const [formStoreType, setFormStoreType] = useState("direct");
  const [formContactPerson, setFormContactPerson] = useState("");
  const [formContactPhone, setFormContactPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formStatus, setFormStatus] = useState("normal");
  const [formExitConfirmOpen, setFormExitConfirmOpen] = useState(false);
  const [formInitialSnapshot, setFormInitialSnapshot] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const buildFormSnapshot = (args: {
    name: string;
    code: string;
    merchantId: string;
    storeType: string;
    contactPerson: string;
    contactPhone: string;
    address: string;
    status: string;
  }) =>
    JSON.stringify({
      name: args.name.trim(),
      code: args.code.trim(),
      merchantId: args.merchantId,
      storeType: args.storeType,
      contactPerson: args.contactPerson.trim(),
      contactPhone: args.contactPhone.trim(),
      address: args.address.trim(),
      status: args.status,
    });

  const resetForm = () => {
    setFormName("");
    setFormCode("");
    setFormMerchantId("");
    setFormMerchantName("");
    setFormStoreType("direct");
    setFormContactPerson("");
    setFormContactPhone("");
    setFormAddress("");
    setFormStatus("normal");
  };

  const hasFormChanges = () =>
    buildFormSnapshot({
      name: formName,
      code: formCode,
      merchantId: formMerchantId,
      storeType: formStoreType,
      contactPerson: formContactPerson,
      contactPhone: formContactPhone,
      address: formAddress,
      status: formStatus,
    }) !== formInitialSnapshot;

  const [merchantComboboxOpen, setMerchantComboboxOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    resetForm();
    if (merchants.length > 0) {
      setFormMerchantId(merchants[0].id);
      setFormMerchantName(merchants[0].name);
    }
    setFormInitialSnapshot(
      buildFormSnapshot({
        name: "",
        code: "",
        merchantId: merchants.length > 0 ? merchants[0].id : "",
        storeType: "direct",
        contactPerson: "",
        contactPhone: "",
        address: "",
        status: "normal",
      })
    );
    setView("create");
  };

  const openEdit = (s: Store) => {
    setEditing(s);
    setFormName(s.name || "");
    setFormCode(s.code || "");
    setFormMerchantId(s.merchantId || "");
    setFormMerchantName(s.merchantName || "");
    setFormStoreType(s.storeType || "direct");
    setFormContactPerson(s.contactPerson || "");
    setFormContactPhone(s.contactPhone || "");
    setFormAddress(s.address || "");
    setFormStatus(s.status || "normal");
    setFormInitialSnapshot(
      buildFormSnapshot({
        name: s.name || "",
        code: s.code || "",
        merchantId: s.merchantId || "",
        storeType: s.storeType || "direct",
        contactPerson: s.contactPerson || "",
        contactPhone: s.contactPhone || "",
        address: s.address || "",
        status: s.status || "normal",
      })
    );
    setView("edit");
  };

  const submitForm = async () => {
    if (!formName.trim()) {
      setFormError("请输入门店名称");
      return;
    }
    if (!formMerchantId) {
      setFormError("请选择归属商户");
      return;
    }
    setFormError(null);

    const payload = {
      name: formName.trim(),
      code: formCode.trim() || undefined,
      merchantId: formMerchantId,
      storeType: formStoreType,
      contactPerson: formContactPerson.trim() || null,
      contactPhone: formContactPhone.trim() || null,
      address: formAddress.trim() || null,
      status: formStatus,
    };

    await saveMutation.mutateAsync({
      mode: view === "create" ? "create" : "edit",
      id: editing?.id,
      payload,
    });
    
    setView("list");
    setEditing(null);
  };

  const handleFormBack = () => {
    if (hasFormChanges()) {
      setFormExitConfirmOpen(true);
      return;
    }
    resetForm();
    setEditing(null);
    setView("list");
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState<Store | null>(null);
  const openDelete = (s: Store) => {
    setDeleting(s);
    setDeleteConfirmOpen(true);
  };

  if (view === "create" || view === "edit") {
    return (
      <PageShell>
        <PageHeader
          title={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleFormBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="page-title">{view === "create" ? "新增门店" : "编辑门店"}</h1>
            </div>
          }
        />

        <div className="w-full max-w-[1000px] mx-auto space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="workflow-form-label">
                <span className="text-destructive">*</span>门店名称
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="请输入门店名称"
                className="workflow-form-input"
              />
            </div>
            <div className="space-y-2">
              <label className="workflow-form-label">门店编码</label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="不填将自动生成"
                className="workflow-form-input"
                disabled={view === "edit"}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="workflow-form-label">
                <span className="text-destructive">*</span>归属商户
              </label>
              <Popover open={merchantComboboxOpen} onOpenChange={setMerchantComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={merchantComboboxOpen}
                    className="w-full justify-between h-10 font-normal text-left px-3 shadow-none border-input"
                  >
                    {formMerchantId
                      ? formMerchantName || merchants.find((m) => m.id === formMerchantId)?.name || formMerchantId
                      : <span className="text-muted-foreground">请选择归属商户</span>}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="搜索商户..."
                      value={merchantSearchKeyword}
                      onValueChange={setMerchantSearchKeyword}
                    />
                    <CommandList>
                      <CommandEmpty>{merchantsQuery.isFetching ? "搜索中..." : "未找到商户"}</CommandEmpty>
                      <CommandGroup>
                        {merchants.map((m) => (
                          <CommandItem
                            key={m.id}
                            value={m.id}
                            onSelect={() => {
                              setFormMerchantId(m.id);
                              setFormMerchantName(m.name);
                              setMerchantComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formMerchantId === m.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {m.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="workflow-form-label">
                <span className="text-destructive">*</span>门店类型
              </label>
              <Select value={formStoreType} onValueChange={setFormStoreType}>
                <SelectTrigger className="subpage-native-select w-full h-10">
                  <SelectValue placeholder="请选择门店类型" />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {storeTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} className="subpage-select-item" value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="workflow-form-label">联系人</label>
              <Input
                value={formContactPerson}
                onChange={(e) => setFormContactPerson(e.target.value)}
                placeholder="请输入联系人姓名"
                className="workflow-form-input"
              />
            </div>
            <div className="space-y-2">
              <label className="workflow-form-label">联系电话</label>
              <Input
                value={formContactPhone}
                onChange={(e) => setFormContactPhone(e.target.value)}
                placeholder="请输入联系电话"
                className="workflow-form-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="workflow-form-label">地址</label>
            <Input
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              placeholder="请输入详细地址"
              className="workflow-form-input"
            />
          </div>

          <div className="space-y-2">
            <label className="workflow-form-label">启用状态</label>
            <div className="h-10 flex items-center">
              <Switch 
                checked={formStatus === "normal"} 
                onCheckedChange={(v) => setFormStatus(v ? "normal" : "disabled")} 
              />
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 pt-3 pb-8 mt-6">
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" className="h-10 px-5" onClick={handleFormBack}>
                取消
              </Button>
              <Button
                className="h-10 px-5 bg-foreground text-background hover:bg-foreground/90"
                onClick={submitForm}
                disabled={saveMutation.isPending}
              >
                <Save className="w-4 h-4 mr-1" />
                保存
              </Button>
            </div>
          </div>
        </div>

        <AlertDialog open={formExitConfirmOpen} onOpenChange={setFormExitConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认取消</AlertDialogTitle>
              <AlertDialogDescription>您已输入部分内容，确认要放弃当前编辑内容吗？</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>继续编辑</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  resetForm();
                  setEditing(null);
                  setView("list");
                  setFormExitConfirmOpen(false);
                }}
              >
                确认放弃
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="门店管理"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => refresh()} disabled={listQuery.isFetching}>
              刷新
            </Button>
            <Button variant="page" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              新增门店
            </Button>
          </>
        }
      />

      <PageFilterBar>
        <Select
          value={storeTypeFilter}
          onValueChange={(v) => {
            setStoreTypeFilter(v);
            setPageNo(1);
          }}
        >
          <SelectTrigger className="subpage-native-select w-32 h-9">
            <SelectValue placeholder="门店类型" />
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value="all">
              全部类型
            </SelectItem>
            {storeTypeOptions.map((opt) => (
              <SelectItem key={opt.value} className="subpage-select-item" value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SearchField
          wrapClassName="!w-[380px] !max-w-[380px] shrink-0"
          placeholder="搜索名称、联系人、地址，回车搜索"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyKeywordSearch();
            }
          }}
        />
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[150px]">门店名称</TableHead>
              <TableHead className="w-24">类型</TableHead>
              <TableHead className="min-w-[150px]">归属商户</TableHead>
              <TableHead className="w-32">联系人</TableHead>
              <TableHead className="w-32">联系电话</TableHead>
              <TableHead className="min-w-[150px]">地址</TableHead>
              <TableHead className="w-32">账户余额</TableHead>
              <TableHead className="w-24 text-center">状态</TableHead>
              <TableHead className="w-36">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                  加载中...
                </TableCell>
              </TableRow>
            )}
            {!listQuery.isLoading &&
              items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{getStoreTypeName(s.storeType)}</TableCell>
                  <TableCell className="text-muted-foreground">{getMerchantName(s)}</TableCell>
                  <TableCell>{s.contactPerson || "-"}</TableCell>
                  <TableCell>{s.contactPhone || "-"}</TableCell>
                  <TableCell className="truncate max-w-[200px]" title={s.address || ""}>{s.address || "-"}</TableCell>
                  <TableCell className="font-medium font-mono">{Number(s.balance ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={s.status === "normal"}
                      onCheckedChange={(v) => toggleStatusMutation.mutate({ id: s.id, status: v ? "normal" : "disabled" })}
                      disabled={toggleStatusMutation.isPending}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary hover:text-primary"
                        title="编辑"
                        onClick={() => openEdit(s)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {canManageAccountBalance ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-amber-500 hover:bg-amber-50 hover:text-amber-600 disabled:text-muted-foreground"
                          title={s.merchantId ? "门店资金调整" : "缺少归属商户，无法划转充值"}
                          disabled={!s.merchantId}
                          onClick={() => {
                            setBalanceDialogStore(s);
                            setBalanceDialogOpen(true);
                          }}
                        >
                          <Wallet className="w-4 h-4" />
                        </Button>
                      ) : null}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        title="删除"
                        onClick={() => openDelete(s)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!listQuery.isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                  暂无门店数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableSurface>

      <CommonPaginationBar
        total={pageTotal || items.length}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={canNextPage}
        onPageNoChange={setPageNo}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPageNo(1);
        }}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              将删除门店：{deleting?.name || "-"}。该操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                await deleteMutation.mutateAsync(deleting.id);
                setDeleteConfirmOpen(false);
                setDeleting(null);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canManageAccountBalance ? (
        <StoreBalanceDialog
          open={balanceDialogOpen}
          onOpenChange={(open) => {
            setBalanceDialogOpen(open);
            if (!open) {
              setBalanceDialogStore(null);
            }
          }}
          storeId={balanceDialogStore?.id ?? ""}
          storeName={balanceDialogStore?.name ?? ""}
          merchantId={balanceDialogStore?.merchantId}
          merchantName={balanceDialogStore?.merchantName}
          onStoreBalanceUpdated={() => {
            void refresh();
          }}
          onMerchantBalanceUpdated={() => {
            void refresh();
          }}
        />
      ) : null}
    </PageShell>
  );
}
