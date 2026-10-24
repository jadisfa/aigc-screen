import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { GripVertical, Image, Plus, Trash2, Upload, X } from "lucide-react";
import type { ImageSelectPreviewOption, UiComponent } from "../ui-schema";
import { readRuntimeComponentValue, valueToInputPayload } from "./shared";
import type { UiComponentCanvasCardProps, UiComponentDefinition } from "./types";
import { getParamAlias } from "../param-utils";
import { uploadFileMaterialForm, getFileMaterialByHash } from "@/shared/api/materials/materials-file-material";
import { md5HexFromFile } from "@/shared/lib/md5";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { getSessionScopeReadyError, useSessionScope, withSessionScope } from "@/shared/hooks/use-session-scope";
import { notify } from "@/shared/lib/notify";

const IMAGE_SELECT_PREVIEW_FOCUS_OPTION_EVENT = "pagebuilder:image-select-preview-focus-option";
let pendingImageSelectPreviewFocusDetail: ImageSelectPreviewFocusOptionDetail | null = null;

type ImageSelectPreviewFocusOptionDetail = {
  componentId: string;
  optionIndex: number;
};

type ImageSelectPreviewItemLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

// 通知扩展属性面板滚动并高亮到当前预览项对应的配置位置。
function dispatchImageSelectPreviewFocusOption(detail: ImageSelectPreviewFocusOptionDetail) {
  if (typeof window === "undefined") return;
  pendingImageSelectPreviewFocusDetail = detail;
  window.dispatchEvent(new CustomEvent<ImageSelectPreviewFocusOptionDetail>(IMAGE_SELECT_PREVIEW_FOCUS_OPTION_EVENT, { detail }));
}

// 纯数组重排工具：把 fromIndex 的选项移动到 toIndex。
function moveImageSelectPreviewOption(options: ImageSelectPreviewOption[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= options.length || toIndex >= options.length) {
    return options;
  }
  const next = [...options];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

// 用于判断父级回流的数据是否已经追上本地拖拽后的顺序，避免本地承接状态长期保留。
function isSameImageSelectPreviewOptions(a: ImageSelectPreviewOption[], b: ImageSelectPreviewOption[]) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    if (!other) return false;
    const valuesA = item.values ?? [];
    const valuesB = other.values ?? [];
    return (
      item.title === other.title &&
      item.src === other.src &&
      item.value === other.value &&
      item.valueExtra === other.valueExtra &&
      item.weight === other.weight &&
      valuesA.length === valuesB.length &&
      valuesA.every((value, valueIndex) => value === valuesB[valueIndex])
    );
  });
}

function ImageUploader({ src, onChange }: { src: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sessionScope = useSessionScope();

  const processUpload = async (selectedFile: File) => {
    const uploadBlockReason = getSessionScopeReadyError(sessionScope);
    if (uploadBlockReason) {
      notify.error("上传暂不可用", { description: uploadBlockReason });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const fileHash = await md5HexFromFile(selectedFile);
      const existed = await getFileMaterialByHash(withSessionScope(sessionScope.scope, { fileHash }));

      if (existed?.accessUrl) {
        onChange(existed.accessUrl);
      } else {
        const result = await uploadFileMaterialForm(withSessionScope(sessionScope.scope, {
          file: selectedFile,
          fileType: "image",
          fileHash,
        }));
        onChange(result.file.accessUrl);
      }
    } catch (e) {
      notify.error("上传失败", { description: resolveUserErrorMessage(e, "请求失败") });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    if (!selectedFile) return;
    await processUpload(selectedFile);
  };

  return (
    <div className="flex items-center gap-3">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
      <div
        onClick={() => inputRef.current?.click()}
        className="w-16 h-16 shrink-0 rounded border flex items-center justify-center bg-muted overflow-hidden cursor-pointer hover:border-primary/50 relative group"
      >
        {src ? (
          <>
            <img src={src} alt="Preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload className="w-4 h-4 text-white" />
            </div>
          </>
        ) : (
          <Image className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 space-y-1.5">
        <Input value={src} onChange={(e) => onChange(e.target.value)} placeholder="输入图片 URL 或点击左侧上传" className="h-9 text-xs" />
        <div className="text-[10px] text-muted-foreground">{uploading ? "上传中..." : "支持本地上传或输入外部链接"}</div>
      </div>
    </div>
  );
}

function ImageSelectPreviewCanvasPreview({ comp }: { comp: Extract<UiComponent, { type: "ImageSelectPreview" }> }) {
  return <ImageSelectPreviewGrid comp={comp} />;
}

function ImageSelectPreviewGrid({
  comp,
  editable = false,
  onChange,
  onPreviewOptionClick,
}: {
  comp: Extract<UiComponent, { type: "ImageSelectPreview" }>;
  editable?: boolean;
  onChange?: (next: Extract<UiComponent, { type: "ImageSelectPreview" }>) => void;
  onPreviewOptionClick?: (optionIndex: number) => void;
}) {
  const optionsRaw = comp.ext.options;
  const [optimisticOptions, setOptimisticOptions] = useState<ImageSelectPreviewOption[] | null>(null);
  const options = useMemo(() => optimisticOptions ?? optionsRaw ?? [], [optimisticOptions, optionsRaw]);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const itemLayoutsRef = useRef<ImageSelectPreviewItemLayout[]>([]);
  const pointerDragRef = useRef<{
    pointerId: number;
    sourceIndex: number;
    started: boolean;
    startX: number;
    startY: number;
  } | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const getKey = (o: ImageSelectPreviewOption, idx: number) => {
    return String(idx);
  };

  const [selectedKey, setSelectedKey] = useState<string>("0");
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // 当前拖拽项相对按下起点的偏移量，用于让被拖动卡片跟随指针移动。
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (options.length === 0) {
      setSelectedKey("");
      return;
    }
    const exists = options.some((o, idx) => getKey(o, idx) === selectedKey);
    if (!exists) setSelectedKey("0");
  }, [options, selectedKey]);

  useEffect(() => {
    if (!optimisticOptions) return;
    if (isSameImageSelectPreviewOptions(optimisticOptions, optionsRaw ?? [])) {
      setOptimisticOptions(null);
    }
  }, [optimisticOptions, optionsRaw]);

  const selected = options.find((o, idx) => getKey(o, idx) === selectedKey) ?? options[0];

  // 统一清理一次拖拽会话中的临时状态。
  const resetPointerDrag = () => {
    pointerDragRef.current = null;
    dragOverIndexRef.current = null;
    itemLayoutsRef.current = [];
    setDraggingIndex(null);
    setDragOverIndex(null);
    setDragOffset({ x: 0, y: 0 });
  };

  // 命中计算基于拖拽开始时缓存的静态格位，避免动画中的 DOM 位置扰动命中结果。
  const resolveTargetIndex = (clientX: number, clientY: number) => {
    const gridRect = gridRef.current?.getBoundingClientRect();
    if (!gridRect) return null;
    const withinGrid =
      clientX >= gridRect.left &&
      clientX <= gridRect.right &&
      clientY >= gridRect.top &&
      clientY <= gridRect.bottom;
    if (!withinGrid) return null;

    const localX = clientX - gridRect.left;
    const localY = clientY - gridRect.top;
    const layouts = itemLayoutsRef.current;
    let nearestIndex: number | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < layouts.length; i += 1) {
      const rect = layouts[i];
      if (!rect) continue;
      const containsPoint =
        localX >= rect.left &&
        localX <= rect.left + rect.width &&
        localY >= rect.top &&
        localY <= rect.top + rect.height;
      if (containsPoint) return i;

      const distance = Math.hypot(localX - rect.centerX, localY - rect.centerY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    return nearestIndex;
  };

  // 落位时先本地承接最终顺序，再把结果同步回父级，避免出现“先回位再交换”的视觉干扰。
  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (!editable || !onChange) return;
    const nextOptions = moveImageSelectPreviewOption(options, fromIndex, toIndex);
    if (nextOptions === options) return;
    const selectedIndex = options.findIndex((o, idx) => getKey(o, idx) === selectedKey);
    const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
    const nextSelectedIndex = selectedOption ? nextOptions.indexOf(selectedOption) : -1;
    setSelectedKey(String(nextSelectedIndex >= 0 ? nextSelectedIndex : toIndex));
    setOptimisticOptions(nextOptions);
    onChange({ ...comp, ext: { ...comp.ext, options: nextOptions } });
    dispatchImageSelectPreviewFocusOption({ componentId: comp.id, optionIndex: toIndex });
  };

  // 生成每个卡片当前应展示的位移：被拖动项跟手移动，其余项按目标落位即时让位。
  const getPreviewTransform = (itemIndex: number) => {
    if (draggingIndex === null || dragOverIndex === null) return undefined;
    if (itemIndex === draggingIndex) {
      return `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.04) rotate(1deg)`;
    }
    if (draggingIndex === dragOverIndex) return undefined;

    const fromIndex = itemIndex;
    let toIndex = itemIndex;

    if (draggingIndex < dragOverIndex && itemIndex > draggingIndex && itemIndex <= dragOverIndex) {
      toIndex = itemIndex - 1;
    } else if (draggingIndex > dragOverIndex && itemIndex >= dragOverIndex && itemIndex < draggingIndex) {
      toIndex = itemIndex + 1;
    }

    if (fromIndex === toIndex) return undefined;

    const layouts = itemLayoutsRef.current;
    const fromLayout = layouts[fromIndex];
    const toLayout = layouts[toIndex];
    if (!fromLayout || !toLayout) return undefined;

    return `translate(${toLayout.left - fromLayout.left}px, ${toLayout.top - fromLayout.top}px)`;
  };

  // 占位框直接复用目标格位的静态布局，这样提示位置与最终落位保持一致。
  const getPlaceholderStyle = () => {
    if (draggingIndex === null || dragOverIndex === null) return undefined;
    const targetLayout = itemLayoutsRef.current[dragOverIndex];
    if (!targetLayout) return undefined;

    return {
      width: targetLayout.width,
      height: targetLayout.height,
      left: targetLayout.left,
      top: targetLayout.top,
    };
  };

  const getPlaceholderAccentClass = () => {
    if (draggingIndex === null || dragOverIndex === null || draggingIndex === dragOverIndex) {
      return "inset-x-3 top-2 h-1";
    }
    if (draggingIndex < dragOverIndex) {
      return "inset-x-3 bottom-2 h-1";
    }
    return "inset-x-3 top-2 h-1";
  };

  const placeholderStyle = getPlaceholderStyle();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">选择风格：</span>
        <span className="text-xs font-medium text-foreground">{selected?.title ?? "-"}</span>
      </div>
      <div ref={gridRef} data-preview-grid="true" className="relative grid grid-cols-4 gap-2">
        {options.map((o, idx) => {
          const key = getKey(o, idx);
          const selectedNow = key === selectedKey;
          return (
            <div
              ref={(node) => {
                itemRefs.current[idx] = node;
              }}
              key={`${key}-${idx}`}
              data-preview-option="true"
              onPointerDown={(e) => {
                if (!editable || e.button !== 0) return;
                const target = e.target as HTMLElement | null;
                if (!target?.closest('[data-preview-drag-handle="true"]')) return;
                e.stopPropagation();
                // 拖拽开始时冻结一份网格静态布局，后续命中和让位都以此为准。
                const gridRect = gridRef.current?.getBoundingClientRect();
                if (gridRect) {
                  itemLayoutsRef.current = options.map((_, optionIndex) => {
                    const rect = itemRefs.current[optionIndex]?.getBoundingClientRect();
                    if (!rect) {
                      return {
                        left: 0,
                        top: 0,
                        width: 0,
                        height: 0,
                        centerX: 0,
                        centerY: 0,
                      };
                    }
                    const left = rect.left - gridRect.left;
                    const top = rect.top - gridRect.top;
                    return {
                      left,
                      top,
                      width: rect.width,
                      height: rect.height,
                      centerX: left + rect.width / 2,
                      centerY: top + rect.height / 2,
                    };
                  });
                }
                pointerDragRef.current = {
                  pointerId: e.pointerId,
                  sourceIndex: idx,
                  started: false,
                  startX: e.clientX,
                  startY: e.clientY,
                };
                dragOverIndexRef.current = idx;
                (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
              }}
              onPointerMove={(e) => {
                const dragState = pointerDragRef.current;
                if (!editable || !dragState || dragState.pointerId !== e.pointerId) return;
                e.stopPropagation();
                // 实时记录位移，让拖动项跟随指针。
                setDragOffset({
                  x: e.clientX - dragState.startX,
                  y: e.clientY - dragState.startY,
                });
                const movedEnough =
                  Math.abs(e.clientX - dragState.startX) > 4 ||
                  Math.abs(e.clientY - dragState.startY) > 4;
                if (!dragState.started && !movedEnough) return;
                if (!dragState.started) {
                  dragState.started = true;
                  setDraggingIndex(dragState.sourceIndex);
                  setDragOverIndex(dragState.sourceIndex);
                  dragOverIndexRef.current = dragState.sourceIndex;
                }
                const targetIndex = resolveTargetIndex(e.clientX, e.clientY);
                dragOverIndexRef.current = targetIndex;
                setDragOverIndex(targetIndex);
              }}
              onPointerUp={(e) => {
                const dragState = pointerDragRef.current;
                if (!dragState || dragState.pointerId !== e.pointerId) return;
                e.stopPropagation();
                (e.currentTarget as HTMLDivElement).releasePointerCapture?.(e.pointerId);
                if (dragState.started) {
                  suppressClickRef.current = true;
                  // 松手时直接以当前命中的目标位作为最终顺序，不再做额外交换动画。
                  const finalTargetIndex = dragOverIndexRef.current;
                  if (finalTargetIndex != null && finalTargetIndex !== dragState.sourceIndex) {
                    handleReorder(dragState.sourceIndex, finalTargetIndex);
                  }
                }
                resetPointerDrag();
              }}
              onPointerCancel={(e) => {
                const dragState = pointerDragRef.current;
                if (!dragState || dragState.pointerId !== e.pointerId) return;
                (e.currentTarget as HTMLDivElement).releasePointerCapture?.(e.pointerId);
                resetPointerDrag();
              }}
              style={{ transform: getPreviewTransform(idx) }}
              className={`relative select-none will-change-transform ${
                draggingIndex === idx ? "z-20 opacity-80" : "z-0"
              }`}
            >
              {editable && (
                <button
                  type="button"
                  data-preview-drag-handle="true"
                  aria-label={`拖拽排序 ${o.title || `选项 ${idx + 1}`}`}
                  className="absolute right-1 top-1 z-20 h-6 w-6 cursor-grab active:cursor-grabbing rounded-md border-0 bg-transparent p-0 opacity-0"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                />
              )}
              <button
                type="button"
                className={`w-full rounded-lg border p-2 text-left transition-colors ${
                  selectedNow ? "bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/70"
                } ${
                  dragOverIndex === idx && draggingIndex !== null && draggingIndex !== idx ? "border-primary ring-1 ring-primary/40" : ""
                } ${
                  draggingIndex === idx ? "shadow-lg shadow-primary/15 ring-1 ring-primary/20" : "shadow-sm"
                }`}
                onClick={(e) => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  e.stopPropagation();
                  setSelectedKey(key);
                  onPreviewOptionClick?.(idx);
                  dispatchImageSelectPreviewFocusOption({ componentId: comp.id, optionIndex: idx });
                }}
              >
                <div className="w-full aspect-square rounded-md overflow-hidden bg-muted flex items-center justify-center">
                  {o.src?.trim() ? (
                    <img
                      alt={o.title}
                      src={o.src}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-muted/70 to-muted flex items-center justify-center">
                      <Image className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className={`mt-1 text-[10px] text-center truncate ${selectedNow ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {o.title || "未命名"}
                </div>
              </button>
            </div>
          );
        })}
        {placeholderStyle && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-10"
            style={placeholderStyle}
          >
            <div className="relative h-full w-full rounded-lg border-2 border-dashed border-primary/70 bg-primary/8 shadow-[0_0_0_1px_hsl(var(--primary)/0.12),0_8px_24px_-12px_hsl(var(--primary)/0.45)]">
              <div className={`absolute rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.55)] ${getPlaceholderAccentClass()}`} />
              <div className="absolute inset-3 rounded-md border border-primary/20 bg-background/55" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ImageSelectPreviewCanvasCard(props: UiComponentCanvasCardProps) {
  const comp = props.comp as Extract<UiComponent, { type: "ImageSelectPreview" }>;
  const onChange = props.onChangeComponent as ((next: Extract<UiComponent, { type: "ImageSelectPreview" }>) => void) | undefined;
  const focusDispatchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (focusDispatchTimerRef.current != null) {
        window.clearTimeout(focusDispatchTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      onClick={props.onSelect}
      className={`rounded-lg border p-3 mb-1 cursor-pointer transition-all duration-200 group ${
        props.selected ? "border-1.5 border-purple-500 border-dashed bg-background" : "border-transparent hover:border-border border-solid bg-background"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <button
            type="button"
            draggable
            aria-label="拖拽排序"
            onDragStart={props.onDragStart}
            onDragEnd={props.onDragEnd}
            onClick={(e) => e.stopPropagation()}
            className={`cursor-grab active:cursor-grabbing ${props.selected ? "block" : "hidden group-hover:block"}`}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-foreground">
            <Image className="w-4 h-4" />
          </span>
          <span>{comp.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {comp.ext?.enableTranslate && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] bg-accent text-primary pointer-events-none">
              翻译
            </Button>
          )}
          {comp.ext?.enableLLM && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] bg-accent text-primary pointer-events-none">
              AI润色
            </Button>
          )}
          <button
            aria-label="删除组件"
            onClick={(e) => {
              e.stopPropagation();
              props.onRemove();
            }}
            className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <ImageSelectPreviewGrid
          comp={comp}
          editable={props.selected && !!onChange}
          onChange={onChange}
          onPreviewOptionClick={(optionIndex) => {
            if (!props.selected) {
              props.onSelect();
              if (focusDispatchTimerRef.current != null) {
                window.clearTimeout(focusDispatchTimerRef.current);
              }
              focusDispatchTimerRef.current = window.setTimeout(() => {
                dispatchImageSelectPreviewFocusOption({ componentId: comp.id, optionIndex });
              }, 30);
            }
          }}
        />
      </div>
    </div>
  );
}

function ImageSelectPreviewExtEditor({
  component,
  onChange,
}: {
  component: Extract<UiComponent, { type: "ImageSelectPreview" }>;
  onChange: (next: UiComponent) => void;
}) {
  const options: ImageSelectPreviewOption[] = component.ext.options;
  const optionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const highlightTimerRef = useRef<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const focusOption = useCallback((detail: ImageSelectPreviewFocusOptionDetail) => {
    if (!detail || detail.componentId !== component.id) return;
    const target = optionRefs.current[detail.optionIndex];
    if (!target) return;
    pendingImageSelectPreviewFocusDetail = null;
    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setHighlightedIndex(detail.optionIndex);
    if (highlightTimerRef.current != null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedIndex((current) => (current === detail.optionIndex ? null : current));
    }, 1200);
  }, [component.id]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current != null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleFocusOption = (event: Event) => {
      const detail = (event as CustomEvent<ImageSelectPreviewFocusOptionDetail>).detail;
      focusOption(detail);
    };

    window.addEventListener(IMAGE_SELECT_PREVIEW_FOCUS_OPTION_EVENT, handleFocusOption as EventListener);
    if (pendingImageSelectPreviewFocusDetail?.componentId === component.id) {
      window.setTimeout(() => {
        if (pendingImageSelectPreviewFocusDetail?.componentId === component.id) {
          focusOption(pendingImageSelectPreviewFocusDetail);
        }
      }, 0);
    }
    return () => {
      window.removeEventListener(IMAGE_SELECT_PREVIEW_FOCUS_OPTION_EVENT, handleFocusOption as EventListener);
    };
  }, [component.id, focusOption]);

  return (
    <div className="space-y-3 mx-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground">执行前物化</span>
        <Switch
          checked={component.ext.enableUploadBeforeRun !== false}
          onCheckedChange={(v) => onChange({ ...component, ext: { ...component.ext, enableUploadBeforeRun: v } })}
        />
      </div>
      <div className="sticky top-0 z-10 -mx-3 h-16 bg-background px-3 border-b border-border/60 shadow-[0_1px_0_0_hsl(var(--background))]">
        <div className="flex h-full items-center justify-between">
          <span className="text-sm font-medium text-foreground">预设选项</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const next = { title: "新选项", src: "", value: "", valueExtra: "", weight: 1 };
              onChange({ ...component, ext: { ...component.ext, options: [...options, next] } });
            }}
          >
            <Plus className="w-4 h-4" />
            添加
          </Button>
        </div>
      </div>
      {options.map((o, idx) => (
        <div
          key={idx}
          ref={(node) => {
            optionRefs.current[idx] = node;
          }}
          className={`scroll-mt-20 rounded-lg border border-border p-3 space-y-2 transition-shadow ${
            highlightedIndex === idx ? "ring-1 ring-primary/50 shadow-sm" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">选项 {idx + 1}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                const next = options.filter((_, i) => i !== idx);
                onChange({ ...component, ext: { ...component.ext, options: next } });
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">标题</label>
            <Input
              value={o.title}
              onChange={(e) => {
                const next = options.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x));
                onChange({ ...component, ext: { ...component.ext, options: next } });
              }}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">缩略图 URL</label>
            <ImageUploader
              src={o.src ?? ""}
              onChange={(newSrc) => {
                const next = options.map((x, i) => (i === idx ? { ...x, src: newSrc } : x));
                onChange({ ...component, ext: { ...component.ext, options: next } });
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {component.basic?.params?.map((p, pIdx) => {
              const val = (o.values ? o.values[pIdx] : pIdx === 0 ? o.value : pIdx === 1 ? o.valueExtra : "") ?? "";
              return (
                <div key={p.name || String(pIdx)} className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">值 ({p.name || `参数 ${pIdx + 1}`})</label>
                  <Input
                    value={val}
                    onChange={(e) => {
                      const next = options.map((x, i) => {
                        if (i !== idx) return x;
                        const newValues = [...(x.values ?? [x.value ?? "", x.valueExtra ?? ""])];
                        newValues[pIdx] = e.target.value;
                        return { ...x, values: newValues, value: newValues[0], valueExtra: newValues[1] };
                      });
                      onChange({ ...component, ext: { ...component.ext, options: next } });
                    }}
                    className="h-9"
                  />
                </div>
              );
            })}
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">权重</label>
              <Input
                value={o.weight == null ? "" : String(o.weight)}
                onChange={(e) => {
                  const v = e.target.value.trim() ? Number(e.target.value) : undefined;
                  const next = options.map((x, i) => (i === idx ? { ...x, weight: Number.isFinite(v as number) ? v : undefined } : x));
                  onChange({ ...component, ext: { ...component.ext, options: next } });
                }}
                className="h-9"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export const imageSelectPreviewDefinition: UiComponentDefinition = {
  type: "ImageSelectPreview",
  iconName: "image-preview",
  palette: { id: "img-preprocess", label: "图像预览选择", category: "图像", badge: "Biz", order: 20 },
  renderCanvasCard: (props) => {
    return <ImageSelectPreviewCanvasCard {...props} />;
  },
  createInitialRuntimeValue: (component) => {
    return "0";
  },
  collectDispatchParams: (component, values) => {
    const c = component as Extract<UiComponent, { type: "ImageSelectPreview" }>;
    const params = component.basic?.params ?? [];
    const key0 = getParamAlias(params[0]);
    if (!key0) return {};

    const options = c.ext?.options ?? [];
    const runtimeState = readRuntimeComponentValue(component, values);
    const selectedIdx = typeof runtimeState.value === "string" ? parseInt(runtimeState.value as string, 10) : 0;
    const matched = options[Number.isNaN(selectedIdx) ? 0 : selectedIdx] ?? null;
    
    const out: Record<string, unknown> = {};
    if (!matched) {
      return out;
    }

    const optionValues = matched.values ?? [matched.value ?? "", matched.valueExtra ?? ""];
    params.forEach((p, idx) => {
      const k = getParamAlias(p);
      if (!k) return;
      out[k] = valueToInputPayload(optionValues[idx] ?? "");
    });
    return out;
  },
  renderCanvasPreview: (component): ReactNode => {
    return <ImageSelectPreviewCanvasPreview comp={component as Extract<UiComponent, { type: "ImageSelectPreview" }>} />;
  },
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    const c = comp as Extract<UiComponent, { type: "ImageSelectPreview" }>;
    const options: ImageSelectPreviewOption[] = c.ext?.options ?? [];
    const v = typeof value === "string" ? value : "0";
    return (
      <div className="space-y-2">
        <LabelComp />
        <div className="grid grid-cols-4 gap-2">
          {options.map((o, idx) => {
            const val = String(idx);
            const active = v === val;
            return (
              <button
                key={val}
                type="button"
                onClick={() => onChange(val)}
                className={`rounded-lg border p-2 text-left transition-colors ${
                  active ? "bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/70"
                }`}
              >
                <div className="w-full aspect-square rounded-md overflow-hidden bg-muted flex items-center justify-center">
                  {o.src?.trim() ? (
                    <img
                      alt={o.title}
                      src={o.src}
                      className="w-full h-full object-cover"
                      draggable={false}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-muted/70 to-muted flex items-center justify-center">
                      <Image className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className={`mt-1 text-[10px] text-center truncate ${active ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {o.title || "未命名"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  },
  renderExtEditor: (component, onChange) => {
    return <ImageSelectPreviewExtEditor component={component as Extract<UiComponent, { type: "ImageSelectPreview" }>} onChange={onChange} />;
  },
};
