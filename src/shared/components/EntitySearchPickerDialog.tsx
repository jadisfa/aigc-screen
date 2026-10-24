import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePagedTotal } from "@/shared/hooks/use-paged-total";
import { useQuery } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";

type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type EntitySearchPickerPage<T> = {
  page?: PageResult;
  items: T[];
};

export type EntitySearchPickerDialogProps<T> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  queryKeyPrefix: readonly unknown[];
  fetchPage: (params: { keyword?: string; pageNo: number; pageSize: number; total?: number }) => Promise<EntitySearchPickerPage<T>>;
  getId: (item: T) => string;
  getTitle: (item: T) => string;
  getDescription?: (item: T) => ReactNode;
  getMeta?: (item: T) => ReactNode;
  onPick: (item: T) => void;
  searchPlaceholder?: string;
  emptyText?: string;
  selectedId?: string;
  pageSizeOptions?: number[];
};

export default function EntitySearchPickerDialog<T>(props: EntitySearchPickerDialogProps<T>) {
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(props.pageSizeOptions?.[0] ?? 10);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if (!props.open) {
      setKeyword("");
      setDebouncedKeyword("");
      setPageNo(1);
      setPageSize(props.pageSizeOptions?.[0] ?? 10);
    }
  }, [props.open, props.pageSizeOptions]);

  const listQuery = useQuery({
    queryKey: [...props.queryKeyPrefix, debouncedKeyword, pageNo, pageSize],
    queryFn: () =>
      props.fetchPage({
        keyword: debouncedKeyword || undefined,
        pageNo,
        pageSize,
        total: requestTotal,
      }),
    enabled: props.open,
  });

  const requestTotal = usePagedTotal(pageNo, listQuery.data?.page?.total);

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.page?.total ?? 0;

  const canNextPage = useMemo(() => {
    if (total > 0) return pageNo * pageSize < total;
    return items.length === pageSize;
  }, [items.length, pageNo, pageSize, total]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none sm:rounded-none p-0 gap-0 flex flex-col">
        <div className="page-content-shell flex flex-col h-full">
          <DialogHeader className="py-0 mb-5 shrink-0">
            <DialogTitle className="text-[18px] font-semibold text-foreground">{props.title}</DialogTitle>
          </DialogHeader>

          <div className="subpage-toolbar mb-4 shrink-0">
            <div className="subpage-toolbar-start !flex-nowrap gap-3">
              <div className="subpage-search-wrap !w-[420px] !max-w-[420px] shrink-0">
                <Search className="subpage-search-icon" />
                <Input
                  placeholder={props.searchPlaceholder || "请输入关键词搜索"}
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPageNo(1);
                  }}
                  className="subpage-search-input"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {listQuery.isLoading ? (
              <div className="py-12 text-sm text-muted-foreground">加载中...</div>
            ) : items.length === 0 ? (
              <div className="py-12 text-sm text-muted-foreground">{props.emptyText || "暂无可选数据"}</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => {
                  const id = props.getId(item);
                  const selected = props.selectedId === id;
                  const description = props.getDescription?.(item);
                  const meta = props.getMeta?.(item);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/35 hover:shadow-sm ${
                        selected ? "border-primary bg-primary/5" : "border-border"
                      }`}
                      onClick={() => {
                        props.onPick(item);
                        props.onOpenChange(false);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15px] font-semibold text-foreground" title={props.getTitle(item)}>
                            {props.getTitle(item)}
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground" title={id}>
                            ID: {id}
                          </div>
                        </div>
                        {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : null}
                      </div>
                      {description ? <div className="mt-2 text-sm text-foreground/90">{description}</div> : null}
                      {meta ? <div className="mt-2 text-xs text-muted-foreground">{meta}</div> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <CommonPaginationBar
            total={total}
            pageNo={pageNo}
            pageSize={pageSize}
            canNextPage={canNextPage}
            onPageNoChange={setPageNo}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPageNo(1);
            }}
            pageSizeOptions={props.pageSizeOptions}
            disabled={listQuery.isFetching}
            showLastButton
            className="shrink-0"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
