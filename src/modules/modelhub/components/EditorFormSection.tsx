import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Label } from "@/shared/ui/label";

export function EditorSection(props: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-5 rounded-2xl bg-background/85 px-5 py-5", props.className)}>
      <div className="space-y-1.5">
        <h2 className="text-[15px] font-semibold text-foreground">{props.title}</h2>
      </div>
      {props.children}
    </section>
  );
}

export function FieldGroup(props: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={cn("space-y-2", props.className)}>
      <Label className="workflow-form-label flex items-center gap-1">
        <span>{props.label}</span>
        {props.required ? <span className="text-destructive">*</span> : null}
      </Label>
      {props.children}
    </div>
  );
}
