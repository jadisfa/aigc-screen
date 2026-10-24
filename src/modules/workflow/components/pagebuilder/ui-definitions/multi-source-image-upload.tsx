import type { DragEvent, ReactNode } from "react";
import { useRef, useState, useEffect, useCallback, useId } from "react";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Image, Images, GripVertical, X } from "lucide-react";
import type { MultiSourceImageUploadExt, UiComponent } from "../ui-schema";
import { defaultCollectDispatchParamsForComponent } from "./shared";
import type { UiComponentDefinition } from "./types";
import FileMaterialPickerDialog from "@/shared/components/FileMaterialPickerDialog";
import { getFileMaterialByHash, uploadFileMaterialForm, type FileMaterial } from "@/shared/api/materials/materials-file-material";
import { md5HexFromFile } from "@/shared/lib/md5";
import { getSessionScopeReadyError, useSessionScope, withSessionScope } from "@/shared/hooks/use-session-scope";
import {
  clearUploadPasteTargetActive,
  clearUploadPasteTargetHover,
  markUploadPasteTargetActive,
  markUploadPasteTargetHover,
  shouldHandleUploadPaste,
} from "./upload-paste-target";
import { notify } from "@/shared/lib/notify";

type MultiSourceImageUploadRules = {
  maxSizeBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

type ImageAssetMeta = {
  width: number;
  height: number;
  fileSize: number;
};

type EditableNumericValue = number | string | undefined;

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "-" || trimmed === "." || trimmed === "-." || trimmed.endsWith(".")) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toEditableNumericValue(value: string): EditableNumericValue {
  if (value === "" || value === "-" || value === "." || value === "-." || value.endsWith(".")) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeMultiSourceImageUploadRules(ext: MultiSourceImageUploadExt): MultiSourceImageUploadRules {
  const maxSizeMB = toFiniteNumber(ext.maxSizeMB);
  const maxWidth = toFiniteNumber(ext.maxWidth);
  const maxHeight = toFiniteNumber(ext.maxHeight);
  const quality = toFiniteNumber(ext.quality);

  return {
    maxSizeBytes: maxSizeMB != null && maxSizeMB > 0 ? maxSizeMB * 1024 * 1024 : undefined,
    maxWidth: maxWidth != null && maxWidth > 0 ? maxWidth : undefined,
    maxHeight: maxHeight != null && maxHeight > 0 ? maxHeight : undefined,
    quality: quality != null && quality > 0 && quality <= 1 ? quality : undefined,
  };
}

export function validateMultiSourceImageAsset(meta: ImageAssetMeta, rules: MultiSourceImageUploadRules): void {
  if (rules.maxWidth != null && meta.width > rules.maxWidth) {
    throw new Error(`图片宽度不能超过 ${rules.maxWidth}px`);
  }
  if (rules.maxHeight != null && meta.height > rules.maxHeight) {
    throw new Error(`图片高度不能超过 ${rules.maxHeight}px`);
  }
  if (rules.maxSizeBytes != null && meta.fileSize > rules.maxSizeBytes) {
    const maxSizeMB = Number((rules.maxSizeBytes / (1024 * 1024)).toFixed(2));
    throw new Error(`图片体积不能超过 ${maxSizeMB}MB`);
  }
}

async function readImageDimensionsFromUrl(url: string): Promise<{ width: number; height: number }> {
  return await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("无法读取图片尺寸"));
    img.src = url;
  });
}

async function readImageMetaFromFile(file: File): Promise<ImageAssetMeta> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const { width, height } = await readImageDimensionsFromUrl(objectUrl);
    return { width, height, fileSize: file.size };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function compressImageFile(file: File, quality: number): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("图片压缩失败"));
      img.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("图片压缩失败");
    }
    ctx.drawImage(img, 0, 0);

    const mimeType = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (nextBlob) resolve(nextBlob);
        else reject(new Error("图片压缩失败"));
      }, mimeType, quality);
    });

    return new File([blob], file.name, { type: blob.type || mimeType, lastModified: file.lastModified });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareLocalImageForMultiSourceUpload(
  file: File,
  rules: MultiSourceImageUploadRules,
  deps: {
    readMeta?: (file: File) => Promise<ImageAssetMeta>;
    compress?: (file: File, quality: number) => Promise<File>;
  } = {},
): Promise<File> {
  const readMeta = deps.readMeta ?? readImageMetaFromFile;
  const compress = deps.compress ?? compressImageFile;

  const originalMeta = await readMeta(file);
  validateMultiSourceImageAsset(originalMeta, { ...rules, maxSizeBytes: undefined });

  const processedFile = rules.quality != null ? await compress(file, rules.quality) : file;
  const processedMeta = processedFile === file ? originalMeta : await readMeta(processedFile);
  validateMultiSourceImageAsset({ ...processedMeta, fileSize: processedFile.size }, rules);

  return processedFile;
}

export async function validatePickedMultiSourceMaterial(
  material: FileMaterial,
  rules: MultiSourceImageUploadRules,
  deps: {
    readDimensions?: (url: string) => Promise<{ width: number; height: number }>;
  } = {},
): Promise<void> {
  const readDimensions = deps.readDimensions ?? readImageDimensionsFromUrl;
  const { width, height } = await readDimensions(material.accessUrl);
  validateMultiSourceImageAsset(
    { width, height, fileSize: material.fileSize ?? 0 },
    { ...rules, quality: undefined },
  );
}

function ImgPickHoverPreview() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="w-[260px]">
      <div className="flex items-center gap-1.5 mb-2">
        <Image className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">图片选择(本地/素材库)</span>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
      <div className="border border-dashed border-border rounded-lg h-[160px] flex flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="flex items-center gap-1.5 px-2 py-2 rounded-md border border-border bg-background hover:bg-accent transition-colors text-xs font-normal text-foreground"
          >
            <Image className="w-4 h-4" />
            本地上传
          </button>
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 px-2 py-2 rounded-md border border-border bg-background hover:bg-accent transition-colors text-xs font-normal text-foreground"
          >
            <Images className="w-4 h-4" />
            素材库
          </button>
        </div>
      </div>
    </div>
  );
}

function MultiSourceImageUploadCanvasCard(props: { comp: Extract<UiComponent, { type: "MultiSourceImageUpload" }>; selected: boolean; onSelect: () => void; onRemove: () => void; onDragStart: (e: DragEvent<HTMLElement>) => void; onDragEnd: () => void; onChange?: (material: FileMaterial | null) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [picked, setPicked] = useState<FileMaterial | null>(null);
  const title = props.comp.title || "图片选择(本地/素材库/历史记录)";
  const sessionScope = useSessionScope();

  const handleLocalUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const uploadBlockReason = getSessionScopeReadyError(sessionScope);
    if (uploadBlockReason) {
      notify.error("上传暂不可用", { description: uploadBlockReason });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const fileHash = await md5HexFromFile(file);
      let material: FileMaterial;
      const existing = await getFileMaterialByHash(withSessionScope(sessionScope.scope, { fileHash }));
      if (existing) {
        material = existing;
      } else {
        const result = await uploadFileMaterialForm(withSessionScope(sessionScope.scope, { file, fileType: "image", fileHash }));
        material = result.file;
      }
      setPicked(material);
      if (props.onChange) props.onChange(material);
    } catch (err) {
      notify.error("上传失败", { description: err instanceof Error ? err.message : "请求失败" });
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const pickedUrl = (picked?.accessUrl || "").trim();
  const pickedName = (picked?.fileName || "").trim();

  return (
    <div
      onClick={props.onSelect}
      className={`rounded-md border p-3 cursor-pointer transition-all duration-200 group ${
        props.selected ? "border-1 border-purple-500 border-dashed bg-background" : "border-border border-solid bg-background"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            draggable
            onDragStart={props.onDragStart}
            onDragEnd={props.onDragEnd}
            onClick={(e) => e.stopPropagation()}
            className={`cursor-grab active:cursor-grabbing ${props.selected ? "block" : "hidden group-hover:block"}`}
          >
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <Image className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onRemove();
          }}
          className="text-destructive hover:text-destructive/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => handleLocalUpload(e.target.files)}
      />
      {pickedUrl ? (
          <div className="w-full border-2 border-dashed border-border rounded-lg overflow-hidden relative group">
            <div className="relative h-[320px] bg-muted flex items-center justify-center">
              <img src={pickedUrl} alt={pickedName || "已选择图片"} className="h-full w-full object-contain" />
              <div className="absolute bottom-1 right-2 z-10 text-[10px] text-white bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm pointer-events-none">
                <span ref={(el) => {
                  if (el) {
                    const img = new window.Image();
                    img.src = pickedUrl;
                    img.onload = () => {
                      el.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
                    };
                  }
                }} />
              </div>
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-white/30 bg-black/40 hover:bg-black/50 transition-colors text-sm font-medium text-white disabled:opacity-60"
                >
                  <Image className="w-4 h-4" />
                  本地上传
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMaterialPickerOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-white/30 bg-black/40 hover:bg-black/50 transition-colors text-sm font-medium text-white disabled:opacity-60"
                >
                  <Images className="w-4 h-4" />
                  素材库
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPicked(null);
                if (props.onChange) props.onChange(null);
              }}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-white hover:bg-destructive transition-colors opacity-0 group-hover:opacity-100 z-10"
              title="清除图片"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full border-2 border-dashed border-border rounded-lg h-[160px] flex flex-col items-center justify-center gap-3 hover:bg-accent/30 transition-colors">
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              disabled={uploading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-border bg-background hover:bg-accent transition-colors text-sm font-medium text-foreground disabled:opacity-60"
            >
              <Image className="w-4 h-4" />
              {uploading ? "上传中..." : "本地上传"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMaterialPickerOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-border bg-background hover:bg-accent transition-colors text-sm font-medium text-foreground"
            >
              <Images className="w-4 h-4" />
              素材库
            </button>
          </div>
        </div>
      )}
      <FileMaterialPickerDialog
        open={materialPickerOpen}
        onOpenChange={setMaterialPickerOpen}
        title="选择图片素材"
        fileType="image"
        onPick={(url, item) => {
          if (!item) return;
          setPicked(item);
          if (props.onChange) props.onChange(item);
        }}
      />
    </div>
  );
}

function MultiSourceImageUploadRuntimeField(props: {
  comp: Extract<UiComponent, { type: "MultiSourceImageUpload" }>;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const files = Array.isArray(props.value) ? (props.value as FileMaterial[]) : [];
  const pasteTargetId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const sessionScope = useSessionScope();
  const uploadRules = normalizeMultiSourceImageUploadRules(props.comp.ext);

  const handleLocalUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const uploadBlockReason = getSessionScopeReadyError(sessionScope);
    if (uploadBlockReason) {
      notify.error("上传暂不可用", { description: uploadBlockReason });
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }
    setUploading(true);
    try {
      const uploadedMaterials: FileMaterial[] = [];
      for (const file of Array.from(fileList)) {
        const processedFile = await prepareLocalImageForMultiSourceUpload(file, uploadRules);
        const fileHash = await md5HexFromFile(processedFile);
        const existing = await getFileMaterialByHash(withSessionScope(sessionScope.scope, { fileHash }));
        if (existing) {
          uploadedMaterials.push(existing);
        } else {
          const result = await uploadFileMaterialForm(withSessionScope(sessionScope.scope, { file: processedFile, fileType: "image", fileHash }));
          uploadedMaterials.push(result.file);
        }
      }
      props.onChange(uploadedMaterials);
    } catch (err) {
      notify.error("上传失败", { description: err instanceof Error ? err.message : "请求失败" });
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }, [inputRef, props, sessionScope, uploadRules]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleLocalUpload(files);
    }
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!shouldHandleUploadPaste(pasteTargetId) || uploading) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const filesToUpload: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) filesToUpload.push(file);
        }
      }
      if (filesToUpload.length > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const dt = new DataTransfer();
        filesToUpload.forEach((file) => dt.items.add(file));
        await handleLocalUpload(dt.files);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
      clearUploadPasteTargetActive(pasteTargetId);
      clearUploadPasteTargetHover(pasteTargetId);
    };
  }, [handleLocalUpload, pasteTargetId, uploading]);

  const previews = files
    .map((m) => ({ id: m.id, url: (m.accessUrl || "").trim(), name: (m.fileName || "").trim() }))
    .filter((x) => x.url);

  return (
    <div 
      className="space-y-2"
      tabIndex={0}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseEnter={() => markUploadPasteTargetHover(pasteTargetId)}
      onMouseLeave={() => clearUploadPasteTargetHover(pasteTargetId)}
      onPointerDownCapture={() => markUploadPasteTargetActive(pasteTargetId)}
      onFocusCapture={() => markUploadPasteTargetActive(pasteTargetId)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          clearUploadPasteTargetActive(pasteTargetId);
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleLocalUpload(e.target.files)}
      />
      {previews.length > 0 ? (
        <div className={`w-full border-2 border-dashed rounded-lg overflow-hidden relative group ${isDragOver ? "border-primary" : "border-border"}`}>
          <div className="relative h-[320px] bg-muted">
            <img src={previews[0].url} alt={previews[0].name || "已选择图片"} className="h-full w-full object-contain" />
            <div className="absolute bottom-1 right-2 z-10 text-[10px] text-white bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm pointer-events-none">
              <span ref={(el) => {
                if (el) {
                  const img = new window.Image();
                  img.src = previews[0].url;
                  img.onload = () => {
                    el.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
                  };
                }
              }} />
            </div>
            {previews.length > 1 && (
              <div className="absolute right-2 top-2 px-2 py-1 rounded-md bg-black/60 text-white text-xs">{previews.length} 张</div>
            )}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => inputRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-white/30 bg-black/40 hover:bg-black/50 transition-colors text-sm font-medium text-white disabled:opacity-60"
                >
                  <Image className="w-4 h-4" />
                  本地上传
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setMaterialPickerOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-white/30 bg-black/40 hover:bg-black/50 transition-colors text-sm font-medium text-white disabled:opacity-60"
                >
                  <Images className="w-4 h-4" />
                  素材库
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onChange([]);
              }}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-white hover:bg-destructive transition-colors opacity-0 group-hover:opacity-100 z-10"
              title="清除图片"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className={`w-full border-2 border-dashed rounded-lg h-[160px] flex flex-col items-center justify-center gap-3 transition-colors ${
          isDragOver ? "border-primary bg-accent/50" : "border-border hover:bg-accent/30"
        }`}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-border bg-background hover:bg-accent transition-colors text-sm font-medium text-foreground disabled:opacity-60"
            >
              <Image className="w-4 h-4" />
              {uploading ? "上传中..." : "本地上传"}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMaterialPickerOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-border bg-background hover:bg-accent transition-colors text-sm font-medium text-foreground"
            >
              <Images className="w-4 h-4" />
              素材库
            </button>
          </div>
          <div className="text-xs text-muted-foreground">{uploading ? "上传中..." : "支持：本地上传 / 素材库 / 历史记录"}</div>
        </div>
      )}
      <FileMaterialPickerDialog
        open={materialPickerOpen}
        onOpenChange={setMaterialPickerOpen}
        title="选择图片素材"
        fileType="image"
        onPick={async (url, item) => {
          if (!item) return;
          try {
            await validatePickedMultiSourceMaterial(item, uploadRules);
          } catch (err) {
            notify.error("图片不符合约束", { description: err instanceof Error ? err.message : "请选择符合约束的图片" });
            return;
          }
          props.onChange([item]);
        }}
      />
    </div>
  );
}

export const multiSourceImageUploadDefinition: UiComponentDefinition = {
  type: "MultiSourceImageUpload",
  iconName: "image",
  palette: { id: "img-pick", label: "图片选择(本地/素材库/...)", category: "图像", order: 30 },
  // renderPaletteHoverPreview：
  // - 左侧组件面板 hover 预览（添加组件前的形态预览）
  // - 这里用 ImgPickHoverPreview 展示“本地上传/素材库”两个入口的静态布局
  renderPaletteHoverPreview: () => <ImgPickHoverPreview />,
  // renderCanvasCard：
  // - PageBuilder 画布中组件卡片渲染（包含选中态、拖拽手柄、删除按钮等）
  // - 注意：画布卡片是“设计态”，用于排版/配置；真实运行时交互在 renderRuntimeField
  renderCanvasCard: (props) => {
    const comp = props.comp as Extract<UiComponent, { type: "MultiSourceImageUpload" }>;
    return (
      <MultiSourceImageUploadCanvasCard
        comp={comp}
        selected={props.selected}
        onSelect={props.onSelect}
        onRemove={props.onRemove}
        onDragStart={props.onDragStart}
        onDragEnd={props.onDragEnd}
      />
    );
  },
  createInitialRuntimeValue: () => [],
  collectDispatchParams: (component, values) => {
    const params = defaultCollectDispatchParamsForComponent(component, values);
    for (const k of Object.keys(params)) {
      if (Array.isArray(params[k])) {
        params[k] = params[k].join(",");
      }
    }
    return params;
  },
  // renderCanvasPreview：
  // - 画布中的静态预览（较轻量）
  // - 当画布卡片不需要完全复用运行时 UI 时，可用这里提供更简单的占位预览
  renderCanvasPreview: (): ReactNode => {
    return (
      <div className="border border-dashed border-border rounded-lg p-6 text-center text-muted-foreground text-sm">
        图片选择（本地/素材库/历史记录）
      </div>
    );
  },
  // renderRuntimeField：
  // - 运行时表单中的真实输入控件（用户真正选择图片的地方）
  // - MultiSourceImageUploadRuntimeField 内部负责：本地上传（hash 去重）、素材库选择、以及在控件内展示预览
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    const c = comp as Extract<UiComponent, { type: "MultiSourceImageUpload" }>;
    return (
      <div className="space-y-2">
        <LabelComp />
        <MultiSourceImageUploadRuntimeField comp={c} value={value} onChange={onChange} />
      </div>
    );
  },
  // renderExtEditor：
  // - 右侧属性面板扩展配置
  // - 用于编辑图片约束（maxSizeMB/quality/maxWidth/maxHeight），影响运行时上传校验与处理策略
  renderExtEditor: (component, onChange) => {
    const c = component as Extract<UiComponent, { type: "MultiSourceImageUpload" }>;
    return (
      <div className="space-y-3 mt-4 mx-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">执行前物化</span>
          <Switch
            checked={c.ext.enableUploadBeforeRun !== false}
            onCheckedChange={(v) => onChange({ ...c, ext: { ...c.ext, enableUploadBeforeRun: v } })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">图片最大体积（MB）</label>
            <Input
              value={c.ext.maxSizeMB === undefined ? "" : c.ext.maxSizeMB}
              onChange={(e) => {
                const v = e.target.value;
                onChange({ ...c, ext: { ...c.ext, maxSizeMB: toEditableNumericValue(v) } });
              }}
              onBlur={(e) => {
                const v = e.target.value;
                if (v === "" || v === "-" || Number.isNaN(Number(v))) {
                  onChange({ ...c, ext: { ...c.ext, maxSizeMB: undefined } });
                }
              }}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">图片压缩质量</label>
            <Input
              value={c.ext.quality === undefined ? "" : c.ext.quality}
              onChange={(e) => {
                const v = e.target.value;
                onChange({ ...c, ext: { ...c.ext, quality: toEditableNumericValue(v) } });
              }}
              onBlur={(e) => {
                const v = e.target.value;
                if (v === "" || v === "-" || Number.isNaN(Number(v))) {
                  onChange({ ...c, ext: { ...c.ext, quality: undefined } });
                }
              }}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">图片最大宽度</label>
            <Input
              value={c.ext.maxWidth === undefined ? "" : c.ext.maxWidth}
              onChange={(e) => {
                const v = e.target.value;
                onChange({ ...c, ext: { ...c.ext, maxWidth: toEditableNumericValue(v) } });
              }}
              onBlur={(e) => {
                const v = e.target.value;
                if (v === "" || v === "-" || Number.isNaN(Number(v))) {
                  onChange({ ...c, ext: { ...c.ext, maxWidth: undefined } });
                }
              }}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">图片最大高度</label>
            <Input
              value={c.ext.maxHeight === undefined ? "" : c.ext.maxHeight}
              onChange={(e) => {
                const v = e.target.value;
                onChange({ ...c, ext: { ...c.ext, maxHeight: toEditableNumericValue(v) } });
              }}
              onBlur={(e) => {
                const v = e.target.value;
                if (v === "" || v === "-" || Number.isNaN(Number(v))) {
                  onChange({ ...c, ext: { ...c.ext, maxHeight: undefined } });
                }
              }}
              className="h-9"
            />
          </div>
        </div>
      </div>
    );
  },
};
