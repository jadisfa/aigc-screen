import { useEffect, useMemo, useState, type UIEvent } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { Button } from "@/shared/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  getWorkflow,
  listWorkflows,
  searchWorkflowsByKeyword,
  type WorkflowCard,
} from "@/shared/api/workflow/workflow";
import { cn } from "@/shared/lib/utils";

const PAGE_SIZE = 20;

function formatWorkflowLabel(item: Pick<WorkflowCard, "title" | "code">): string {
  return `${item.title || item.code}（${item.code}）`;
}

export function WorkflowAppSelect(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  allowClear?: boolean;
}) {
  const sessionScope = useSessionScope();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 300);
  const allowClear = props.allowClear !== false;

  const listQuery = useInfiniteQuery({
    queryKey: ["workflowAppSelect", sessionScope.scope.queryScopeKey, debouncedSearch],
    queryFn: async ({ pageParam }) => {
      const params = {
        pageNo: pageParam as number,
        pageSize: PAGE_SIZE,
        keyword: debouncedSearch || undefined,
      };
      return debouncedSearch
        ? searchWorkflowsByKeyword(params)
        : listWorkflows(params);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + (page.items?.length ?? 0), 0);
      const total = lastPage.page?.total;
      if (typeof total === "number" && total >= 0) {
        return loaded < total ? allPages.length + 1 : undefined;
      }
      if ((lastPage.items?.length ?? 0) < PAGE_SIZE) return undefined;
      return allPages.length + 1;
    },
    enabled: open,
  });

  const selectedQuery = useQuery({
    queryKey: ["workflowAppSelectSelected", sessionScope.scope.queryScopeKey, props.value],
    queryFn: () => getWorkflow(props.value),
    enabled: !!props.value,
  });

  const items = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items ?? []) ?? [],
    [listQuery.data?.pages]
  );

  const selectedLabel = useMemo(() => {
    if (!props.value) return "";
    const fromList = items.find((item) => item.id === props.value);
    if (fromList) return formatWorkflowLabel(fromList);
    const detail = selectedQuery.data?.workflow;
    if (detail) return formatWorkflowLabel(detail);
    return "已选择应用";
  }, [items, props.value, selectedQuery.data?.workflow]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const onListScroll = (e: UIEvent<HTMLDivElement>) => {
    if (!listQuery.hasNextPage || listQuery.isFetchingNextPage) return;
    const el = e.currentTarget;
    const remain = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remain <= 48) {
      void listQuery.fetchNextPage();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", props.className)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "subpage-native-select w-[580px] h-9 justify-between font-normal px-3",
              !props.value && "text-muted-foreground",
              allowClear && props.value ? "pr-8" : undefined
            )}
          >
            <span className="truncate text-left flex-1 min-w-0">
              {props.value ? selectedLabel : props.placeholder || "选择工作流应用"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {allowClear && props.value ? (
          <button
            type="button"
            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50"
            title="清除选择"
            onClick={(e) => {
              e.stopPropagation();
              props.onChange("");
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <PopoverContent align="start" className="w-[420px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="搜索名称/编码..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[320px]" onScroll={onListScroll}>
            <CommandEmpty>
              {listQuery.isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                "未找到工作流应用"
              )}
            </CommandEmpty>
            <CommandGroup>
              {allowClear ? (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    props.onChange("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !props.value ? "opacity-100" : "opacity-0")} />
                  未选择
                </CommandItem>
              ) : null}
              {items.map((item) => {
                const selected = item.id === props.value;
                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => {
                      props.onChange(item.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{formatWorkflowLabel(item)}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {listQuery.isFetchingNextPage ? (
              <div className="flex items-center justify-center py-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                <span className="text-xs">加载更多...</span>
              </div>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
