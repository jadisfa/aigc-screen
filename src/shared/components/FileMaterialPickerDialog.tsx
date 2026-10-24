import {useEffect, useMemo, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Search} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {Input} from "@/shared/ui/input";
import {Button} from "@/shared/ui/button";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/shared/ui/select";
import {listFileMaterials, type FileMaterial} from "@/shared/api/materials/materials-file-material";
import {formatDateTime} from "@/shared/lib/datetime";

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

export default function FileMaterialPickerDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (url: string, item: FileMaterial) => void;
  title?: string;
  fileType?: "image" | "video" | "file";
}) {
  const [keyword, setKeyword] = useState("");
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const fileType = props.fileType ?? "image";

  useEffect(() => {
    if (props.open) return;
    setKeyword("");
    setPageNo(1);
    setPageSize(20);
  }, [props.open]);

  const listQuery = useQuery({
    queryKey: ["fileMaterialPicker", fileType, keyword, pageNo, pageSize],
    queryFn: () =>
      listFileMaterials({
        fileType,
        keyword: keyword.trim() ? keyword.trim() : undefined,
        pageNo,
        pageSize,
      }),
    enabled: props.open,
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.page?.total ?? 0;
  const totalPages = useMemo(() => (total > 0 ? Math.ceil(total / pageSize) : 0), [pageSize, total]);
  const pageFrom = total === 0 ? 0 : (pageNo - 1) * pageSize + 1;
  const pageTo = total === 0 ? 0 : Math.min(pageNo * pageSize, total);
  const canNextPage = total > 0 && pageNo * pageSize < total;

  useEffect(() => {
    if (!props.open) return;
    if (totalPages === 0) {
      if (pageNo !== 1) setPageNo(1);
      return;
    }
    if (pageNo > totalPages) setPageNo(totalPages);
  }, [pageNo, props.open, totalPages]);

  const pickMaterial = (item: FileMaterial) => {
    const url = (item.accessUrl || "").trim();
    if (!url) return;
    props.onPick(url, item);
    props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        className="fixed z-50 border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] left-0 top-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none sm:rounded-none p-0 gap-0 flex flex-col">
        <VisuallyHidden>
          <DialogTitle>{props.title || "选择素材"}</DialogTitle>
        </VisuallyHidden>
        <div className="page-content-shell h-full flex flex-col">
          <div className="subpage-toolbar mb-5 shrink-0">
            <h1 className="text-[18px] font-semibold text-foreground">{props.title || "选择素材"}</h1>
          </div>

          <div className="subpage-toolbar mb-4 shrink-0">
            <div className="subpage-toolbar-start !flex-nowrap gap-3">
              <div className="subpage-search-wrap !w-[320px] !max-w-[320px] shrink-0">
                <Search className="subpage-search-icon"/>
                <Input
                  placeholder="搜索素材"
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setPageNo(1);
                  }}
                  className="subpage-search-input"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {listQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">加载中...</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground">暂无可选素材</div>
            ) : (
              <div
                className="grid [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))] gap-5 max-[768px]:grid-cols-1">
                {items.map((item) => {
                  const preview = (item.accessUrl || "").trim();
                  const fileName = (item.fileName || fileNameFromUrl(preview)).trim() || "未命名";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="text-left rounded-lg border bg-card overflow-hidden group hover:shadow-md hover:border-primary/35 transition-all"
                      onClick={() => pickMaterial(item)}
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-muted flex items-center justify-center">
                        {preview ? <img src={preview} alt={fileName} className="h-full w-full object-cover"/> :
                          <span className="text-xs text-muted-foreground">无预览</span>}
                      </div>
                      <div className="p-4 space-y-1.5">
                        <p className="text-[15px] font-semibold text-foreground truncate" title={fileName}>
                          {fileName}
                        </p>
                        <p className="text-[12px] text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end mt-4 shrink-0">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>每页数目:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPageNo(1);
                }}
              >
                <SelectTrigger className="subpage-native-select w-20 h-8">
                  <SelectValue/>
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  <SelectItem className="subpage-select-item" value="10">
                    10
                  </SelectItem>
                  <SelectItem className="subpage-select-item" value="20">
                    20
                  </SelectItem>
                  <SelectItem className="subpage-select-item" value="50">
                    50
                  </SelectItem>
                </SelectContent>
              </Select>

              {total > 0 ? (
                <span>
                  {pageFrom}-{pageTo} 共 {total} 条
                </span>
              ) : (
                <span>共 0 条</span>
              )}

              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" disabled={pageNo === 1 || listQuery.isFetching}
                        onClick={() => setPageNo(1)}>
                  {"<<"}
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={pageNo === 1 || listQuery.isFetching}
                        onClick={() => setPageNo((p) => Math.max(1, p - 1))}>
                  {"<"}
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={!canNextPage || listQuery.isFetching}
                        onClick={() => setPageNo((p) => p + 1)}>
                  {">"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={totalPages === 0 || pageNo === totalPages || listQuery.isFetching}
                  onClick={() => setPageNo(totalPages)}
                >
                  {">>"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
