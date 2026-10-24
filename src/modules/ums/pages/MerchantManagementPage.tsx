import { Plus, Pencil, Trash2, ArrowLeft, Save, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePagedTotal } from "@/shared/hooks/use-paged-total";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
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
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  TableSurface,
} from "@/shared/components/page";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import {
  buildPermissionSetForNamespace,
  CONSOLE_PERMISSION_NAMESPACE,
  CONSOLE_PERMISSIONS,
  hasPermission,
} from "@/shared/lib/permissions";
import {
  listMerchants,
  createMerchant,
  updateMerchant,
  deleteMerchant,
  type Merchant,
  type CreateMerchantCommand,
  type UpdateMerchantCommand,
} from "@/shared/api/ums/ums-merchant";
import MerchantBalanceDialog from "../components/MerchantBalanceDialog";
import { notify } from "@/shared/lib/notify";

export default function MerchantManagementPage() {
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
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [balanceDialogMerchant, setBalanceDialogMerchant] = useState<Merchant | null>(null);

  const listQuery = useQuery({
    queryKey: ["umsMerchants", pageNo, pageSize, appliedKeyword],
    queryFn: () =>
      listMerchants({
        pageNo,
        pageSize,
        total: requestTotal,
        keyword: appliedKeyword.trim() ? appliedKeyword.trim() : undefined,
      }),
  });

  const requestTotal = usePagedTotal(pageNo, listQuery.data?.page?.total);

  useEffect(() => {
    if (!listQuery.isError) return;
    notify.fromError(listQuery.error, "请求失败", "加载失败");
  }, [listQuery.error, listQuery.isError]);

  const items = listQuery.data?.items ?? [];
  const pageTotal = listQuery.data?.page?.total ?? 0;
  const canNextPage = useMemo(() => {
    if (pageTotal > 0) return pageNo * pageSize < pageTotal;
    return items.length === pageSize;
  }, [items.length, pageNo, pageSize, pageTotal]);
  const totalPages = pageTotal > 0 ? Math.ceil(pageTotal / pageSize) : 0;
  const pageFrom = pageTotal > 0 ? (pageNo - 1) * pageSize + 1 : 0;
  const pageTo = pageTotal > 0 ? Math.min(pageNo * pageSize, pageTotal) : 0;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["umsMerchants"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMerchant(id),
    onSuccess: async () => {
      notify.success("删除成功");
      await refresh();
    },
    onError: (e) => {
      notify.error("删除失败", { description: e instanceof Error ? e.message : "请求失败" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (p: { mode: "create" | "edit"; id?: string; payload: CreateMerchantCommand | UpdateMerchantCommand }) => {
      if (p.mode === "create") {
        return createMerchant(p.payload as CreateMerchantCommand);
      }
      return updateMerchant(p.id!, p.payload as UpdateMerchantCommand);
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
    mutationFn: (p: { id: string; status: string }) => updateMerchant(p.id, { status: p.status }),
    onSuccess: async (_data, variables) => {
      notify.success(variables.status === "normal" ? "商户已启用" : "商户已禁用");
      await refresh();
    },
    onError: (e) => {
      notify.error("操作失败", { description: e instanceof Error ? e.message : "请求失败" });
    },
  });

  const [editing, setEditing] = useState<Merchant | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
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
    contactPerson: string;
    contactPhone: string;
    address: string;
    status: string;
  }) =>
    JSON.stringify({
      name: args.name.trim(),
      code: args.code.trim(),
      contactPerson: args.contactPerson.trim(),
      contactPhone: args.contactPhone.trim(),
      address: args.address.trim(),
      status: args.status,
    });

  const resetForm = () => {
    setFormName("");
    setFormCode("");
    setFormContactPerson("");
    setFormContactPhone("");
    setFormAddress("");
    setFormStatus("normal");
  };

  const hasFormChanges = () =>
    buildFormSnapshot({
      name: formName,
      code: formCode,
      contactPerson: formContactPerson,
      contactPhone: formContactPhone,
      address: formAddress,
      status: formStatus,
    }) !== formInitialSnapshot;

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setFormInitialSnapshot(
      buildFormSnapshot({
        name: "",
        code: "",
        contactPerson: "",
        contactPhone: "",
        address: "",
        status: "normal",
      })
    );
    setView("create");
  };

  const openEdit = (m: Merchant) => {
    setEditing(m);
    setFormName(m.name || "");
    setFormCode(m.code || "");
    setFormContactPerson(m.contactPerson || "");
    setFormContactPhone(m.contactPhone || "");
    setFormAddress(m.address || "");
    setFormStatus(m.status || "normal");
    setFormInitialSnapshot(
      buildFormSnapshot({
        name: m.name || "",
        code: m.code || "",
        contactPerson: m.contactPerson || "",
        contactPhone: m.contactPhone || "",
        address: m.address || "",
        status: m.status || "normal",
      })
    );
    setView("edit");
  };

  const submitForm = async () => {
    if (!formName.trim()) {
      setFormError("请输入商户名称");
      return;
    }
    setFormError(null);

    const payload = {
      name: formName.trim(),
      code: formCode.trim() || undefined,
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
  const [deleting, setDeleting] = useState<Merchant | null>(null);
  const openDelete = (m: Merchant) => {
    setDeleting(m);
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
              <h1 className="page-title">{view === "create" ? "新增商户" : "编辑商户"}</h1>
            </div>
          }
        />

        <div className="w-full max-w-[1000px] mx-auto space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="workflow-form-label">
                <span className="text-destructive">*</span>商户名称
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="请输入商户名称"
                className="workflow-form-input"
              />
            </div>
            <div className="space-y-2">
              <label className="workflow-form-label">商户编码</label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="不填将自动生成"
                className="workflow-form-input"
                disabled={view === "edit"} // 编码通常不允许修改
              />
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
        title="组织管理"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => refresh()} disabled={listQuery.isFetching}>
              刷新
            </Button>
            <Button variant="page" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              新增商户
            </Button>
          </>
        }
      />

      <PageFilterBar>
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
              <TableHead className="min-w-[150px]">商户名称</TableHead>
              <TableHead className="w-40">商户编码</TableHead>
              <TableHead className="w-32">联系人</TableHead>
              <TableHead className="w-32">联系电话</TableHead>
              <TableHead className="min-w-[200px]">地址</TableHead>
              <TableHead className="w-32">账户余额</TableHead>
              <TableHead className="w-24 text-center">状态</TableHead>
              <TableHead className="w-36">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                  加载中...
                </TableCell>
              </TableRow>
            )}
            {!listQuery.isLoading &&
              items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.code}</TableCell>
                  <TableCell>{m.contactPerson || "-"}</TableCell>
                  <TableCell>{m.contactPhone || "-"}</TableCell>
                  <TableCell className="truncate max-w-[200px]" title={m.address || ""}>{m.address || "-"}</TableCell>
                  <TableCell className="font-medium font-mono">{Number(m.balance ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={m.status === "normal"}
                      onCheckedChange={(v) => toggleStatusMutation.mutate({ id: m.id, status: v ? "normal" : "disabled" })}
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
                        onClick={() => openEdit(m)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {canManageAccountBalance ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-amber-500 hover:bg-amber-50 hover:text-amber-600"
                          title="商户资金调整"
                          onClick={() => {
                            setBalanceDialogMerchant(m);
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
                        onClick={() => openDelete(m)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!listQuery.isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                  暂无商户数据
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
              将删除商户：{deleting?.name || "-"}。该操作不可恢复。
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
        <MerchantBalanceDialog
          open={balanceDialogOpen}
          onOpenChange={(open) => {
            setBalanceDialogOpen(open);
            if (!open) {
              setBalanceDialogMerchant(null);
            }
          }}
          merchantId={balanceDialogMerchant?.id ?? ""}
          merchantName={balanceDialogMerchant?.name ?? ""}
          onBalanceUpdated={() => {
            void refresh();
          }}
        />
      ) : null}
    </PageShell>
  );
}
