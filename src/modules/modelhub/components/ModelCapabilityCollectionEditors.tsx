import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type SelectableOption = {
  label: string;
  value: string;
  isCustom?: boolean;
};

function handleEnterAdd(event: KeyboardEvent<HTMLInputElement>, onAdd: () => void) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  if (!event.currentTarget.value.trim()) return;
  onAdd();
}

export function CapabilityOptionGridEditor(props: {
  label: string;
  options: SelectableOption[];
  selectedValues: string[];
  draftValue: string;
  draftPlaceholder: string;
  helperText?: string;
  showCustomAdd?: boolean;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onToggle: (value: string, checked: boolean) => void;
  onRemove?: (value: string) => void;
  className?: string;
}) {
  const {
    label,
    options,
    selectedValues,
    draftValue,
    draftPlaceholder,
    helperText,
    showCustomAdd = true,
    onDraftChange,
    onAdd,
    onToggle,
    onRemove,
    className,
  } = props;
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (!draftValue.trim()) return;
    onAdd();
    setIsAdding(false);
  };

  const handleCancel = () => {
    onDraftChange("");
    setIsAdding(false);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label className="workflow-form-label">{label}</Label>
        {showCustomAdd ? (
          <Button
            type="button"
            size="sm"
            variant={isAdding ? "secondary" : "outline"}
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => {
              if (isAdding) {
                handleCancel();
                return;
              }
              setIsAdding(true);
            }}
            aria-label={isAdding ? `cancel add ${label}` : `add ${label}`}
          >
            {isAdding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {isAdding ? "取消" : "添加自定义"}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/20 px-4 py-4 md:grid-cols-4">
        {options.map((option) => (
          <div key={option.value} className="group flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-background/80">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-foreground">
              <Checkbox checked={selectedValues.includes(option.value)} onCheckedChange={(checked) => onToggle(option.value, checked === true)} />
              <span className="min-w-0 break-all">{option.label}</span>
            </label>

            {option.isCustom && onRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 rounded-full text-muted-foreground transition-colors hover:text-foreground"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onRemove(option.value);
                }}
                aria-label={`remove ${option.label}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <span className="h-6 w-6 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {showCustomAdd && isAdding ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Input
              autoFocus
              value={draftValue}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => handleEnterAdd(event, handleAdd)}
              className="workflow-form-input"
              placeholder={draftPlaceholder}
            />
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" size="sm" className="h-9 rounded-full px-4" onClick={handleAdd} disabled={!draftValue.trim()}>
                添加
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-9 rounded-full px-3" onClick={handleCancel}>
                取消
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {helperText ? <p className="text-[11px] text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}
