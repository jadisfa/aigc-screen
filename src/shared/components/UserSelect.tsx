import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";
import { listUsers } from "@/shared/api/ums/iam";
import { useSessionScope } from "@/shared/hooks/use-session-scope";

export function UserSelect(props: {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  tenantId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const sessionScope = useSessionScope();
  const tenantId = props.tenantId?.trim() || undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["usersSearch", sessionScope.scope.queryScopeKey, tenantId ?? "current", debouncedSearch],
    queryFn: () => listUsers({ tenantId, pageNo: 1, pageSize: 50, keyword: debouncedSearch }),
    enabled: open,
  });

  const users = data?.items || [];
  
  const selectedUser = users.find((u) => u.principalId === props.value);

  // If the selected user is not in the current search results, we might want to still show it
  // But usually it's fine.

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={`w-[200px] justify-between font-normal ${props.className || ""} ${!props.value ? "text-muted-foreground" : ""} pr-8`}
          >
            {props.value
              ? selectedUser
                ? selectedUser.nickname || selectedUser.displayName || selectedUser.phone || selectedUser.principalId
                : "已选择用户"
              : props.placeholder || "筛选用户..."}
            {!props.value && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
          </Button>
        </PopoverTrigger>
        {props.value && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50"
            onClick={(e) => {
              e.stopPropagation();
              props.onChange("");
            }}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="搜索昵称/电话..." 
            value={search} 
            onValueChange={setSearch} 
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                "未找到用户"
              )}
            </CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.principalId}
                  value={user.principalId}
                  onSelect={(currentValue) => {
                    props.onChange(currentValue === props.value ? "" : user.principalId);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      props.value === user.principalId ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <div className="flex flex-col">
                    <span>{user.nickname || user.displayName || user.phone}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {user.phone || user.email || user.principalId}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
