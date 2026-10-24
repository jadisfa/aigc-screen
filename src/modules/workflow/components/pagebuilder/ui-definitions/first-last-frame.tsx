import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Image, Plus, RefreshCcw, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import FileMaterialPickerDialog from "@/shared/components/FileMaterialPickerDialog";
import {
  getFileMaterialByHash,
  listRecommendedFileMaterials,
  uploadFileMaterialForm,
  type FileMaterial,
} from "@/shared/api/materials/materials-file-material";
import { md5HexFromFile } from "@/shared/lib/md5";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import {
  getSessionScopeReadyError,
  useSessionScope,
  withSessionScope,
} from "@/shared/hooks/use-session-scope";
import {
  clearUploadPasteTargetActive,
  clearUploadPasteTargetHover,
  markUploadPasteTargetActive,
  markUploadPasteTargetHover,
  shouldHandleUploadPaste,
} from "./upload-paste-target";
import {
  normalizeMultiSourceImageUploadRules,
  prepareLocalImageForMultiSourceUpload,
  validatePickedMultiSourceMaterial,
} from "./multi-source-image-upload";
import type {
  FirstLastFrameExt,
  FirstLastFrameRecommendation,
  UiParam,
  UiComponent,
} from "../ui-schema";
import type { UiComponentDefinition } from "./types";
import { getParamAlias } from "../param-utils";
import { readRuntimeComponentValue, valueToInputPayload } from "./shared";
import { notify } from "@/shared/lib/notify";

type FrameSlotKey = "firstFrame" | "lastFrame";

type MaterialLike = Pick<FileMaterial, "accessUrl" | "fileName"> & Partial<FileMaterial>;

type FirstLastFrameValue = {
  firstFrame: MaterialLike | null;
  lastFrame: MaterialLike | null;
};

type VisualRecommendation = FirstLastFrameRecommendation & {
  materialId?: string;
};

type EditableNumericValue = number | string | undefined;

const DEFAULT_RECOMMENDATION_PLACEHOLDER_COUNT = 8;
const MAX_CONFIGURED_RECOMMENDATION_COUNT = 6;

const PLACEHOLDER_RECOMMENDATION_STYLES = [
  "from-[#d9c4b0] via-[#ead9c8] to-[#c3a78c]",
  "from-[#b98e70] via-[#d9b39a] to-[#8c654a]",
  "from-[#e2cfbb] via-[#f1e5d7] to-[#cdb49b]",
  "from-[#d9d0c6] via-[#f2ede8] to-[#bca694]",
  "from-[#b6aaa0] via-[#d7cec7] to-[#88786d]",
  "from-[#f0dfd1] via-[#e3c2af] to-[#b88a74]",
  "from-[#1d232b] via-[#3b4652] to-[#0f141a]",
  "from-[#c4a58b] via-[#e3ccb8] to-[#9c7b63]",
] as const;

function buildPlaceholderRecommendations(count: number): VisualRecommendation[] {
  return Array.from({ length: count }, (_, index) => ({
    title: `默认推荐${index + 1}`,
  }));
}

function fileNameFromUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split("/").pop() || "");
  } catch {
    const raw = url.split("?")[0].split("#")[0];
    return decodeURIComponent(raw.split("/").pop() || "");
  }
}

function toEditableNumericValue(value: string): EditableNumericValue {
  if (value === "" || value === "-" || value === "." || value === "-." || value.endsWith(".")) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeMaterialLike(value: unknown): MaterialLike | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const accessUrl = [record.accessUrl, record.url, record.src]
    .find((item) => typeof item === "string" && item.trim()) as string | undefined;
  if (!accessUrl) return null;
  const fileName = typeof record.fileName === "string" && record.fileName.trim()
    ? record.fileName
    : fileNameFromUrl(accessUrl);
  return {
    ...(record as Partial<FileMaterial>),
    accessUrl,
    fileName,
  };
}

function normalizeFirstLastFrameValue(value: unknown): FirstLastFrameValue {
  if (!value || typeof value !== "object") {
    return { firstFrame: null, lastFrame: null };
  }
  const record = value as Record<string, unknown>;
  return {
    firstFrame: normalizeMaterialLike(record.firstFrame),
    lastFrame: normalizeMaterialLike(record.lastFrame),
  };
}

function createSyntheticMaterial(url: string, fileName?: string): MaterialLike {
  return {
    accessUrl: url,
    fileName: fileName?.trim() || fileNameFromUrl(url) || "image",
  };
}

function resolveSlotLabel(slot: FrameSlotKey): string {
  return slot === "firstFrame" ? "首帧图" : "尾帧图";
}

function resolvePreferredSlot(value: FirstLastFrameValue, preferred: FrameSlotKey): FrameSlotKey {
  if (!value.firstFrame) return "firstFrame";
  if (!value.lastFrame) return "lastFrame";
  return preferred;
}

function buildHint(ext: FirstLastFrameExt): string {
  const rules = normalizeMultiSourceImageUploadRules(ext);
  const hints: string[] = [];
  if (rules.maxSizeBytes != null) {
    hints.push(`点击/拖拽/粘贴，文件大小不超过 ${Number((rules.maxSizeBytes / 1024 / 1024).toFixed(2))}MB`);
  }
  if (rules.maxWidth != null || rules.maxHeight != null) {
    hints.push(`${rules.maxWidth ?? "-"} x ${rules.maxHeight ?? "-"} 以内`);
  }
  return hints.join("，") || "支持本地上传、拖拽与粘贴";
}

function toVisualRecommendation(material: FileMaterial): VisualRecommendation {
  return {
    title: material.fileName || "推荐图片",
    iconUrl: material.accessUrl,
    materialId: material.id,
  };
}

async function uploadImageMaterial(
  file: File,
  sessionScope: ReturnType<typeof useSessionScope>,
  ext?: Pick<FirstLastFrameExt, "maxSizeMB" | "maxWidth" | "maxHeight" | "quality">,
): Promise<FileMaterial> {
  const uploadBlockReason = getSessionScopeReadyError(sessionScope);
  if (uploadBlockReason) {
    throw new Error(uploadBlockReason);
  }
  const rules = ext ? normalizeMultiSourceImageUploadRules(ext) : undefined;
  const processedFile = rules ? await prepareLocalImageForMultiSourceUpload(file, rules) : file;
  const fileHash = await md5HexFromFile(processedFile);
  const existing = await getFileMaterialByHash(withSessionScope(sessionScope.scope, { fileHash }));
  if (existing) return existing;
  const result = await uploadFileMaterialForm(withSessionScope(sessionScope.scope, {
    file: processedFile,
    fileType: "image",
    fileHash,
  }));
  return result.file;
}

// 场景：首尾帧切换区的通用按钮，运行态与预览态共用。
function FrameSlotButton(props: {
  label: string;
  active: boolean;
  material: MaterialLike | null;
  onClick: () => void;
  onClear?: () => void;
}) {
  const previewUrl = props.material?.accessUrl?.trim() || "";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={props.onClick}
        className={`group inline-flex h-10 items-center gap-2 rounded-[12px] px-2 text-[13px] transition-all ${
          previewUrl && props.onClear ? "pr-7" : "pr-3"
        } ${
          props.active
            ? "border-[1.5px] border-primary bg-background text-primary shadow-[0_0_0_1px_rgba(99,102,241,0.08)]"
            : "border border-transparent bg-transparent text-foreground hover:bg-accent/80"
        }`}
      >
        <span className={`flex h-8 w-8 items-center justify-center rounded-md border border-dashed ${
          props.active ? "border-primary/35 bg-primary/[0.03]" : "border-border bg-background"
        }`}>
          {previewUrl ? (
            <img src={previewUrl} alt={props.label} className="h-full w-full rounded-[inherit] object-cover" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="whitespace-nowrap">{props.label}</span>
      </button>
      {previewUrl && props.onClear && (
        <button
          type="button"
          aria-label={`清除${props.label}`}
          onClick={props.onClear}
          className={`absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full transition-colors ${
            props.active ? "text-primary/75 hover:bg-primary/10" : "text-muted-foreground hover:bg-accent"
          }`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// 场景：底部推荐区的单个缩略图项，支持真实图片和默认占位符。
function RecommendationThumb(props: {
  recommendation: VisualRecommendation;
  active: boolean;
  onClick: () => void;
  placeholderIndex?: number;
  disabled?: boolean;
}) {
  const iconUrl = props.recommendation.iconUrl?.trim() || "";
  const palette = PLACEHOLDER_RECOMMENDATION_STYLES[(props.placeholderIndex ?? 0) % PLACEHOLDER_RECOMMENDATION_STYLES.length];
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border transition-all ${
        props.active
          ? "border-primary ring-1 ring-primary/45"
          : props.disabled
            ? "border-border/70"
            : "border-border hover:border-primary/40"
      }`}
      title={props.recommendation.title || "推荐图标"}
    >
      {iconUrl ? (
        <img src={iconUrl} alt={props.recommendation.title || "推荐图标"} className="h-full w-full object-cover" />
      ) : (
        <div className={`relative h-full w-full overflow-hidden bg-gradient-to-br ${palette}`}>
          <span className="absolute inset-x-1 top-1 h-1.5 rounded-full bg-white/35 blur-[0.5px]" />
          <span className="absolute bottom-1 left-1 h-2.5 w-2.5 rounded-full bg-black/15" />
          <span className="absolute bottom-1.5 right-1 h-3 w-3 rounded-full bg-white/40" />
          <span className="absolute left-1.5 top-2.5 h-2 w-4 rounded-full bg-black/10" />
        </div>
      )}
    </button>
  );
}

function getVisualRecommendations(
  recommendations: VisualRecommendation[],
  maxCount = DEFAULT_RECOMMENDATION_PLACEHOLDER_COUNT,
) {
  const normalizedCount = Math.max(1, maxCount);
  return recommendations.length > 0
    ? recommendations.slice(0, normalizedCount)
    : buildPlaceholderRecommendations(normalizedCount);
}

// 场景：首尾帧控件底部推荐区，运行态与预览态共用。
function RecommendationRow(props: {
  recommendations: VisualRecommendation[];
  activeIndex?: number;
  onPick?: (item: VisualRecommendation, index: number) => void;
  showRefresh?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  maxCount?: number;
}) {
  const visualRecommendations = getVisualRecommendations(props.recommendations, props.maxCount);
  const usingPlaceholders = props.recommendations.length === 0;
  return (
    <div className="mt-4 px-2 py-3 flex items-center gap-1.5">
      {/* font-medium  */}
      <span className="shrink-0 text-[12px] text-foreground">推荐:</span>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {visualRecommendations.map((item, index) => (
          <RecommendationThumb
            key={`${item.title}-${index}`}
            recommendation={item}
            placeholderIndex={index}
            active={!usingPlaceholders && props.activeIndex === index}
            disabled={usingPlaceholders}
            onClick={() => props.onPick?.(item, index)}
          />
        ))}
        {props.showRefresh !== false && (
          <button
            type="button"
            className="ml-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-foreground/75 transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            title="刷新推荐"
            onClick={props.onRefresh}
            disabled={props.refreshing}
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${props.refreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>
    </div>
  );
}

// 场景：历史上传空态样式保留，用于纯提示型预览片段。
function UploadEmptyState(props: { hint: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-md bg-muted/[0.04] px-4 text-center ${props.compact ? "h-[182px]" : "h-[188px]"}`}>
      <div className={`flex items-center justify-center rounded-xl text-muted-foreground ${props.compact ? "h-12 w-12" : "h-14 w-14 bg-background shadow-sm"}`}>
        <Image className={props.compact ? "h-8 w-8" : "h-7 w-7"} />
      </div>
      <div className={`${props.compact ? "mt-2 text-[11px]" : "mt-1 text-[12px]"} leading-5 text-muted-foreground`}>{props.hint}</div>
    </div>
  );
}

// 场景：顶部统一上传面板，服务于左侧 hover 预览、画布静态预览和运行态上传入口。
function UploadActionPanel(props: {
  compact?: boolean;
  dragOver?: boolean;
  hint: string;
  material?: MaterialLike | null;
  onLocalUpload?: () => void;
  onMaterialLibrary?: () => void;
  disabled?: boolean;
}) {
  const previewUrl = props.material?.accessUrl?.trim() || "";
  return (
    <div
      className={`text-center transition-colors ${
        props.dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/[0.04]"
      } ${props.compact ? "py-0" : "py-0"} ${props.disabled ? "opacity-70" : ""}`}
    >
      {previewUrl ? (
        <div className={`overflow-hidden rounded-lg bg-[#d7d9df] ${props.compact ? "h-[110px]" : "h-[136px]"}`}>
          <img
            src={previewUrl}
            alt={props.material?.fileName || "首尾帧预览图"}
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className={`flex items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm ${props.compact ? "h-10 w-10 mt-4" : "h-12 w-12 mt-4"}`}>
            <Upload className={`${props.compact ? "h-5 w-5" : "h-6 w-6"}`} />
          </div>
          <div className={`${props.compact ? "mt-3" : "mt-4"} flex items-center justify-center gap-2`}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`${props.compact ? "h-8 px-3 text-[11px]" : "h-9 px-4 text-[12px]"}`}
              onClick={props.onLocalUpload}
              disabled={props.disabled}
            >
              <Image className="mr-1.5 h-3.5 w-3.5" />
              本地上传
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`${props.compact ? "h-8 px-3 text-[11px]" : "h-9 px-4 text-[12px]"}`}
              onClick={props.onMaterialLibrary}
              disabled={props.disabled}
            >
              <Image className="mr-1.5 h-3.5 w-3.5" />
              素材库
            </Button>
          </div>
          <div className={`${props.compact ? "mt-3 text-[10px]" : "mt-3 text-[12px] px-6"} text-muted-foreground`}>
            {props.hint}
          </div>
        </div>
      )}
    </div>
  );
}

// 场景：左侧组件面板 hover 预览，只展示结构，不承载真实上传交互。
function FirstLastFramePaletteHoverPreview() {
  return (
    <div className="w-[320px] rounded-xl border border-border bg-background p-1 shadow-sm">
      <div className="rounded-xl bg-muted/[0.06] p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Image className="h-4 w-4 text-foreground/70" />
            <span>首尾帧</span>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-destructive/80 transition-colors hover:bg-destructive/8"
            tabIndex={-1}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="rounded-lg border border-border bg-background p-3">
          <UploadActionPanel compact hint="请上传图片文件，文件大小不超过5MB" />

          <div className="mt-4 flex items-center justify-center gap-3">
            <FrameSlotButton label="首帧图" active material={null} onClick={() => undefined} />
            <ArrowRightLeft className="h-4 w-4 text-foreground/65" />
            <FrameSlotButton label="尾帧图" active={false} material={null} onClick={() => undefined} />
          </div>

          <RecommendationRow recommendations={[]} activeIndex={0} maxCount={6} />
        </div>
      </div>
    </div>
  );
}

// 场景：画布中的静态预览，展示控件布局，不处理真实数据写入。
function FirstLastFrameStaticPreview({ comp }: { comp: Extract<UiComponent, { type: "FirstLastFrame" }> }) {
  const recommendations = comp.ext.recommendations ?? [];
  const hint = buildHint(comp.ext);
  return (
    <div className="rounded-xl bg-transparent">
      <div className="relative rounded-xl border border-border bg-background p-1">
        <UploadActionPanel hint={hint} />
        <div className="mt-4 flex items-center justify-center gap-3">
          <FrameSlotButton label="首帧图" active material={null} onClick={() => undefined} />
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          <FrameSlotButton label="尾帧图" active={false} material={null} onClick={() => undefined} />
        </div>
        <RecommendationRow recommendations={recommendations} activeIndex={recommendations.length > 0 ? 0 : undefined} />
      </div>
    </div>
  );
}

// 场景：运行态真实交互区，处理上传、拖拽、粘贴、素材库和推荐写入。
function FirstLastFrameRuntimeField(props: {
  comp: Extract<UiComponent, { type: "FirstLastFrame" }>;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const frameValue = useMemo(() => normalizeFirstLastFrameValue(props.value), [props.value]);
  const configuredRecommendations = useMemo<VisualRecommendation[]>(
    () => (props.comp.ext.recommendations ?? []).slice(0, MAX_CONFIGURED_RECOMMENDATION_COUNT).map((item) => ({ ...item })),
    [props.comp.ext.recommendations],
  );
  const configuredRecommendationKey = useMemo(
    () => JSON.stringify(configuredRecommendations.map((item) => `${item.title}|${item.iconUrl ?? ""}`)),
    [configuredRecommendations],
  );
  const [activeSlot, setActiveSlot] = useState<FrameSlotKey>(() => resolvePreferredSlot(frameValue, "firstFrame"));
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [remoteRecommendations, setRemoteRecommendations] = useState<VisualRecommendation[]>([]);
  const [preferRemoteRecommendations, setPreferRemoteRecommendations] = useState(false);
  const [recommendationRefreshing, setRecommendationRefreshing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingSlotRef = useRef<FrameSlotKey>("firstFrame");
  const pasteTargetId = useId();
  const sessionScope = useSessionScope();
  const hint = buildHint(props.comp.ext);

  useEffect(() => {
    setActiveSlot((current) => resolvePreferredSlot(frameValue, current));
  }, [frameValue.firstFrame, frameValue.lastFrame]);

  const commitValue = useCallback((patch: Partial<FirstLastFrameValue>) => {
    const current = normalizeFirstLastFrameValue(props.value);
    props.onChange({ ...current, ...patch });
  }, [props.onChange, props.value]);

  const handleSwapFrames = useCallback(() => {
    props.onChange({
      firstFrame: frameValue.lastFrame,
      lastFrame: frameValue.firstFrame,
    });
    setActiveSlot((current) => (current === "firstFrame" ? "lastFrame" : "firstFrame"));
  }, [frameValue.firstFrame, frameValue.lastFrame, props.onChange]);

  const loadRemoteRecommendations = useCallback(async (options?: {
    excludeIds?: string[];
    preferRemote?: boolean;
    silent?: boolean;
  }) => {
    setRecommendationRefreshing(true);
    try {
      const items = await listRecommendedFileMaterials({
        fileType: "image",
        limit: MAX_CONFIGURED_RECOMMENDATION_COUNT,
        excludeIds: options?.excludeIds,
      });
      setRemoteRecommendations(items.map(toVisualRecommendation));
      if (options?.preferRemote) {
        setPreferRemoteRecommendations(true);
      }
    } catch (error) {
      if (!options?.silent) {
        notify.error("推荐加载失败", { description: resolveUserErrorMessage(error, "请稍后重试") });
      }
    } finally {
      setRecommendationRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setPreferRemoteRecommendations(false);
    setRemoteRecommendations([]);
    if (configuredRecommendations.length === 0) {
      void loadRemoteRecommendations({ silent: true });
    }
  }, [configuredRecommendationKey, configuredRecommendations.length, loadRemoteRecommendations]);

  const openFilePickerForSlot = useCallback((slot: FrameSlotKey) => {
    pendingSlotRef.current = slot;
    setActiveSlot(slot);
    inputRef.current?.click();
  }, []);

  const processUpload = useCallback(async (file: File, slot: FrameSlotKey) => {
    setUploading(true);
    try {
      const material = await uploadImageMaterial(file, sessionScope, props.comp.ext);
      commitValue({ [slot]: material });
      setActiveSlot(slot);
    } catch (error) {
      notify.error("上传失败", { description: resolveUserErrorMessage(error, "请求失败") });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [commitValue, props.comp.ext, sessionScope]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) return;
    await processUpload(selectedFile, pendingSlotRef.current);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    const selectedFile = event.dataTransfer.files?.[0] ?? null;
    if (!selectedFile) return;
    const slot = resolvePreferredSlot(frameValue, activeSlot);
    pendingSlotRef.current = slot;
    await processUpload(selectedFile, slot);
  };

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      if (!shouldHandleUploadPaste(pasteTargetId) || uploading) return;
      const items = event.clipboardData?.items;
      if (!items) return;
      for (let index = 0; index < items.length; index += 1) {
        if (!items[index].type.includes("image")) continue;
        const file = items[index].getAsFile();
        if (!file) continue;
        event.preventDefault();
        event.stopImmediatePropagation();
        const slot = resolvePreferredSlot(normalizeFirstLastFrameValue(props.value), activeSlot);
        pendingSlotRef.current = slot;
        await processUpload(file, slot);
        break;
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
      clearUploadPasteTargetActive(pasteTargetId);
      clearUploadPasteTargetHover(pasteTargetId);
    };
  }, [activeSlot, pasteTargetId, processUpload, props.value, uploading]);

  const recommendations = preferRemoteRecommendations
    ? remoteRecommendations
    : (configuredRecommendations.length > 0 ? configuredRecommendations : remoteRecommendations);
  const previewUrl = (activeSlot === "firstFrame" ? frameValue.firstFrame : frameValue.lastFrame)?.accessUrl?.trim() || "";
  const recommendationActiveIndex = recommendations.findIndex(
    (item) => (item.iconUrl?.trim() || "") !== "" && (item.iconUrl?.trim() || "") === previewUrl,
  );

  return (
    <div
      className="rounded-xl"
      tabIndex={0}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
      }}
      onDrop={handleDrop}
      onMouseEnter={() => markUploadPasteTargetHover(pasteTargetId)}
      onMouseLeave={() => clearUploadPasteTargetHover(pasteTargetId)}
      onPointerDownCapture={() => markUploadPasteTargetActive(pasteTargetId)}
      onFocusCapture={() => markUploadPasteTargetActive(pasteTargetId)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          clearUploadPasteTargetActive(pasteTargetId);
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />
      <div className="rounded-xl border border-border bg-background p-1">
        <UploadActionPanel
          dragOver={isDragOver}
          hint={hint}
          material={activeSlot === "firstFrame" ? frameValue.firstFrame : frameValue.lastFrame}
          disabled={uploading}
          onLocalUpload={() => openFilePickerForSlot(activeSlot)}
          onMaterialLibrary={() => setPickerOpen(true)}
        />
        <div className="mt-4 flex items-center justify-center gap-2">
          <FrameSlotButton
            label="首帧图"
            active={activeSlot === "firstFrame"}
            material={frameValue.firstFrame}
            onClick={() => setActiveSlot("firstFrame")}
            onClear={() => commitValue({ firstFrame: null })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            onClick={handleSwapFrames}
            disabled={uploading || (!frameValue.firstFrame && !frameValue.lastFrame)}
            aria-label="互换首尾帧"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
          <FrameSlotButton
            label="尾帧图"
            active={activeSlot === "lastFrame"}
            material={frameValue.lastFrame}
            onClick={() => setActiveSlot("lastFrame")}
            onClear={() => commitValue({ lastFrame: null })}
          />
        </div>
        <RecommendationRow
          recommendations={recommendations}
          activeIndex={recommendationActiveIndex >= 0 ? recommendationActiveIndex : undefined}
          refreshing={recommendationRefreshing}
          onRefresh={() => {
            void loadRemoteRecommendations({
              preferRemote: true,
              excludeIds: recommendations.map((item) => item.materialId).filter((id): id is string => Boolean(id)),
            });
          }}
          onPick={(item) => {
            const iconUrl = item.iconUrl?.trim() || "";
            if (!iconUrl) return;
            const patch: Partial<FirstLastFrameValue> = {
              [activeSlot]: createSyntheticMaterial(iconUrl, `${item.title}-${resolveSlotLabel(activeSlot)}`),
            };
            commitValue(patch);
          }}
        />
      </div>
      <FileMaterialPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={`选择${resolveSlotLabel(activeSlot)}`}
        fileType="image"
        onPick={async (_url, item) => {
          try {
            await validatePickedMultiSourceMaterial(item, normalizeMultiSourceImageUploadRules(props.comp.ext));
          } catch (error) {
            notify.error("图片不符合约束", { description: error instanceof Error ? error.message : "请选择符合限制的图片" });
            return;
          }
          commitValue({ [activeSlot]: item });
        }}
      />
    </div>
  );
}

// 场景：扩展属性中的推荐图片编辑器，支持 URL、本地上传和文件管理选择。
function RecommendationImageField(props: {
  label: string;
  value: string;
  placeholder: string;
  helper?: string;
  onChange: (next: string) => void;
  validateMaterial?: (item: FileMaterial) => Promise<void>;
  uploadRules?: Pick<FirstLastFrameExt, "maxSizeMB" | "maxWidth" | "maxHeight" | "quality">;
}) {
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sessionScope = useSessionScope();
  const previewUrl = props.value.trim();

  const handleLocalUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) return;
    setUploading(true);
    try {
      const material = await uploadImageMaterial(selectedFile, sessionScope, props.uploadRules);
      if (props.validateMaterial) {
        await props.validateMaterial(material);
      }
      props.onChange(material.accessUrl);
    } catch (error) {
      notify.error("上传失败", { description: resolveUserErrorMessage(error, "请求失败") });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm text-muted-foreground">{props.label}</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLocalUpload}
        disabled={uploading}
      />
      <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/20">
          {previewUrl ? (
            <img src={previewUrl} alt={props.label} className="h-full w-full object-cover" />
          ) : (
            <Image className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            value={props.value}
            onChange={(event) => props.onChange(event.target.value)}
            placeholder={props.placeholder}
            className="h-9 text-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-[12px]" onClick={() => inputRef.current?.click()}>
              本地上传
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-[12px]" onClick={() => setPickerOpen(true)}>
              文件管理
            </Button>
            {previewUrl && (
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[12px]" onClick={() => props.onChange("")}>
                清空
              </Button>
            )}
          </div>
          {props.helper && <div className="text-[11px] text-muted-foreground">{props.helper}</div>}
        </div>
      </div>
      <FileMaterialPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={`选择${props.label}`}
        fileType="image"
        onPick={async (_url, item) => {
          try {
            if (props.validateMaterial) {
              await props.validateMaterial(item);
            }
            props.onChange(item.accessUrl);
          } catch (error) {
            notify.error("图片不符合约束", { description: error instanceof Error ? error.message : "请选择符合限制的图片" });
          }
        }}
      />
    </div>
  );
}

// 场景：首尾帧控件定义入口，负责注册 palette、预览、运行态和扩展属性编辑。
export const firstLastFrameDefinition: UiComponentDefinition = {
  type: "FirstLastFrame",
  iconName: "image",
  palette: { id: "first-last-frame", label: "首尾帧", category: "图像", badge: "Biz", order: 35 },
  renderPaletteHoverPreview: () => <FirstLastFramePaletteHoverPreview />,
  createInitialRuntimeValue: () => ({ firstFrame: null, lastFrame: null }),
  collectDispatchParams: (component, values) => {
    const params = component.basic?.params ?? [];
    const runtimeValue = normalizeFirstLastFrameValue(readRuntimeComponentValue(component, values).value);
    const out: Record<string, unknown> = {};
    const mapping: Array<[UiParam | undefined, MaterialLike | null]> = [
      [params[0], runtimeValue.firstFrame],
      [params[1], runtimeValue.lastFrame],
    ];
    mapping.forEach(([param, material]) => {
      const key = getParamAlias(param);
      if (!key || !material) return;
      out[key] = valueToInputPayload(material);
    });
    return out;
  },
  renderCanvasPreview: (component): ReactNode => {
    return <FirstLastFrameStaticPreview comp={component as Extract<UiComponent, { type: "FirstLastFrame" }>} />;
  },
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    const component = comp as Extract<UiComponent, { type: "FirstLastFrame" }>;
    return (
      <div className="space-y-2">
        <LabelComp />
        <FirstLastFrameRuntimeField comp={component} value={value} onChange={onChange} />
      </div>
    );
  },
  renderExtEditor: (component, onChange) => {
    const current = component as Extract<UiComponent, { type: "FirstLastFrame" }>;
    const recommendations = current.ext.recommendations ?? [];
    const uploadRules = {
      maxSizeMB: current.ext.maxSizeMB,
      maxWidth: current.ext.maxWidth,
      maxHeight: current.ext.maxHeight,
      quality: current.ext.quality,
    } satisfies Pick<FirstLastFrameExt, "maxSizeMB" | "maxWidth" | "maxHeight" | "quality">;

    const updateExt = (patch: Partial<FirstLastFrameExt>) => {
      onChange({ ...current, ext: { ...current.ext, ...patch } });
    };

    const updateRecommendation = (index: number, patch: Partial<FirstLastFrameRecommendation>) => {
      const nextRecommendations = recommendations.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      ));
      updateExt({ recommendations: nextRecommendations });
    };

    return (
      <div className="mt-4 space-y-4 px-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">执行前物化</span>
          <Switch
            checked={current.ext.enableUploadBeforeRun !== false}
            onCheckedChange={(v) => updateExt({ enableUploadBeforeRun: v })}
          />
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">图片约束</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">图片最大体积（MB）</label>
              <Input
                value={current.ext.maxSizeMB === undefined ? "" : current.ext.maxSizeMB}
                onChange={(event) => updateExt({ maxSizeMB: toEditableNumericValue(event.target.value) })}
                onBlur={(event) => {
                  const value = event.target.value;
                  if (value === "" || value === "-" || Number.isNaN(Number(value))) {
                    updateExt({ maxSizeMB: undefined });
                  }
                }}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">图片压缩质量</label>
              <Input
                value={current.ext.quality === undefined ? "" : current.ext.quality}
                onChange={(event) => updateExt({ quality: toEditableNumericValue(event.target.value) })}
                onBlur={(event) => {
                  const value = event.target.value;
                  if (value === "" || value === "-" || Number.isNaN(Number(value))) {
                    updateExt({ quality: undefined });
                  }
                }}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">图片最大宽度</label>
              <Input
                value={current.ext.maxWidth === undefined ? "" : current.ext.maxWidth}
                onChange={(event) => updateExt({ maxWidth: toEditableNumericValue(event.target.value) })}
                onBlur={(event) => {
                  const value = event.target.value;
                  if (value === "" || value === "-" || Number.isNaN(Number(value))) {
                    updateExt({ maxWidth: undefined });
                  }
                }}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">图片最大高度</label>
              <Input
                value={current.ext.maxHeight === undefined ? "" : current.ext.maxHeight}
                onChange={(event) => updateExt({ maxHeight: toEditableNumericValue(event.target.value) })}
                onBlur={(event) => {
                  const value = event.target.value;
                  if (value === "" || value === "-" || Number.isNaN(Number(value))) {
                    updateExt({ maxHeight: undefined });
                  }
                }}
                className="h-9"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">推荐图标</div>
              <div className="text-[11px] text-muted-foreground">最多配置 8 张。未配置时运行态会从文件管理随机加载 8 张图片，点击刷新会切换到另一批随机推荐。</div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-[12px]"
              disabled={recommendations.length >= MAX_CONFIGURED_RECOMMENDATION_COUNT}
              onClick={() => updateExt({
                recommendations: [
                  ...recommendations,
                  { title: `推荐${recommendations.length + 1}`, iconUrl: "" },
                ],
              })}
            >
              新增推荐
            </Button>
          </div>

          {recommendations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-4 text-[12px] text-muted-foreground">
              暂未配置推荐图片，运行时会从文件管理随机加载 8 张图片；若接口暂无数据，则回退为占位符。
            </div>
          ) : (
            recommendations.map((item, index) => (
              <div key={`${item.title}-${index}`} className="space-y-3 rounded-lg border border-border bg-background px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">推荐项 {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-[12px] text-destructive hover:text-destructive"
                    onClick={() => updateExt({
                      recommendations: recommendations.filter((_, itemIndex) => itemIndex !== index),
                    })}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    删除
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">名称</label>
                  <Input
                    value={item.title}
                    onChange={(event) => updateRecommendation(index, { title: event.target.value })}
                    placeholder="请输入推荐名称"
                    className="h-9"
                  />
                </div>
                <RecommendationImageField
                  label="推荐图片"
                  value={item.iconUrl ?? ""}
                  placeholder="请输入推荐图片 URL"
                  helper="仅需一张图片。运行时点击该推荐项时，会按用户当前选中的首帧或尾帧槽位写入。"
                  onChange={(next) => updateRecommendation(index, { iconUrl: next })}
                  uploadRules={uploadRules}
                  validateMaterial={(material) => validatePickedMultiSourceMaterial(material, normalizeMultiSourceImageUploadRules(current.ext))}
                />
              </div>
            ))
          )}
        </div>
      </div>
    );
  },
};
