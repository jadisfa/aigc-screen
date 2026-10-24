import { LogOut, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { resolvePagedTotal } from "@/shared/hooks/use-paged-total";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  TableSurface,
} from "@/shared/components/page";
import { formatDateTime } from "@/shared/lib/datetime";
import { formatElapsedDuration } from "@/shared/lib/format";
import { getUserAvatarFallback, resolveUserAvatarUrl } from "@/shared/lib/user-avatar";
import { notify } from "@/shared/lib/notify";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  kickOnlineUser,
  listOnlineUsers,
  ONLINE_USER_SOURCE_OPTIONS,
  type OnlineUser,
} from "@/shared/api/sys/online-users";

const ALL_FILTER_VALUE = "all";

type OnlineUserFilters = {
  source: string;
  keyword: string;
};

function createInitialFilters(): OnlineUserFilters {
  return {
    source: ALL_FILTER_VALUE,
    keyword: "",
  };
}

function isSameFilters(left: OnlineUserFilters, right: OnlineUserFilters) {
  return left.source === right.source && left.keyword === right.keyword;
}

function formatPrincipalIdTail(principalId?: string | null) {
  const value = (principalId || "").trim();
  if (!value) {
    return "-";
  }
  return value.length <= 8 ? value : value.slice(-8);
}

function sameSessionId(left?: string | null, right?: string | null) {
  const a = (left || "").replace(/-/g, "").toLowerCase();
  const b = (right || "").replace(/-/g, "").toLowerCase();
  return a.length > 0 && a === b;
}

function resolveLoginDuration(user: OnlineUser) {
  if (user.loginAt) {
    const startedAt = new Date(user.loginAt).getTime();
    if (Number.isFinite(startedAt)) {
      return formatElapsedDuration(Date.now() - startedAt);
    }
  }
  if (typeof user.loginDurationSeconds === "number") {
    return formatElapsedDuration(user.loginDurationSeconds * 1000);
  }
  return "-";
}

export default function OnlineUserPage() {
  const sessionScope = useSessionScope();
  const [items, setItems] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [kicking, setKicking] = useState(false);
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<OnlineUserFilters>(() => createInitialFilters());
  const [appliedFilters, setAppliedFilters] = useState<OnlineUserFilters>(() => createInitialFilters());
  const [userToKick, setUserToKick] = useState<OnlineUser | null>(null);

  const load = useCallback(async (
    nextPageNo: number,
    nextPageSize: number,
    nextFilters: OnlineUserFilters = appliedFilters,
    knownTotal?: number,
  ) => {
    setLoading(true);
    try {
      const res = await listOnlineUsers({
        source: nextFilters.source === ALL_FILTER_VALUE ? undefined : nextFilters.source,
        keyword: nextFilters.keyword.trim() || undefined,
        pageNo: nextPageNo,
        pageSize: nextPageSize,
        total: resolvePagedTotal(nextPageNo, knownTotal),
      });
      setItems(res.items || []);
      setTotal(res.page?.total || 0);
    } catch (e) {
      notify.error("加载失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void load(pageNo, pageSize, appliedFilters, total);
  }, [appliedFilters, load, pageNo, pageSize, total]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedFilters((current) => {
        const nextFilters = {
          ...filters,
          keyword: current.keyword,
        };
        return isSameFilters(current, nextFilters) ? current : nextFilters;
      });
      setPageNo((current) => (current === 1 ? current : 1));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [filters.source]);

  const applyKeywordSearch = () => {
    const nextFilters = {
      ...filters,
      keyword: filters.keyword.trim(),
    };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPageNo(1);
  };

  const handleReset = () => {
    const nextFilters = createInitialFilters();
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPageNo(1);
  };

  const handleKick = async () => {
    if (!userToKick?.sessionId || kicking) {
      return;
    }
    setKicking(true);
    try {
      await kickOnlineUser(userToKick.sessionId);
      notify.success("已强制下线");
      setUserToKick(null);
      setTotal(0);
      await load(pageNo, pageSize, appliedFilters, 0);
    } catch (e) {
      notify.error("强制下线失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setKicking(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canNextPage = pageNo < totalPages;

  return (
    <PageShell>
      <PageHeader
        title="在线用户"
        actions={
          <>
            <Button variant="pageOutline" onClick={handleReset} disabled={loading}>
              重置
            </Button>
            <Button variant="pageOutline" onClick={() => void load(pageNo, pageSize, appliedFilters, total)} disabled={loading}>
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
          </>
        }
      />

      <PageFilterBar>
        <Select value={filters.source} onValueChange={(value) => setFilters((current) => ({ ...current, source: value }))}>
          <SelectTrigger className="subpage-native-select w-[160px] h-9">
            <SelectValue placeholder="登录源" />
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value={ALL_FILTER_VALUE}>登录源</SelectItem>
            {ONLINE_USER_SOURCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchField
          wrapClassName="!max-w-[360px] shrink-0"
          placeholder="搜索昵称/商户/门店，回车搜索"
          value={filters.keyword}
          onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyKeywordSearch();
            }
          }}
        />
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">序号</TableHead>
              <TableHead className="min-w-[140px]">用户昵称</TableHead>
              <TableHead className="min-w-[140px]">所属商户</TableHead>
              <TableHead className="min-w-[140px]">所属门店</TableHead>
              <TableHead className="min-w-[140px]">登录源</TableHead>
              <TableHead className="min-w-[180px]">登录时间</TableHead>
              <TableHead className="min-w-[120px]">登录时长</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                  加载中...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              items.map((user, index) => {
                const displayName = user.nickname?.trim() || "-";
                const isCurrentSession = sameSessionId(user.sessionId, sessionScope.scope.sessionId);
                return (
                  <TableRow key={user.sessionId || `${user.principalId}-${index}`}>
                    <TableCell>{(pageNo - 1) * pageSize + index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-[110px]">
                        <Avatar className="h-8 w-8 rounded-md shrink-0">
                          <AvatarImage
                            src={resolveUserAvatarUrl(user.avatarUrl, user.principalId || "user", 64)}
                            alt={displayName === "-" ? "用户头像" : displayName}
                            className="object-cover"
                          />
                          <AvatarFallback className="rounded-md bg-primary/10 text-primary text-xs font-medium">
                            {getUserAvatarFallback(displayName === "-" ? (user.principalId || "U") : displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 space-y-1">
                          <div className="truncate">{displayName}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {formatPrincipalIdTail(user.principalId)}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.merchantName?.trim() || "-"}</TableCell>
                    <TableCell>{user.storeName?.trim() || "-"}</TableCell>
                    <TableCell>{user.sourceLabel || user.source || "-"}</TableCell>
                    <TableCell>{formatDateTime(user.loginAt)}</TableCell>
                    <TableCell>{resolveLoginDuration(user)}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        title={isCurrentSession ? "当前会话不可强制下线" : "强制下线"}
                        disabled={loading || kicking || !user.sessionId || isCurrentSession}
                        onClick={() => setUserToKick(user)}
                      >
                        <LogOut className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableSurface>

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
        showLastButton={true}
        disabled={loading}
      />

      <AlertDialog open={userToKick != null} onOpenChange={(open) => { if (!open && !kicking) setUserToKick(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认强制下线？</AlertDialogTitle>
            <AlertDialogDescription>
              {userToKick?.nickname?.trim() || "该用户"}在{userToKick?.sourceLabel || userToKick?.source || "当前客户端"}的登录会话将立即失效，需重新登录后才能继续使用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={kicking}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleKick();
              }}
              disabled={kicking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {kicking ? "处理中..." : "确认下线"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
