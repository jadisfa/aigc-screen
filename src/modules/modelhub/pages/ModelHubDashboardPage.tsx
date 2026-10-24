import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Banknote,
  Cpu,
  KeyRound,
  Layers3,
  RefreshCw,
  Route,
  Server,
  Shield,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { getModelHubDashboard } from "@/shared/api/model-hub/model-hub";
import { resolveModelHubErrorMessage } from "@/modules/modelhub/services/modelhubAdminUi";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import {
  buildPermissionSetForNamespace,
  CONSOLE_PERMISSION_NAMESPACE,
  CONSOLE_PERMISSIONS,
  CONSOLE_ROUTES,
  hasPermission,
  type PermissionKey,
} from "@/shared/lib/permissions";
import { PageHeader, PageShell, TableSurface } from "@/shared/components/page";
import { formatDateTime } from "@/shared/lib/datetime";
import { formatCurrency, formatNumber, formatPercent } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { LucideIcon } from "lucide-react";
import { notify } from "@/shared/lib/notify";

/** Core data stages only — details live in resource nodes above. */
const CORE_DATA_FLOW = [
  { title: "接入鉴权", detail: "API Key 身份与挂载", icon: KeyRound },
  { title: "路由选模", detail: "安全校验 → 池/模型/渠道", icon: Route },
  { title: "预算预检", detail: "计价 → 估算 → 资金校验", icon: Banknote },
  { title: "渠道调用", detail: "记 pending → 调模型 → usage", icon: Server },
  { title: "扣费回写", detail: "扣费 → 更新日志 → 返回", icon: Wallet },
] as const;

function formatDashboardStatus(status: string) {
  switch (status) {
    case "PRIMARY_POOL":
      return "主池命中";
    case "FALLBACK_POOL":
      return "回退命中";
    case "NO_ROUTE":
      return "无可用路由";
    case "BLOCKED_BY_GUARDRAIL":
      return "已拦截";
    case "BLOCK":
      return "已拦截";
    case "REVIEW":
      return "待复核";
    case "ALERT":
      return "已告警";
    default:
      return status;
  }
}

function dashboardStatusVariant(status: string) {
  if (status === "PRIMARY_POOL" || status === "FALLBACK_POOL" || status === "已结算") {
    return "secondary" as const;
  }
  if (status === "BLOCKED_BY_GUARDRAIL" || status === "BLOCK") {
    return "destructive" as const;
  }
  return "outline" as const;
}

type ResourceNode = {
  id: string;
  title: string;
  countLabel: string;
  helper: string;
  stage: string;
  to: string;
  permissionCode: PermissionKey;
  icon: LucideIcon;
  accentClassName: string;
};

export default function ModelHubDashboardPage() {
  const permissionsQuery = useMePermissions({ sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode });
  const dashboardQuery = useQuery({
    queryKey: ["modelhub", "dashboard"],
    queryFn: () => getModelHubDashboard(),
  });
  const permissionSet = useMemo(
    () => buildPermissionSetForNamespace(CONSOLE_PERMISSION_NAMESPACE, permissionsQuery.data?.permissions ?? []),
    [permissionsQuery.data?.permissions],
  );

  useEffect(() => {
    if (!dashboardQuery.error) {
      return;
    }
    notify.error("加载失败", { description: resolveModelHubErrorMessage(dashboardQuery.error, "运营看板加载失败") });
  }, [dashboardQuery.error]);

  const stats = useMemo(() => {
    const data = dashboardQuery.data?.stats;
    return [
      {
        label: "在线渠道",
        value: formatNumber(data?.onlineChannelCount),
        helper: `共享 ${formatNumber(data?.sharedChannelCount)} / BYOK ${formatNumber(data?.byokChannelCount)}`,
        icon: Activity,
        tone: "bg-sky-50 text-sky-600",
      },
      {
        label: "启用模型池",
        value: formatNumber(data?.enabledPoolCount),
        helper: `总池数 ${formatNumber(data?.poolCount)}`,
        icon: Cpu,
        tone: "bg-violet-50 text-violet-600",
      },
      {
        label: "今日调用量",
        value: formatNumber(data?.todayCallCount),
        helper: `成功率 ${formatPercent(data?.todaySuccessRate)}`,
        icon: RefreshCw,
        tone: "bg-emerald-50 text-emerald-600",
      },
      {
        label: "今日成本",
        value: formatCurrency(data?.todayCost, data?.currency),
        helper: "统一资金账户结算",
        icon: Wallet,
        tone: "bg-amber-50 text-amber-600",
      },
    ];
  }, [dashboardQuery.data?.stats]);

  const quickBoards = useMemo(() => {
    const data = dashboardQuery.data?.highlights;
    return [
      {
        title: "安全命中",
        value: formatNumber(data?.guardrailEventCount),
        description: "近期开启的安全事件累计命中数",
        tone: "destructive" as const,
      },
      {
        title: "路由异常",
        value: formatNumber(data?.routingAnomalyCount),
        description: "主要聚焦无路由与前置安全拦截",
        tone: "outline" as const,
      },
      {
        title: "余额告警",
        value: formatNumber(data?.balanceAlertCount),
        description: "渠道额度进入 warning / exhausted 的告警数",
        tone: "secondary" as const,
      },
    ];
  }, [dashboardQuery.data?.highlights]);

  const recentEvents = dashboardQuery.data?.recentEvents ?? [];
  const resourceFlow = useMemo(() => {
    const data = dashboardQuery.data?.stats;
    const nodes: ResourceNode[] = [
      {
        id: "api-key",
        title: "API Key",
        countLabel: formatNumber(data?.apiKeyCount),
        helper: "请求接入 · 身份解析",
        stage: "接入",
        to: CONSOLE_ROUTES.modelHubApiKeys,
        permissionCode: CONSOLE_PERMISSIONS.modelHubApiKeyManage,
        icon: KeyRound,
        accentClassName: "border-sky-200 bg-sky-50/70",
      },
      {
        id: "guardrail",
        title: "安全规则",
        countLabel: formatNumber(data?.guardrailRuleCount),
        helper: "护栏拦截 · 风险审核",
        stage: "治理",
        to: CONSOLE_ROUTES.modelHubGuardrails,
        permissionCode: CONSOLE_PERMISSIONS.modelHubGuardrailManage,
        icon: Shield,
        accentClassName: "border-rose-200 bg-rose-50/70",
      },
      {
        id: "routing",
        title: "路由策略",
        countLabel: formatNumber(data?.routingProfileCount),
        helper: "路由选模 · 回落控制",
        stage: "选模",
        to: CONSOLE_ROUTES.modelHubRouting,
        permissionCode: CONSOLE_PERMISSIONS.modelHubRoutingManage,
        icon: Route,
        accentClassName: "border-indigo-200 bg-indigo-50/70",
      },
      {
        id: "pool",
        title: "模型池",
        countLabel: `${formatNumber(data?.enabledPoolCount)}/${formatNumber(data?.poolCount)}`,
        helper: "候选集合 · 绑定关系",
        stage: "选模",
        to: CONSOLE_ROUTES.modelHubPools,
        permissionCode: CONSOLE_PERMISSIONS.modelHubPoolManage,
        icon: Layers3,
        accentClassName: "border-violet-200 bg-violet-50/70",
      },
      {
        id: "base-model",
        title: "基础模型",
        countLabel: formatNumber(data?.baseModelCount),
        helper: "计费价格 · 能力边界",
        stage: "定价",
        to: CONSOLE_ROUTES.modelHubModels,
        permissionCode: CONSOLE_PERMISSIONS.modelHubBaseModelManage,
        icon: Cpu,
        accentClassName: "border-cyan-200 bg-cyan-50/70",
      },
      {
        id: "channel",
        title: "渠道",
        countLabel: `${formatNumber(data?.onlineChannelCount)}/${formatNumber(data?.channelCount)}`,
        helper: "渠道调用 · 额度预检",
        stage: "出渠",
        to: CONSOLE_ROUTES.modelHubChannels,
        permissionCode: CONSOLE_PERMISSIONS.modelHubChannelManage,
        icon: Server,
        accentClassName: "border-emerald-200 bg-emerald-50/70",
      },
      {
        id: "ledger",
        title: "日志 / 消费",
        countLabel: formatNumber(data?.todayCallCount),
        helper: "落账回写 · 结果返回",
        stage: "落账",
        to: CONSOLE_ROUTES.modelHubLogs,
        permissionCode: CONSOLE_PERMISSIONS.modelHubLogManage,
        icon: Wallet,
        accentClassName: "border-amber-200 bg-amber-50/70",
      },
    ];
    return nodes.filter((item) => hasPermission(permissionSet, item.permissionCode));
  }, [dashboardQuery.data?.stats, permissionSet]);

  return (
    <PageShell>
      <PageHeader
        title="模型看板"
        actions={
          <Button
            variant="pageOutline"
            onClick={() => void dashboardQuery.refetch()}
            disabled={dashboardQuery.isFetching}
          >
            <RefreshCw className="w-4 h-4" />
            {dashboardQuery.isFetching ? "刷新中..." : "刷新看板"}
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-xl border border-border/80 bg-card px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[14px] text-muted-foreground">{item.label}</div>
                <div className="mt-2 text-[20px] font-semibold leading-none tracking-tight text-foreground">
                  {item.value}
                </div>
                <div className="mt-2 truncate text-[13px] text-muted-foreground">{item.helper}</div>
              </div>
              <div className={`rounded-lg p-2 ${item.tone}`}>
                <item.icon className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card className="mt-4 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">调用请求流</CardTitle>
          <CardDescription>
            从接入到回写的单向调用链。节点对应正式资源，数量用于理解当前治理规模与上下游依赖。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-[920px] items-stretch gap-2">
              {resourceFlow.map((item, index) => (
                <div key={item.id} className="flex min-w-0 flex-1 items-stretch gap-2">
                  <Link
                    to={item.to}
                    className={`group flex min-h-[108px] flex-1 flex-col rounded-xl border px-3 py-3 transition-colors hover:border-primary/40 hover:bg-background ${item.accentClassName}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <item.icon className="h-3.5 w-3.5" />
                        {item.stage}
                      </div>
                      <span className="text-[11px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        进入
                      </span>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-foreground">{item.title}</div>
                    <div className="mt-1 text-[22px] font-semibold leading-none tracking-tight text-foreground">
                      {item.countLabel}
                    </div>
                    <div className="mt-2 text-[11px] leading-4 text-muted-foreground">{item.helper}</div>
                  </Link>
                  {index < resourceFlow.length - 1 ? (
                    <div className="flex w-4 shrink-0 items-center justify-center text-muted-foreground/70">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-gradient-to-br from-muted/40 via-background to-muted/20 px-4 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">核心数据流</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">一次调用里真正影响计费与结果的五段路径</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="flex min-w-[720px] items-stretch">
                {CORE_DATA_FLOW.map((step, index) => (
                  <div key={step.title} className="flex min-w-0 flex-1 items-stretch">
                    <div className="relative flex flex-1 flex-col rounded-lg border border-border/60 bg-background/90 px-3 py-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                          {index + 1}
                        </span>
                        <step.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="mt-2.5 text-sm font-semibold text-foreground">{step.title}</div>
                      <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{step.detail}</div>
                    </div>
                    {index < CORE_DATA_FLOW.length - 1 ? (
                      <div className="flex w-6 shrink-0 items-center justify-center text-muted-foreground/55">
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">最新治理事件</CardTitle>
            <CardDescription>路由、安全、消费和日志里最近事件</CardDescription>
          </CardHeader>
          <CardContent>
            <TableSurface>
              <Table className="text-[13px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>事件号</TableHead>
                    <TableHead>模块</TableHead>
                    <TableHead>内容</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>责任域</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEvents.length > 0 ? (
                    recentEvents.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.id}</TableCell>
                        <TableCell>{item.module}</TableCell>
                        <TableCell>{item.subject}</TableCell>
                        <TableCell>
                          <Badge variant={dashboardStatusVariant(item.status)}>
                            {formatDashboardStatus(item.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.owner}</TableCell>
                        <TableCell>{formatDateTime(item.time)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        {dashboardQuery.isLoading ? "加载中..." : "暂无治理事件"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableSurface>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {quickBoards.map((item) => (
            <Card key={item.title} className="shadow-none">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <Badge variant={item.tone}>{item.value}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
