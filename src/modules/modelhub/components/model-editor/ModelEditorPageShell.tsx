import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { ReactNode } from "react";

export function ModelEditorPageShell(props: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  cancelDisabled?: boolean;
  saveLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="page-content-shell">
      <div className="subpage-toolbar mb-7">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={props.onCancel} disabled={props.cancelDisabled}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-[18px] font-semibold text-foreground">{props.title}</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1080px] space-y-5">
        {props.children}
        <div className="flex justify-end gap-3 pb-8">
          <Button
            type="button"
            variant="outline"
            className="subpage-outline-btn !h-10 !px-5"
            onClick={props.onCancel}
            disabled={props.cancelDisabled}
          >
            取消
          </Button>
          <Button
            type="button"
            className="subpage-primary-btn !h-10 !px-5"
            onClick={props.onSave}
            disabled={props.saveDisabled}
          >
            <Save className="mr-1 h-4 w-4" />
            {props.saveLabel || "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
