import { Save, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader, PageShell } from "@/shared/components/page";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import {
  getPublicWatermarkSettings,
  getWatermarkSettings,
  updateWatermarkSettings,
  type WatermarkSettings,
} from "@/shared/api/sys/system-config";
import { getApiBaseUrl } from "@/shared/api/sys/api-base";
import { notify } from "@/shared/lib/notify";

type WatermarkMode = "none" | "light" | "dark";

type WatermarkAsset = {
  url: string;
  name?: string;
  type?: string;
  size?: number;
  width?: number;
  height?: number;
};

function resolveAssetBaseUrl(): string {
  return getApiBaseUrl();
}
const DARK_TOKEN_PATTERN = /^[a-zA-Z0-9._-]{2,64}$/;
const DARK_TEMPLATE_MAX_LENGTH = 512;
const DARK_TEMPLATE_VAR_PATTERN = /\$\{([a-zA-Z0-9_]+)\}/g;
const DARK_ALGORITHM_OPTIONS = [
  { value: "image_file_tail_v1", label: "image_file_tail_v1", description: "推荐，兼容当前调度端暗水印编码实现" },
  { value: "image_lsb_v1", label: "image_lsb_v1", description: "预留算法标识，仅允许使用平台支持值" },
] as const;
const DARK_ALGORITHM_VALUES = new Set<string>(DARK_ALGORITHM_OPTIONS.map((item) => item.value));
const DARK_TEMPLATE_ALLOWED_VARS = [
  "tenantId",
  "merchantId",
  "principalId",
  "taskId",
  "assetId",
  "timestamp",
  "nonce",
  "algorithm",
  "keyVersion",
] as const;
const DARK_TEMPLATE_ALLOWED_VAR_SET = new Set<string>(DARK_TEMPLATE_ALLOWED_VARS);

function parseAsset(v: string | null | undefined): WatermarkAsset | null {
  if (!v) return null;
  try {
    const obj = JSON.parse(v) as unknown;
    if (obj && typeof obj === "object" && "url" in (obj as Record<string, unknown>)) {
      const url = (obj as Record<string, unknown>).url;
      if (typeof url === "string" && url.trim()) return obj as WatermarkAsset;
    }
    return null;
  } catch {
    return null;
  }
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

function normalizeText(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function findUnknownDarkTemplateVars(template: string): string[] {
  const unknown = new Set<string>();
  for (const match of template.matchAll(DARK_TEMPLATE_VAR_PATTERN)) {
    const key = match[1]?.trim();
    if (key && !DARK_TEMPLATE_ALLOWED_VAR_SET.has(key)) {
      unknown.add(key);
    }
  }
  return Array.from(unknown);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "未记录";
  return value.replace("T", " ").replace("Z", "");
}

export default function WatermarkManagementPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [admin, setAdmin] = useState<WatermarkSettings | null>(null);
  const [publicWm, setPublicWm] = useState<WatermarkSettings | null>(null);

  const [mode, setMode] = useState<WatermarkMode>("none");
  const [lightAsset, setLightAsset] = useState<WatermarkAsset | null>(null);
  const [lightTouched, setLightTouched] = useState(false);
  const [darkAlgorithm, setDarkAlgorithm] = useState("");
  const [darkKeyVersion, setDarkKeyVersion] = useState("");
  const [darkPayloadTemplate, setDarkPayloadTemplate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const lightFileRef = useRef<HTMLInputElement>(null);

  const effectiveLight = useMemo(() => lightTouched ? lightAsset : parseAsset(admin?.lightAsset), [admin?.lightAsset, lightAsset, lightTouched]);
  const supportedFormats = useMemo(() => {
    const values = admin?.darkSupportedFormats?.length ? admin.darkSupportedFormats : publicWm?.darkSupportedFormats;
    return (values && values.length ? values : ["png", "jpg", "jpeg"]).map((item) => item.toUpperCase());
  }, [admin?.darkSupportedFormats, publicWm?.darkSupportedFormats]);
  const activeMode = publicWm?.mode || admin?.mode || mode;
  const activeDarkSummary = publicWm?.darkPayloadTemplateSummary || admin?.darkPayloadTemplateSummary || "未生成";
  const activeDarkAlgorithm = publicWm?.darkAlgorithm || admin?.darkAlgorithm || "未配置";
  const activeDarkKeyVersion = publicWm?.darkKeyVersion || admin?.darkKeyVersion || "未配置";
  const hasUnsupportedDarkAlgorithm = !!darkAlgorithm && !DARK_ALGORITHM_VALUES.has(darkAlgorithm);

  const modeSummary = useMemo(() => {
    if (mode === "light") {
      return "当前仅展示明水印配置，保存时会更新可见叠加水印资源。";
    }
    if (mode === "dark") {
      return "当前仅展示暗水印配置，保存时会更新不可见数字水印参数。";
    }
    return "当前已关闭水印，下面不展示具体水印配置。";
  }, [mode]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [a, p] = await Promise.all([getWatermarkSettings(), getPublicWatermarkSettings().catch(() => null)]);
      setAdmin(a || { mode: "none" });
      setPublicWm(p);
      const m = (a?.mode || "none") as WatermarkMode;
      setMode(m === "light" || m === "dark" || m === "none" ? m : "none");
      setLightAsset(parseAsset(a?.lightAsset));
      setLightTouched(false);
      setDarkAlgorithm(a?.darkAlgorithm?.trim() || "");
      setDarkKeyVersion(a?.darkKeyVersion?.trim() || "");
      setDarkPayloadTemplate(a?.darkPayloadTemplate?.trim() || "");
    } catch (e) {
      notify.error("加载失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleSelectFile(file: File) {
    try {
      const url = await toDataUrl(file);
      const asset: WatermarkAsset = { url, name: file.name, type: file.type, size: file.size };
      setLightAsset(asset);
      setLightTouched(true);
    } catch (e) {
      notify.error("上传失败", { description: e instanceof Error ? e.message : "读取文件失败" });
    }
  }

  async function handleSave() {
    if (saving) return;
    const effLight = effectiveLight;
    if (mode === "light" && (!effLight || !effLight.url)) {
      setFormError("mode=light 需要先配置明水印资源");
      return;
    }

    const normalizedDarkAlgorithm = normalizeText(darkAlgorithm);
    const normalizedDarkKeyVersion = normalizeText(darkKeyVersion);
    const normalizedDarkPayloadTemplate = normalizeText(darkPayloadTemplate);

    if (mode === "dark" && (!normalizedDarkAlgorithm || !DARK_TOKEN_PATTERN.test(normalizedDarkAlgorithm))) {
      setFormError("暗水印算法仅支持 2-64 位字母、数字、点、下划线和中划线");
      return;
    }
    if (mode === "dark" && normalizedDarkAlgorithm && !DARK_ALGORITHM_VALUES.has(normalizedDarkAlgorithm)) {
      setFormError("暗水印算法必须从平台支持列表中选择，当前不支持自定义算法标识");
      return;
    }
    if (mode === "dark" && (!normalizedDarkKeyVersion || !DARK_TOKEN_PATTERN.test(normalizedDarkKeyVersion))) {
      setFormError("密钥版本仅支持 2-64 位字母、数字、点、下划线和中划线");
      return;
    }
    if (mode === "dark" && !normalizedDarkPayloadTemplate) {
      setFormError("请填写暗水印载荷模板");
      return;
    }
    if (normalizedDarkPayloadTemplate && normalizedDarkPayloadTemplate.length > DARK_TEMPLATE_MAX_LENGTH) {
      setFormError(`暗水印载荷模板最多 ${DARK_TEMPLATE_MAX_LENGTH} 个字符`);
      return;
    }
    if (mode === "dark" && normalizedDarkPayloadTemplate) {
      const unknownVars = findUnknownDarkTemplateVars(normalizedDarkPayloadTemplate);
      if (unknownVars.length > 0) {
        setFormError(`载荷模板包含未支持变量：${unknownVars.join("、")}，请改用页面提示中的变量名`);
        return;
      }
    }

    setFormError(null);
    setSaving(true);
    try {
      await updateWatermarkSettings({
        mode,
        lightAsset: effLight ? JSON.stringify(effLight) : null,
        darkAlgorithm: normalizedDarkAlgorithm,
        darkKeyVersion: normalizedDarkKeyVersion,
        darkPayloadTemplate: normalizedDarkPayloadTemplate,
      });
      notify.success("保存成功");
      await refresh();
    } catch (e) {
      notify.error("保存失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <PageShell>
      <PageHeader
        title="隐私水印配置"
        titleExtra={
          publicWm ? (
            <Badge variant="outline" className="text-xs">
              客户端读取：{publicWm.mode}
            </Badge>
          ) : null
        }
      />

      <div className="w-full max-w-[960px] mx-auto space-y-8 !mt-10">
        <div className="space-y-3 border-b border-border pb-6">
          <label className="text-sm font-normal">模式（明/暗互斥）</label>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="w-full md:w-[240px]">
            <Select
              value={mode}
              onValueChange={(v) => {
                setFormError(null);
                setMode(v as WatermarkMode);
              }}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">关闭（none）</SelectItem>
                <SelectItem value="light">明水印（light）</SelectItem>
                <SelectItem value="dark">暗水印（dark）</SelectItem>
              </SelectContent>
            </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">当前模式：{activeMode}</Badge>
              {mode === "light" && <Badge variant="secondary">可见叠加</Badge>}
              {mode === "dark" && <Badge variant="secondary">不可见数字水印</Badge>}
              {mode === "none" && <Badge variant="outline">水印关闭</Badge>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{modeSummary}</p>
        </div>

        <div className="space-y-4 border-b border-border pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">当前生效状态</span>
            {activeMode === "dark" && <Badge variant="secondary">暗水印参数已下发</Badge>}
            {activeMode === "light" && <Badge variant="secondary">明水印图片已下发</Badge>}
          </div>
          {activeMode === "dark" && (
            <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">暗水印状态</div>
                <div className="font-medium text-foreground">已启用，固定执行验签</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">算法标识</div>
                <div className="font-medium text-foreground break-all">{activeDarkAlgorithm}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">密钥版本</div>
                <div className="font-medium text-foreground break-all">{activeDarkKeyVersion}</div>
              </div>
              <div className="space-y-1 md:col-span-2">
                <div className="text-muted-foreground">载荷模板摘要</div>
                <div className="font-medium text-foreground break-all">{activeDarkSummary}</div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="text-muted-foreground">受支持格式</div>
                <div className="flex flex-wrap gap-2">
                  {supportedFormats.map((item) => (
                    <Badge key={item} variant="outline">{item}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeMode === "light" && (
            <div className="space-y-2 text-sm">
              <div className="text-muted-foreground">明水印配置</div>
              <div className="font-medium text-foreground">
                当前使用可见叠加模式，保存时将以下方明水印资源配置为准。
              </div>
            </div>
          )}
          {activeMode === "none" && (
            <div className="space-y-2 text-sm">
              <div className="text-muted-foreground">水印状态</div>
              <div className="font-medium text-foreground">当前未启用任何水印配置。</div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            最近更新时间：{formatDateTime(admin?.updatedAt)}，保存成功后会刷新平台配置并触发调度侧缓存刷新。
          </p>
        </div>

        {mode === "none" && (
          <div className="border-b border-border pb-6">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">当前未启用任何水印</div>
              <p className="text-sm text-muted-foreground">
                如需配置，请先在上方选择 `light` 或 `dark` 模式。页面将只展示当前模式对应的配置项，避免混合展示造成干扰。
              </p>
            </div>
          </div>
        )}

        {mode === "light" && (
          <div className="space-y-5 border-border pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">明水印资源</span>
                <Badge variant="secondary">light</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                明水印会以可见叠加方式作用于结果图片，支持上传图片资源或直接填写可访问的图片 URL。
              </p>
            </div>

            <div
              className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-lg overflow-hidden relative group w-full max-w-[560px]"
              style={{ minHeight: "200px" }}
            >
              {effectiveLight?.url ? (
                <>
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => lightFileRef.current?.click()} disabled={loading}>
                      <Upload className="w-4 h-4 mr-1" />
                      更换
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => { setLightAsset(null); setLightTouched(true); }} disabled={loading}>
                      <X className="w-4 h-4 mr-1" />
                      移除
                    </Button>
                  </div>
                  <img
                    src={effectiveLight.url.startsWith('/') ? resolveAssetBaseUrl() + effectiveLight.url : effectiveLight.url}
                    alt="light watermark"
                    className="block mx-auto w-auto max-w-full h-auto object-contain p-3"
                    style={{ maxHeight: "260px" }}
                  />
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer bg-muted/10 hover:bg-muted/30" onClick={() => lightFileRef.current?.click()}>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">点击上传图片</p>
                  <p className="text-xs text-muted-foreground mt-1">支持 PNG, JPG, WEBP 等格式</p>
                </div>
              )}
              <input
                ref={lightFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleSelectFile(f);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-normal">图片 URL</label>
              <Input
                className="h-10"
                value={effectiveLight?.url || ""}
                onChange={(e) => {
                  const url = e.target.value;
                  setLightAsset((prev) => ({ ...(prev || { url: "" }), url }));
                  setLightTouched(true);
                }}
                placeholder="https://... 或 data:image/..."
              />
              <p className="text-xs text-muted-foreground">可手动输入图片地址，或通过上传自动生成数据 URL。</p>
            </div>
          </div>
        )}

        {mode === "dark" && (
          <div className="space-y-6 border-border pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">暗水印参数</span>
                <Badge variant="secondary">dark</Badge>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-normal">算法标识</label>
                <Select
                  value={DARK_ALGORITHM_VALUES.has(darkAlgorithm) ? darkAlgorithm : ""}
                  onValueChange={setDarkAlgorithm}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={hasUnsupportedDarkAlgorithm ? `当前值 ${darkAlgorithm} 不受支持，请重新选择` : "请选择调度端支持的算法"} />
                  </SelectTrigger>
                  <SelectContent>
                    {DARK_ALGORITHM_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {DARK_ALGORITHM_OPTIONS.map((item) => (
                    <p key={item.value}>
                      {item.value}：{item.description}
                    </p>
                  ))}
                  {hasUnsupportedDarkAlgorithm && (
                    <p className="text-destructive">检测到历史配置值 `{darkAlgorithm}` 不在支持列表内，保存前必须重新选择。</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-normal">密钥版本</label>
                <Input
                  value={darkKeyVersion}
                  onChange={(e) => setDarkKeyVersion(e.target.value)}
                  placeholder="例如：kv-202606 或 dark-key-v1"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">建议按版本号命名，仅支持 2-64 位字母、数字、点、下划线和中划线，不支持空格。</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-normal">载荷模板</label>
              <Textarea
                value={darkPayloadTemplate}
                onChange={(e) => setDarkPayloadTemplate(e.target.value)}
                placeholder='例如：{"taskId":"${taskId}","assetId":"${assetId}","timestamp":"${timestamp}"}'
                disabled={loading}
                maxLength={DARK_TEMPLATE_MAX_LENGTH}
                className="min-h-[60px]"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{darkPayloadTemplate.length}/{DARK_TEMPLATE_MAX_LENGTH}</span>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">允许使用的模板变量</div>
                <div className="flex flex-wrap gap-2">
                  {DARK_TEMPLATE_ALLOWED_VARS.map((item) => (
                    <Badge key={item} variant="outline">{item}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  示例：`tenantId / merchantId / principalId / taskId / assetId / timestamp / nonce / algorithm / keyVersion`，未列出的变量保存时会被拦截。
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col items-end gap-2 pt-4">
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <Button variant="page" onClick={handleSave} disabled={saving || loading}>
            <Save className="w-4 h-4 mr-1" />
            保存
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
