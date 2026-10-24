import { useMemo, useState, useEffect } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Save } from "lucide-react";
import { createStorageConfig, updateStorageConfig, type StorageConfig } from "@/shared/api/sys/system-config";
import { notify } from "@/shared/lib/notify";

export type StorageCard = StorageConfig & {
  noId: boolean;
  uploadEnabled: boolean;
  returnImageEnabled: boolean;
  priority: number;
};

function safeJsonPretty(v: string | null | undefined): string {
  if (!v) return "";
  try {
    return JSON.stringify(JSON.parse(v), null, 2);
  } catch {
    return v;
  }
}

interface StorageConfigEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: StorageCard | null;
  onSaved: () => void;
}

export function StorageConfigEditDialog({ open, onOpenChange, editing, onSaved }: StorageConfigEditDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState("");

  const [providerCode, setProviderCode] = useState("");
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [uploadEnabled, setUploadEnabled] = useState(false);
  const [returnImageEnabled, setReturnImageEnabled] = useState(false);
  const [priority, setPriority] = useState("0");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [clearSecretKey, setClearSecretKey] = useState(false);
  const [bucket, setBucket] = useState("");
  const [region, setRegion] = useState("");
  const [domain, setDomain] = useState("");
  const [cdnEnabled, setCdnEnabled] = useState(false);
  const [cdnDomain, setCdnDomain] = useState("");
  const [configJson, setConfigJson] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open && editing) {
      const prettyConfigJson = safeJsonPretty(editing.configJson);
      setProviderCode(editing.providerCode);
      setName(editing.name || "");
      setEnabled(!!editing.enabled);
      setUploadEnabled(!!editing.uploadEnabled);
      setReturnImageEnabled(!!editing.returnImageEnabled);
      setPriority(String(editing.priority ?? 0));
      setAccessKey(editing.accessKey || "");
      setSecretKey("");
      setClearSecretKey(false);
      setBucket(editing.bucket || "");
      setRegion(editing.region || "");
      setDomain(editing.domain || "");
      setCdnEnabled(!!editing.cdnEnabled);
      setCdnDomain(editing.cdnDomain || "");
      setConfigJson(prettyConfigJson);
      setDescription(editing.description || "");
      setFormError(null);
      setInitialSnapshot(
        JSON.stringify({
          providerCode: editing.providerCode,
          name: editing.name || "",
          enabled: !!editing.enabled,
          uploadEnabled: !!editing.uploadEnabled,
          returnImageEnabled: !!editing.returnImageEnabled,
          priority: String(editing.priority ?? 0),
          accessKey: editing.accessKey || "",
          secretKey: "",
          clearSecretKey: false,
          bucket: editing.bucket || "",
          region: editing.region || "",
          domain: editing.domain || "",
          cdnEnabled: !!editing.cdnEnabled,
          cdnDomain: editing.cdnDomain || "",
          configJson: prettyConfigJson,
          description: editing.description || "",
        }),
      );
    } else if (!open) {
      // reset on close
      setProviderCode("");
      setName("");
      setEnabled(false);
      setUploadEnabled(false);
      setReturnImageEnabled(false);
      setPriority("0");
      setAccessKey("");
      setSecretKey("");
      setClearSecretKey(false);
      setBucket("");
      setRegion("");
      setDomain("");
      setCdnEnabled(false);
      setCdnDomain("");
      setConfigJson("");
      setDescription("");
      setFormError(null);
      setInitialSnapshot("");
    }
  }, [open, editing]);

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        providerCode,
        name,
        enabled,
        uploadEnabled,
        returnImageEnabled,
        priority,
        accessKey,
        secretKey,
        clearSecretKey,
        bucket,
        region,
        domain,
        cdnEnabled,
        cdnDomain,
        configJson,
        description,
      }),
    [
      providerCode,
      name,
      enabled,
      uploadEnabled,
      returnImageEnabled,
      priority,
      accessKey,
      secretKey,
      clearSecretKey,
      bucket,
      region,
      domain,
      cdnEnabled,
      cdnDomain,
      configJson,
      description,
    ],
  );

  const secretPlaceholder = useMemo(() => {
    if (!editing) return "密钥信息保存后不再显示";
    if (editing.hasSecretKey) return "已配置（不回显，留空表示不更新）";
    return "留空表示不设置";
  }, [editing]);

  const hasUnsavedChanges = open && !!initialSnapshot && currentSnapshot !== initialSnapshot;

  function requestCloseDialog() {
    if (saving) return;
    if (hasUnsavedChanges) {
      const ok = window.confirm("您已输入内容，确定要取消吗？未保存的内容将会丢失。");
      if (!ok) return;
    }
    onOpenChange(false);
  }

  async function handleSave() {
    if (saving) return;
    if (!editing) return;
    if (!name.trim()) {
      setFormError("请输入名称");
      return;
    }

    if (cdnEnabled && !cdnDomain.trim()) {
      setFormError("开启 CDN 加速时，请配置 CDN 加速域名");
      return;
    }

    let cfg: Record<string, unknown> = {};
    if (configJson.trim()) {
      try {
        const parsed = JSON.parse(configJson);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          cfg = parsed as Record<string, unknown>;
        } else {
          setFormError("configJson 必须是 JSON 对象");
          return;
        }
      } catch {
        setFormError("configJson 不是合法 JSON");
        return;
      }
    }
    cfg.uploadEnabled = uploadEnabled;
    cfg.returnImageEnabled = returnImageEnabled;
    cfg.priority = Math.max(0, Number.parseInt(priority || "0", 10) || 0);
    const normalizedConfigJson = JSON.stringify(cfg);

    setFormError(null);
    setSaving(true);
    try {
      if (editing.noId) {
        await createStorageConfig({
          providerCode: editing.providerCode,
          name: name,
          enabled,
          accessKey: accessKey,
          secretKeyEnc: secretKey || undefined,
          bucket: bucket,
          region: region,
          domain: domain,
          cdnEnabled: cdnEnabled,
          cdnDomain: cdnDomain,
          configJson: normalizedConfigJson,
          description: description,
        });
      } else {
        await updateStorageConfig(editing.providerCode, {
          name: name,
          enabled,
          accessKey: accessKey,
          secretKeyEnc: secretKey || undefined,
          clearSecretKey,
          bucket: bucket,
          region: region,
          domain: domain,
          cdnEnabled: cdnEnabled,
          cdnDomain: cdnDomain,
          configJson: normalizedConfigJson,
          description: description,
        });
      }
      notify.success("保存成功");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      notify.error("保存失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(openVal) => {
        if (!openVal) requestCloseDialog();
        else onOpenChange(openVal);
      }}
    >
      <DialogContent className="max-w-[60vw] p-0 gap-0 flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="px-6 pt-6">编辑存储配置</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 py-4 overflow-y-auto">
          <div className="space-y-2">
            <label className="text-sm font-normal">启用</label>
            <div className="flex items-center gap-3">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <span className="text-sm text-muted-foreground">{enabled ? "启用" : "禁用"}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-normal">上传开关</label>
            <div className="flex items-center gap-3">
              <Switch checked={uploadEnabled} onCheckedChange={setUploadEnabled} />
              <span className="text-sm text-muted-foreground">{uploadEnabled ? "启用" : "禁用"}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-normal">返图开关</label>
            <div className="flex items-center gap-3">
              <Switch checked={returnImageEnabled} onCheckedChange={setReturnImageEnabled} />
              <span className="text-sm text-muted-foreground">{returnImageEnabled ? "启用" : "禁用"}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-normal">优先级</label>
            <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-normal">ACCESS_KEY</label>
            <Input value={accessKey} onChange={(e) => setAccessKey(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-normal">SECRET_KEY</label>
            <Input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder={secretPlaceholder} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-normal">清空密钥</label>
            <div className="flex items-center gap-3">
              <Switch checked={clearSecretKey} onCheckedChange={setClearSecretKey} />
              <span className="text-sm text-muted-foreground">{clearSecretKey ? "将清空已保存密钥" : "不清空"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-normal">BUCKET</label>
            <Input value={bucket} onChange={(e) => setBucket(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-normal">REGION</label>
            <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="ap-guangzhou" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-normal">空间域名</label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="https://bucket.example.com" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-normal">CDN加速开关</label>
            <div className="flex items-center gap-3">
              <Switch checked={cdnEnabled} onCheckedChange={setCdnEnabled} />
              <span className="text-sm text-muted-foreground">{cdnEnabled ? "开启" : "关闭"}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-normal">CDN加速域名</label>
            <Input value={cdnDomain} onChange={(e) => setCdnDomain(e.target.value)} placeholder="https://cdn.example.com" />
          </div>

          <div className="space-y-2 col-span-2">
            <label className="text-sm font-normal">描述</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px]" />
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-2 border-t border-border mt-auto flex-col items-stretch sm:flex-col sm:space-x-0 gap-2">
          {formError ? <p className="text-sm text-destructive text-right">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={requestCloseDialog} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              保存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
