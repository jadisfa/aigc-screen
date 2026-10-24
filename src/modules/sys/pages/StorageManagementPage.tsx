import { ImageIcon, ListOrdered, Pencil, Upload, Globe } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageShell, StatusBadge } from "@/shared/components/page";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Badge } from "@/shared/ui/badge";
import {
  listStorageConfigs,
  setStorageConfigEnabled,
  updateStorageConfig,
} from "@/shared/api/sys/system-config";
import { StorageConfigEditDialog, type StorageCard } from "../components/StorageConfigEditDialog";
import { notify } from "@/shared/lib/notify";

const STORAGE_PROVIDER_PRESETS = [
  { providerCode: "minio", name: "MinIO", description: "MinIO 对象存储" },
  { providerCode: "oss", name: "阿里云 OSS", description: "阿里云对象存储 OSS" },
  { providerCode: "cos", name: "腾讯云 COS", description: "腾讯云对象存储 COS" },
  { providerCode: "qiniu", name: "七牛 OSS", description: "七牛云对象存储" },
  { providerCode: "s3oss", name: "S3 兼容存储", description: "S3 兼容对象存储" },
] as const;

function normalizeProviderCode(providerCode: string | null | undefined): string {
  return (providerCode || "").trim().toLowerCase();
}

function parseConfigObject(configJson: string | null | undefined): Record<string, unknown> {
  if (!configJson) return {};
  try {
    const parsed = JSON.parse(configJson);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function parseCardControls(configJson: string | null | undefined): { uploadEnabled: boolean; returnImageEnabled: boolean; priority: number } {
  const cfg = parseConfigObject(configJson);
  const uploadEnabled = cfg.uploadEnabled === true;
  const returnImageEnabled = cfg.returnImageEnabled === true;
  const parsedPriority = Number(cfg.priority);
  const priority = Number.isFinite(parsedPriority) ? Math.max(0, Math.floor(parsedPriority)) : 0;
  return { uploadEnabled, returnImageEnabled, priority };
}

export default function StorageManagementPage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<StorageCard[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StorageCard | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listStorageConfigs();
      const byProviderCode = new Map(res.map((item) => [normalizeProviderCode(item.providerCode), item]));
      const normalizedItems: StorageCard[] = STORAGE_PROVIDER_PRESETS.map((preset) => {
        const matched = byProviderCode.get(preset.providerCode);
        if (!matched) {
          return {
            id: "",
            providerCode: preset.providerCode,
            name: preset.name,
            enabled: false,
            accessKey: null,
            hasSecretKey: false,
            secretKeyMasked: null,
            bucket: null,
            region: null,
            domain: null,
            cdnEnabled: false,
            cdnDomain: null,
            configJson: JSON.stringify({ uploadEnabled: false, returnImageEnabled: false, priority: 0 }),
            description: preset.description,
            createdAt: null,
            updatedAt: null,
            updatedBy: null,
            noId: true,
            uploadEnabled: false,
            returnImageEnabled: false,
            priority: 0,
          };
        }
        const controls = parseCardControls(matched.configJson);
        return {
          ...matched,
          providerCode: preset.providerCode,
          name: matched.name || preset.name,
          description: matched.description ?? preset.description,
          noId: !matched.id,
          ...controls,
        };
      });
      setItems(normalizedItems);
    } catch (e) {
      notify.error("加载失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setLoading(false);
    }
  }, []);

  function openEdit(item: StorageCard) {
    setEditing(item);
    setDialogOpen(true);
  }

  async function handleToggleEnabled(item: StorageCard, next: boolean) {
    if (item.noId) return;
    setItems((prev) => prev.map((it) => (it.providerCode === item.providerCode ? { ...it, enabled: next } : it)));
    try {
      await setStorageConfigEnabled(item.providerCode, next);
      notify.success(next ? "已启用" : "已禁用");
    } catch (e) {
      setItems((prev) => prev.map((it) => (it.providerCode === item.providerCode ? { ...it, enabled: item.enabled } : it)));
      notify.error("更新失败", { description: e instanceof Error ? e.message : "请求失败" });
    }
  }

  async function handleCardConfigChange(
    item: StorageCard,
    patch: Partial<Pick<StorageCard, "uploadEnabled" | "returnImageEnabled" | "priority" | "cdnEnabled">>,
  ) {
    if (item.noId) return;
    const current = items.find((it) => it.providerCode === item.providerCode);
    if (!current) return;

    if (patch.cdnEnabled === true && !current.cdnDomain?.trim()) {
      notify.error("开启失败", { description: "请先点击编辑按钮配置 CDN 加速域名" });
      return;
    }

    const nextUploadEnabled = patch.uploadEnabled ?? current.uploadEnabled;
    const nextReturnImageEnabled = patch.returnImageEnabled ?? current.returnImageEnabled;
    const nextPriority = patch.priority ?? current.priority;
    const nextCdnEnabled = patch.cdnEnabled ?? current.cdnEnabled;

    const cfg = parseConfigObject(current.configJson);
    cfg.uploadEnabled = nextUploadEnabled;
    cfg.returnImageEnabled = nextReturnImageEnabled;
    cfg.priority = nextPriority;
    const nextConfigJson = JSON.stringify(cfg);

    setItems((prev) =>
      prev.map((it) =>
        it.providerCode === item.providerCode
          ? {
              ...it,
              uploadEnabled: nextUploadEnabled,
              returnImageEnabled: nextReturnImageEnabled,
              priority: nextPriority,
              cdnEnabled: nextCdnEnabled,
              configJson: nextConfigJson,
            }
          : it,
      ),
    );

    try {
      await updateStorageConfig(item.providerCode, { configJson: nextConfigJson, cdnEnabled: nextCdnEnabled });
      notify.success("更新成功");
    } catch (e) {
      notify.error("更新失败", { description: e instanceof Error ? e.message : "请求失败" });
      await refresh();
    }
  }

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <PageShell>
      <PageHeader title="存储配置" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.providerCode} className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{item.name}</span>
                <Badge variant="outline" className="text-xs">
                  {item.providerCode}
                </Badge>
                {item.noId && (
                  <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                    无 ID
                  </Badge>
                )}
              </div>
              <button
                onClick={() => openEdit(item)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                title="编辑"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">启用状态</span>
                <div className="flex items-center gap-2">
                  <Switch checked={!!item.enabled} onCheckedChange={(checked) => void handleToggleEnabled(item, checked)} disabled={item.noId} />
                  <StatusBadge tone={item.enabled ? "success" : "neutral"}>
                    {item.enabled ? "已启用" : "已禁用"}
                  </StatusBadge>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Upload className="w-4 h-4" />
                  <span>上传</span>
                </div>
                <Switch
                  checked={item.uploadEnabled}
                  disabled={item.noId}
                  onCheckedChange={(checked) => void handleCardConfigChange(item, { uploadEnabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="w-4 h-4" />
                  <span>CDN加速</span>
                </div>
                <Switch
                  checked={!!item.cdnEnabled}
                  disabled={item.noId}
                  onCheckedChange={(checked) => void handleCardConfigChange(item, { cdnEnabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ListOrdered className="w-4 h-4" />
                  <span>优先级</span>
                </div>
                <Input
                  type="number"
                  className="w-20 h-8 text-center"
                  disabled={item.noId}
                  value={item.priority}
                  onChange={(e) => {
                    const nextPriority = Math.max(0, Number.parseInt(e.target.value || "0", 10) || 0);
                    setItems((prev) => prev.map((it) => (it.providerCode === item.providerCode ? { ...it, priority: nextPriority } : it)));
                  }}
                  onBlur={(e) => {
                    const nextPriority = Math.max(0, Number.parseInt(e.currentTarget.value || "0", 10) || 0);
                    void handleCardConfigChange(item, { priority: nextPriority });
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">密钥</span>
                <Badge variant="outline" className="text-xs">
                  {item.hasSecretKey ? "已配置" : "未配置"}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>

      <StorageConfigEditDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        editing={editing}
        onSaved={() => {
          void refresh();
        }}
      />
    </PageShell>
  );
}
