import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ChannelModelCatalogItem, ProviderOption } from "@/modules/modelhub/types/channelManagementTypes";
import { resolveModelKindLabel } from "@/modules/modelhub/types/modelTypeProfiles";
import { getDisplayFallback } from "@/shared/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

export default function ChannelModelConfigDialog(props: {
  open: boolean;
  title?: string;
  searchKeyword: string;
  availableModelCount: number;
  filteredModelOptions: ChannelModelCatalogItem[];
  selectedModelIds: string[];
  providerOptions: ProviderOption[];
  onOpenChange: (open: boolean) => void;
  onSearchKeywordChange: (value: string) => void;
  onToggleModel: (modelId: string, checked: boolean | "indeterminate") => void;
  onSelectAllFiltered: () => void;
  onClear: () => void;
  onConfirm: () => void;
}) {
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  useEffect(() => {
    if (!props.open) {
      return;
    }
    setPageNo(1);
    setPageSize(24);
  }, [props.open]);

  useEffect(() => {
    setPageNo(1);
  }, [props.searchKeyword]);

  const providerMap = useMemo(
    () =>
      props.providerOptions.reduce<Record<string, ProviderOption>>((accumulator, item) => {
        accumulator[item.id] = item;
        return accumulator;
      }, {}),
    [props.providerOptions],
  );

  const pagedModelOptions = useMemo(() => {
    const start = (pageNo - 1) * pageSize;
    return props.filteredModelOptions.slice(start, start + pageSize);
  }, [pageNo, pageSize, props.filteredModelOptions]);

  const canNextPage = useMemo(() => pageNo * pageSize < props.filteredModelOptions.length, [pageNo, pageSize, props.filteredModelOptions.length]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="left-0 top-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-none">
        <div className="page-content-shell flex flex-1 flex-col overflow-hidden">
          <DialogHeader className="mb-5 py-0">
            <DialogTitle className="text-[18px] font-semibold text-foreground">
              {props.title || "选择渠道部署模型"}
            </DialogTitle>
          </DialogHeader>

          <div className="subpage-toolbar mb-4">
            <div className="subpage-toolbar-start !flex-nowrap gap-3">
              <div className="subpage-search-wrap !w-[420px] !max-w-[420px] shrink-0">
                <Search className="subpage-search-icon" />
                <Input
                  value={props.searchKeyword}
                  onChange={(event) => props.onSearchKeywordChange(event.target.value)}
                  placeholder="搜索模型名称 / 编码"
                  className="subpage-search-input"
                />
              </div>
              <Button variant="outline" className="h-9" onClick={props.onSelectAllFiltered}>全选结果</Button>
              <Button variant="outline" className="h-9" onClick={props.onClear}>清空</Button>
            </div>
            <div className="subpage-toolbar-end text-sm text-muted-foreground">
              已选 {props.selectedModelIds.length} / {props.availableModelCount}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {pagedModelOptions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-12 text-center text-sm text-muted-foreground">
              暂无符合条件的部署模型
              </div>
            ) : (
              <div className="grid [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] gap-5 max-[768px]:grid-cols-1">
                {pagedModelOptions.map((item) => {
                  const checked = props.selectedModelIds.includes(item.id);
                  const provider = providerMap[item.providerId];
                  return (
                    <label
                      key={item.id}
                      className="cursor-pointer rounded-xl border border-border bg-card p-2 transition-all hover:border-primary/35 hover:shadow-md"
                    >
                      <div className="flex gap-3">
                        <div className="flex h-[88px] w-[28%] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/30">
                          <Avatar className="h-12 w-12 rounded-xl border border-border/60">
                            <AvatarImage src={provider?.logoUrl || undefined} alt={provider?.displayName || item.displayName} className="object-cover" />
                            <AvatarFallback className="text-xs font-medium">
                              {getDisplayFallback(provider?.displayName || item.displayName)}
                            </AvatarFallback>
                          </Avatar>
                        </div>

                        <div className="flex min-w-0 w-[72%] flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[15px] font-semibold leading-tight text-foreground">{item.displayName || item.code}</span>
                            <div className="ml-auto flex shrink-0 items-center gap-1">
                              <Badge variant={checked ? "default" : "outline"} className="px-1.5 text-[11px] font-medium">
                                {checked ? "已选" : "未选"}
                              </Badge>
                            </div>
                          </div>

                          <div className="space-y-1 text-[12px] leading-[1.45] text-muted-foreground/85">
                            <p className="truncate">提供方：{provider?.displayName || "-"}</p>
                            <p className="truncate">类型：{resolveModelKindLabel(item.modelType, item.capabilityCodes)}</p>
                            <p className="truncate font-mono">编码：{item.code || "-"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground">
                          {resolveModelKindLabel(item.modelType, item.capabilityCodes)}
                        </span>
                        <div className="flex-1" />
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(checkedValue) => props.onToggleModel(item.id, checkedValue)}
                          className="h-4 w-4"
                        />
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-end gap-3 text-sm text-muted-foreground">
            <span>共 {props.filteredModelOptions.length} 条</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" disabled={pageNo === 1} onClick={() => setPageNo(1)}>
                {"<<"}
              </Button>
              <Button variant="ghost" size="sm" disabled={pageNo === 1} onClick={() => setPageNo((current) => Math.max(1, current - 1))}>
                {"<"}
              </Button>
              <Button variant="ghost" size="sm" disabled={!canNextPage} onClick={() => setPageNo((current) => current + 1)}>
                {">"}
              </Button>
            </div>
            <span>第 {pageNo} 页 / 每页 {pageSize} 条</span>
            <div className="subpage-toolbar-end">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPageNo(1);
                }}
              >
                <SelectTrigger className="subpage-native-select h-9 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  <SelectItem className="subpage-select-item" value="12">12/页</SelectItem>
                  <SelectItem className="subpage-select-item" value="24">24/页</SelectItem>
                  <SelectItem className="subpage-select-item" value="48">48/页</SelectItem>
                  <SelectItem className="subpage-select-item" value="96">96/页</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => props.onOpenChange(false)}>取消</Button>
            <Button onClick={props.onConfirm}>确认部署模型</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
