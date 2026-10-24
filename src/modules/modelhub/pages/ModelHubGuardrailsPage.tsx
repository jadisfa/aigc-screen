import { RefreshCw } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ModelHubGuardrailEditorPage from "@/modules/modelhub/components/ModelHubGuardrailEditorPage";
import { fetchGuardrailListPage } from "@/modules/modelhub/services/guardrailManagementService";
import { resolveModelHubErrorMessage } from "@/modules/modelhub/services/modelhubAdminUi";
import {
  buildGuardrailReferenceDescriptions,
} from "@/modules/modelhub/types/guardrailManagementHelpers";
import {
  GUARDRAIL_RISK_OPTIONS,
  type GuardrailRiskLevel,
} from "@/modules/modelhub/types/guardrailManagementTypes";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  StatusBadge,
  TableSurface,
  statusToneFromCode,
  type StatusBadgeTone,
} from "@/shared/components/page";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { formatNumber } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { notify } from "@/shared/lib/notify";

function riskTone(riskLevel: string): StatusBadgeTone {
  if (riskLevel === "high") return "danger";
  if (riskLevel === "medium") return "warning";
  return "info";
}

export default function ModelHubGuardrailsPage() {
  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, invalidateTotal, changePageSize, rememberTotal } =
    usePagedListQuery();
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingId, setEditingId] = useState("");
  const [referenceViewingId, setReferenceViewingId] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [risk, setRisk] = useState<"all" | GuardrailRiskLevel>("all");

  const listQuery = useQuery({
    queryKey: ["modelhub", "guardrails", pageNo, pageSize, keyword, risk],
    queryFn: () =>
      fetchGuardrailListPage({
        pageNo,
        pageSize,
        total: getTotalParam(),
        keyword: keyword.trim() || undefined,
        riskLevel: risk === "all" ? undefined : risk,
      }),
    enabled: view === "list",
  });

  useEffect(() => {
    rememberTotal(listQuery.data?.page.total);
  }, [listQuery.data?.page.total, rememberTotal]);

  useEffect(() => {
    if (!listQuery.error) {
      return;
    }
    notify.error("加载失败", { description: resolveModelHubErrorMessage(listQuery.error, "安全规则列表加载失败") });
  }, [listQuery.error]);

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.page.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const loading = listQuery.isFetching;

  const applyFilters = () => {
    setKeyword(keywordInput.trim());
    resetPage();
  };

  const summaryCards = useMemo(() => {
    const summary = listQuery.data?.summary;
    return [
      { value: formatNumber(summary?.totalCount), label: "规则总数", hint: "当前配置数量", badge: "GD", badgeClassName: "bg-violet-50 text-violet-600" },
      { value: formatNumber(summary?.enabledCount), label: "启用规则", hint: "参与预检查看", badge: "ON", badgeClassName: "bg-emerald-50 text-emerald-600" },
      { value: formatNumber(summary?.highRiskCount), label: "高危规则", hint: "critical 风险", badge: "CR", badgeClassName: "bg-rose-50 text-rose-500" },
      { value: formatNumber(summary?.hitCount), label: "命中事件", hint: "来自调用事实", badge: "HT", badgeClassName: "bg-amber-50 text-amber-500" },
    ];
  }, [listQuery.data?.summary]);

  if (view === "create" || view === "edit") {
    return (
      <ModelHubGuardrailEditorPage
        mode={view}
        editingId={editingId}
        onCancel={() => {
          setView("list");
          setEditingId("");
        }}
        onSuccess={() => {
          invalidateTotal();
          void listQuery.refetch();
          setView("list");
          setEditingId("");
        }}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="安全规则"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => {
              void listQuery.refetch();
            }} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              {loading ? "刷新中..." : "刷新"}
            </Button>
            <Button variant="page" onClick={() => setView("create")}>
              新增安全规则
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => (
          <Card key={item.label} className="rounded-2xl border border-border/80 bg-card shadow-none">
            <CardContent className="flex items-start justify-between px-5 py-5">
              <div>
                <div className="text-[16px] font-semibold leading-none text-foreground">{item.value}</div>
                <div className="mt-3 text-sm font-medium text-foreground">{item.label}</div>
                <div className="mt-4 text-xs text-muted-foreground">{item.hint}</div>
              </div>
              <div className={`rounded-xl px-3 py-2 text-[15px] font-medium ${item.badgeClassName}`}>{item.badge}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PageFilterBar>
          <div className="flex items-center gap-2">
            <Select value={risk} onValueChange={(value) => {
              setRisk(value as "all" | GuardrailRiskLevel);
              resetPage();
            }}>
              <SelectTrigger className="subpage-native-select h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                <SelectItem className="subpage-select-item" value="all">
                  全部等级
                </SelectItem>
                {GUARDRAIL_RISK_OPTIONS.map((option) => (
                  <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SearchField
            wrapClassName="!max-w-[420px] shrink-0"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyFilters();
              }
            }}
            placeholder="搜索规则名称"
          />
          <Button variant="pageOutline" onClick={applyFilters} disabled={loading}>
            搜索
          </Button>
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead>规则</TableHead>
              <TableHead>风险等级</TableHead>
              <TableHead>匹配条件摘要</TableHead>
              <TableHead>处置动作</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>系统默认</TableHead>
              <TableHead>引用次数</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className="w-44">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <Fragment key={item.id}>
                <TableRow>
                  <TableCell>
                    <div className="font-medium text-foreground">{item.name}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={riskTone(item.riskLevel)}>{item.riskLabel}</StatusBadge>
                  </TableCell>
                  <TableCell>{item.matchSummary}</TableCell>
                  <TableCell>{item.actionLabel}</TableCell>
                  <TableCell>
                    <StatusBadge tone={statusToneFromCode(item.status)}>{item.statusLabel}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    {item.isSystemBaseline ? <Badge variant="secondary">系统默认基线</Badge> : <span className="text-muted-foreground">否</span>}
                  </TableCell>
                  <TableCell>{item.referenceCount === 0 ? "未引用" : `${item.referenceCount} 个 API Key`}</TableCell>
                  <TableCell>{item.updatedAtLabel}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-primary"
                        onClick={() => {
                          setEditingId(item.id);
                          setView("edit");
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-xs text-muted-foreground"
                        onClick={() => setReferenceViewingId((prev) => (prev === item.id ? "" : item.id))}
                      >
                        {referenceViewingId === item.id ? "收起引用" : "查看引用"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {referenceViewingId === item.id ? (
                  <TableRow>
                    <TableCell colSpan={9} className="bg-muted/10">
                      <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-medium text-foreground">引用说明</div>
                          {item.isSystemBaseline ? <Badge variant="secondary">系统默认基线</Badge> : null}
                          <Badge variant="outline">{item.referenceCount} 个 API Key</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {buildGuardrailReferenceDescriptions(item.referenceSummary).map((line) => (
                            <div key={line}>{line}</div>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
            {!loading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  暂无符合条件的安全规则
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableSurface>

      <CommonPaginationBar
        total={total}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={pageNo < totalPages}
        onPageNoChange={setPageNo}
        onPageSizeChange={changePageSize}
        disabled={loading}
      />
    </PageShell>
  );
}
