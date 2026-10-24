import { useEffect, useMemo, useState } from "react";
import { UserSelect } from "@/shared/components/UserSelect";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

export default function TicketAssignDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketIds: string[];
  initialAssigneeId?: string;
  title?: string;
  description?: string;
  submitting?: boolean;
  onSubmit: (assigneeId: string) => Promise<void> | void;
}) {
  const [assigneeId, setAssigneeId] = useState(props.initialAssigneeId || "");

  useEffect(() => {
    if (!props.open) return;
    setAssigneeId(props.initialAssigneeId || "");
  }, [props.initialAssigneeId, props.open]);

  const ticketCountText = useMemo(() => {
    if (props.ticketIds.length <= 1) {
      return props.ticketIds[0] || "-";
    }
    return `已选 ${props.ticketIds.length} 个工单`;
  }, [props.ticketIds]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{props.title || "工单指派"}</DialogTitle>
          <DialogDescription>
            {props.description || "支持对单个工单或所选工单批量更新处理人，留空可取消当前指派。"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
            <div className="text-muted-foreground">目标工单</div>
            <div className="mt-1 font-mono text-xs text-foreground break-all">{ticketCountText}</div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-normal">处理人</label>
            <UserSelect value={assigneeId} onChange={setAssigneeId} className="w-full" placeholder="选择处理人，留空为取消指派" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={props.submitting}>
            取消
          </Button>
          <Button onClick={() => void props.onSubmit(assigneeId)} disabled={props.submitting || props.ticketIds.length === 0}>
            {props.submitting ? "保存中..." : "确认指派"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
