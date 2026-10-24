import { useRef, useState } from "react";
import { Eye, FileText, Loader2, Paperclip, Trash2, Upload, X } from "lucide-react";
import { getOpsTicketFileByHash, uploadOpsTicketFileForm } from "@/shared/api/ops/ops-ticket-file";
import type { TicketAttachment } from "@/shared/api/ops/ops-ticket";
import { md5HexFromFile } from "@/shared/lib/md5";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/utils";
import { notify } from "@/shared/lib/notify";

function formatFileSize(size?: number | null) {
  if (!size || Number.isNaN(size)) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function normalizeAttachments(items: TicketAttachment[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.fileId || ""}::${item.url}::${item.name}`;
    if (!item.url || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sanitizeUrl(url?: string | null) {
  return (url || "").replace(/[`'"]/g, "").trim();
}

function isImageAttachment(item: TicketAttachment) {
  const mime = (item.mimeType || "").trim().toLowerCase();
  if (mime.startsWith("image/")) return true;
  const name = (item.name || item.url || "").trim().toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif)(\?|$)/i.test(name);
}

export default function TicketAttachmentEditor(props: {
  value: TicketAttachment[];
  onChange: (items: TicketAttachment[]) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<TicketAttachment | null>(null);

  const handleUpload = async (fileList: FileList | File[] | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;

    setUploading(true);
    try {
      const nextItems: TicketAttachment[] = [];
      for (const file of files) {
        const fileHash = await md5HexFromFile(file);
        const existing = await getOpsTicketFileByHash(fileHash);
        const uploaded = existing ?? (await uploadOpsTicketFileForm({ file, fileHash })).file;
        nextItems.push({
          fileId: uploaded.id,
          name: (uploaded.fileName || file.name || "未命名附件").trim(),
          url: sanitizeUrl(uploaded.accessUrl),
          mimeType: uploaded.mimeType ?? file.type ?? null,
          size: uploaded.fileSize ?? file.size ?? null,
          fileHash: uploaded.fileHash ?? fileHash,
        });
      }

      props.onChange(normalizeAttachments([...(props.value ?? []), ...nextItems]));
    } catch (error) {
      notify.error("附件上传失败", { description: error instanceof Error ? error.message : "请求失败" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeItem = (index: number) => {
    props.onChange((props.value ?? []).filter((_, currentIndex) => currentIndex !== index));
  };

  const items = props.value ?? [];
  const imageItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isImageAttachment(item));
  const fileItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !isImageAttachment(item));

  const uploadDisabled = props.disabled || uploading;

  const renderImageCard = (item: TicketAttachment, index: number, compact?: boolean) => (
    <div
      key={`${item.url}-${index}`}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card",
        compact ? "h-20 w-20" : "aspect-[4/3]",
      )}
    >
      <button
        type="button"
        className="block h-full w-full"
        onClick={() => setPreview(item)}
        title="点击预览"
        disabled={!item.url}
      >
        <img
          src={item.url}
          alt={item.name || "附件图片"}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </button>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="absolute bottom-1.5 left-1.5 right-8 truncate text-[11px] text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100">
        {item.name || "图片"}
      </div>
      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-7 w-7 bg-background/90 hover:bg-background"
          onClick={() => setPreview(item)}
          title="预览"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-7 w-7 bg-background/90 hover:bg-background"
          onClick={() => removeItem(index)}
          disabled={uploadDisabled}
          title="移除"
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => void handleUpload(event.target.files)}
      />

      {props.compact ? (
        <div className="flex flex-wrap items-center gap-2">
          {imageItems.map(({ item, index }) => (
            <div
              key={`${item.url}-${index}`}
              className="group relative h-11 w-11 overflow-hidden rounded-lg border bg-card"
            >
              <button type="button" className="block h-full w-full" onClick={() => setPreview(item)} title={item.name || "预览"}>
                <img src={item.url} alt={item.name || "附件图片"} className="h-full w-full object-cover" loading="lazy" />
              </button>
              <button
                type="button"
                className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded bg-background/90 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                onClick={() => removeItem(index)}
                disabled={uploadDisabled}
                title="移除"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {fileItems.map(({ item, index }) => (
            <span
              key={`${item.url}-${index}`}
              className="inline-flex max-w-[180px] items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5 text-xs text-foreground"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate hover:text-primary"
                title={item.name}
              >
                {item.name || item.url}
              </a>
              <button
                type="button"
                className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                onClick={() => removeItem(index)}
                disabled={uploadDisabled}
                title="移除附件"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => inputRef.current?.click()}
            disabled={uploadDisabled}
            title={uploading ? "上传中..." : "添加附件"}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
        </div>
      ) : (
        <>
          <div
            className={cn(
              "rounded-lg border border-dashed p-5 transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/10",
              uploadDisabled ? "opacity-60" : "cursor-pointer hover:border-foreground/35",
            )}
            onClick={() => {
              if (!uploadDisabled) inputRef.current?.click();
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!uploadDisabled) setDragOver(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!uploadDisabled) setDragOver(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragOver(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragOver(false);
              if (uploadDisabled) return;
              void handleUpload(event.dataTransfer.files);
            }}
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center sm:flex-row sm:gap-4 sm:text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background border">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">
                  {uploading ? "正在上传..." : "点击或拖拽文件到此处上传"}
                </div>
                <div className="text-xs text-muted-foreground">支持图片与任意文件；图片上传后可直接预览</div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="subpage-outline-btn sm:ml-auto"
                onClick={(event) => {
                  event.stopPropagation();
                  inputRef.current?.click();
                }}
                disabled={uploadDisabled}
              >
                选择文件
              </Button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">暂无附件</div>
          ) : (
            <div className="space-y-4">
              {imageItems.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">图片预览（点击可放大）</div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {imageItems.map(({ item, index }) => renderImageCard(item, index))}
                  </div>
                </div>
              ) : null}

              {fileItems.length > 0 ? (
                <div className="space-y-2">
                  {imageItems.length > 0 ? <div className="text-xs text-muted-foreground">其他文件</div> : null}
                  {fileItems.map(({ item, index }) => (
                    <div key={`${item.url}-${index}`} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/30">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-sm font-medium text-foreground hover:text-primary"
                            title={item.name}
                          >
                            {item.name || item.url}
                          </a>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.mimeType || "未知类型"} · {formatFileSize(item.size)}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        disabled={uploadDisabled}
                        title="移除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </>
      )}

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-[920px] gap-3 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{preview?.name || "图片预览"}</DialogTitle>
          </DialogHeader>
          {preview?.url ? (
            <div className="flex max-h-[75vh] items-center justify-center overflow-auto rounded-lg bg-muted/30 p-2">
              <img src={preview.url} alt={preview.name || "预览图"} className="max-h-[70vh] max-w-full object-contain" />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {preview?.mimeType || "image"} · {formatFileSize(preview?.size)}
            </span>
            {preview?.url ? (
              <a href={preview.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                新窗口打开
              </a>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
