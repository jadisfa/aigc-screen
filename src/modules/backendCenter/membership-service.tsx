import React, { useEffect, useMemo, useState, useRef } from "react";
import { Spin, Card, Tag, Button, Modal } from "antd";
import { FireFilled, ThunderboltTwoTone, CheckOutlined } from "@ant-design/icons";
import { Sparkles } from "lucide-react";
import { listComputePackages } from "@/shared/api/ops/ops-compute-package";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import { listPaymentGatewayConfigs, type PaymentGatewayConfig } from "@/shared/api/sys/system-config";
import { useMessage } from "@/utils/common";
import {CONSOLE_PERMISSION_NAMESPACE} from "@/shared/lib/permissions";
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
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { formatCurrency } from "@/shared/lib/format";
import { StatusBadge, statusToneFromCode } from "@/shared/components/page";
import "@/assets/css/scss/global.scss";

function channelLabel(channel: string | null | undefined): string {
  if (channel === "alipay") return "支付宝";
  if (channel === "wechat") return "微信";
  return channel || "-";
}

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

interface ComputePackage {
    id: string;
    name: string;
    amount: number;
    bonusCompute: number;
    computeQuota: number;
    coverUrl: string | null;
    currency: string;
    description: string | null;
    enabled: boolean;
    [key: string]: any;
 }

 const currencySymbolMap = {
  CNY: '¥',
  USD: '$',
  JPY: '¥',
  KRW: '₩'
}
type PayChannel = "wechat" | "alipay";
const PAY_STATUS_POLL_MS = 4000;

const MembershipService = () => {
     const { messageError, messageSuccess } = useMessage();
    const [loading, setLoading] = useState<boolean>(true);
    const [datas, setDatas] = useState<ComputePackage[]>([]);
    const [selectedPackage, setSelectedPackage] = useState<ComputePackage | null>(null);
    const { data: meInfo, refetch: refetchMePermissions } = useMePermissions({ sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode });
    const [ open, setOpen ] = useState<boolean>(false); // 支付弹框
    const [payArr, setPayArr] = useState<PaymentGatewayConfig[]>([]); // 支付类型
    const selectPay = useRef<PaymentGatewayConfig | null>(null); // 选中的支付类型
    const [createdOrder, setCreatedOrder] = useState<OnlineRechargeOrder | null>(null); // 生成订单信息
    const [switchingChannel, setSwitchingChannel] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            const {page, items}= await listComputePackages({
                pageNo: 1,
                pageSize: 50,
            }).finally(() => { setLoading(false) });
            const pays = await listPaymentGatewayConfigs();
            selectPay.current = pays?.filter((item: PaymentGatewayConfig) => item?.gatewayCode == 'wechat' || item?.name?.includes('微信')) || null;
            // 仅显示基础套餐
            setDatas(items.filter((item) => item?.enabled && item?.packageType == 'recharge') || []);
            setPayArr(pays || []);
            setLoading(false);
        }

        fetchData();
    }, [])

      const onSwitchPayChannel = async (nextChannel: PayChannel) => {
        selectPay.current = payArr?.filter((item: PaymentGatewayConfig) => item?.gatewayCode == nextChannel )[0] || null;
        console.log(payArr?.filter((item: PaymentGatewayConfig) => item?.gatewayCode == nextChannel ), nextChannel, '切换支付方式')
        if (!createdOrder || switchingChannel || loading) return;
        if (createdOrder.payChannel === nextChannel) return;
        if (createdOrder.status === "paid") {
        messageError("订单已支付,无法切换支付方式");
          return;
        }
    
        setSwitchingChannel(true);
        try {
          if (createdOrder.status === "created" || createdOrder.status === "paying") {
            await closeOnlineRecharge(createdOrder.orderNo);
          }
          const created = await createOnlineRecharge({
            packageId: selectedPackage?.id || '',
            payChannel: selectPay.current?.gatewayCode || 'wechat',
            principalId: meInfo?.principalId || '',
          });
        //   setChannel(nextChannel);
          setCreatedOrder(created);
        //   notify.success("已切换支付方式", { description: `请使用${channelLabel(nextChannel)}扫码` });
          messageSuccess(`已切换支付方式，请使用${channelLabel(nextChannel)}扫码`);
        } catch (e) {
            messageError("请刷新后重试");
        } finally {
          setSwitchingChannel(false);
        }
      };

    const onSync = async (orderNo: string) => {
        try {
            const updated = await syncOnlineRechargeStatus(orderNo);
            if (createdOrder?.orderNo === orderNo) {
                setCreatedOrder(updated);
            }
        } catch (e) {
            messageError("查询失败，请稍后重试");
        }
    };


    // 点击订阅
    const handlePay = async (item: ComputePackage) => {
        console.log(item, payArr, selectPay.current,'点击订阅')
        setSelectedPackage(item);
        const orderParam = {
            packageId: item.id,
            payChannel: selectPay.current?.gatewayCode || 'wechat',
            principalId: meInfo?.principalId || '',
            // storeId
        }
        const payOrder = await createOnlineRecharge(orderParam);
        setCreatedOrder(payOrder);
        if (payOrder?.orderId) {
            messageSuccess(`创建成功,订单号：${payOrder.orderNo}`);
            setOpen(true);
        }
    }

    useEffect(() => {
        if (!open || switchingChannel) return;
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
                messageSuccess(`支付成功，订单号：${updated.orderNo}`);
                return;
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
    }, [createdOrder?.orderNo, createdOrder?.status, switchingChannel]);

    const handleClosePay = () => {
        setOpen(false);
        setCreatedOrder(null);
        selectPay.current = null;
    }


    return (
        <>
            <div className="absolute inset-0 bg-[#fff] p-[20px]">
                <div className="flex justify-center font-bold items-center leading-2">
                    <FireFilled className="mr-2" style={{color: 'rgb(253, 57, 70)'}} />
                    限时专享优惠
                    <FireFilled className="ml-2" style={{color: 'rgb(253, 57, 70)'}} />
                </div>
                <div className="w-full mt-2">
                    <Spin spinning={loading} className="w-full min-h-[600px]">
                        <div className="grid grid-cols-4 gap-3 pa-2">
                            {(!loading && datas.length > 0 ) && datas.map((item) => (
                                <Card className="min-h-[600px] border-2 cursor-pointer hover:scale-[1.03] transition-transform duration-300 rounded-3xl
                                border-gray-200 hover:border-primary-500 hover:shadow-lg pa-0 ndmy-custom-card overflow-hidden" key={item.id}>
                                    <div className="h-1 gradient primary opacity-80 pa-0"></div>
                                    <div className="flex flex-col flex-1 p-5 w-full">
                                        <div className="mb-4">
                                            <h3 className="text-2xl leading-snug text-gray-800 font-normal">{item?.name}</h3>
                                            {/* {item?.description && <p className="text-sm text-gray-500 mt-2">{item.description}</p> } */}
                                        </div>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            <Tag className="flex items-center" color="#2db7f5" variant="outlined"><ThunderboltTwoTone className="mr-2" />{`${item?.computeQuota} 分`}</Tag>
                                            <Tag className="flex items-center" color="#87d068" variant="outlined"><Sparkles size="15" className="mr-2" />{`额外赠送 ${item?.bonusCompute} 分`}</Tag>
                                        </div>
                                        <div className="mb-4 pt-3 border-t border-gray-200 flex items-baseline gap-1">
                                            <span className="text-2xl font-bold text-primary">{ currencySymbolMap[item.currency as keyof typeof currencySymbolMap] }</span>
                                                <span
                                                    className="text-3xl font-bold text-gray-800"
                                                >{ item.amount / 100 }</span>
                                        </div>
                                        <Button size="large" type="primary" className="w-full gradient primary flex items-center justify-start" onClick={() =>handlePay(item)}>
                                            <span className="text-sm font-semibold ">
                                            订阅 • { `${(item.amount || 0)} 分` }
                                            </span>
                                        </Button>
                                        {/* 套餐详情列表 */}
                                        <div className="flex-1 my-4 space-y-2">
                                            {(item.detailContent?.split('\n') ?? []).map((detailItem, detailIndex) => {
                                                return (
                                                    <div className="flex items-start gap-2 text-xs text-gray-600" key={detailIndex}>
                                                        <CheckOutlined style={{ color: '#4caf50', marginTop: '2px' }} />
                                                        <span>{detailItem}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </Card>
                        ))}
                        </div>
                    </Spin>
                </div>  
            </div>
            <Modal open={open} onCancel={() => handleClosePay()} footer={null} title="扫码支付">
                <div className="text-sm">
                    订单号 {createdOrder?.orderNo}。请使用{channelLabel(createdOrder?.payChannel)}扫描下方二维码；切换支付方式将关闭旧单并重新出码。
                </div>
                <div className="flex flex-col items-center gap-4 py-2">
                    <ToggleGroup
                        type="single"
                        value={(createdOrder?.payChannel as PayChannel) || 'wechat'}
                        onValueChange={(v) => {
                        if (v === "wechat" || v === "alipay") void onSwitchPayChannel(v);
                        }}
                        variant="outline"
                        className="justify-center"
                        disabled={
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
                <div className="flex items-center justify-end gap-2 mt-4">
                    <button
                    type="button"
                    className="subpage-outline-btn"
                    disabled={!createdOrder?.orderNo || loading || switchingChannel}
                    onClick={() => createdOrder?.orderNo && void onSync(createdOrder.orderNo)}
                    >
                    刷新状态
                    </button>
                    <Button  onClick={() => handleClosePay()} disabled={switchingChannel}>
                    关闭
                    </Button>
                </div>
            </Modal>
        </>
    )
}


export default MembershipService;