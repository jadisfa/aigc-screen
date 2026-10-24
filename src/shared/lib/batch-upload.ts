export type BatchUploadCounts = {
  existedCount: number;
  uploadedCount: number;
  failedCount: number;
};

export type BatchUploadWithDedupParams<TExist, TUploadResult> = {
  files: File[];
  computeHash: (file: File) => Promise<string>;
  checkExisted: (fileHash: string) => Promise<TExist | null | undefined | false>;
  uploadOne: (file: File, fileHash: string) => Promise<TUploadResult>;
  isUploadedAsExisted?: (result: TUploadResult) => boolean;
  onFileError?: (file: File, error: unknown) => void;
};

/**
 * 批量上传通用流水线（支持基于 hash 的秒传/去重）。
 *
 * 业务场景：
 * - 文件素材/作品素材等多个页面存在“md5→查重→上传→统计→刷新”的同构逻辑；
 * - 将公共流程抽取为单点，避免规则变更时多处同步遗漏（例如：错误提示策略、秒传判定、上传返回格式调整）。
 *
 * 处理流程：
 * - 对每个文件依次执行：computeHash → checkExisted → uploadOne；
 * - checkExisted 命中时计入 existedCount 并跳过 upload；
 * - uploadOne 返回后使用 isUploadedAsExisted 判定“后端侧秒传”（例如返回 {existed:true}）；
 * - 单个文件失败不影响后续文件，失败计数 + 回调 onFileError。
 */
export async function batchUploadWithDedup<TExist, TUploadResult>(
  params: BatchUploadWithDedupParams<TExist, TUploadResult>,
): Promise<BatchUploadCounts> {
  const isUploadedAsExisted = params.isUploadedAsExisted ?? (() => false);

  let existedCount = 0;
  let uploadedCount = 0;
  let failedCount = 0;

  for (const f of params.files) {
    try {
      const fileHash = await params.computeHash(f);
      const existed = await params.checkExisted(fileHash);
      if (existed) {
        existedCount += 1;
        continue;
      }

      const result = await params.uploadOne(f, fileHash);
      if (isUploadedAsExisted(result)) existedCount += 1;
      else uploadedCount += 1;
    } catch (e) {
      failedCount += 1;
      params.onFileError?.(f, e);
    }
  }

  return { existedCount, uploadedCount, failedCount };
}

export type HashedFileItem<TMeta = unknown> = {
  file: File;
  fileHash: string;
  meta?: TMeta;
};

export type BatchUploadHashedParams<TItem extends HashedFileItem, TExist, TUploadResult> = {
  items: TItem[];
  checkExisted: (fileHash: string, item: TItem) => Promise<TExist | null | undefined | false>;
  uploadOne: (item: TItem) => Promise<TUploadResult>;
  isUploadedAsExisted?: (result: TUploadResult) => boolean;
  onItemError?: (item: TItem, error: unknown) => void;
};

/**
 * 批量上传通用流水线（入参已包含预计算的 fileHash）。
 *
 * 业务场景：
 * - 某些上传弹窗会在“选择文件”阶段预先计算 hash 与 previewUrl，并保存到组件 state；
 * - 提交时应复用已有 hash，避免重复读文件计算 md5 带来的额外开销。
 */
export async function batchUploadHashed<TItem extends HashedFileItem, TExist, TUploadResult>(
  params: BatchUploadHashedParams<TItem, TExist, TUploadResult>,
): Promise<BatchUploadCounts> {
  const isUploadedAsExisted = params.isUploadedAsExisted ?? (() => false);

  let existedCount = 0;
  let uploadedCount = 0;
  let failedCount = 0;

  for (const item of params.items) {
    try {
      const existed = await params.checkExisted(item.fileHash, item);
      if (existed) {
        existedCount += 1;
        continue;
      }

      const result = await params.uploadOne(item);
      if (isUploadedAsExisted(result)) existedCount += 1;
      else uploadedCount += 1;
    } catch (e) {
      failedCount += 1;
      params.onItemError?.(item, e);
    }
  }

  return { existedCount, uploadedCount, failedCount };
}
