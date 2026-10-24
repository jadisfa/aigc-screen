import { ArrowLeft, Plus } from "lucide-react";
import { useState } from "react";
import { EditorSection, FieldGroup } from "@/modules/modelhub/components/EditorFormSection";
import {
  formatChannelQuotaSummaryValue,
  getChannelLedgerStatusLabel,
  getChannelLedgerSourceLabel,
  getChannelLedgerTypeLabel,
  getChannelQuotaStatusLabel,
  type ChannelBaseItem,
  type ChannelQuotaAccountSummary,
  type ChannelQuotaAdjustmentValue,
  type ChannelQuotaLedgerListItem,
} from "@/modules/modelhub/types/channelManagementTypes";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

export default function ModelHubChannelQuotaEntriesPage(props: {
  channel: ChannelBaseItem;
  quotaSummary: ChannelQuotaAccountSummary | null;
  entries: ChannelQuotaLedgerListItem[];
  saving?: boolean;
  onBack: () => void;
  onCreateEntry: (entry: ChannelQuotaAdjustmentValue) => void;
}) {
  const [adjustmentMode, setAdjustmentMode] = useState<"increase" | "decrease">("increase");
  const [changeAmount, setChangeAmount] = useState("");
  const [remark, setRemark] = useState("");

  const handleCreate = () => {
    const numericAmount = Number(changeAmount.trim());
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return;
    }
    const signedAmount = adjustmentMode === "decrease" ? -numericAmount : numericAmount;
    props.onCreateEntry({
      changeAmount: String(signedAmount),
      balanceAfter: "",
      bizRef: "",
      remark: remark.trim(),
    });
    setChangeAmount("");
    setRemark("");
  };

  return (
    <div className="page-content-shell">
      <div className="subpage-toolbar mb-7">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={props.onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-[18px] font-semibold text-foreground">额度明细</h1>
            <p className="text-[12px] text-muted-foreground">{props.channel.displayName} / {props.channel.channelCode}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1080px] space-y-5">
        <EditorSection title="余额概览">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 px-4">
            <FieldGroup label="当前可用余额">
              <div className="flex h-10 items-center px-3 text-sm font-medium text-foreground">
                {props.quotaSummary ? formatChannelQuotaSummaryValue(props.quotaSummary) : "-"}
              </div>
            </FieldGroup>
            <FieldGroup label="已用额度">
              <div className="flex h-10 items-center px-3 text-sm text-muted-foreground">
                {props.quotaSummary ? `${props.quotaSummary.currency} ${props.quotaSummary.usedAmount}` : "-"}
              </div>
            </FieldGroup>
            <FieldGroup label="总额度">
              <div className="flex h-10 items-center px-3 text-sm text-foreground">
                {props.quotaSummary ? `${props.quotaSummary.currency} ${props.quotaSummary.totalAmount}` : "-"}
              </div>
            </FieldGroup>
            <FieldGroup label="状态">
              <div className="flex h-10 items-center px-3 text-sm text-muted-foreground">
                {props.quotaSummary ? getChannelQuotaStatusLabel(props.quotaSummary.status) : "-"}
              </div>
            </FieldGroup>
          </div>
          {/* <div className="mt-4 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground px-4">
            当前页面展示真实额度账户与台账明细。手工录入会落到额度台账，不再保留原型中的“有效期 / 作废”伪字段。
          </div> */}
        </EditorSection>

        <EditorSection title="手工调账">
          <div className="space-y-4 px-4">
            <div className="rounded-2xl bg-muted/15 px-4 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
                <div className="space-y-3 xl:w-[260px] xl:shrink-0">
               
                  <div className="grid w-full grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1.5">
                    <button
                      type="button"
                      className={`h-10 rounded-lg text-sm font-medium transition-colors ${
                        adjustmentMode === "increase"
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "border border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground"
                      }`}
                      onClick={() => setAdjustmentMode("increase")}
                      aria-pressed={adjustmentMode === "increase"}
                    >
                      余额充值
                    </button>
                    <button
                      type="button"
                      className={`h-10 rounded-lg text-sm font-medium transition-colors ${
                        adjustmentMode === "decrease"
                          ? "border border-rose-200 bg-rose-50 text-rose-700 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                          : "border border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground"
                      }`}
                      onClick={() => setAdjustmentMode("decrease")}
                      aria-pressed={adjustmentMode === "decrease"}
                    >
                      余额扣减
                    </button>
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_160px]">
                  <div>
                    <Input
                      value={changeAmount}
                      onChange={(event) => setChangeAmount(event.target.value)}
                      inputMode="decimal"
                      placeholder={adjustmentMode === "increase" ? "请输入要充值的金额" : "请输入要扣减的金额"}
                      className="workflow-form-input"
                    />
                  </div>
                  <div>
                    <Input
                      value={remark}
                      onChange={(event) => setRemark(event.target.value)}
                      placeholder={adjustmentMode === "increase" ? "例如 后台人工充值 / 月度补录" : "例如 后台人工扣减 / 人工修正"}
                      className="workflow-form-input"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <Button className="subpage-primary-btn h-11 w-full" onClick={handleCreate} disabled={props.saving}>
                      <Plus className="mr-1 h-4 w-4" />
                      {props.saving ? "提交中..." : adjustmentMode === "increase" ? "确认充值" : "确认扣减"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </EditorSection>

        <EditorSection title="额度台账列表">
          <div className="overflow-x-auto px-4">
            <Table className="text-[13px]">
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>变更金额</TableHead>
                  <TableHead>余额后</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>录入时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      暂无额度台账
                    </TableCell>
                  </TableRow>
                ) : (
                  props.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{getChannelLedgerTypeLabel(entry.ledgerType)}</TableCell>
                      <TableCell className="font-medium text-foreground">{entry.changeAmount}</TableCell>
                      <TableCell>{entry.balanceAfter || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={entry.status === "recorded" ? "secondary" : "outline"}>
                          {getChannelLedgerStatusLabel(entry.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{getChannelLedgerSourceLabel(entry.bizRef)}</TableCell>
                      <TableCell>{entry.remark || "-"}</TableCell>
                      <TableCell>{entry.createdAt}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </EditorSection>
      </div>
    </div>
  );
}
