import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

type CommonPaginationBarProps = {
  total: number;
  pageNo: number;
  pageSize: number;
  canNextPage: boolean;
  onPageNoChange: (nextPageNo: number) => void;
  onPageSizeChange: (nextPageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  showLastButton?: boolean;
  showPageSizeSelect?: boolean;
  disabled?: boolean;
};

export default function CommonPaginationBar(props: CommonPaginationBarProps) {
  const total = Math.max(0, props.total || 0);
  const pageSizeOptions = props.pageSizeOptions && props.pageSizeOptions.length > 0 ? props.pageSizeOptions : [10, 20, 50];
  const showLastButton = props.showLastButton === true;
  const showPageSizeSelect = props.showPageSizeSelect !== false;
  const disabled = props.disabled === true;
  const lastPageNo = Math.max(1, Math.ceil(total / Math.max(1, props.pageSize)));
  const baseClassName = "flex items-center justify-end mt-4 gap-3 text-sm text-muted-foreground";
  const containerClassName = props.className ? `${baseClassName} ${props.className}` : baseClassName;

  return (
    <div className={containerClassName}>
      <span>共 {total} 条</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={disabled || props.pageNo === 1} onClick={() => props.onPageNoChange(1)}>
          {"<<"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || props.pageNo === 1}
          onClick={() => props.onPageNoChange(Math.max(1, props.pageNo - 1))}
        >
          {"<"}
        </Button>
        <Button variant="ghost" size="sm" disabled={disabled || !props.canNextPage} onClick={() => props.onPageNoChange(props.pageNo + 1)}>
          {">"}
        </Button>
        {showLastButton && (
          <Button variant="ghost" size="sm" disabled={disabled || !props.canNextPage} onClick={() => props.onPageNoChange(lastPageNo)}>
            {">>"}
          </Button>
        )}
      </div>
      <span>
        第 {props.pageNo} 页 / 每页 {props.pageSize} 条
      </span>

      {showPageSizeSelect && (
        <div className="subpage-toolbar-end">
          <Select
            value={String(props.pageSize)}
            onValueChange={(v) => {
              props.onPageSizeChange(Number(v));
            }}
            disabled={disabled}
          >
            <SelectTrigger className="subpage-native-select w-24 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} className="subpage-select-item" value={String(option)}>
                  {option}/页
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
