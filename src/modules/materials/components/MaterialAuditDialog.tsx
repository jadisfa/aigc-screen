import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

export default function MaterialAuditDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  targetId?: string | null;
  decision: "approved" | "rejected";
  onDecisionChange: (v: "approved" | "rejected") => void;
  reason: string;
  onReasonChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="text-sm text-muted-foreground">
            ID：<span className="font-mono text-foreground">{props.targetId || "-"}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select value={props.decision} onValueChange={(v) => props.onDecisionChange(v as "approved" | "rejected")}>
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="审核结果" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">通过</SelectItem>
                <SelectItem value="rejected">拒绝</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="原因（可选）" value={props.reason} onChange={(e) => props.onReasonChange(e.target.value)} className="h-10" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={props.onSubmit} disabled={props.submitting}>
            提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
