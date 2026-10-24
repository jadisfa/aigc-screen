import { Save, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader, PageShell } from "@/shared/components/page";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  createMiniprogramConfig,
  listMiniprogramConfigs,
  updateMiniprogramConfig,
  type MiniprogramConfig,
} from "@/shared/api/sys/system-config";
import { notify } from "@/shared/lib/notify";

const MiniProgramManagement = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingAppId, setExistingAppId] = useState<string>("");
  const [hasSecret, setHasSecret] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const [bannerImages, setBannerImages] = useState<string[]>([]);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const secretPlaceholder = useMemo(() => {
    if (hasSecret) return "已配置（不回显，留空表示不更新）";
    return "保存后不回显";
  }, [hasSecret]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setBannerImages((prev) => [...prev, ev.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removeBanner = (index: number) => {
    setBannerImages((prev) => prev.filter((_, i) => i !== index));
  };

  const loadToForm = useCallback((item: MiniprogramConfig | null) => {
    setAppId(item?.appId || "");
    setEnabled(!!item?.enabled);
    setHasSecret(!!item?.hasSecret);
    setAppSecret("");
    const raw = item?.homeBanners || "[]";
    try {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) {
        setBannerImages(arr.map((x) => (x && typeof x === "object" ? (x as { url?: string }).url || "" : "")).filter((u) => !!u));
      } else {
        setBannerImages([]);
      }
    } catch {
      setBannerImages([]);
    }
  }, []);

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMiniprogramConfigs();
      const first = res[0] || null;
      if (first) {
        setExistingAppId(first.appId);
        loadToForm(first);
      } else {
        setExistingAppId("");
        setAppId("");
        setEnabled(true);
        setHasSecret(false);
        setAppSecret("");
        setBannerImages([]);
      }
    } catch (e) {
      notify.error("加载失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setLoading(false);
    }
  }, [loadToForm]);

  const handleSave = async () => {
    if (saving) return;
    if (!appId.trim()) {
      setFormError("请填写小程序 appid");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const homeBanners = JSON.stringify(bannerImages.map((url, idx) => ({ url, sort: idx + 1 })));
      if (existingAppId) {
        await updateMiniprogramConfig(existingAppId, {
          enabled,
          appSecretEnc: appSecret || undefined,
          clearSecret: false,
          homeBanners,
        });
      } else {
        await createMiniprogramConfig({
          appId: appId.trim(),
          enabled: true,
          appSecretEnc: appSecret || undefined,
          homeBanners,
        });
      }
      notify.success("保存成功");
      await refreshList();
    } catch (e) {
      notify.error("保存失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  return (
    <PageShell>
      <PageHeader title="小程序配置" />
      <div className="w-full max-w-[800px] mx-auto space-y-6">
        <div>
          {/* <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-foreground">小程序页面显示配置</span>
          </div> */}

          <div className="space-y-2">
            <label className="text-sm font-normal">
              小程序首页轮播图
            </label>

            <div className="flex gap-3 flex-wrap">
              {bannerImages.map((img, idx) => (
                <div key={idx} className="relative w-[200px] h-[266px] rounded-md border border-border overflow-hidden group">
                  <img src={img} alt={`轮播图${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeBanner(idx)}
                    className="absolute top-1 right-1 bg-foreground/70 text-background rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-[100px] h-[133px] border-2 border-dashed border-border rounded-md flex flex-col items-center justify-center text-muted-foreground hover:border-foreground/40 hover:text-foreground/60 transition-colors"
              >
                <Plus className="w-6 h-6" />
                <span className="text-sm mt-1">上传</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleUpload}
              />
            </div>

            <p className="text-xs text-muted-foreground">建议上传图片尺寸为长600*高度800</p>
          </div>
        </div>

        {/* <div className="border-t border-border" /> */}

        <div>
          {/* <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-foreground">小程序管理配置</span>
          </div> */}

          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <div className="space-y-2">
              <label className="text-sm font-normal">
                小程序appid
              </label>
              <Input
                value={appId}
                onChange={(e) => {
                  setFormError(null);
                  setAppId(e.target.value);
                }}
                disabled={!!existingAppId}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-normal">
                小程序appSecret
              </label>
              <Input
                type="password"
                value={appSecret}
                onChange={(e) => {
                  setFormError(null);
                  setAppSecret(e.target.value);
                }}
                placeholder={secretPlaceholder}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <Button variant="page" onClick={handleSave} disabled={saving || loading}>
            <Save className="w-4 h-4 mr-1" />
            保存
          </Button>
        </div>
      </div>
    </PageShell>
  );
};


export default MiniProgramManagement;
