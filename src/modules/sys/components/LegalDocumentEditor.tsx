import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import RichTextEditor from "@/shared/components/RichTextEditor";
import type { LegalDocument } from "@/shared/api/sys/system-config";

export interface LegalDocumentEditorProps {
  editingDoc: LegalDocument | null;
  formTitle: string;
  setFormTitle: (title: string) => void;
  formVersion: string;
  setFormVersion: (version: string) => void;
  formContent: string;
  setFormContent: (content: string) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  docTypeName: string; // e.g. "协议" or "政策"
  formError?: string | null;
}

export default function LegalDocumentEditor({
  editingDoc,
  formTitle,
  setFormTitle,
  formVersion,
  setFormVersion,
  formContent,
  setFormContent,
  saving,
  onSave,
  onCancel,
  docTypeName,
  formError,
}: LegalDocumentEditorProps) {
  return (
    <div className="page-content-shell">
      <div className="subpage-toolbar mb-7">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-[18px] font-semibold text-foreground">
            {editingDoc ? `编辑${docTypeName}版本` : `新增${docTypeName}版本`}
          </h1>
        </div>
      </div>

      <div className="w-full max-w-[1000px] mx-auto">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-normal">标题</label>
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder={`例如：用户${docTypeName} V1.0`}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-normal">版本号</label>
            <Input
              value={formVersion}
              onChange={(e) => setFormVersion(e.target.value)}
              placeholder="例如 1.0.0"
            />
          </div>
        </div>

        <div className="space-y-2 flex-1 flex flex-col mb-6">
          <label className="text-sm font-normal">内容</label>
          <RichTextEditor content={formContent} onChange={setFormContent} />
        </div>

        <div className="flex flex-col items-end gap-2">
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel}>
              返回
            </Button>
            <Button
              onClick={onSave}
              disabled={saving}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              <Save className="w-4 h-4 mr-1" />
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
