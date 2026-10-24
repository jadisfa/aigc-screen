import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Save, X } from "lucide-react";
import { notify } from "@/shared/lib/notify";
import ChannelModelConfigDialog from "@/modules/modelhub/components/channel-editor/ChannelModelConfigDialog";
import { EditorSection, FieldGroup } from "@/modules/modelhub/components/EditorFormSection";
import ImageMaterialField from "@/modules/modelhub/components/ImageMaterialField";
import { toChineseBusinessLabel } from "@/modules/modelhub/types/capabilityDisplayText";
import { getCapabilityRegistryCatalog } from "@/modules/modelhub/types/capabilityRegistryStore";
import { resolveModelKindLabel } from "@/modules/modelhub/types/modelTypeProfiles";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { getFileMaterialByHash, uploadFileMaterialForm } from "@/shared/api/materials/materials-file-material";
import FileMaterialPickerDialog from "@/shared/components/FileMaterialPickerDialog";
import {
  collectRequiredScenes,
  formatChannelQuotaSummaryValue,
  protocolsForScene,
  resolveSingleSceneProtocol,
  scenesRequiringProtocolChoice,
  type AuthType,
  type ChannelEditorValue,
  type ChannelModelCatalogItem,
  type ChannelProtocolOption,
  type ChannelQuotaAccountSummary,
  type ChannelSceneOption,
  type ChannelType,
  type AuthMode,
  type ProviderOption,
  type ChannelScopeSelection,
} from "@/modules/modelhub/types/channelManagementTypes";
import { getSessionScopeReadyError, withSessionScope } from "@/shared/hooks/use-session-scope";
import { useGovernanceScopeChoice } from "@/shared/hooks/use-governance-scope-choice";
import { md5HexFromFile } from "@/shared/lib/md5";
import { getDisplayFallback } from "@/shared/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";

function buildEmptyValue(scope?: ChannelScopeSelection): ChannelEditorValue {
  return {
    name: "",
    channelCode: "",
    merchantId: scope?.merchantId?.trim() || "",
    storeId: scope?.storeId?.trim() || "",
    principalId: scope?.principalId?.trim() || "",
    channelType: "provider_direct",
    authMode: "shared",
    sceneProtocolIds: {},
    sceneConfigJsons: {},
    providerId: "",
    platformSubject: "",
    supportedModelIds: [],
    modelBillingMultipliers: {},
    modelUpstreamCodes: {},
    modelPathPrefixes: {},
    endpoint: "",
    iconUrl: "",
    enabled: true,
    credentialId: null,
    credentialName: "",
    authType: "api_key",
    primaryCredential: true,
    credentialSecret: "",
    credentialMask: "",
  };
}

function normalizeWrappedText(value: string): string {
  let normalized = value.trim();
  while (normalized.length >= 2) {
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    const wrappedByBackticks = first === "`" && last === "`";
    const wrappedByDoubleQuotes = first === "\"" && last === "\"";
    const wrappedBySingleQuotes = first === "'" && last === "'";
    if (!wrappedByBackticks && !wrappedByDoubleQuotes && !wrappedBySingleQuotes) {
      break;
    }
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

function parseStructuredCredential(authType: AuthType, credentialSecret: string) {
  if (authType !== "ak_sk" || !credentialSecret.trim()) {
    return { accessKey: "", secretKey: "" };
  }
  try {
    const parsed = JSON.parse(credentialSecret) as { accessKey?: string; secretKey?: string };
    return {
      accessKey: parsed.accessKey?.trim() || "",
      secretKey: parsed.secretKey?.trim() || "",
    };
  } catch {
    return { accessKey: "", secretKey: "" };
  }
}

function buildCredentialCiphertext(authType: AuthType, values: {
  apiKeySecret: string;
  tokenSecret: string;
  accessKey: string;
  secretKey: string;
}) {
  if (authType === "token") {
    return values.tokenSecret.trim();
  }
  if (authType === "ak_sk") {
    if (!values.accessKey.trim() && !values.secretKey.trim()) {
      return "";
    }
    return JSON.stringify({
      accessKey: values.accessKey.trim(),
      secretKey: values.secretKey.trim(),
    });
  }
  return values.apiKeySecret.trim();
}

function normalizePositiveMultiplierText(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return String(parsed);
}

export default function ModelHubChannelEditorPage(props: {
  mode: "create" | "edit";
  initialValue?: ChannelEditorValue | null;
  initialScope: ChannelScopeSelection;
  providerOptions: ProviderOption[];
  modelCatalog: ChannelModelCatalogItem[];
  scenes: ChannelSceneOption[];
  protocols: ChannelProtocolOption[];
  quotaSummary?: ChannelQuotaAccountSummary | null;
  initialOpenModelDialog?: boolean;
  saving?: boolean;
  onCancel: () => void;
  onOpenQuota?: () => void;
  onSuccess: (value: ChannelEditorValue) => void;
}) {
  const localUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [name, setName] = useState("");
  const [channelCode, setChannelCode] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [channelType, setChannelType] = useState<ChannelType>("provider_direct");
  const [authMode, setAuthMode] = useState<AuthMode>("shared");
  const [sceneProtocolIds, setSceneProtocolIds] = useState<Record<string, string>>({});
  const [sceneConfigJsons, setSceneConfigJsons] = useState<Record<string, string>>({});
  const [platformSubject, setPlatformSubject] = useState("");
  const [supportedModelIds, setSupportedModelIds] = useState<string[]>([]);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [hasOpenedInitialModelDialog, setHasOpenedInitialModelDialog] = useState(false);
  const [modelSearchKeyword, setModelSearchKeyword] = useState("");
  const [draftSupportedModelIds, setDraftSupportedModelIds] = useState<string[]>([]);
  const [modelBillingMultipliers, setModelBillingMultipliers] = useState<Record<string, string>>({});
  const [modelUpstreamCodes, setModelUpstreamCodes] = useState<Record<string, string>>({});
  const [modelPathPrefixes, setModelPathPrefixes] = useState<Record<string, string>>({});
  const [pathPrefixEditorOpenIds, setPathPrefixEditorOpenIds] = useState<Record<string, boolean>>({});
  const [bulkBillingMultiplier, setBulkBillingMultiplier] = useState("1");
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [authType, setAuthType] = useState<AuthType>("api_key");
  const [endpoint, setEndpoint] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [uploadingLocalIcon, setUploadingLocalIcon] = useState(false);
  const [apiKeySecret, setApiKeySecret] = useState("");
  const [tokenSecret, setTokenSecret] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [credentialMask, setCredentialMask] = useState("");
  const {
    sessionScope,
    canChooseMerchant,
    canChooseStore,
    fixedMerchantId,
    fixedStoreId,
    merchantOptions,
    storeOptions,
    isPlatformScoped,
  } = useGovernanceScopeChoice({
    allowChoose: props.mode === "create",
    extraFixedMerchantId: props.initialScope.merchantId,
    extraFixedStoreId: props.initialScope.storeId,
    merchantId,
    storeId,
    onMerchantIdChange: setMerchantId,
    onStoreIdChange: setStoreId,
    clearStoreWhenMerchantEmpty: true,
  });

  useEffect(() => {
    const initialValue = props.initialValue || buildEmptyValue(props.initialScope);
    setEnabled(initialValue.enabled);
    setName(initialValue.name);
    setChannelCode(initialValue.channelCode);
    setMerchantId(initialValue.merchantId);
    setStoreId(initialValue.storeId);
    setChannelType(initialValue.channelType);
    setAuthMode(initialValue.authMode);
    setSceneProtocolIds(initialValue.sceneProtocolIds || {});
    setSceneConfigJsons(initialValue.sceneConfigJsons || {});
    setPlatformSubject(initialValue.platformSubject);
    setSupportedModelIds(initialValue.supportedModelIds);
    setDraftSupportedModelIds(initialValue.supportedModelIds);
    setModelBillingMultipliers(initialValue.modelBillingMultipliers || {});
    setModelUpstreamCodes(initialValue.modelUpstreamCodes || {});
    setModelPathPrefixes(initialValue.modelPathPrefixes || {});
    setPathPrefixEditorOpenIds({});
    setBulkBillingMultiplier("1");
    setCredentialId(initialValue.credentialId || null);
    setAuthType(initialValue.authType);
    setEndpoint(normalizeWrappedText(initialValue.endpoint));
    setIconUrl(normalizeWrappedText(initialValue.iconUrl));
    setApiKeySecret(initialValue.authType === "api_key" ? initialValue.credentialSecret : "");
    setTokenSecret(initialValue.authType === "token" ? initialValue.credentialSecret : "");
    const structuredCredential = parseStructuredCredential(initialValue.authType, initialValue.credentialSecret);
    setAccessKey(structuredCredential.accessKey);
    setSecretKey(structuredCredential.secretKey);
    setCredentialMask(initialValue.credentialMask);
    setHasOpenedInitialModelDialog(false);
  }, [props.initialScope, props.initialValue, props.mode]);

  useEffect(() => {
    setModelUpstreamCodes((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const modelId of supportedModelIds) {
        if (next[modelId] !== undefined) {
          continue;
        }
        const model = props.modelCatalog.find((entry) => entry.id === modelId);
        next[modelId] = model?.code?.trim() || "";
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [props.modelCatalog, supportedModelIds]);

  useEffect(() => {
    if (!props.initialOpenModelDialog || hasOpenedInitialModelDialog) {
      return;
    }
    setDraftSupportedModelIds(supportedModelIds);
    setModelSearchKeyword("");
    setModelDialogOpen(true);
    setHasOpenedInitialModelDialog(true);
  }, [hasOpenedInitialModelDialog, props.initialOpenModelDialog, supportedModelIds]);

  const providerMap = useMemo(
    () =>
      props.providerOptions.reduce<Record<string, ProviderOption>>((accumulator, item) => {
        accumulator[item.id] = item;
        return accumulator;
      }, {}),
    [props.providerOptions],
  );

  const availableModelOptions = useMemo(() => {
    return props.modelCatalog;
  }, [props.modelCatalog]);

  useEffect(() => {
    const allowedIds = new Set(availableModelOptions.map((item) => item.id));
    setSupportedModelIds((prev) => prev.filter((item) => allowedIds.has(item)));
    setDraftSupportedModelIds((prev) => prev.filter((item) => allowedIds.has(item)));
    setModelBillingMultipliers((prev) => {
      const next = Object.fromEntries(Object.entries(prev).filter(([modelId]) => allowedIds.has(modelId)));
      return next;
    });
  }, [availableModelOptions]);

  useEffect(() => {
    if (supportedModelIds.length === 0) {
      setModelBillingMultipliers({});
      return;
    }
    setModelBillingMultipliers((prev) => {
      const next: Record<string, string> = {};
      supportedModelIds.forEach((modelId) => {
        const current = prev[modelId]?.trim();
        next[modelId] = current || "1";
      });
      const unchanged =
        Object.keys(next).length === Object.keys(prev).length
        && Object.entries(next).every(([key, value]) => prev[key] === value);
      return unchanged ? prev : next;
    });
  }, [supportedModelIds]);

  const filteredModelOptions = useMemo(() => {
    const keyword = modelSearchKeyword.trim();
    if (!keyword) {
      return availableModelOptions;
    }
    return availableModelOptions.filter((item) => item.displayName.includes(keyword) || item.code.includes(keyword) || item.id.includes(keyword));
  }, [availableModelOptions, modelSearchKeyword]);

  const selectedModelItems = useMemo(
    () =>
      props.modelCatalog
        .filter((item) => supportedModelIds.includes(item.id))
        .map((item) => ({
          ...item,
          logoUrl: providerMap[item.providerId]?.logoUrl || "",
          providerName: providerMap[item.providerId]?.displayName || "",
        })),
    [props.modelCatalog, providerMap, supportedModelIds],
  );

  const capabilityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    getCapabilityRegistryCatalog().forEach((item) => {
      map.set(item.code, toChineseBusinessLabel(item.label));
    });
    return map;
  }, []);

  const requiredScenes = useMemo(
    () => collectRequiredScenes(supportedModelIds, props.modelCatalog, props.scenes),
    [props.modelCatalog, props.scenes, supportedModelIds],
  );

  const protocolChoiceScenes = useMemo(
    () => scenesRequiringProtocolChoice(requiredScenes, props.protocols),
    [props.protocols, requiredScenes],
  );

  useEffect(() => {
    setSceneProtocolIds((current) => {
      let changed = false;
      const next = { ...current };
      for (const scene of requiredScenes) {
        const single = resolveSingleSceneProtocol(scene.code, props.protocols);
        if (single && next[scene.code] !== single.id) {
          next[scene.code] = single.id;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [props.protocols, requiredScenes]);

  const toggleSupportedModel = (modelId: string, checked: boolean | "indeterminate") => {
    setDraftSupportedModelIds((prev) => {
      if (checked === true) {
        return prev.includes(modelId) ? prev : [...prev, modelId];
      }
      return prev.filter((item) => item !== modelId);
    });
  };

  const openModelDialog = () => {
    setDraftSupportedModelIds(supportedModelIds);
    setModelSearchKeyword("");
    setModelDialogOpen(true);
  };

  const handleUploadLocalIcon = async (file?: File) => {
    if (!file) return;
    const uploadBlockReason = getSessionScopeReadyError(sessionScope);
    if (uploadBlockReason) {
      notify.error(uploadBlockReason);
      return;
    }
    setUploadingLocalIcon(true);
    try {
      const fileHash = await md5HexFromFile(file);
      const existing = await getFileMaterialByHash(withSessionScope(sessionScope.scope, { fileHash }));
      const material = existing ?? (await uploadFileMaterialForm(withSessionScope(sessionScope.scope, { file, fileType: "image", fileHash }))).file;
      setIconUrl(material.accessUrl);
      notify.success("上传成功");
    } catch (error) {
      notify.error(resolveUserErrorMessage(error, "图标上传失败"));
    } finally {
      setUploadingLocalIcon(false);
      if (localUploadInputRef.current) {
        localUploadInputRef.current.value = "";
      }
    }
  };

  const handleSave = () => {
    const credentialSecret = buildCredentialCiphertext(authType, {
      apiKeySecret,
      tokenSecret,
      accessKey,
      secretKey,
    });
    if (authType === "ak_sk" && ((accessKey.trim() && !secretKey.trim()) || (!accessKey.trim() && secretKey.trim()))) {
      notify.error("AK/SK 需要同时填写 Access Key 和 Secret Key");
      return;
    }
    if (props.mode === "create" && !credentialSecret.trim()) {
      notify.error("请输入认证凭证");
      return;
    }
    if (props.mode === "edit" && props.initialValue?.authType !== authType && !credentialSecret.trim()) {
      notify.error("变更鉴权方式后，请重新输入对应凭证");
      return;
    }
    const missingProtocolScene = protocolChoiceScenes.find((scene) => !sceneProtocolIds[scene.code]?.trim());
    if (missingProtocolScene) {
      notify.error(`请选择「${missingProtocolScene.label}」调用协议`);
      return;
    }
    props.onSuccess({
      id: props.initialValue?.id,
      name,
      channelCode,
      merchantId: effectiveMerchantId,
      storeId: effectiveStoreId,
      principalId: "",
      channelType,
      authMode,
      sceneProtocolIds,
      sceneConfigJsons,
      providerId: "",
      platformSubject,
      supportedModelIds,
      modelBillingMultipliers,
      modelUpstreamCodes,
      modelPathPrefixes,
      endpoint: normalizeWrappedText(endpoint),
      iconUrl: normalizeWrappedText(iconUrl),
      enabled,
      credentialId,
      credentialName: "",
      authType,
      primaryCredential: true,
      credentialSecret,
      credentialMask,
    });
  };

  const handleSelectAllFiltered = () => {
    setDraftSupportedModelIds((prev) => Array.from(new Set([...prev, ...filteredModelOptions.map((item) => item.id)])));
  };

  const handleConfirmModelSelection = () => {
    setSupportedModelIds(draftSupportedModelIds);
    setModelUpstreamCodes((prev) => {
      const next = { ...prev };
      for (const modelId of draftSupportedModelIds) {
        if (next[modelId]?.trim()) {
          continue;
        }
        const model = props.modelCatalog.find((item) => item.id === modelId);
        if (model?.code?.trim()) {
          next[modelId] = model.code.trim();
        }
      }
      return next;
    });
    setModelDialogOpen(false);
  };

  const updateModelBillingMultiplier = (modelId: string, value: string) => {
    setModelBillingMultipliers((prev) => ({
      ...prev,
      [modelId]: value,
    }));
  };

  const applyBillingMultiplierToModels = (modelIds: string[], rawValue: string) => {
    const normalized = normalizePositiveMultiplierText(rawValue);
    if (!normalized) {
      notify.error("请输入大于 0 的有效倍率");
      return;
    }
    setModelBillingMultipliers((prev) => {
      const next = { ...prev };
      modelIds.forEach((modelId) => {
        next[modelId] = normalized;
      });
      return next;
    });
    setBulkBillingMultiplier(normalized);
  };

  const resetBillingMultiplierToBaseCost = (modelIds: string[]) => {
    setModelBillingMultipliers((prev) => {
      const next = { ...prev };
      modelIds.forEach((modelId) => {
        next[modelId] = "1";
      });
      return next;
    });
    setBulkBillingMultiplier("1");
  };

  const effectiveMerchantId = canChooseMerchant ? merchantId : fixedMerchantId;
  const effectiveStoreId = canChooseStore ? storeId : fixedStoreId;

  return (
    <div className="page-content-shell">
      <div className="subpage-toolbar mb-7">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={props.onCancel}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-[18px] font-semibold text-foreground">{props.mode === "create" ? "新增渠道" : "编辑渠道"}</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1180px] space-y-5">
        <EditorSection title="基础信息">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-2 px-4">
            <FieldGroup label="渠道名称">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="请输入渠道名称" className="workflow-form-input" />
            </FieldGroup>
            <FieldGroup label="渠道编码">
              <Input
                value={channelCode}
                onChange={(event) => setChannelCode(event.target.value)}
                placeholder="例如 CH-OPENAI-MAIN"
                className="workflow-form-input font-mono"
              />
            </FieldGroup>
            <FieldGroup label="目标商户">
              {canChooseMerchant ? (
                <Select
                  value={merchantId || "none"}
                  onValueChange={(value) => {
                    setMerchantId(value === "none" ? "" : value);
                    setStoreId("");
                  }}
                >
                  <SelectTrigger className="subpage-native-select h-10 w-full">
                    <SelectValue placeholder="平台渠道或指定商户" />
                  </SelectTrigger>
                  <SelectContent className="subpage-select-content">
                    <SelectItem className="subpage-select-item" value="none">平台渠道</SelectItem>
                    {merchantOptions.map((item) => (
                      <SelectItem className="subpage-select-item" value={item.id} key={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={fixedMerchantId || "-"} className="workflow-form-input font-mono" disabled />
              )}
            </FieldGroup>
            <FieldGroup label="目标门店">
              {canChooseStore ? (
                <Select
                  value={storeId || "none"}
                  onValueChange={(value) => setStoreId(value === "none" ? "" : value)}
                  disabled={!(canChooseMerchant ? merchantId : fixedMerchantId)}
                >
                  <SelectTrigger className="subpage-native-select h-10 w-full">
                    <SelectValue placeholder={isPlatformScoped ? "平台渠道" : "请选择目标门店"} />
                  </SelectTrigger>
                  <SelectContent className="subpage-select-content">
                    <SelectItem className="subpage-select-item" value="none">
                      {isPlatformScoped ? "平台渠道" : "商户渠道"}
                    </SelectItem>
                    {storeOptions.map((item) => (
                      <SelectItem className="subpage-select-item" value={item.id} key={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={fixedStoreId || "-"} className="workflow-form-input font-mono" disabled />
              )}
            </FieldGroup>
            <FieldGroup label="当前作用域" className="xl:col-span-2">
              <div className="flex h-10 items-center rounded-md border border-border/60 bg-muted/10 px-3 text-sm text-muted-foreground">
                {isPlatformScoped
                  ? "当前为平台级渠道：可作为平台默认路由的共享渠道。"
                  : (canChooseStore ? storeId : fixedStoreId)
                    ? "当前为门店级渠道：仅作用于所选门店。"
                    : "当前为商户级渠道：作用于所选商户。"}
              </div>
            </FieldGroup>
            <FieldGroup label="渠道类型">
              <Select value={channelType} onValueChange={(value) => setChannelType(value as ChannelType)}>
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  <SelectItem className="subpage-select-item" value="provider_direct">厂商直连</SelectItem>
                  <SelectItem className="subpage-select-item" value="api_aggregator">聚合平台</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="接入模式">
              <Select value={authMode} onValueChange={(value) => setAuthMode(value as AuthMode)}>
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  <SelectItem className="subpage-select-item" value="shared">平台共享</SelectItem>
                  <SelectItem className="subpage-select-item" value="byok">商户 BYOK</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="状态">
              <div className="flex h-10 items-center gap-3 px-2">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                <span className="text-sm text-foreground">{enabled ? "启用" : "停用"}</span>
              </div>
            </FieldGroup>
            <FieldGroup label="接入 Endpoint" className="xl:col-span-2">
              <Input
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                onBlur={(event) => setEndpoint(normalizeWrappedText(event.target.value))}
                placeholder="例如 https://api.openai.com/v1"
                className="workflow-form-input"
              />
            </FieldGroup>
            {requiredScenes.length > 0 ? (
              <div className="space-y-3 xl:col-span-2">
                <div className="space-y-1">
                  <div className="workflow-form-label text-sm font-medium">调用协议</div>
                  <p className="text-xs text-muted-foreground">按 Endpoint 实际提供的接口选择，不要按模型品牌选择。</p>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {requiredScenes.map((scene) => {
                    const available = protocolsForScene(scene.code, props.protocols);
                    const singleProtocol = available.length === 1 ? available[0] : null;
                    return (
                      <div key={scene.code} className="space-y-3">
                        <FieldGroup label={scene.label} required={available.length > 1}>
                          {singleProtocol ? (
                            <Input readOnly value={singleProtocol.name || singleProtocol.code} className="bg-muted/40" />
                          ) : (
                            <Select
                              value={sceneProtocolIds[scene.code] || undefined}
                              onValueChange={(value) => {
                                setSceneProtocolIds((current) => ({ ...current, [scene.code]: value }));
                              }}
                            >
                              <SelectTrigger className="subpage-native-select h-10 w-full">
                                <SelectValue placeholder="请选择" />
                              </SelectTrigger>
                              <SelectContent className="subpage-select-content">
                                {available.map((item) => (
                                  <SelectItem className="subpage-select-item" value={item.id} key={item.id}>
                                    {item.name || item.code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </FieldGroup>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <FieldGroup label="渠道图标" className="xl:col-span-2">
              <ImageMaterialField
                previewUrl={iconUrl}
                alt={name || "渠道图标"}
                fallbackText={getDisplayFallback(name || platformSubject || "MH")}
                uploading={uploadingLocalIcon}
                description="点击左侧卡片可从本地上传，右侧按钮可直接从素材库选择，建议使用透明底图标。"
                emptyHint="未设置图标时将使用名称首字展示。"
                onUploadClick={() => localUploadInputRef.current?.click()}
                onPickFromLibrary={() => setIconPickerOpen(true)}
                onClear={() => setIconUrl("")}
              />
              <input
                ref={localUploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  void handleUploadLocalIcon(file);
                }}
              />
            </FieldGroup>
            {channelType === "api_aggregator" ? (
              <FieldGroup label="服务主体补充">
                <Input
                  value={platformSubject}
                  onChange={(event) => setPlatformSubject(event.target.value)}
                  placeholder="可选，例如 OpenRouter 华东 / 企业代理主体"
                  className="workflow-form-input"
                />
              </FieldGroup>
            ) : null}
       
          </div>
        </EditorSection>

        <EditorSection title="渠道模型部署">
          <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 px-4 py-3">
            {availableModelOptions.length === 0 ? (
              <div className="text-sm text-muted-foreground">当前暂无可选基础模型，请先补充基础模型字典。</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-foreground">
                    已部署 <span className="font-medium">{supportedModelIds.length}</span> / {availableModelOptions.length} 个基础模型
                  </div>
                  <Button variant="outline" className="h-9" onClick={openModelDialog}>
                    配置部署模型
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background/80 px-3 py-3">
                  <Badge variant="outline" className="rounded-md border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[12px] text-emerald-700">
                    cost_first / 成本记账 = 模型销售价（或显式 upstreamPricing）× 渠道倍率
                    倍率不改变对客应收。
                  </Badge>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">批量倍率</span>
                    <Input
                      value={bulkBillingMultiplier}
                      onChange={(event) => setBulkBillingMultiplier(event.target.value)}
                      onBlur={(event) => {
                        const normalized = normalizePositiveMultiplierText(event.target.value);
                        setBulkBillingMultiplier(normalized || "1");
                      }}
                      placeholder="例如 1 / 1.2 / 0.8"
                      className="h-9 w-[120px] font-mono text-[12px]"
                      inputMode="decimal"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9"
                      onClick={() => applyBillingMultiplierToModels(supportedModelIds, bulkBillingMultiplier)}
                      disabled={supportedModelIds.length === 0}
                    >
                      应用到全部
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => applyBillingMultiplierToModels(supportedModelIds, "0.8")}
                      disabled={supportedModelIds.length === 0}
                    >
                      0.8x
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => applyBillingMultiplierToModels(supportedModelIds, "1")}
                      disabled={supportedModelIds.length === 0}
                    >
                      1x
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => applyBillingMultiplierToModels(supportedModelIds, "1.2")}
                      disabled={supportedModelIds.length === 0}
                    >
                      1.2x
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => resetBillingMultiplierToBaseCost(supportedModelIds)}
                      disabled={supportedModelIds.length === 0}
                    >
                      重置为 1x
                    </Button>
                  </div>
                </div>
                {selectedModelItems.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border/70 bg-background/80 px-3 py-3 text-sm text-muted-foreground">
                    暂未配置渠道模型部署
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
                              <AvatarImage src={item.logoUrl || undefined} alt={item.providerName || item.displayName} className="object-cover" />
                              <AvatarFallback className="text-[11px] font-medium">
                                {getDisplayFallback(item.providerName || item.displayName)}
                              </AvatarFallback>
                            </Avatar>
                          </div>

                          <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <div className="flex min-w-0 items-start gap-2">
                              <span className="min-w-0 flex-1 truncate pt-0.5 text-[15px] font-semibold leading-tight text-foreground">{item.displayName}</span>
                              <Badge variant="outline" className="mt-0.5 shrink-0 whitespace-nowrap px-1.5 py-0.5 text-[11px] font-medium">
                                {resolveModelKindLabel(item.modelType, item.capabilityCodes)}
                              </Badge>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="-mr-1 -mt-0.5 h-7 w-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setSupportedModelIds((prev) => prev.filter((modelId) => modelId !== item.id))}
                                aria-label={`移除${item.displayName}`}
                                title="移除该部署模型"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="space-y-1 text-[12px] leading-[1.45] text-muted-foreground/85">
                              <p className="truncate">提供方：{item.providerName || "-"}</p>
                              <p className="truncate">类型：{resolveModelKindLabel(item.modelType, item.capabilityCodes)}</p>
                              <p className="truncate font-mono">编码：{item.code || "-"}</p>
                            </div>
                          </div>
                        </div>

                        <div className="min-w-0 space-y-2 overflow-hidden pt-2 px-2">
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
                                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground">暂无能力标签</span>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
                                <span>上游模型编码</span>
                                <span className="font-mono">供应商 API model</span>
                              </div>
                              <Input
                                value={modelUpstreamCodes[item.id] ?? ""}
                                onChange={(event) => setModelUpstreamCodes((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))}
                                onBlur={(event) => setModelUpstreamCodes((current) => ({
                                  ...current,
                                  [item.id]: event.target.value.trim(),
                                }))}
                                placeholder="例如 seedream/4.5-text-to-image"
                                className="h-8 font-mono text-[12px]"
                              />
                              <p className="text-[11px] leading-snug text-muted-foreground/80">
                                目录编码：{item.code || "-"}（仅作参考；上游编码须按供应商 API 填写）
                              </p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
                                <span>成本倍率</span>
                                <span className="font-mono">成本 = 模型价 × 倍率</span>
                              </div>
                              <Input
                                value={modelBillingMultipliers[item.id] || "1"}
                                onChange={(event) => updateModelBillingMultiplier(item.id, event.target.value)}
                                onBlur={(event) => {
                                  const normalized = normalizePositiveMultiplierText(event.target.value);
                                  updateModelBillingMultiplier(item.id, normalized || "1");
                                }}
                                placeholder="例如 1 / 1.2 / 0.8"
                                className="h-8 font-mono text-[12px]"
                                inputMode="decimal"
                              />
                            </div>
                            {Boolean(modelPathPrefixes[item.id]?.trim()) || pathPrefixEditorOpenIds[item.id] ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
                                  <span>渠道路径前缀</span>
                                  {modelPathPrefixes[item.id]?.trim() ? (
                                    <span className="font-mono">已覆盖</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="text-[12px] text-muted-foreground hover:text-foreground"
                                      onClick={() => setPathPrefixEditorOpenIds((current) => {
                                        const next = { ...current };
                                        delete next[item.id];
                                        return next;
                                      })}
                                    >
                                      收起
                                    </button>
                                  )}
                                </div>
                                <Input
                                  value={modelPathPrefixes[item.id] || ""}
                                  onChange={(event) => setModelPathPrefixes((current) => ({
                                    ...current,
                                    [item.id]: event.target.value,
                                  }))}
                                  onBlur={(event) => setModelPathPrefixes((current) => ({
                                    ...current,
                                    [item.id]: event.target.value.trim(),
                                  }))}
                                  placeholder="例如 /gemini-3-flash/v1"
                                  className="h-8 font-mono text-[12px]"
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="text-left text-[12px] text-muted-foreground hover:text-foreground"
                                onClick={() => setPathPrefixEditorOpenIds((current) => ({
                                  ...current,
                                  [item.id]: true,
                                }))}
                              >
                                设置渠道路径
                              </button>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="text-[12px] text-muted-foreground">
              成本默认按「模型能力销售价 × 渠道倍率」计算与选路；对客扣费只用销售价。仅在 JSON 中显式配置 upstreamPricing 时才覆盖成本基数。
            </div>
          </div>
        </EditorSection>

        <EditorSection title="凭证配置">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 px-4">
            <FieldGroup label="鉴权方式">
              <Select value={authType} onValueChange={(value) => setAuthType(value as AuthType)}>
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  <SelectItem className="subpage-select-item" value="api_key">API Key</SelectItem>
                  <SelectItem className="subpage-select-item" value="token">Token</SelectItem>
                  <SelectItem className="subpage-select-item" value="ak_sk">AK/SK</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            {authType === "ak_sk" ? (
              <>
                <FieldGroup label="Access Key">
                  <Input
                    type="password"
                    value={accessKey}
                    onChange={(event) => setAccessKey(event.target.value)}
                    placeholder={props.mode === "edit" ? "留空则保留原凭证" : "请输入 Access Key"}
                    className="workflow-form-input"
                  />
                </FieldGroup>
                <FieldGroup label="Secret Key">
                  <Input
                    type="password"
                    value={secretKey}
                    onChange={(event) => setSecretKey(event.target.value)}
                    placeholder={props.mode === "edit" ? "留空则保留原凭证" : "请输入 Secret Key"}
                    className="workflow-form-input"
                  />
                </FieldGroup>
              </>
            ) : authType === "token" ? (
              <FieldGroup label="Token" className="xl:col-span-2">
                <Input
                  type="password"
                  value={tokenSecret}
                  onChange={(event) => setTokenSecret(event.target.value)}
                  placeholder={props.mode === "edit" ? "留空则保留原凭证" : "请输入 Token"}
                  className="workflow-form-input"
                />
              </FieldGroup>
            ) : (
              <FieldGroup label="API Key" className="xl:col-span-2">
                <Input
                  type="password"
                  value={apiKeySecret}
                  onChange={(event) => setApiKeySecret(event.target.value)}
                  placeholder={props.mode === "edit" ? "留空则保留原凭证" : "请输入 API Key"}
                  className="workflow-form-input"
                />
              </FieldGroup>
            )}
            {credentialMask ? (
              <FieldGroup label="已存凭证掩码" className="xl:col-span-3">
                <div className="flex h-10 items-center px-3 text-sm text-muted-foreground">{credentialMask}</div>
              </FieldGroup>
            ) : null}
          </div>
        </EditorSection>

        {/* <EditorSection title="额度汇总">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 px-4">
            <FieldGroup label="当前可用余额">
              <div className="flex h-10 items-center px-3 text-sm font-medium text-foreground">
                {props.quotaSummary ? formatChannelQuotaSummaryValue(props.quotaSummary) : "-"}
              </div>
            </FieldGroup>
            <FieldGroup label="已用额度">
              <div className="flex h-10 items-center px-3 text-sm text-muted-foreground">
                {props.quotaSummary ? `${props.quotaSummary.currency} ${props.quotaSummary.usedAmount}` : "-"}
              </div>
            </FieldGroup>
            <FieldGroup label="总额度">
              <div className="flex h-10 items-center px-3 text-sm text-muted-foreground">
                {props.quotaSummary ? `${props.quotaSummary.currency} ${props.quotaSummary.totalAmount}` : "-"}
              </div>
            </FieldGroup>
            <FieldGroup label="最近同步">
              <div className="flex h-10 items-center px-3 text-sm text-muted-foreground">{props.quotaSummary?.lastSyncAt || "-"}</div>
            </FieldGroup>
            {props.mode === "edit" && props.onOpenQuota ? (
              <div className="xl:col-span-4">
                <Button variant="outline" className="subpage-outline-btn !h-10 !px-5" onClick={props.onOpenQuota}>
                  查看额度台账
                </Button>
              </div>
            ) : null}
          </div>
        </EditorSection> */}

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" className="subpage-outline-btn !h-10 !px-5" onClick={props.onCancel} disabled={props.saving}>
            取消
          </Button>
          <Button className="subpage-primary-btn !h-10 !px-5" onClick={handleSave} disabled={props.saving}>
            <Save className="mr-1 h-4 w-4" />
            {props.saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      <ChannelModelConfigDialog
        open={modelDialogOpen}
        onOpenChange={(open) => {
          setModelDialogOpen(open);
          if (!open) {
            setModelSearchKeyword("");
          }
        }}
        searchKeyword={modelSearchKeyword}
        availableModelCount={availableModelOptions.length}
        filteredModelOptions={filteredModelOptions}
        selectedModelIds={draftSupportedModelIds}
        providerOptions={props.providerOptions}
        onSearchKeywordChange={setModelSearchKeyword}
        onToggleModel={toggleSupportedModel}
        onSelectAllFiltered={handleSelectAllFiltered}
        onClear={() => setDraftSupportedModelIds([])}
        onConfirm={handleConfirmModelSelection}
      />
      <FileMaterialPickerDialog
        open={iconPickerOpen}
        onOpenChange={setIconPickerOpen}
        title="选择渠道图标"
        fileType="image"
        onPick={(url) => setIconUrl(url)}
      />
    </div>
  );
}
