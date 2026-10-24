import { ArrowLeft, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ChannelModelConfigDialog from "@/modules/modelhub/components/channel-editor/ChannelModelConfigDialog";
import { toChineseBusinessLabel } from "@/modules/modelhub/types/capabilityDisplayText";
import { resolveModelKindLabel } from "@/modules/modelhub/types/modelTypeProfiles";
import { getCapabilityRegistryCatalog } from "@/modules/modelhub/types/capabilityRegistryStore";
import type {
  ChannelModelCatalogItem,
  ProviderOption,
} from "@/modules/modelhub/types/channelManagementTypes";
import {
  createBizCapability,
  updateBizCapability,
  type BizCapability,
} from "@/shared/api/model-hub/biz-capability";
import {
  listModelHubBaseModelsCatalog,
  listModelHubProviders,
  type ModelHubBaseModel,
} from "@/shared/api/model-hub/model-hub";
import { getDisplayFallback } from "@/shared/lib/format";
import {
  ROUTE_ENTRY_LABEL,
  ROUTE_ENTRY_ORDER,
  ROUTE_ENTRY_REQUIRED_CAPABILITY,
  type RouteEntryCode,
} from "@/shared/lib/route-entry-dicts";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { notify } from "@/shared/lib/notify";

const MAX_DEFAULT_PROMPT = 1000;

export type BizCapabilityEditorMode = "create" | "edit";

export interface BizCapabilityEditorPageProps {
  mode: BizCapabilityEditorMode;
  config?: BizCapability | null;
  onBack: () => void;
  onSuccess: () => void;
}

type FormState = {
  bizCode: string;
  bizName: string;
  sceneCode: RouteEntryCode;
  defaultPrompt: string;
  allowedModelIds: string[];
  remark: string;
  enabled: boolean;
};

function buildForm(config?: BizCapability | null): FormState {
  if (!config) {
    return {
      bizCode: "",
      bizName: "",
      sceneCode: "chat",
      defaultPrompt: "",
      allowedModelIds: [],
      remark: "",
      enabled: true,
    };
  }
  return {
    bizCode: config.bizCode,
    bizName: config.bizName,
    sceneCode: (config.sceneCode as RouteEntryCode) || "chat",
    defaultPrompt: config.defaultPrompt || "",
    allowedModelIds: Array.isArray(config.allowedModelIds) ? [...config.allowedModelIds] : [],
    remark: config.remark || "",
    enabled: !!config.enabled,
  };
}

function toModelCatalogItem(item: ModelHubBaseModel): ChannelModelCatalogItem {
  return {
    id: item.id,
    displayName: item.name,
    providerIds: [item.providerId],
    code: item.code,
    modelType: item.modelType,
    providerId: item.providerId,
    capabilityCodes: item.capabilities || [],
  };
}

export default function BizCapabilityEditorPage({
  mode,
  config,
  onBack,
  onSuccess,
}: BizCapabilityEditorPageProps) {
  const isCreate = mode === "create";
  const [form, setForm] = useState<FormState>(() => buildForm(config));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [baseModels, setBaseModels] = useState<ModelHubBaseModel[]>([]);
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [modelSearchKeyword, setModelSearchKeyword] = useState("");
  const [draftAllowedModelIds, setDraftAllowedModelIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    void Promise.all([listModelHubBaseModelsCatalog(), listModelHubProviders()])
      .then(([models, providers]) => {
        if (cancelled) return;
        setBaseModels(models);
        setProviderOptions(
          providers.map((item) => ({
            id: item.id,
            providerCode: item.providerCode,
            displayName: item.displayName,
            logoUrl: item.logoUrl || "",
          }))
        );
      })
      .catch((e) => {
        if (!cancelled) {
          notify.error("加载模型失败", { description: e instanceof Error ? e.message : "请求失败" });
        }
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const providerMap = useMemo(
    () =>
      providerOptions.reduce<Record<string, ProviderOption>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [providerOptions]
  );

  const capabilityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    getCapabilityRegistryCatalog().forEach((item) => {
      map.set(item.code, toChineseBusinessLabel(item.label));
    });
    return map;
  }, []);

  const availableModelOptions = useMemo(() => {
    const requiredCapability = ROUTE_ENTRY_REQUIRED_CAPABILITY[form.sceneCode];
    return baseModels
      .filter((m) => m.status === "enabled" && (m.capabilities || []).includes(requiredCapability))
      .map(toModelCatalogItem)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "zh-CN"));
  }, [baseModels, form.sceneCode]);

  const filteredModelOptions = useMemo(() => {
    const keyword = modelSearchKeyword.trim().toLowerCase();
    if (!keyword) return availableModelOptions;
    return availableModelOptions.filter(
      (item) =>
        item.displayName.toLowerCase().includes(keyword) ||
        item.code.toLowerCase().includes(keyword) ||
        item.id.toLowerCase().includes(keyword)
    );
  }, [availableModelOptions, modelSearchKeyword]);

  const selectedModelItems = useMemo(
    () =>
      availableModelOptions
        .filter((item) => form.allowedModelIds.includes(item.id))
        .map((item) => ({
          ...item,
          logoUrl: providerMap[item.providerId]?.logoUrl || "",
          providerName: providerMap[item.providerId]?.displayName || "",
        })),
    [availableModelOptions, form.allowedModelIds, providerMap]
  );

  function handleSceneChange(sceneCode: RouteEntryCode) {
    const requiredCapability = ROUTE_ENTRY_REQUIRED_CAPABILITY[sceneCode];
    setForm((f) => {
      const allowedIds = new Set(
        baseModels.filter((m) => (m.capabilities || []).includes(requiredCapability)).map((m) => m.id)
      );
      return {
        ...f,
        sceneCode,
        allowedModelIds: f.allowedModelIds.filter((id) => allowedIds.has(id)),
      };
    });
  }

  function openModelDialog() {
    setDraftAllowedModelIds(form.allowedModelIds);
    setModelSearchKeyword("");
    setModelDialogOpen(true);
  }

  function toggleDraftModel(modelId: string, checked: boolean | "indeterminate") {
    setDraftAllowedModelIds((prev) => {
      if (checked === true) {
        return prev.includes(modelId) ? prev : [...prev, modelId];
      }
      return prev.filter((id) => id !== modelId);
    });
  }

  function handleSelectAllFiltered() {
    setDraftAllowedModelIds((prev) =>
      Array.from(new Set([...prev, ...filteredModelOptions.map((item) => item.id)]))
    );
  }

  function handleConfirmModelSelection() {
    setForm((f) => ({ ...f, allowedModelIds: draftAllowedModelIds }));
    setModelDialogOpen(false);
  }

  function removeSelectedModel(modelId: string) {
    setForm((f) => ({
      ...f,
      allowedModelIds: f.allowedModelIds.filter((id) => id !== modelId),
    }));
  }

  async function handleSave() {
    const bizCode = form.bizCode.trim();
    const bizName = form.bizName.trim();
    const missing: string[] = [];
    if (!bizCode) missing.push("业务编码");
    if (!bizName) missing.push("业务名称");
    if (missing.length > 0) {
      setFormError(`请填写：${missing.join("、")}`);
      return;
    }
    if (form.defaultPrompt.length > MAX_DEFAULT_PROMPT) {
      setFormError(`默认提示词不能超过${MAX_DEFAULT_PROMPT} 字符`);
      return;
    }
    setFormError(null);

    setSaving(true);
    try {
      if (isCreate) {
        await createBizCapability({
          bizCode,
          bizName,
          sceneCode: form.sceneCode,
          defaultPrompt: form.defaultPrompt || null,
          allowedModelIds: form.allowedModelIds,
          remark: form.remark.trim() || null,
          enabled: form.enabled,
        });
      } else {
        await updateBizCapability(bizCode, {
          bizName,
          sceneCode: form.sceneCode,
          defaultPrompt: form.defaultPrompt,
          allowedModelIds: form.allowedModelIds,
          remark: form.remark.trim() || null,
          enabled: form.enabled,
        });
      }
      notify.success(isCreate ? "创建成功" : "保存成功");
      onSuccess();
    } catch (e) {
      notify.error("保存失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-content-shell">
      <div className="subpage-toolbar mb-7">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={onBack} disabled={saving}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-[18px] font-semibold text-foreground">
            {isCreate ? "新增业务能力" : "编辑业务能力"}
          </h1>
        </div>
      </div>

      <div className="w-full max-w-[1000px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">业务编码</label>
            <Input
              value={form.bizCode}
              onChange={(e) => setForm((f) => ({ ...f, bizCode: e.target.value }))}
              placeholder="例如: workflow_ui_llm"
              disabled={!isCreate}
            />
            {isCreate && <p className="text-xs text-muted-foreground">创建后不可修改，需唯一</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">业务名称</label>
            <Input
              value={form.bizName}
              onChange={(e) => setForm((f) => ({ ...f, bizName: e.target.value }))}
              placeholder="例如: 工作流 UI LLM"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">路由场景 sceneCode</label>
            <Select
              value={form.sceneCode}
              onValueChange={(v) => handleSceneChange(v as RouteEntryCode)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择场景" />
              </SelectTrigger>
              <SelectContent>
                {ROUTE_ENTRY_ORDER.map((code) => (
                  <SelectItem key={code} value={code}>
                    {ROUTE_ENTRY_LABEL[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">绑定 ModelHub 治理路由场景（InferenceScene）。</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">启用</label>
            <div className="flex items-center gap-3">
              <Switch
                className="mt-2"
                checked={form.enabled}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, enabled: checked }))}
              />
            </div>
          </div>
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="text-sm font-medium">可执行模型</label>
                <p className="mt-1 text-xs text-muted-foreground">
                  未选表示不额外限制，按该入口绑定的默认模型池路由；已选则仅从名单中按路由策略择一。C 端仍可指定任意模型，后端在默认池内匹配。
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-9 shrink-0"
                onClick={openModelDialog}
                disabled={modelsLoading || availableModelOptions.length === 0}
              >
                配置可执行模型
              </Button>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                已选 <span className="font-medium text-foreground">{form.allowedModelIds.length}</span>
                {" / "}
                {availableModelOptions.length} 个基础模型
              </span>
              {modelsLoading ? <span>加载中...</span> : null}
            </div>
            {selectedModelItems.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 bg-background/80 px-3 py-3 text-sm text-muted-foreground">
                {availableModelOptions.length === 0
                  ? "当前场景下暂无可用基础模型"
                  : "暂未配置可执行模型，将使用该入口绑定的默认模型池"}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 rounded-md border border-dashed border-border/70 bg-background/80 px-3 py-3 md:grid-cols-2 xl:grid-cols-3">
                {selectedModelItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border bg-card p-2 transition-all hover:border-primary/35 hover:shadow-md"
                  >
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-[58px] w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/30">
                        <Avatar className="h-10 w-10 rounded-xl border border-border/60">
                          <AvatarImage
                            src={item.logoUrl || undefined}
                            alt={item.providerName || item.displayName}
                            className="object-cover"
                          />
                          <AvatarFallback className="text-[11px] font-medium">
                            {getDisplayFallback(item.providerName || item.displayName)}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight text-foreground">
                            {item.displayName}
                          </span>
                          <Badge variant="outline" className="shrink-0 whitespace-nowrap px-1.5 py-0.5 text-[11px] font-medium">
                            {resolveModelKindLabel(item.modelType, item.capabilityCodes)}
                          </Badge>
                        </div>

                        <div className="space-y-1 text-[12px] leading-[1.45] text-muted-foreground/85">
                          <p className="truncate">提供方：{item.providerName || "-"}</p>
                          <p className="truncate">类型：{resolveModelKindLabel(item.modelType, item.capabilityCodes)}</p>
                          <p className="truncate font-mono">编码：{item.code || "-"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-end gap-2 pt-2">
                      <div className="min-w-0 flex-1 space-y-2 overflow-hidden">
                        <div className="flex flex-nowrap gap-1.5 overflow-hidden whitespace-nowrap">
                          {item.capabilityCodes.length > 0 ? (
                            item.capabilityCodes.map((code) => (
                              <span
                                key={`${item.id}-${code}`}
                                className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground"
                              >
                                {capabilityNameMap.get(code) || toChineseBusinessLabel(code)}
                              </span>
                            ))
                          ) : (
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground">
                              暂无能力标签
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removeSelectedModel(item.id)}
                        aria-label={`移除${item.displayName}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">
              默认提示词              <span className="ml-2 text-xs text-muted-foreground font-normal">
                {form.defaultPrompt.length}/{MAX_DEFAULT_PROMPT}
              </span>
            </label>
            <Textarea
              value={form.defaultPrompt}
              onChange={(e) => setForm((f) => ({ ...f, defaultPrompt: e.target.value }))}
              placeholder="可选，最多 1000 字符"
              rows={4}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">备注</label>
            <Textarea
              value={form.remark}
              onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
              rows={2}
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col items-end gap-2 pb-8">
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <div className="flex justify-end gap-3">
            <Button variant="outline" className="subpage-outline-btn !h-10 !px-5" onClick={onBack} disabled={saving}>
              取消
            </Button>
            <Button
              className="subpage-primary-btn !h-10 !px-5"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              <Save className="mr-1 h-4 w-4" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </div>

      <ChannelModelConfigDialog
        open={modelDialogOpen}
        title="选择可执行模型"
        onOpenChange={(open) => {
          setModelDialogOpen(open);
          if (!open) setModelSearchKeyword("");
        }}
        searchKeyword={modelSearchKeyword}
        availableModelCount={availableModelOptions.length}
        filteredModelOptions={filteredModelOptions}
        selectedModelIds={draftAllowedModelIds}
        providerOptions={providerOptions}
        onSearchKeywordChange={setModelSearchKeyword}
        onToggleModel={toggleDraftModel}
        onSelectAllFiltered={handleSelectAllFiltered}
        onClear={() => setDraftAllowedModelIds([])}
        onConfirm={handleConfirmModelSelection}
      />
    </div>
  );
}
