import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { resolvePagedTotal } from "@/shared/hooks/use-paged-total";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  StatusBadge,
  statusToneFromCode,
  TableSurface,
} from "@/shared/components/page";
import { UserSelect } from "@/shared/components/UserSelect";
import { listComputePackages, type ComputePackage } from "@/shared/api/ops/ops-compute-package";
import {
  closeOnlineRecharge,
  createOnlineRecharge,
  creditTargetLabel,
  getPurchaseContext,
  listOnlineRecharges,
  orderStatusLabel,
  syncOnlineRechargeStatus,
  type OnlineRechargeOrder,
  type PurchaseContext,
} from "@/shared/api/fund/online-recharge";
import { formatDateTime } from "@/shared/lib/datetime";
import { formatCurrency } from "@/shared/lib/format";
import { resolveUserErrorNotice } from "@/shared/api/sys/error-message";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { notify } from "@/shared/lib/notify";

type PayChannel = "wechat" | "alipay";

const ALL_FILTER = "all";

function channelLabel(channel: string | null | undefined): string {
  if (channel === "alipay") return "支付宝";
  if (channel === "wechat") return "微信";
  return channel || "-";
}

const PAY_STATUS_POLL_MS = 4000;

function orderStatusTone(status: string | null | undefined) {
  const value = (status || "").toLowerCase();
  if (value === "closed") return "neutral" as const;
  return statusToneFromCode(status);
}

function isPendingPayStatus(status: string | null | undefined): boolean {
  const value = (status || "").toLowerCase();
  return value === "created" || value === "paying";
}

function formatPayFen(fen: number | null | undefined, currency: string | null | undefined): string {
  if (fen === null || fen === undefined) return "-";
  return formatCurrency(fen / 100, currency || "CNY");
}

function packageValidityLabel(days: number | null | undefined): string {
  return days ? `${days} 天` : "无限制";
}

export default function OrderManagementPage() {
  const [packages, setPackages] = useState<ComputePackage[]>([]);
  const [items, setItems] = useState<OnlineRechargeOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [filterStatus, setFilterStatus] = useState(ALL_FILTER);
  const [filterChannel, setFilterChannel] = useState(ALL_FILTER);
  const [filterOrderNo, setFilterOrderNo] = useState("");
  const [appliedOrderNo, setAppliedOrderNo] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPrincipalId, setSelectedPrincipalId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [channel, setChannel] = useState<PayChannel>("wechat");
  const [purchaseContext, setPurchaseContext] = useState<PurchaseContext | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [qrOpen, setQrOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<OnlineRechargeOrder | null>(null);
  const [switchingChannel, setSwitchingChannel] = useState(false);

  const rechargePackages = useMemo(
    () => packages.filter((p) => p.packageType === "recharge" && p.onlineRecharge && p.enabled),
    [packages],
  );
  const selectedPackage = useMemo(
    () => rechargePackages.find((pkg) => pkg.id === selectedPackageId) ?? null,
    [rechargePackages, selectedPackageId],
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canNextPage = pageNo < totalPages;

  const loadPackages = useCallback(async () => {
    try {
      const res = await listComputePackages({ pageNo: 1, pageSize: 200, packageType: "recharge" });
      setPackages(res.items);
    } catch (e) {
      notify.error("加载套餐失败", { description: e instanceof Error ? e.message : "请求失败" });
    }
  }, []);

  const loadOrders = useCallback(
    async (targetPageNo: number, targetPageSize: number, knownTotal?: number) => {
      setLoading(true);
      try {
        const res = await listOnlineRecharges({
          pageNo: targetPageNo,
          pageSize: targetPageSize,
          total: resolvePagedTotal(targetPageNo, knownTotal),
          status: filterStatus === ALL_FILTER ? undefined : filterStatus,
          payChannel: filterChannel === ALL_FILTER ? undefined : filterChannel,
          orderNo: appliedOrderNo.trim() || undefined,
        });
        setItems(res.items);
        setTotal(res.page.total);
      } catch (e) {
        notify.error("加载订单失败", { description: e instanceof Error ? e.message : "请求失败" });
      } finally {
        setLoading(false);
      }
    },
    [appliedOrderNo, filterChannel, filterStatus],
  );

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    void loadOrders(pageNo, pageSize, total);
  }, [loadOrders, pageNo, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps -- total only for resolvePagedTotal inside load

  useEffect(() => {
    if (!qrOpen || switchingChannel) return;
    const orderNo = createdOrder?.orderNo;
    if (!orderNo || !isPendingPayStatus(createdOrder?.status)) return;

    let stopped = false;
    let inFlight = false;
    const timer = window.setInterval(() => {
      if (stopped || inFlight) return;
      inFlight = true;
      void syncOnlineRechargeStatus(orderNo)
        .then((updated) => {
          if (stopped) return;
          setCreatedOrder((prev) => (prev?.orderNo === orderNo ? updated : prev));
          const next = (updated.status || "").toLowerCase();
          if (next === "paid") {
            stopped = true;
            window.clearInterval(timer);
            notify.success("支付成功", { description: `订单号：${updated.orderNo}` });
            void loadOrders(pageNo, pageSize, total);
            return;
          }
          if (next === "closed" || next === "failed") {
            void loadOrders(pageNo, pageSize, total);
          }
        })
        .catch(() => {
          // 定时查询失败不打断，等待下次
        })
        .finally(() => {
          inFlight = false;
        });
    }, PAY_STATUS_POLL_MS);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [createdOrder?.orderNo, createdOrder?.status, loadOrders, pageNo, pageSize, qrOpen, switchingChannel, total]);

  useEffect(() => {
    if (!createOpen || !selectedPrincipalId || !selectedPackageId) {
      setPurchaseContext(null);
      setSelectedStoreId("");
      return;
    }
    void getPurchaseContext({ principalId: selectedPrincipalId, packageId: selectedPackageId })
      .then((ctx) => {
        setPurchaseContext(ctx);
        if (ctx.availableStores?.length === 1) {
          setSelectedStoreId(ctx.availableStores[0].storeId);
        } else if (!ctx.storeSelectionRequired) {
          setSelectedStoreId(ctx.storeId || "");
        } else {
          setSelectedStoreId("");
        }
      })
      .catch((e) => {
        setPurchaseContext(null);
        notify.error("购买校验失败", { description: e instanceof Error ? e.message : "请求失败" });
      });
  }, [createOpen, selectedPackageId, selectedPrincipalId]);

  const openCreateDialog = () => {
    setSelectedPrincipalId("");
    setSelectedPackageId(rechargePackages[0]?.id || "");
    setSelectedStoreId("");
    setChannel("wechat");
    setPurchaseContext(null);
    setFormError(null);
    setCreateOpen(true);
  };

  const onCreate = async () => {
    if (!selectedPrincipalId) {
      setFormError("请选择购买用户");
      return;
    }
    if (!selectedPackageId) {
      setFormError("请选择套餐");
      return;
    }
    if (purchaseContext && !purchaseContext.purchasable && !purchaseContext.storeSelectionRequired) {
      setFormError(purchaseContext.message || "购买条件不满足");
      return;
    }
    if (purchaseContext?.storeSelectionRequired && !selectedStoreId) {
      setFormError("请选择门店");
      return;
    }
    setFormError(null);
    setCreating(true);
    try {
      const created = await createOnlineRecharge({
        principalId: selectedPrincipalId,
        packageId: selectedPackageId,
        payChannel: channel,
        storeId: selectedStoreId || undefined,
      });
      setCreateOpen(false);
      setCreatedOrder(created);
      setQrOpen(true);
      notify.success("创建成功", { description: `订单号：${created.orderNo}` });
      setPageNo(1);
      await loadOrders(1, pageSize);
    } catch (e) {
      const notice = resolveUserErrorNotice(e, "创建失败，请稍后重试", "创建失败");
      notify.error(notice.title, { description: notice.description });
    } finally {
      setCreating(false);
    }
  };

  const onSync = async (orderNo: string) => {
    setLoading(true);
    try {
      const updated = await syncOnlineRechargeStatus(orderNo);
      if (createdOrder?.orderNo === orderNo) {
        setCreatedOrder(updated);
      }
      await loadOrders(pageNo, pageSize, total);
    } catch (e) {
      const notice = resolveUserErrorNotice(e, "查询失败，请稍后重试", "查询失败");
      notify.error(notice.title, { description: notice.description });
    } finally {
      setLoading(false);
    }
  };

  const onSwitchPayChannel = async (nextChannel: PayChannel) => {
    if (!createdOrder || switchingChannel || loading) return;
    if (createdOrder.payChannel === nextChannel) return;
    if (createdOrder.status === "paid") {
      notify.error("订单已支付", { description: "无法切换支付方式" });
      return;
    }

    setSwitchingChannel(true);
    try {
      if (createdOrder.status === "created" || createdOrder.status === "paying") {
        await closeOnlineRecharge(createdOrder.orderNo);
      }
      const created = await createOnlineRecharge({
        principalId: selectedPrincipalId || createdOrder.principalId || "",
        packageId: selectedPackageId || createdOrder.packageId || "",
        payChannel: nextChannel,
        storeId: selectedStoreId || createdOrder.storeId || undefined,
      });
      setChannel(nextChannel);
      setCreatedOrder(created);
      notify.success("已切换支付方式", { description: `请使用${channelLabel(nextChannel)}扫码` });
      setPageNo(1);
      await loadOrders(1, pageSize);
    } catch (e) {
      const notice = resolveUserErrorNotice(e, "请刷新后重试", "切换失败");
      notify.error(notice.title, { description: notice.description });
      await loadOrders(pageNo, pageSize, total);
    } finally {
      setSwitchingChannel(false);
    }
  };

  const handleSearch = () => {
    const normalized = filterOrderNo.trim();
    setFilterOrderNo(normalized);
    setAppliedOrderNo(normalized);
    setPageNo(1);
  };

  const handleReset = () => {
    setFilterStatus(ALL_FILTER);
    setFilterChannel(ALL_FILTER);
    setFilterOrderNo("");
    setAppliedOrderNo("");
    setPageNo(1);
  };

  return (
    <PageShell>
      <PageHeader
        title="订单管理"
        actions={
          <>
            <Button variant="pageOutline" onClick={handleReset} disabled={loading}>
              重置
            </Button>
            <Button
              variant="pageOutline"
              disabled={loading}
              onClick={() => void loadOrders(pageNo, pageSize, total)}
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
            <Button variant="page" onClick={openCreateDialog} disabled={loading}>
              <Plus className="w-4 h-4" />
              创建订单
            </Button>
          </>
        }
      />

      <PageFilterBar className="!flex-nowrap overflow-x-auto">
        <Select
          value={filterStatus}
          onValueChange={(v) => {
            setFilterStatus(v);
            setPageNo(1);
          }}
        >
          <SelectTrigger className="subpage-native-select w-[140px] shrink-0">
            <SelectValue placeholder="订单状态" />
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value={ALL_FILTER}>
              全部状态
            </SelectItem>
            <SelectItem className="subpage-select-item" value="paying">
              支付中
            </SelectItem>
            <SelectItem className="subpage-select-item" value="paid">
              已支付
            </SelectItem>
            <SelectItem className="subpage-select-item" value="closed">
              已关闭
            </SelectItem>
            <SelectItem className="subpage-select-item" value="failed">
              失败
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterChannel}
          onValueChange={(v) => {
            setFilterChannel(v);
            setPageNo(1);
          }}
        >
          <SelectTrigger className="subpage-native-select w-[140px] shrink-0">
            <SelectValue placeholder="支付渠道" />
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value={ALL_FILTER}>
              全部渠道
            </SelectItem>
            <SelectItem className="subpage-select-item" value="wechat">
              微信
            </SelectItem>
            <SelectItem className="subpage-select-item" value="alipay">
              支付宝
            </SelectItem>
          </SelectContent>
        </Select>

        <SearchField
          wrapClassName="!w-[240px] !max-w-[240px] shrink-0"
          placeholder="搜索订单号，回车搜索"
          value={filterOrderNo}
          onChange={(e) => setFilterOrderNo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch();
            }
          }}
        />
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">订单号</TableHead>
              <TableHead className="min-w-[140px]">套餐</TableHead>
              <TableHead className="w-24">渠道</TableHead>
              <TableHead className="w-24">入账目标</TableHead>
              <TableHead className="w-24">状态</TableHead>
              <TableHead className="w-28 text-right">实付</TableHead>
              <TableHead className="w-28 text-right">入账额度</TableHead>
              <TableHead className="min-w-[160px]">创建时间</TableHead>
              <TableHead className="min-w-[160px]">支付时间</TableHead>
              <TableHead className="w-28 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                  正在加载订单…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                  暂无订单数据
                </TableCell>
              </TableRow>
            ) : (
              items.map((o) => (
                <TableRow key={o.orderId}>
                  <TableCell className="font-mono text-xs">{o.orderNo}</TableCell>
                  <TableCell>{o.packageName || o.packageId || "-"}</TableCell>
                  <TableCell>{channelLabel(o.payChannel)}</TableCell>
                  <TableCell>{creditTargetLabel(o.creditTarget)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">{formatPayFen(o.payAmountFen, o.currency)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(o.amount, o.currency)}</TableCell>
                  <TableCell>{formatDateTime(o.createdAt)}</TableCell>
                  <TableCell>{formatDateTime(o.paidAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={loading || o.status === "paid" || o.status === "closed" || o.status === "failed"}
                      onClick={() => void onSync(o.orderNo)}
                    >
                      查询状态
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableSurface>

      <CommonPaginationBar
        total={total}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={canNextPage}
        onPageNoChange={setPageNo}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setPageNo(1);
        }}
        showLastButton
        disabled={loading}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>创建支付订单</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <label className="workflow-form-label">购买用户</label>
              <UserSelect
                value={selectedPrincipalId}
                onChange={(v) => {
                  setFormError(null);
                  setSelectedPrincipalId(v);
                }}
                placeholder="搜索并选择用户"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="workflow-form-label">充值套餐</label>
              <Select
                value={selectedPackageId}
                onValueChange={(v) => {
                  setFormError(null);
                  setSelectedPackageId(v);
                }}
              >
                <SelectTrigger className="workflow-form-select">
                  <SelectValue placeholder="选择充值套餐" />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {rechargePackages.map((p) => (
                    <SelectItem key={p.id} className="subpage-select-item" value={p.id}>
                      {p.name}（{creditTargetLabel(p.creditTarget)}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPackage ? (
                <div
                  className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 px-3 py-3"
                  aria-live="polite"
                >
                  <div className="space-y-1">
                    <div className="workflow-form-label">购买金额</div>
                    <div className="text-sm font-medium tabular-nums text-foreground">
                      {formatPayFen(selectedPackage.amount, selectedPackage.currency)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="workflow-form-label">到账额度</div>
                    <div className="text-sm font-medium tabular-nums text-foreground">
                      {formatPayFen(selectedPackage.computeQuota, selectedPackage.currency)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="workflow-form-label">赠送额度</div>
                    <div className="text-sm font-medium tabular-nums text-foreground">
                      {formatPayFen(selectedPackage.bonusCompute, selectedPackage.currency)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="workflow-form-label">有效期</div>
                    <div className="text-sm font-medium text-foreground">
                      {packageValidityLabel(selectedPackage.validityDays)}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            {purchaseContext?.storeSelectionRequired || (purchaseContext?.availableStores?.length || 0) > 1 ? (
              <div className="space-y-2">
                <label className="workflow-form-label">门店</label>
                <Select
                  value={selectedStoreId}
                  onValueChange={(v) => {
                    setFormError(null);
                    setSelectedStoreId(v);
                  }}
                >
                  <SelectTrigger className="workflow-form-select">
                    <SelectValue placeholder="选择门店" />
                  </SelectTrigger>
                  <SelectContent className="subpage-select-content">
                    {(purchaseContext?.availableStores || []).map((s) => (
                      <SelectItem key={s.storeId} className="subpage-select-item" value={s.storeId}>
                        {s.storeName || s.storeId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <label className="workflow-form-label">支付方式</label>
              <ToggleGroup
                type="single"
                value={channel}
                onValueChange={(v) => {
                  if (v === "wechat" || v === "alipay") setChannel(v);
                }}
                variant="outline"
                className="justify-start"
              >
                <ToggleGroupItem value="wechat" className="px-4">
                  微信支付
                </ToggleGroupItem>
                <ToggleGroupItem value="alipay" className="px-4">
                  支付宝
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            {purchaseContext?.message ? (
              <p className="text-sm text-muted-foreground">{purchaseContext.message}</p>
            ) : null}
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className="subpage-outline-btn" onClick={() => setCreateOpen(false)} disabled={creating}>
              取消
            </button>
            <Button type="button" variant="page" onClick={() => void onCreate()} disabled={creating}>
              {creating ? "创建中…" : "确认创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>扫码支付</DialogTitle>
            <DialogDescription>
              订单号 {createdOrder?.orderNo}。请使用{channelLabel(createdOrder?.payChannel)}
              扫描下方二维码；切换支付方式将关闭旧单并重新出码。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <ToggleGroup
              type="single"
              value={(createdOrder?.payChannel as PayChannel) || channel}
              onValueChange={(v) => {
                if (v === "wechat" || v === "alipay") void onSwitchPayChannel(v);
              }}
              variant="outline"
              className="justify-center"
              disabled={
                switchingChannel ||
                loading ||
                !createdOrder ||
                createdOrder.status === "paid" ||
                createdOrder.status === "failed"
              }
            >
              <ToggleGroupItem value="wechat" aria-label="微信支付" className="px-4">
                微信支付
              </ToggleGroupItem>
              <ToggleGroupItem value="alipay" aria-label="支付宝" className="px-4">
                支付宝
              </ToggleGroupItem>
            </ToggleGroup>
            {createdOrder?.codeUrl ? (
              <img
                alt="支付二维码"
                className="w-56 h-56 border border-border rounded-lg bg-white p-2"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(createdOrder.codeUrl)}`}
              />
            ) : (
              <div className="text-sm text-muted-foreground py-16">
                {switchingChannel ? "正在切换支付方式…" : "暂无二维码"}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>状态</span>
              <StatusBadge tone={orderStatusTone(createdOrder?.status)}>
                {orderStatusLabel(createdOrder?.status)}
              </StatusBadge>
            </div>
            {isPendingPayStatus(createdOrder?.status) ? (
              <p className="text-sm text-muted-foreground">正在自动查询支付结果…</p>
            ) : null}
            {createdOrder?.payAmountFen != null ? (
              <div className="text-sm font-medium text-foreground">
                应付 {formatPayFen(createdOrder.payAmountFen, createdOrder.currency)}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="subpage-outline-btn"
              disabled={!createdOrder?.orderNo || loading || switchingChannel}
              onClick={() => createdOrder?.orderNo && void onSync(createdOrder.orderNo)}
            >
              刷新状态
            </button>
            <Button variant="page" onClick={() => setQrOpen(false)} disabled={switchingChannel}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
