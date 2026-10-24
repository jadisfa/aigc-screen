import { Loader2, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { resolvePagedTotal } from "@/shared/hooks/use-paged-total";
import { useNavigate } from "react-router-dom";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  StatusBadge,
  TableSurface,
} from "@/shared/components/page";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  COMPUTE_PACKAGE_TYPE_OPTIONS,
  deleteComputePackage,
  getComputePackageCreditTargetLabel,
  getComputePackageTypeLabel,
  listComputePackages,
  setComputePackageEnabled,
  type ComputePackage,
} from "@/shared/api/ops/ops-compute-package";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "请求失败";
}
import { notify } from "@/shared/lib/notify";

export default function UserPackageManagementPage() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<ComputePackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [packageType, setPackageType] = useState<string>("all");

  const loadData = useCallback(async (page: number, total?: number) => {
    setLoading(true);
    try {
      const res = await listComputePackages({
        pageNo: page,
        pageSize,
        total: resolvePagedTotal(page, total),
        keyword: appliedKeyword.trim() || undefined,
        packageType: packageType === "all" ? undefined : packageType,
      });
      setPackages(res.items || []);
      setTotal(res.page?.total || 0);
    } catch (err: unknown) {
      notify.error("加载列表失败", { description: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [appliedKeyword, packageType, pageSize]);

  useEffect(() => {
    void loadData(pageNo, total);
  }, [loadData, pageNo, total]);

  const handleSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
    setPageNo(1);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定要删除该套餐吗？")) return;
    try {
      await deleteComputePackage(id);
      notify.success("删除成功");
      loadData(pageNo);
    } catch (err: unknown) {
      notify.error("删除失败", { description: getErrorMessage(err) });
    }
  };

  const handleToggleEnabled = async (pkg: ComputePackage) => {
    const nextEnabled = !pkg.enabled;
    setTogglingId(pkg.id);
    try {
      await setComputePackageEnabled(pkg.id, nextEnabled);
      notify.success(nextEnabled ? "套餐已开启" : "套餐已关闭");
      await loadData(pageNo);
    } catch (err: unknown) {
      notify.error(nextEnabled ? "开启失败" : "关闭失败", { description: getErrorMessage(err) });
    } finally {
      setTogglingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canNextPage = pageNo < totalPages;

  return (
    <PageShell>
      <PageHeader
        title="用户套餐管理"
        actions={
          <Button variant="page" onClick={() => navigate("/ops/user-packages/new")}>
            <Plus className="w-4 h-4" />
            新增套餐
          </Button>
        }
      />

      <PageFilterBar>
        <Select
          value={packageType}
          onValueChange={(v) => {
            setPackageType(v);
            setPageNo(1);
          }}
        >
          <SelectTrigger className="subpage-native-select w-40 h-9">
            <SelectValue placeholder="全部" />
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value="all">
              全部
            </SelectItem>
            {COMPUTE_PACKAGE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchField
          wrapClassName="!w-[280px] !max-w-[280px] shrink-0"
          placeholder="请输入套餐名称，回车搜索"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch();
            }
          }}
        />
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">序号</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>购买金额(分)</TableHead>
              <TableHead>货币</TableHead>
              <TableHead>到账额度</TableHead>
              <TableHead>赠送额度</TableHead>
              <TableHead>有效期(天)</TableHead>
              <TableHead>专属商户</TableHead>
              <TableHead>套餐类型</TableHead>
              <TableHead>入账目标</TableHead>
              <TableHead>套餐状态</TableHead>
              <TableHead>线上充值</TableHead>
              <TableHead className="w-24 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-muted-foreground py-12">
                  加载中...
                </TableCell>
              </TableRow>
            ) : packages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-muted-foreground py-12">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              packages.map((pkg, index) => (
                <TableRow key={pkg.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{pkg.name}</TableCell>
                  <TableCell>{pkg.amount}</TableCell>
                  <TableCell>{pkg.currency}</TableCell>
                  <TableCell>{pkg.computeQuota}</TableCell>
                  <TableCell>{pkg.bonusCompute}</TableCell>
                  <TableCell>{pkg.validityDays || "无限制"}</TableCell>
                  <TableCell>{pkg.isExclusive ? pkg.exclusiveMerchantId || "有" : "-"}</TableCell>
                  <TableCell>
                    <StatusBadge tone="info">{getComputePackageTypeLabel(pkg.packageType)}</StatusBadge>
                  </TableCell>
                  <TableCell>{getComputePackageCreditTargetLabel(pkg.creditTarget)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={pkg.enabled ? "success" : "neutral"}>
                      {pkg.enabled ? "开启" : "关闭"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={pkg.onlineRecharge ? "success" : "neutral"}>
                      {pkg.onlineRecharge ? "启用" : "禁用"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-foreground hover:text-foreground"
                        onClick={() => handleToggleEnabled(pkg)}
                        disabled={togglingId === pkg.id}
                        title={pkg.enabled ? "关闭套餐" : "开启套餐"}
                        aria-label={pkg.enabled ? "关闭套餐" : "开启套餐"}
                      >
                        {togglingId === pkg.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : pkg.enabled ? (
                          <PowerOff className="w-4 h-4" />
                        ) : (
                          <Power className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary hover:text-primary"
                        onClick={() => navigate(`/ops/user-packages/${pkg.id}/edit`)}
                        title="编辑"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDelete(pkg.id)}
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
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
    </PageShell>
  );
}
