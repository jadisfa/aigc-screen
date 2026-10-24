// components/common/CommonUploadImage.tsx
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { cn } from "@/shared/lib/utils";
import { uploadFileMaterialForm } from "@/shared/api/materials/materials-file-material";
import { uploadModelMaterial } from "@/shared/api/materials/materials-model";
import { useToast } from "@/shared/hooks/use-toast";
import type {
  MaterialAuditStatus,
  MaterialCategoryType,
  MaterialPublishStatus,
} from "@/modules/materials/lib/material-governance";
import {
  buildScopedHashKey,
  getSessionScopeReadyError,
  useSessionScope,
  withSessionScope,
} from "@/shared/hooks/use-session-scope";
import {
  Plus,
  X,
  AlertCircle,
  Image as ImageIcon,
  Loader2,
  Eye,
} from "lucide-react";

// 上传接口 - 需要从你的 API 中导入

interface CommonUploadImageProps {
  /** 文件列表 (v-model)，直接绑定 files */
  files?: (string | File)[];
  /** 文件变化回调，v-model:files 的更新函数 */
  onFilesChange?: (files: (string | File)[]) => void;
  /** 初始值 */
  initValue?: string;
  /** 是否支持多选 */
  multiple?: boolean;
  /** 最大文件大小 (MB) */
  maxSize?: number;
  /** 最大文件数量 */
  limit?: number;
  /** 是否启用剪贴板 */
  enableClipboard?: boolean;
  /** 是否替换模式 */
  isReplace?: boolean;
  /** 列表类型 */
  listType?: "picture" | "picture-card" | "text";
  /** 宽度 */
  width?: number | string;
  /** 高度 */
  height?: number | string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 类名 */
  className?: string;
  /** 自定义上传文本 */
  uploadText?: string;
  /** 子元素（自定义上传按钮内容） */
  children?: React.ReactNode;
  /** 样式 */
  style?: React.CSSProperties;
  /** 上传前回调 */
  onBeforeUpload?: (file: File) => boolean | Promise<boolean>;
  /** 上传成功回调 */
  onUploadSuccess?: (urls: string[]) => void;
  /** 上传失败回调 */
  onUploadError?: (error: Error) => void;
  /** 预览回调 */
  onPreview?: (file: string | File, index: number) => void;
  uploadParam?: {
    categoryType: MaterialCategoryType;
    metarialCategoryId: string;
  };
}

export const CommonUploadImage = forwardRef<any, CommonUploadImageProps>(
  (
    {
      files = [],
      onFilesChange,
      initValue,
      multiple = false,
      maxSize = 10,
      limit = 1,
      enableClipboard = false,
      isReplace = false,
      listType = "picture-card",
      width = 100,
      height = 120,
      disabled = false,
      className,
      uploadText,
      children,
      style,
      onBeforeUpload,
      onUploadSuccess,
      onUploadError,
      onPreview,
      uploadParam,
    },
    ref,
  ) => {
    const sessionScope = useSessionScope();
    const { toast } = useToast();
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
    const [internalFiles, setInternalFiles] = useState<(string | File)[]>(
      initValue ? [initValue] : [],
    );
    const [isMouseOver, setIsMouseOver] = useState(false);
    const [isManualUpload, setIsManualUpload] = useState(false);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [tempPreviewUrls, setTempPreviewUrls] = useState<Map<number, string>>(
      new Map(),
    );
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 获取实际文件列表（优先使用外部传入的 files）
    const currentFiles = files.length > 0 ? files : internalFiles;

    // 检查是否是图片
    const isImageFile = useCallback((file: string | File): boolean => {
      if (typeof file === "string") {
        return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(file);
      }
      return file.type?.startsWith("image/") || false;
    }, []);

    // 获取预览 URL
    const getPreviewUrl = useCallback(
      (file: string | File, index?: number): string => {
        if (typeof file === "string") return file;
        if (index !== undefined && tempPreviewUrls.has(index)) {
          return tempPreviewUrls.get(index)!;
        }
        return URL.createObjectURL(file);
      },
      [tempPreviewUrls],
    );

    // 获取文件名
    const getFileName = useCallback((file: string | File): string => {
      if (typeof file === "string") {
        return file.split("/").pop() || "图片";
      }
      return file.name || "图片";
    }, []);

    // 计算文件 hash
    const computeFileHash = useCallback(async (file: File): Promise<string> => {
      return `${file.name}-${file.size}-${file.lastModified}-${Date.now()}`;
    }, []);

    // 验证文件
    const validateFile = useCallback(
      async (file: File): Promise<{ valid: boolean; error?: string }> => {
        if (!file.type.startsWith("image/")) {
          return { valid: false, error: "请上传图片文件" };
        }

        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > maxSize) {
          return {
            valid: false,
            error: `文件大小不能超过 ${maxSize}MB，当前 ${fileSizeMB.toFixed(2)}MB`,
          };
        }

        if (file.size === 0) {
          return { valid: false, error: "文件为空，请重新选择" };
        }

        return { valid: true };
      },
      [maxSize],
    );

    // 单个文件上传
    const uploadSingleFile = useCallback(
      async (file: File): Promise<string> => {
        const fileHash = await computeFileHash(file);
        const fileResult = await uploadFileMaterialForm(
          withSessionScope(sessionScope.scope, {
            file: file,
            fileType: "image",
            fileHash: fileHash,
          }),
        );
        let uploadSts = 0;
        if (uploadParam) {
          // 有该参数为上传模型素材
          const modalMetrailReuslt = await uploadModelMaterial({
            assetUrl: fileResult.file.accessUrl,
            fileHash: fileHash,
            ...uploadParam,
          });
          if (
            modalMetrailReuslt.model.assetUrl == null ||
            modalMetrailReuslt.model.assetUrl === ""
          ) {
            uploadSts = 1;
            toast({
              title: "上传失败",
              description: modalMetrailReuslt?.message || "",
            });
          }
        }
        return uploadSts == 0 ? fileResult.file.accessUrl : null;
      },
      [sessionScope, computeFileHash],
    );

    // 更新文件列表
    const updateFiles = useCallback(
      (newFiles: (string | File)[]) => {
        setInternalFiles(newFiles);
        onFilesChange?.(newFiles);
      },
      [onFilesChange],
    );

    // 处理文件选择
    const handleFileSelect = useCallback(
      async (selectedFiles: FileList | null) => {
        if (!selectedFiles || disabled || uploading) return;

        const fileArray = Array.from(selectedFiles);

        const totalFiles = currentFiles.length + fileArray.length;
        if (totalFiles > limit) {
          setError(`最多只能上传 ${limit} 个文件`);
          setTimeout(() => setError(null), 3000);
          return;
        }

        const validFiles: File[] = [];
        const errors: string[] = [];
        for (const file of fileArray) {
          if (onBeforeUpload) {
            const result = await onBeforeUpload(file);
            if (!result) {
              errors.push(`${file.name} 未通过前置校验`);
              continue;
            }
          }

          const result = await validateFile(file);
          if (result.valid) {
            validFiles.push(file);
          } else {
            errors.push(result.error || `${file.name} 验证失败`);
          }
        }

        if (errors.length > 0) {
          setError(errors.join("；"));
          setTimeout(() => setError(null), 3000);
          return;
        }

        if (validFiles.length === 0) return;

        let newFiles: (string | File)[];
        if (isReplace) {
          newFiles = validFiles;
        } else {
          newFiles = [...validFiles, ...currentFiles];
        }

        if (newFiles.length > limit) {
          newFiles = newFiles.slice(0, limit);
        }
        console.log(newFiles, 293)

        updateFiles(newFiles);
        setUploading(true);

        try {
          const uploadedUrls: string[] = [];
          const failedFiles: File[] = [];
          const filesToUpload = newFiles.filter((f) => typeof f !== "string");

          for (let i = 0; i < filesToUpload.length; i++) {
            const file = filesToUpload[i] as File;
            const index = newFiles.indexOf(file);
            setUploadingIndex(index);

            try {
              const tempUrl = URL.createObjectURL(file);
              setTempPreviewUrls((prev) => new Map(prev).set(index, tempUrl));

              const url = await uploadSingleFile(file);
              uploadedUrls.push(url);

              setTempPreviewUrls((prev) => {
                const newMap = new Map(prev);
                newMap.delete(index);
                return newMap;
              });
              URL.revokeObjectURL(tempUrl);
            } catch (err) {
              failedFiles.push(file);
              setTempPreviewUrls((prev) => {
                const newMap = new Map(prev);
                newMap.delete(index);
                return newMap;
              });
              console.error("上传失败:", err);
            }
          }

          setUploadingIndex(null);

          let finalFiles: (string | File)[] = [];
          let urlIndex = 0;
          const existingUrls = currentFiles.filter(
            (f) => typeof f === "string",
          );

          for (const item of newFiles) {
            if (typeof item === "string") {
              finalFiles.push(item);
            } else if (urlIndex < uploadedUrls.length) {
              finalFiles.push(uploadedUrls[urlIndex]);
              urlIndex++;
            }
          }

          const allFiles = isReplace
            ? finalFiles
            : [
                ...finalFiles,
                ...existingUrls.filter((url) => !finalFiles.includes(url)),
              ];

          const finalResult = allFiles.slice(0, limit);
          updateFiles(finalResult);

          if (uploadedUrls.length > 0) {
            onUploadSuccess?.(uploadedUrls);
          }

          if (failedFiles.length > 0) {
            setError(`${failedFiles.length} 个文件上传失败`);
            setTimeout(() => setError(null), 3000);
          }
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : "上传失败，请重试";
          setError(errorMsg);
          onUploadError?.(err instanceof Error ? err : new Error(errorMsg));
          setTimeout(() => setError(null), 3000);
        } finally {
          setUploading(false);
          setUploadingIndex(null);
          setIsManualUpload(false);
          setTempPreviewUrls(new Map());
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      },
      [
        currentFiles,
        limit,
        disabled,
        uploading,
        validateFile,
        onBeforeUpload,
        isReplace,
        updateFiles,
        uploadSingleFile,
        onUploadSuccess,
        onUploadError,
      ],
    );

    // 删除文件
    const handleRemoveFile = useCallback(
      (index: number) => {
        if (uploading) return;
        const newFiles = currentFiles.filter((_, i) => i !== index);
        updateFiles(newFiles);
        setHoverIndex(null);
      },
      [currentFiles, updateFiles, uploading],
    );

    // 预览文件
    const handlePreviewFile = useCallback(
      (index: number) => {
        const file = currentFiles[index];
        if (!file) return;

        if (onPreview) {
          onPreview(file, index);
          return;
        }

        const url = getPreviewUrl(file, index);
        const fileName = getFileName(file);
        const isBlobUrl = url.startsWith("blob:");

        // 创建新窗口
        const newWindow = window.open("", "_blank");
        if (!newWindow) {
          // 如果被拦截，提示用户
          console.warn("新窗口被拦截，请允许弹出窗口");
          return;
        }

        // 如果是 blob URL，先获取 blob 数据再显示
        if (isBlobUrl) {
          fetch(url)
            .then((res) => {
              if (!res.ok) throw new Error("获取图片失败");
              return res.blob();
            })
            .then((blob) => {
              // 创建新的 blob URL
              const newUrl = URL.createObjectURL(blob);

              // 写入 HTML
              newWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${fileName || "图片预览"}</title>
                <style>
                  * { margin: 0; padding: 0; }
                  body {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    background: #1a1a2e;
                    font-family: system-ui, -apple-system, sans-serif;
                  }
                  .container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                    padding: 20px;
                  }
                  .image-wrapper {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background: #16213e;
                    border-radius: 12px;
                    padding: 8px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                  }
                  img {
                    max-width: 90vw;
                    max-height: 80vh;
                    object-fit: contain;
                    border-radius: 8px;
                  }
                  .info {
                    color: #8899aa;
                    font-size: 13px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                  }
                  .close-btn {
                    background: #e94560;
                    color: white;
                    border: none;
                    padding: 6px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: background 0.2s;
                  }
                  .close-btn:hover {
                    background: #c73652;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="image-wrapper">
                    <img 
                      src="${newUrl}" 
                      alt="${fileName || "图片"}"
                      onload="console.log('图片加载成功')"
                      onerror="this.parentElement.innerHTML='<div style=\\'color:#8899aa;padding:40px;\\'>图片加载失败</div>'"
                    />
                  </div>
                  <div class="info">
                    <span>${fileName || "图片"}</span>
                    <button class="close-btn" onclick="window.close()">关闭</button>
                  </div>
                </div>
                <script>
                  // 窗口关闭时释放 blob URL
                  window.addEventListener('beforeunload', function() {
                    try { URL.revokeObjectURL('${newUrl}'); } catch(e) {}
                  });
                <\/script>
              </body>
            </html>
          `);
              newWindow.document.close();
            })
            .catch((err) => {
              console.error("预览失败:", err);
              newWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head><title>预览失败</title></head>
              <body style="display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a2e;color:#8899aa;font-family:system-ui;">
                <div>图片加载失败，请重试</div>
              </body>
            </html>
          `);
              newWindow.document.close();
            });
        } else {
          // 普通 URL 直接渲染
          newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${fileName || "图片预览"}</title>
            <style>
              * { margin: 0; padding: 0; }
              body {
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background: rgb(14,14,14);
                font-family: system-ui, -apple-system, sans-serif;
              }
              .container {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
                padding: 20px;
              }
              .image-wrapper {
                display: flex;
                justify-content: center;
                align-items: center;
                background: #fff;
                border-radius: 12px;
                padding: 8px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
              }
              img {
                max-width: 90vw;
                max-height: 80vh;
                object-fit: contain;
                border-radius: 8px;
              }
              .info {
                color: #8899aa;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 16px;
              }
              .close-btn {
                background: #e94560;
                color: white;
                border: none;
                padding: 6px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                transition: background 0.2s;
              }
              .close-btn:hover {
                background: #c73652;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="image-wrapper">
                <img 
                  src="${url}" 
                  alt="${fileName || "图片"}"
                  onerror="this.parentElement.innerHTML='<div style=\\'color:#8899aa;padding:40px;\\'>图片加载失败</div>'"
                />
              </div>
            </div>
          </body>
        </html>
      `);
          newWindow.document.close();
        }
      },
      [currentFiles, getPreviewUrl, onPreview, getFileName],
    );

    // 点击上传
    const handleClick = useCallback(() => {
      if (disabled || uploading) return;
      fileInputRef.current?.click();
    }, [disabled, uploading]);

    // 拖拽事件
    const handleDragOver = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        if (!disabled && !uploading) {
          setDragOver(true);
        }
      },
      [disabled, uploading],
    );

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
    }, []);

    const handleDrop = useCallback(
      async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (disabled || uploading) return;

        const dataTransfer = e.dataTransfer;
        if (!dataTransfer) return;

        if (dataTransfer.files && dataTransfer.files.length > 0) {
          await handleFileSelect(dataTransfer.files);
          return;
        }

        const text = dataTransfer.getData("text/plain");
        const urlMatch = text?.match(
          /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|svg|bmp|ico))/i,
        );
        if (urlMatch) {
          const url = urlMatch[0];
          if (currentFiles.some((f) => typeof f === "string" && f === url)) {
            return;
          }
          const newFiles = isReplace ? [url] : [url, ...currentFiles];
          const finalFiles = newFiles.slice(0, limit);
          updateFiles(finalFiles);
        }
      },
      [
        disabled,
        uploading,
        handleFileSelect,
        currentFiles,
        isReplace,
        limit,
        updateFiles,
      ],
    );

    // 剪切内容上传
   const getClipboardItems = useCallback(async () => {
    if (!enableClipboard ) return;
    if (disabled || uploading) return;

    try {
      // 检查浏览器是否支持
      if (!navigator.clipboard || !navigator.clipboard.read) {
        console.warn("浏览器不支持 clipboard.read()");
        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (!type.startsWith("image/")) continue;

          const blob = await item.getType(type);
          const file = new File([blob], "clipboard-image.png", {
            type: blob.type,
            lastModified: Date.now(),
          });

          // 验证文件
          const validation = await validateFile(file);
          if (!validation.valid) {
            setError(validation.error || "剪贴板图片验证失败");
            setTimeout(() => setError(null), 3000);
            return;
          }

          // 检查数量限制
          if (currentFiles.length >= limit) {
            setError(`最多只能上传 ${limit} 个文件`);
            setTimeout(() => setError(null), 3000);
            return;
          }

          // 构建新文件列表
          let newFiles: (string | File)[];
          if (isReplace) {
            newFiles = [file];
          } else {
            newFiles = [file, ...currentFiles];
          }

          if (newFiles.length > limit) {
            newFiles = newFiles.slice(0, limit);
          }

          updateFiles(newFiles);
          setUploading(true);
          setIsManualUpload(true);

          try {
            // 获取文件在列表中的索引
            const index = newFiles.indexOf(file);
            setUploadingIndex(index);

            // 显示临时预览
            const tempUrl = URL.createObjectURL(file);
            setTempPreviewUrls((prev) => new Map(prev).set(index, tempUrl));

            // 执行上传
            const url = await uploadSingleFile(file);

            if (url) {
              // 上传成功：替换文件对象为 URL
              const finalFiles = newFiles.map((f) =>
                f === file ? url : f
              );
              updateFiles(finalFiles);
              onUploadSuccess?.([url]);
            } else {
              // 上传失败：移除该文件
              const failedFiles = newFiles.filter((f) => f !== file);
              updateFiles(failedFiles);
              setError("剪贴板图片上传失败");
              setTimeout(() => setError(null), 3000);
            }

            // 清理临时预览
            setTempPreviewUrls((prev) => {
              const newMap = new Map(prev);
              newMap.delete(index);
              return newMap;
            });
            URL.revokeObjectURL(tempUrl);
          } catch (err) {
            // 上传异常：移除该文件
            const failedFiles = newFiles.filter((f) => f !== file);
            updateFiles(failedFiles);
            const errorMsg = err instanceof Error ? err.message : "剪贴板上传失败";
            setError(errorMsg);
            onUploadError?.(err instanceof Error ? err : new Error(errorMsg));
            setTimeout(() => setError(null), 3000);
            console.error("剪贴板上传失败:", err);
          } finally {
            setUploading(false);
            setUploadingIndex(null);
            setIsManualUpload(false);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }

          // 清空剪贴板内容（可选）
          try {
            await navigator.clipboard.writeText("");
          } catch {
            // 忽略清空失败
          }

          return; // 只处理第一张图片
        }
      }
    } catch (err) {
      // 用户拒绝权限或没有图片
      if (err instanceof Error && err.name === "NotAllowedError") {
        console.warn("剪贴板读取权限被拒绝，请使用 Ctrl+V 粘贴");
        // 可以提示用户使用快捷键
        setError("请使用 Ctrl+V 粘贴图片");
        setTimeout(() => setError(null), 3000);
      } else {
        console.error("读取剪贴板失败:", err);
      }
    }
  }, [
    enableClipboard,
    isManualUpload,
    disabled,
    uploading,
    validateFile,
    currentFiles,
    limit,
    isReplace,
    updateFiles,
    uploadSingleFile,
    onUploadSuccess,
    onUploadError,
  ]);

    const handleFocus = () => {
      if (!enableClipboard || isManualUpload) return
      setTimeout(() => {
        getClipboardItems()
      }, 100)
    }

    // 剪贴板粘贴
    useEffect(() => {
      if (!enableClipboard || disabled || uploading) return;

      const handlePaste = async (e: ClipboardEvent) => {
        if (!isMouseOver) return;
        if (isManualUpload || uploading) return;

        const items = e.clipboardData?.items;
        console.log(items, 682)
        if (!items) return;

        for (const item of items) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file && file.size > 0) {
              const fakeFileList = {
                length: 1,
                item: (index: number) => (index === 0 ? file : null),
                [0]: file,
              } as FileList;
              await handleFileSelect(fakeFileList);
            }
            break;
          }
        }
      };

      document.addEventListener("paste", handlePaste, true);
      window.addEventListener('focus', handleFocus)
      return () => {
        document.removeEventListener("paste", handlePaste, true)
        window.removeEventListener('focus', handleFocus)
      };
    }, [
      enableClipboard,
      disabled,
      uploading,
      isMouseOver,
      isManualUpload,
      handleFileSelect,
    ]);

    // 暴露 ref 方法
    useImperativeHandle(ref, () => ({
      upload: handleClick,
      clear: () => {
        updateFiles([]);
        setTempPreviewUrls(new Map());
      },
      getFiles: () => currentFiles,
      getFileList: () => currentFiles,
    }));

    const hasFile = currentFiles.length > 0;
    const hasError = !!error;

    const getFirstFile = () => {
      if (currentFiles.length === 0) return null;
      return currentFiles[0];
    };

    // 渲染预览内容 - 悬浮时显示遮罩
    const renderPreviewContent = (file: string | File, index: number) => {
      const url = getPreviewUrl(file, index);
      const isImage = isImageFile(file);
      const name = getFileName(file);
      const isUploading = uploadingIndex === index;
      const isHover = hoverIndex === index;

      return (
        <div
          className="relative h-full w-full overflow-hidden"
          onMouseEnter={() => setHoverIndex(index)}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {isImage ? (
            <img
              src={url}
              alt={name}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gray-100">
              <ImageIcon className="h-10 w-10 text-gray-400" />
              <span className="mt-1 max-w-full truncate px-2 text-xs text-gray-500">
                {name}
              </span>
            </div>
          )}

          {/* 上传中遮罩 */}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}

          {/* 悬浮遮罩层 - 显示预览和删除按钮 */}
          {!isUploading && !disabled && isHover && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 transition-all duration-200">
              {/* 预览按钮 */}
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center text-white transition-all  "
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreviewFile(index);
                }}
                title="预览"
              >
                <Eye size={16} />
              </button>
              {/* 删除按钮 */}
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center  text-white transition-all "
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile(index);
                }}
                title="删除"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* 文件数量角标 */}
          {currentFiles.length > 1 && (
            <div className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-xs font-medium text-white shadow-md">
              {currentFiles.length}
            </div>
          )}
        </div>
      );
    };

    // 渲染上传按钮
    const renderUploadButtonContent = () => {
      if (children) {
        return (
          <div
            onClick={handleClick}
            className={cn(
              "flex h-full w-full cursor-pointer items-center justify-center",
              (disabled || uploading) && "cursor-not-allowed opacity-60",
            )}
          >
            {children}
          </div>
        );
      }

      return (
        <div
          className={cn(
            "flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 p-2 text-center",
            (disabled || uploading) && "cursor-not-allowed opacity-60",
          )}
          onClick={handleClick}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          ) : (
            <Plus className="h-8 w-8 text-gray-400" />
          )}
          <div className="text-sm text-gray-500">
            {uploading ? "上传中..." : uploadText || "上传"}
          </div>
        </div>
      );
    };

    // 根据 listType 渲染不同的样式
    const getContainerStyles = () => {
      const base =
        "relative flex flex-col items-center justify-center overflow-hidden rounded-lg border-2 transition-all custom-upload";
      const hasFile = currentFiles.length > 0;

      if (listType === "text") {
        return cn(
          base,
          "border-gray-200 px-4 py-3 flex-row gap-3 min-h-[48px]",
          dragOver && "border-violet-500 bg-violet-50",
          hasFile && "border-gray-300",
          !hasFile && isMouseOver && "border-[#4338ca]",
          (disabled || uploading) && "cursor-not-allowed opacity-60",
        );
      }

      if (listType === "picture") {
        return cn(
          base,
          "w-full min-h-[120px]",
          dragOver ? "border-violet-500 bg-violet-50" : "border-gray-300",
          hasFile && "border-gray-200",
          !hasFile && isMouseOver && "border-[#4338ca]",
          (disabled || uploading) && "cursor-not-allowed opacity-60",
        );
      }

      return cn(
        base,
        "border-dashed",
        dragOver ? "border-violet-500 bg-violet-50" : "border-gray-300",
        hasFile && "border-solid border-gray-200",
        !hasFile && isMouseOver && "border-[#4338ca]",
        (disabled || uploading) && "cursor-not-allowed opacity-60",
        className,
      );
    };

    const containerStyle = {
      width: listType === "picture-card" ? width : "100%",
      minWidth:
        listType === "picture-card"
          ? typeof width === "number"
            ? width
            : undefined
          : undefined,
      height: listType === "picture-card" ? height : "auto",
      background: "#f8f8f8",
      ...style,
    };

    return (
      <div
        ref={containerRef}
        className={cn("upload-drag-container relative", {
          "is-dragging": dragOver,
        })}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => setIsMouseOver(true)}
        onMouseLeave={() => setIsMouseOver(false)}
        style={{ width: "auto" }}
      >
        <div className={getContainerStyles()} style={containerStyle}>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple={multiple}
            accept="image/*"
            onChange={(e) => handleFileSelect(e.target.files)}
            disabled={disabled || uploading}
          />

          {hasFile ? (
            <div className="h-full w-full">
              {renderPreviewContent(getFirstFile()!, 0)}
            </div>
          ) : (
            renderUploadButtonContent()
          )}
        </div>

        {/* 拖拽遮罩 */}
        {dragOver && !uploading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-violet-50/90 backdrop-blur-sm border-2 border-dashed border-violet-500">
            <div className="flex flex-col items-center gap-4">
              <Plus className="h-8 w-8 text-violet-500" />
              <p className="text-sm font-sm text-violet-600">释放以上传</p>
            </div>
          </div>
        )}

        {/* 文件数量提示 */}
        {/* {hasFile && currentFiles.length > 1 && (
          <div className="mt-1 text-xs text-gray-400">
            共 {currentFiles.length} 张图片
          </div>
        )} */}

        {/* 错误提示 */}
        {hasError && (
          <div className="mt-1 flex items-center gap-1 text-xs text-red-500">
            <AlertCircle size={12} />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  },
);

CommonUploadImage.displayName = "CommonUploadImage";
