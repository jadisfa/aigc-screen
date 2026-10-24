import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { PoolBindingOption } from "@/modules/modelhub/services/pools";
import { getDisplayFallback } from "@/shared/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

const ALL_CHANNELS = "all";

export function poolBindingKey(item: Pick<PoolBindingOption, "baseModelId" | "channelId">): string {
  return `${item.baseModelId}:${item.channelId}`;
}

export default function PoolBindingPickerDialog(props: {
  open: boolean;
  options: PoolBindingOption[];
  disabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selected: PoolBindingOption[]) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [channelId, setChannelId] = useState(ALL_CHANNELS);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  useEffect(() => {
    if (!props.open) {
      return;
    }
    setKeyword("");
    setChannelId(ALL_CHANNELS);
    setSelectedKeys([]);
    setPageNo(1);
    setPageSize(24);
  }, [props.open]);

  useEffect(() => {
    setPageNo(1);
  }, [keyword, channelId]);

  const optionByKey = useMemo(() => {
    const map = new Map<string, PoolBindingOption>();
    props.options.forEach((item) => map.set(poolBindingKey(item), item));
    return map;
  }, [props.options]);

  const channelOptions = useMemo(() => {
    const index = new Map<string, { id: string; name: string; code: string }>();
    props.options.forEach((item) => {
      if (!index.has(item.channelId)) {
        index.set(item.channelId, {
          id: item.channelId,
          name: item.channelName,
          code: item.channelCode,
        });
      }
    });
    return Array.from(index.values()).sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  }, [props.options]);

  const filteredOptions = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return props.options.filter((item) => {
      if (channelId !== ALL_CHANNELS && item.channelId !== channelId) {
        return false;
      }
      if (!query) {
        return true;
      }
      return item.baseModelName.toLowerCase().includes(query)
        || item.baseModelCode.toLowerCase().includes(query)
        || item.channelName.toLowerCase().includes(query)
        || item.channelCode.toLowerCase().includes(query);
    });
  }, [channelId, keyword, props.options]);

  const pagedOptions = useMemo(() => {
    const start = (pageNo - 1) * pageSize;
    return filteredOptions.slice(start, start + pageSize);
  }, [filteredOptions, pageNo, pageSize]);

  const canNextPage = useMemo(
    () => pageNo * pageSize < filteredOptions.length,
    [filteredOptions.length, pageNo, pageSize],
  );

  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const filteredKeys = useMemo(() => filteredOptions.map(poolBindingKey), [filteredOptions]);

  const toggleKeys = (keys: string[], checked: boolean) => {
    setSelectedKeys((current) => {
      if (checked) {
        const next = new Set(current);
        keys.forEach((key) => next.add(key));
        return Array.from(next);
      }
      const remove = new Set(keys);
      return current.filter((key) => !remove.has(key));
    });
  };

  const handleConfirm = () => {
    const selected = selectedKeys
      .map((key) => optionByKey.get(key))
      .filter((item): item is PoolBindingOption => Boolean(item));
    if (selected.length === 0) {
      return;
    }
    props.onConfirm(selected);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="left-0 top-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-none">
        <div className="page-content-shell flex flex-1 flex-col overflow-hidden">
          <DialogHeader className="mb-5 py-0">
            <DialogTitle className="text-[18px] font-semibold text-foreground">添加候选绑定</DialogTitle>
          </DialogHeader>

          <div className="subpage-toolbar mb-4">
            <div className="subpage-toolbar-start !flex-nowrap gap-3">
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger className="subpage-native-select h-9 w-[200px] shrink-0">
                  <SelectValue placeholder="全部渠道" />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  <SelectItem className="subpage-select-item" value={ALL_CHANNELS}>全部渠道</SelectItem>
                  {channelOptions.map((option) => (
                    <SelectItem key={option.id} className="subpage-select-item" value={option.id}>
                      {option.name || option.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="subpage-search-wrap !w-[320px] !max-w-[320px] shrink-0">
                <Search className="subpage-search-icon" />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索模型或渠道名称 / 编码"
                  className="subpage-search-input"
                />
              </div>
              
              <Button
                variant="outline"
                className="h-9"
                onClick={() => toggleKeys(filteredKeys, true)}
                disabled={filteredKeys.length === 0 || props.disabled}
              >
                全选结果
              </Button>
              <Button
                variant="outline"
                className="h-9"
                onClick={() => setSelectedKeys([])}
                disabled={selectedKeys.length === 0 || props.disabled}
              >
                清空
              </Button>
            </div>
            <div className="subpage-toolbar-end text-sm text-muted-foreground">
              已选 {selectedKeys.length} / {props.options.length}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {pagedOptions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-12 text-center text-sm text-muted-foreground">
                {props.options.length === 0
                  ? "当前范围内可绑定的模型渠道都已加入模型池。"
                  : "没有符合筛选条件的模型或渠道。"}
              </div>
            ) : (
              <div className="grid [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] gap-5 max-[768px]:grid-cols-1">
                {pagedOptions.map((item) => {
                  const key = poolBindingKey(item);
                  const checked = selectedKeySet.has(key);
                  return (
                    <label
                      key={key}
                      className="cursor-pointer rounded-xl border border-border bg-card p-2 transition-all hover:border-primary/35 hover:shadow-md"
                    >
                      <div className="flex gap-3">
                        <div className="flex h-[88px] w-[28%] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/30">
                          <div className="relative">
                            <Avatar className="h-12 w-12 rounded-xl border border-border/60">
                              <AvatarImage src={item.modelLogoUrl || undefined} alt={item.baseModelName} className="object-cover" />
                              <AvatarFallback className="text-xs font-medium">
                                {getDisplayFallback(item.baseModelName)}
                              </AvatarFallback>
                            </Avatar>
                            <Avatar className="absolute -bottom-1 -right-1 h-7 w-7 rounded-lg border-2 border-card">
                              <AvatarImage src={item.channelIconUrl || undefined} alt={item.channelName} className="object-cover" />
                              <AvatarFallback className="rounded-lg bg-primary/10 text-[9px] font-medium text-primary">
                                {getDisplayFallback(item.channelName)}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        </div>

                        <div className="flex min-w-0 w-[72%] flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[15px] font-semibold leading-tight text-foreground">
                              {item.baseModelName || item.baseModelCode}
                            </span>
                            <div className="ml-auto flex shrink-0 items-center gap-1">
                              <Badge variant={checked ? "default" : "outline"} className="px-1.5 text-[11px] font-medium">
                                {checked ? "已选" : "未选"}
                              </Badge>
                            </div>
                          </div>

                          <div className="space-y-1 text-[12px] leading-[1.45] text-muted-foreground/85">
                            <p className="truncate">渠道：{item.channelName || "-"}</p>
                            <p className="truncate font-mono">模型：{item.baseModelCode || "-"}</p>
                            <p className="truncate font-mono">渠道编码：{item.channelCode || "-"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground">
                          {item.channelName || item.channelCode}
                        </span>
                        <div className="flex-1" />
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleKeys([key], value === true)}
                          disabled={props.disabled}
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
            <span>共 {filteredOptions.length} 条</span>
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
            <Button onClick={handleConfirm} disabled={selectedKeys.length === 0 || props.disabled}>
              加入模型池{selectedKeys.length > 0 ? ` (${selectedKeys.length})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
