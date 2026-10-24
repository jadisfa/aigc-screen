import { useCallback, useRef, useState } from "react";
import { md5HexFromFile } from "@/shared/lib/md5";
import { buildScopedHashKey } from "@/shared/hooks/use-session-scope";
import type { HashedFileItem } from "@/shared/lib/batch-upload";

/**
 * 已选择待上传文件在 UI 层的状态结构。
 *
 * 说明：
 * - fileHash 用于前端侧去重（同一 hash 只保留一份），也用于提交时的秒传/查重请求；
 * - previewUrl 由 URL.createObjectURL 生成，组件卸载/移除文件时需要 revoke，避免内存泄漏。
 */
export type HashedUploadFileState = HashedFileItem & {
  key: string;
  previewUrl: string;
};

/**
 * 管理“选择文件 → 计算 hash → 去重 → 维护预览 URL”的通用 hook。
 *
 * 适用场景：
 * - 素材上传弹窗会在选择阶段预计算 md5 并生成预览图；
 * - 提交阶段复用预计算的 fileHash，避免再次读文件计算 md5。
 *
 * 行为约束：
 * - 以 fileHash 去重；命中重复文件会立即 revoke 新生成的 previewUrl；
 * - remove/clear 会 revoke 对应 previewUrl，避免浏览器内存增长。
 */
export function useHashedUploadFiles(opts?: { computeHash?: (file: File) => Promise<string>; dedupScopeKey?: string }) {
  const computeHash = opts?.computeHash ?? md5HexFromFile;
  const dedupScopeKey = opts?.dedupScopeKey ?? "scope:none";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<HashedUploadFileState[]>([]);

  const openPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const appendFiles = useCallback(
    async (picked: File[]) => {
      if (!picked.length) return;
      const batch = await Promise.all(
        picked.map(async (f, idx) => ({
          key: `${f.name}-${f.size}-${f.lastModified}-${idx}`,
          file: f,
          previewUrl: URL.createObjectURL(f),
          fileHash: await computeHash(f),
        })),
      );
      setFiles((prev) => {
        const existedHash = new Set(prev.map((x) => buildScopedHashKey(dedupScopeKey, x.fileHash)));
        const next = [...prev];
        batch.forEach((b) => {
          const dedupKey = buildScopedHashKey(dedupScopeKey, b.fileHash);
          if (!existedHash.has(dedupKey)) {
            next.push(b);
            return;
          }
          /*
           * 发生 hash 重复时丢弃新文件条目：
           * - UI 只保留一份 hash 对应的条目，避免提交时重复上传；
           * - 必须立即 revoke 临时 previewUrl，避免内存泄漏。
           */
          URL.revokeObjectURL(b.previewUrl);
        });
        return next;
      });
    },
    [computeHash, dedupScopeKey],
  );

  const removeFile = useCallback((key: string) => {
    setFiles((prev) => {
      const target = prev.find((x) => x.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((x) => x.key !== key);
    });
  }, []);

  const clearFiles = useCallback(() => {
    setFiles((prev) => {
      /*
       * 批量 revoke，避免对话框反复打开/关闭导致 URL 累积。
       */
      prev.forEach((x) => URL.revokeObjectURL(x.previewUrl));
      return [];
    });
  }, []);

  const resetInput = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return { fileInputRef, files, setFiles, openPicker, appendFiles, removeFile, clearFiles, resetInput };
}
