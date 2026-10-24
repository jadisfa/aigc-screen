import type { ReactNode } from "react";
import { useRef, useState, useEffect, useCallback, useId } from "react";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import { Switch } from "@/shared/ui/switch";
import { Upload, X } from "lucide-react";
import type { ImageUploadAutoExt, UiComponent } from "../ui-schema";
import { defaultCollectDispatchParamsForComponent } from "./shared";
import type { UiComponentDefinition } from "./types";
import { getFileMaterialByHash, uploadFileMaterialForm, type FileMaterial } from "@/shared/api/materials/materials-file-material";
import { md5HexFromFile } from "@/shared/lib/md5";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { normalizeMultiSourceImageUploadRules, prepareLocalImageForMultiSourceUpload } from "./multi-source-image-upload";
import { getSessionScopeReadyError, useSessionScope, withSessionScope } from "@/shared/hooks/use-session-scope";
import {
  clearUploadPasteTargetActive,
  clearUploadPasteTargetHover,
  markUploadPasteTargetActive,
  markUploadPasteTargetHover,
  shouldHandleUploadPaste,
} from "./upload-paste-target";
import { notify } from "@/shared/lib/notify";

function ImageUploadAutoCanvasPreview({ comp }: { comp: Extract<UiComponent, { type: "ImageUploadAuto" }> }) {
  const types = comp.ext.fileTypes ?? [];
  const typeLabel = (t: string) => {
    if (t === "image") return "图片";
    if (t === "audio") return "音频";
    if (t === "video") return "视频";
    return t;
  };
  const typeHint = types.length > 0 ? `支持：${types.map(typeLabel).join(" / ")}` : "支持上传文件";
  const extHintParts: string[] = [];
  const maxSize = comp.ext.imageRules?.maxSizeMB;
  if (types.includes("image") && typeof maxSize === "number" && Number.isFinite(maxSize)) {
    extHintParts.push(`图片最大 ${maxSize}MB`);
  }
  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-border rounded-lg h-[160px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Upload className="w-8 h-8" />
        <span className="text-xs">点击/拖拽/粘贴上传</span>
        <div className="text-[11px] text-muted-foreground">{typeHint}</div>
        {extHintParts.length > 0 && <div className="text-[11px] text-muted-foreground">{extHintParts.join(" · ")}</div>}
      </div>
    </div>
  );
}

function ImageUploadAutoRuntimeField(props: {
  comp: Extract<UiComponent, { type: "ImageUploadAuto" }>;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const material = props.value as FileMaterial | null;
  const pasteTargetId = useId();
  const [uploading, setUploading] = useState(false);
  const types = props.comp.ext.fileTypes ?? [];
  const accept = types.includes("image") ? "image/*" : types.includes("video") ? "video/*" : types.includes("audio") ? "audio/*" : undefined;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sessionScope = useSessionScope();
  const [isDragOver, setIsDragOver] = useState(false);
  const imageRules = props.comp.ext.imageRules ?? {};
  const uploadRules = normalizeMultiSourceImageUploadRules({
    maxSizeMB: imageRules.maxSizeMB,
    maxWidth: imageRules.maxWidth,
    maxHeight: imageRules.maxHeight,
    quality: imageRules.quality,
  });

  const typeLabel = (t: string) => {
    if (t === "image") return "图片";
    if (t === "audio") return "音频";
    if (t === "video") return "视频";
    return t;
  };
  const typeHint = types.length > 0 ? `支持：${types.map(typeLabel).join(" / ")}` : "支持上传文件";
  const maxSize = props.comp.ext.imageRules?.maxSizeMB;
  const extHintParts: string[] = [];
  if (types.includes("image") && typeof maxSize === "number" && Number.isFinite(maxSize)) {
    extHintParts.push(`图片最大 ${maxSize}MB`);
  }

  const processUpload = useCallback(async (selectedFile: File) => {
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
      const uploadFile = selectedFile.type.startsWith("image/")
        ? await prepareLocalImageForMultiSourceUpload(selectedFile, uploadRules)
        : selectedFile;
      const fileHash = await md5HexFromFile(uploadFile);
      const existed = await getFileMaterialByHash(withSessionScope(sessionScope.scope, { fileHash }));

      if (existed?.accessUrl) {
        props.onChange(existed);
      } else {
        const result = await uploadFileMaterialForm(withSessionScope(sessionScope.scope, {
          file: uploadFile,
          fileType: "image",
          fileHash,
        }));
        props.onChange(result.file);
      }
    } catch (e) {
      notify.error("上传失败", { description: resolveUserErrorMessage(e, "请求失败") });
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }, [inputRef, props, sessionScope, uploadRules]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    if (!selectedFile) return;
    await processUpload(selectedFile);
  };

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
    const selectedFile = e.dataTransfer.files?.[0] ?? null;
    if (!selectedFile) return;
    await processUpload(selectedFile);
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!shouldHandleUploadPaste(pasteTargetId) || uploading) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            e.stopImmediatePropagation();
            await processUpload(file);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
      clearUploadPasteTargetActive(pasteTargetId);
      clearUploadPasteTargetHover(pasteTargetId);
    };
  }, [pasteTargetId, processUpload, uploading]);

  const displayName = material?.fileName ?? "";
  const previewUrl = (material?.accessUrl || "").trim();

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
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {previewUrl ? (
        <div className={`w-full border-2 border-dashed rounded-lg overflow-hidden relative group ${isDragOver ? "border-primary" : "border-border"}`}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full relative hover:border-primary/35 transition-colors disabled:opacity-50 disabled:cursor-not-allowed block group"
          >
            <div className="relative h-[320px] bg-muted">
              <img src={previewUrl} alt={displayName || "已选择图片"} className="h-full w-full object-contain" />
              <div className="absolute bottom-1 right-2 z-10 text-[10px] text-white bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm pointer-events-none">
                <span ref={(el) => {
                  if (el) {
                    const img = new window.Image();
                    img.src = previewUrl;
                    img.onload = () => {
                      el.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
                    };
                  }
                }} />
              </div>
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-white">
                  <Upload className={`h-8 w-8 ${uploading ? "animate-pulse" : ""}`} />
                  <span className="text-xs">点击更换</span>
                </div>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              props.onChange(null);
            }}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-white hover:bg-destructive transition-colors opacity-0 group-hover:opacity-100 z-10"
            title="清除图片"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`w-full border-2 border-dashed rounded-lg h-[160px] flex flex-col items-center justify-center gap-2 text-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isDragOver ? "border-primary bg-accent/50" : "border-border hover:bg-accent/30"
          }`}
        >
          <Upload className={`w-8 h-8 ${uploading ? "animate-pulse" : ""}`} />
          <span className="text-xs">{uploading ? "上传中..." : "点击/拖拽/粘贴上传"}</span>
          <div className="text-[11px] text-muted-foreground">{typeHint}</div>
          {extHintParts.length > 0 && <div className="text-[11px] text-muted-foreground">{extHintParts.join(" · ")}</div>}
        </button>
      )}
    </div>
  );
}

export const imageUploadAutoDefinition: UiComponentDefinition = {
  type: "ImageUploadAuto",
  iconName: "upload",
  palette: { id: "upload-file", label: "上传(支持图像、音频、视频)", category: "图像", order: 10 },
  createInitialRuntimeValue: (component) => (component as Extract<UiComponent, { type: "ImageUploadAuto" }>).basic?.params?.[0]?.defaultValue ?? "",
  collectDispatchParams: (component, values) => defaultCollectDispatchParamsForComponent(component, values),
  renderCanvasPreview: (component): ReactNode => {
    return <ImageUploadAutoCanvasPreview comp={component as Extract<UiComponent, { type: "ImageUploadAuto" }>} />;
  },
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    const c = comp as Extract<UiComponent, { type: "ImageUploadAuto" }>;
    return (
      <div className="space-y-2">
        <LabelComp />
        <ImageUploadAutoRuntimeField comp={c} value={value} onChange={onChange} />
      </div>
    );
  },
  renderExtEditor: (component, onChange) => {
    const c = component as Extract<UiComponent, { type: "ImageUploadAuto" }>;
    const ext: ImageUploadAutoExt = c.ext;
    const fileTypes = ext.fileTypes ?? [];
    const imageRules = ext.imageRules ?? {};

    const commit = (nextExt: ImageUploadAutoExt) => onChange({ ...c, ext: nextExt });

    const setFileType = (t: "image" | "audio" | "video", enabled: boolean) => {
      const next = enabled ? Array.from(new Set([...fileTypes, t])) : fileTypes.filter((x) => x !== t);
      commit({ ...ext, fileTypes: next as ImageUploadAutoExt["fileTypes"] });
    };

    const updateImageRules = (patch: Partial<ImageUploadAutoExt["imageRules"]>) => {
      commit({ ...ext, imageRules: { ...imageRules, ...patch } });
    };

    return (
      <div className="space-y-3 mt-4 mx-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">执行前物化</span>
          <Switch
            checked={ext.enableUploadBeforeRun !== false}
            onCheckedChange={(v) => commit({ ...ext, enableUploadBeforeRun: v })}
          />
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">可选文件类型</span>
          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
            <label className="flex items-center gap-1.5 text-sm text-foreground">
              <Checkbox checked={fileTypes.includes("image")} onCheckedChange={(v) => setFileType("image", v as boolean)} />
              图片
            </label>
            <label className="flex items-center gap-1.5 text-sm text-foreground">
              <Checkbox checked={fileTypes.includes("audio")} onCheckedChange={(v) => setFileType("audio", v as boolean)} />
              音频
            </label>
            <label className="flex items-center gap-1.5 text-sm text-foreground">
              <Checkbox checked={fileTypes.includes("video")} onCheckedChange={(v) => setFileType("video", v as boolean)} />
              视频
            </label>
          </div>
        </div>

        {fileTypes.includes("image") && (
          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">图片约束</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">最大体积（MB）</label>
                <Input
                  value={imageRules.maxSizeMB == null ? "" : String(imageRules.maxSizeMB)}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateImageRules({ maxSizeMB: v === "" || v === "-" || v.endsWith(".") ? v : Number(v) });
                  }}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v === "" || v === "-" || Number.isNaN(Number(v))) {
                      updateImageRules({ maxSizeMB: undefined });
                    }
                  }}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">最大宽度</label>
                <Input
                  value={imageRules.maxWidth == null ? "" : String(imageRules.maxWidth)}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateImageRules({ maxWidth: v === "" || v === "-" || v.endsWith(".") ? v : Number(v) });
                  }}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v === "" || v === "-" || Number.isNaN(Number(v))) {
                      updateImageRules({ maxWidth: undefined });
                    }
                  }}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">最大高度</label>
                <Input
                  value={imageRules.maxHeight == null ? "" : String(imageRules.maxHeight)}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateImageRules({ maxHeight: v === "" || v === "-" || v.endsWith(".") ? v : Number(v) });
                  }}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v === "" || v === "-" || Number.isNaN(Number(v))) {
                      updateImageRules({ maxHeight: undefined });
                    }
                  }}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">压缩质量（0~1）</label>
                <Input
                  value={imageRules.quality == null ? "" : String(imageRules.quality)}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateImageRules({ quality: v === "" || v === "-" || v.endsWith(".") ? v : Number(v) });
                  }}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v === "" || v === "-" || Number.isNaN(Number(v))) {
                      updateImageRules({ quality: undefined });
                    }
                  }}
                  className="h-9"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
};
