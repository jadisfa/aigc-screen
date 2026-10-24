import { Send } from "lucide-react";
import TicketAttachmentEditor from "@/modules/ops/components/TicketAttachmentEditor";
import type { TicketAttachment } from "@/shared/api/ops/ops-ticket";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  attachments: TicketAttachment[];
  onAttachmentsChange: (items: TicketAttachment[]) => void;
  onSubmit: () => void;
  submitting?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  disabledPlaceholder?: string;
};

/**
 * 工单回复紧凑输入控件：单卡片内集成文本、附件与发送。
 */
export default function TicketReplyComposer(props: Props) {
  const disabled = Boolean(props.disabled);
  const submitting = Boolean(props.submitting);
  const locked = disabled || submitting;
  const canSubmit = !locked && Boolean(props.value.trim());
  const placeholder = disabled
    ? props.disabledPlaceholder || "工单已结束，无法继续回复"
    : props.placeholder || "请输入处理说明、结论或追问内容";

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey) || !canSubmit) return;
    event.preventDefault();
    props.onSubmit();
  };

  return (
    <div className={cn("z-30 shrink-0 border-t border-border/50 bg-background/95 pt-3 backdrop-blur", props.className)}>
      <div className="mx-auto w-full max-w-[1080px] pb-3">
        <div
          className={cn(
            "overflow-hidden rounded-2xl border border-border/80 bg-background transition-[border-color,box-shadow] focus-within:border-foreground/30 focus-within:shadow-sm",
            disabled && "opacity-70",
          )}
        >
          <Textarea
            rows={3}
            value={props.value}
            onChange={(event) => props.onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={locked}
            placeholder={placeholder}
            className="min-h-[84px] resize-none rounded-none border-0 bg-transparent px-4 py-3 text-sm leading-6 shadow-none focus-visible:ring-0"
          />

          <div className="flex items-center justify-between gap-3 border-t border-border/60 px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <TicketAttachmentEditor
                value={props.attachments}
                onChange={props.onAttachmentsChange}
                disabled={locked}
                compact
              />
            </div>

            <div className="flex shrink-0 items-center gap-2 pr-1">
              <span className="hidden text-[11px] text-muted-foreground md:inline">Ctrl+Enter</span>
              <Button
                size="sm"
                className="h-8 px-3.5 bg-foreground text-background hover:bg-foreground/90"
                onClick={props.onSubmit}
                disabled={!canSubmit}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {submitting ? "发送中" : "发送"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
