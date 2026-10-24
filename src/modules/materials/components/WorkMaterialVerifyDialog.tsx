import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Fingerprint, Loader2, ShieldAlert, ShieldCheck, Upload } from "lucide-react";
import { type WorkMaterialSummary, listWorkMaterials } from "@/shared/api/materials/materials-work";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { type DarkWatermarkVerifyResult, verifyDarkWatermark } from "@/shared/api/sys/system-config";
import { formatDateTime } from "@/shared/lib/datetime";
import { formatOwnerLabel } from "@/shared/lib/owner-display";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { notify } from "@/shared/lib/notify";

type WorkGeneratedItem = {
  kind?: string;
  url?: string;
  text?: string;
};

function parseWorkItems(itemsJson: string | null | undefined): WorkGeneratedItem[] {
  if (!itemsJson) return [];
  try {
    const parsed = JSON.parse(itemsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function resolveWorkVerifyImageUrl(work: WorkMaterialSummary | null | undefined): string | null {
  if (!work) return null;
  const coverUrl = work.coverUrl?.trim();
  if (coverUrl) return coverUrl;
  const imageItem = parseWorkItems(work.itemsJson).find((item) => {
    const url = typeof item?.url === "string" ? item.url.trim() : "";
    return !!url && (item.kind === "image" || !item.kind);
  });
  const itemUrl = typeof imageItem?.url === "string" ? imageItem.url.trim() : "";
  return itemUrl || null;
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function verifyResultLabel(result: DarkWatermarkVerifyResult | null): string {
  if (!result) return "未执行验签";
  if (result.detected && result.signatureValid) return "验签通过";
  if (result.detected && !result.signatureValid) return "检测到水印，但签名校验失败";
  return "未检测到暗水印";
}

function verifyResultBadgeVariant(result: DarkWatermarkVerifyResult | null): "default" | "secondary" | "destructive" | "outline" {
  if (!result) return "outline";
  if (result.detected && result.signatureValid) return "default";
  if (result.detected && !result.signatureValid) return "destructive";
  return "secondary";
}

export default function WorkMaterialVerifyDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [verifySourceMode, setVerifySourceMode] = useState<"upload" | "work">("upload");
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [verifyFilePreviewUrl, setVerifyFilePreviewUrl] = useState<string | null>(null);
  const [verifyWorkKeyword, setVerifyWorkKeyword] = useState("");
  const [verifyWorkPageNo, setVerifyWorkPageNo] = useState(1);
  const verifyWorkPageSize = 9;
  const [verifyTargetWork, setVerifyTargetWork] = useState<WorkMaterialSummary | null>(null);
  const [verifyResult, setVerifyResult] = useState<DarkWatermarkVerifyResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const verifyFileInputRef = useRef<HTMLInputElement | null>(null);

  const verifyWorkListQuery = useQuery({
    queryKey: ["materialsWorkVerifyPicker", verifyWorkKeyword, verifyWorkPageNo, verifyWorkPageSize],
    queryFn: () =>
      listWorkMaterials({
        pageNo: verifyWorkPageNo,
        pageSize: verifyWorkPageSize,
        workType: "image",
        keyword: verifyWorkKeyword.trim() ? verifyWorkKeyword.trim() : undefined,
      }),
    enabled: props.open && verifySourceMode === "work",
    placeholderData: (previousData) => previousData,
  });

  const verifyWorkItems = verifyWorkListQuery.data?.items ?? [];
  const verifyWorkTotal = verifyWorkListQuery.data?.page?.total ?? 0;
  const verifyWorkTotalPages = useMemo(() => {
    if (verifyWorkTotal <= 0) return 0;
    return Math.ceil(verifyWorkTotal / verifyWorkPageSize);
  }, [verifyWorkPageSize, verifyWorkTotal]);
  const verifyCanNextPage = useMemo(() => {
    if (verifyWorkTotal <= 0) return false;
    return verifyWorkPageNo * verifyWorkPageSize < verifyWorkTotal;
  }, [verifyWorkPageNo, verifyWorkPageSize, verifyWorkTotal]);

  useEffect(() => {
    if (verifySourceMode !== "work") return;
    if (verifyWorkTotalPages === 0) {
      if (verifyWorkPageNo !== 1) setVerifyWorkPageNo(1);
      return;
    }
    if (verifyWorkPageNo > verifyWorkTotalPages) setVerifyWorkPageNo(verifyWorkTotalPages);
  }, [verifySourceMode, verifyWorkPageNo, verifyWorkTotalPages]);

  useEffect(() => {
    if (!verifyFile) {
      setVerifyFilePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(verifyFile);
    setVerifyFilePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [verifyFile]);

  useEffect(() => {
    if (props.open) return;
    setVerifySourceMode("upload");
    setVerifyFile(null);
    setVerifyFilePreviewUrl(null);
    setVerifyWorkKeyword("");
    setVerifyWorkPageNo(1);
    setVerifyTargetWork(null);
    setVerifyResult(null);
    setFormError(null);
  }, [props.open]);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (verifySourceMode === "upload") {
        if (!verifyFile) throw new Error("请先上传待验签图片");
        return verifyDarkWatermark({ file: verifyFile });
      }
      const imageUrl = resolveWorkVerifyImageUrl(verifyTargetWork);
      if (!verifyTargetWork || !imageUrl) throw new Error("所选作品暂无可验签图片");
      return verifyDarkWatermark({ imageUrl });
    },
    onSuccess: (result) => {
      setVerifyResult(result);
      // 验签通过时仅在弹窗内展示结果，不弹右下角 toast
      if (!result.detected || result.signatureValid) return;
      notify.error("验签完成", { description: verifyResultLabel(result) });
    },
    onError: (e) => {
      setVerifyResult(null);
      notify.error("验签失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const verifyTargetWorkImageUrl = useMemo(() => resolveWorkVerifyImageUrl(verifyTargetWork), [verifyTargetWork]);

  const handlePickVerifyFile = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError("请上传图片文件后再执行验签");
      return;
    }
    setFormError(null);
    setVerifySourceMode("upload");
    setVerifyFile(file);
    setVerifyTargetWork(null);
    setVerifyResult(null);
  };

  const handleSelectVerifyWork = (row: WorkMaterialSummary) => {
    setFormError(null);
    setVerifySourceMode("work");
    setVerifyTargetWork(row);
    setVerifyFile(null);
    setVerifyResult(null);
  };

  const submitVerify = () => {
    if (verifyMutation.isPending) return;
    if (verifySourceMode === "upload" && !verifyFile) {
      setFormError("上传图片后才能执行验签");
      return;
    }
    if (verifySourceMode === "work" && !verifyTargetWorkImageUrl) {
      setFormError("请选择带有图片资源的作品后再执行验签");
      return;
    }
    setFormError(null);
    verifyMutation.mutate();
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!verifyMutation.isPending) props.onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-7xl max-h-[98vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>作品验签</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)] min-h-0 flex-1 overflow-hidden">
          <div className="min-h-0 overflow-y-auto pr-1 space-y-4">
            <div className="rounded-lg border p-2 bg-muted/20 inline-flex gap-2">
              <Button
                type="button"
                variant={verifySourceMode === "upload" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setFormError(null);
                  setVerifySourceMode("upload");
                  setVerifyTargetWork(null);
                  setVerifyResult(null);
                }}
              >
                上传图片
              </Button>
              <Button
                type="button"
                variant={verifySourceMode === "work" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setFormError(null);
                  setVerifySourceMode("work");
                  setVerifyFile(null);
                  setVerifyResult(null);
                }}
              >
                选择作品
              </Button>
            </div>

            {verifySourceMode === "upload" ? (
              <div className="space-y-4">
                <div className="rounded-xl border-2 border-dashed border-border min-h-[260px] overflow-hidden bg-muted/10 hover:border-primary/50 transition-colors">
                  {verifyFilePreviewUrl ? (
                    <div className="relative h-full min-h-[260px]">
                      <img
                        src={verifyFilePreviewUrl}
                        alt={verifyFile?.name || "待验签图片"}
                        className="w-full h-full object-contain bg-black/5"
                      />
                      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/65 to-transparent text-white">
                        <div className="text-sm font-medium truncate">{verifyFile?.name || "待验签图片"}</div>
                        <div className="text-xs text-white/85">
                          {verifyFile ? `${formatFileSize(verifyFile.size)} · ${verifyFile.type || "image/*"}` : "已选择图片"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="w-full min-h-[260px] flex flex-col items-center justify-center gap-3 text-center px-6"
                      onClick={() => verifyFileInputRef.current?.click()}
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">点击上传待验签图片</p>
                        <p className="text-xs text-muted-foreground">支持 PNG / JPG / JPEG / WEBP</p>
                      </div>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={verifyFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handlePickVerifyFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <Button type="button" variant="outline" onClick={() => verifyFileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-1" />
                    {verifyFile ? "重新上传" : "选择图片"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!verifyFile}
                    onClick={() => {
                      setVerifyFile(null);
                      setVerifyResult(null);
                    }}
                  >
                    清空
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="subpage-search-wrap !max-w-none sm:flex-1">
                    <Input
                      placeholder="搜索作品 ID / 文件名 / 关键字"
                      value={verifyWorkKeyword}
                      onChange={(e) => {
                        setVerifyWorkKeyword(e.target.value);
                        setVerifyWorkPageNo(1);
                      }}
                      className="subpage-search-input"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    仅展示图片作品
                  </div>
                </div>

                {verifyWorkListQuery.isLoading ? (
                  <div className="rounded-lg border py-14 text-center text-muted-foreground">加载作品中...</div>
                ) : verifyWorkItems.length === 0 ? (
                  <div className="rounded-lg border py-14 text-center text-muted-foreground">暂无可选作品</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {verifyWorkItems.map((row) => {
                      const imageUrl = resolveWorkVerifyImageUrl(row);
                      const selected = verifyTargetWork?.id === row.id;
                      return (
                        <button
                          key={row.id}
                          type="button"
                          className={`text-left rounded-lg border overflow-hidden transition-all ${
                            selected ? "border-primary shadow-sm ring-1 ring-primary/20" : "bg-card hover:border-primary/35 hover:shadow-md"
                          }`}
                          onClick={() => handleSelectVerifyWork(row)}
                        >
                          <div className="aspect-[5/4] bg-muted flex items-center justify-center overflow-hidden">
                            {imageUrl ? (
                              <img src={imageUrl} alt={row.id} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="text-xs text-muted-foreground">暂无图片</div>
                            )}
                          </div>
                          <div className="p-2.5 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-foreground truncate">{formatOwnerLabel(row)}</span>
                              {selected && <Badge variant="default" className="shrink-0">已选中</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{row.id}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>{verifyWorkTotal > 0 ? `共 ${verifyWorkTotal} 个作品` : "共 0 个作品"}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={verifyWorkPageNo === 1 || verifyWorkListQuery.isFetching}
                      onClick={() => setVerifyWorkPageNo((page) => Math.max(1, page - 1))}
                    >
                      上一页
                    </Button>
                    <span className="text-xs">
                      {verifyWorkTotalPages > 0 ? `${verifyWorkPageNo}/${verifyWorkTotalPages}` : "0/0"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!verifyCanNextPage || verifyWorkListQuery.isFetching}
                      onClick={() => setVerifyWorkPageNo((page) => page + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto rounded-xl border bg-muted/20 p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">待验签内容</h3>
                <Badge variant="outline">{verifySourceMode === "upload" ? "上传图片" : "已选作品"}</Badge>
              </div>
              {verifySourceMode === "upload" ? (
                verifyFilePreviewUrl ? (
                  <div className="space-y-3">
                    <div className="aspect-[4/3] overflow-hidden rounded-lg border bg-background">
                      <img src={verifyFilePreviewUrl} alt={verifyFile?.name || "待验签图片"} className="w-full h-full object-contain" />
                    </div>
                    <div className="rounded-lg border bg-background p-3 text-sm space-y-1">
                      <div className="font-medium text-foreground truncate">{verifyFile?.name || "待验签图片"}</div>
                      <div className="text-muted-foreground">
                        {verifyFile ? `${formatFileSize(verifyFile.size)} · ${verifyFile.type || "image/*"}` : "-"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed bg-background py-10 px-4 text-center text-sm text-muted-foreground">
                    请先上传待验签图片
                  </div>
                )
              ) : verifyTargetWork && verifyTargetWorkImageUrl ? (
                <div className="aspect-[4/3] overflow-hidden rounded-lg border bg-background">
                  <img src={verifyTargetWorkImageUrl} alt={verifyTargetWork.id} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed bg-background py-10 px-4 text-center text-sm text-muted-foreground">
                  请选择一个图片作品作为验签对象
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">验签结果</h3>
                <Badge variant={verifyResultBadgeVariant(verifyResult)}>{verifyResultLabel(verifyResult)}</Badge>
              </div>

              {verifyMutation.isPending ? (
                <div className="rounded-lg border bg-background py-10 px-4 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-3 text-primary" />
                  <div className="text-sm font-medium text-foreground">正在执行验签</div>
                  <div className="text-xs text-muted-foreground mt-1">请稍候，系统正在校验暗水印签名</div>
                </div>
              ) : verifyResult ? (
                <div className="space-y-3">
                  <div className={`rounded-lg border p-3 flex items-start gap-3 ${verifyResult.detected && verifyResult.signatureValid ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/60" : "bg-background"}`}>
                    {verifyResult.detected && verifyResult.signatureValid ? (
                      <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5" />
                    )}
                    <div className="space-y-1 text-sm">
                      <div className="font-medium text-foreground">{verifyResultLabel(verifyResult)}</div>
                      <div className="text-muted-foreground">
                        {verifyResult.failureReason || (verifyResult.detected ? "已成功解析暗水印信息" : "当前图片未解析到暗水印载荷")}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">水印检测</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{verifyResult.detected ? "已检测到" : "未检测到"}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">签名校验</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{verifyResult.signatureValid ? "通过" : "未通过"}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">算法标识</div>
                      <div className="mt-1 text-sm font-medium text-foreground break-all">{verifyResult.algorithm || "-"}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">协议版本</div>
                      <div className="mt-1 text-sm font-medium text-foreground break-all">{verifyResult.protocolVersion || "-"}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3 sm:col-span-2">
                      <div className="text-xs text-muted-foreground">密钥版本</div>
                      <div className="mt-1 text-sm font-medium text-foreground break-all">{verifyResult.keyVersion || "-"}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3 sm:col-span-2">
                      <div className="text-xs text-muted-foreground">载荷摘要</div>
                      <div className="mt-1 text-sm font-medium text-foreground break-all whitespace-pre-wrap">{verifyResult.payloadSummary || "-"}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed bg-background py-10 px-4 text-center text-sm text-muted-foreground">
                  选择待验签图片后，点击下方“开始验签”查看结果
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          {formError ? <p className="text-sm text-destructive mr-auto">{formError}</p> : null}
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)} disabled={verifyMutation.isPending}>
            关闭
          </Button>
          <Button type="button" onClick={submitVerify} disabled={verifyMutation.isPending}>
            {verifyMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Fingerprint className="w-4 h-4 mr-1" />}
            开始验签
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
