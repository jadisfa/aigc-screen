// Filter.tsx
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { Dropdown, Menu, MenuProps } from "antd";
import {
  Filter,
  RotateCw,
  CalendarDays,
  ChevronDown,
  CircleX,
  Check,
} from "lucide-react";
import { getDateRange, toggleItem } from "@/utils/common";
// import DownloadToLocalFile from '~/components/aiDraw/Record/DownloadToLoalFile';

// 类型定义
interface DateRange {
  key: string;
  label: string;
  begin: number;
  end?: number;
}

export interface FilterCondition {
  dateRange?: DateRange | null;
  outputType?: string[] | null;
  type?: 'deleteFailed' | 'clearWorkspace' | 'refreshStatus'; // 新增 type 字段
}

interface TaskOutput {
  type: string;
  url?: string;
  [key: string]: any;
}

interface Task {
  output_content?: TaskOutput[];
  output?: string[];
  [key: string]: any;
}

interface FilterProps {
  onFilterChange?: (condition?: FilterCondition) => void;
}

// 日期范围列表
const dateRangeList: DateRange[] = [
  { key: 'today', label: "今天", begin: getDateRange(0).start, end: getDateRange(0).end },
  {
    key: 'yesterday',
    label: "昨天",
    begin: getDateRange(1).start,
    end: getDateRange(1).end,
  },
  {
    key: 'last_week',
    label: "前天至最近一周",
    begin: getDateRange(9).start,
    end: getDateRange(2).end,
  },
  {
    key: 'last_month',
    label: "一周前至一个月",
    begin: getDateRange(29).start,
    end: getDateRange(6).end,
  },
  {
    key: 'last_three_months',
    label: "一月前至三个月",
    begin: getDateRange(89).start,
    end: getDateRange(29).end,
  },
];

const outputTypeList = [
  { label: "图片", value: "image" },
  { label: "视频", value: "video" },
  { label: "文案", value: "text" },
];

const DrawRecordFilter: React.FC<FilterProps> = ({ onFilterChange }) => {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [filterCondition, setFilterCondition] = useState<FilterCondition>({});

  const selectedDateRangeLabel = useMemo(() => {
    return filterCondition.dateRange?.label || "选择时间";
  }, [filterCondition.dateRange]);

  // 是否没有筛选条件（用于显示小红点）
  const noFilterCondition = useMemo(() => {
    return !filterCondition.dateRange && !filterCondition.outputType;
  }, [filterCondition.dateRange, filterCondition.outputType]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setVisible(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 选择时间
  const handleSelectDateRange = (date) => {
    const newFilterCondition = {
      ...filterCondition,
      dateRange: {
        label: date?.label,
        begin: date?.begin,
        end: date?.end,
        key: date?.key
      },
    };
    setFilterCondition(newFilterCondition);
    onFilterChange(newFilterCondition);
  };

  // 重置筛选条件
  const handleRestCondition = useCallback(() => {
    onFilterChange();
    setFilterCondition({});
  }, [onFilterChange]);

  // 切换下拉可见性
  const toggleVisible = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setVisible(!visible);
    },
    [visible],
  );

  // 日期菜单项
  const dateMenuItems: MenuProps["items"] = dateRangeList.map((date) => ({
    key: date.key,
    label: (
      <div
        className="text-sm flex flex-col flex-end w-full"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
          handleSelectDateRange(date);
          // 不自动关闭，让用户选择后手动关闭或保持
        }}
      >
        <span>{date.label}</span>
      </div>
    ),
  }));

  const handleClick = () => {
    setOpen(!open);
  };

  const handleClearDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newFilterCondition = (filterCondition?.outputType ?? []).length > 0
      ? {
          outputType: filterCondition?.outputType,
        }
      : {};
      // console.log(newFilterCondition, 177)
    setFilterCondition(newFilterCondition);
    onFilterChange(newFilterCondition);
  };

  const handleSelectOutputType = (val: string) => {
    const outputData = toggleItem(filterCondition?.outputType || [], val);
    const newFilterCondition = {
      ...filterCondition,
      outputType: outputData,
    };
    setFilterCondition(newFilterCondition);
    if (outputData.length > 0) {
      onFilterChange(newFilterCondition);
    } else {
      onFilterChange();
    }
    
  };

  return (
    <div ref={dropdownRef} className="inline-block relative">
      {/* 触发按钮 */}
      <div
        className="cursor-pointer flex items-center p-1 pt-2 bg-theme-surface hover:bg-theme-hover-surface rounded-lg gap-1 text-sm select-none relative"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleVisible}
      >
        <Filter size={20} />
        {!noFilterCondition && (
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute -top-0.5 -right-0.5" />
        )}
      </div>

      {/* 下拉层 */}
      {visible && (
        <div className="absolute right-0 mt-2 z-50 bg-white dark:bg-gray-800 p-3 rounded-lg flex flex-col gap-3 w-48 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="font-bold flex justify-between items-center">
            <span>筛选</span>
            <RotateCw
              className="cursor-pointer"
              size={20}
              onClick={handleRestCondition}
            />
          </div>

          {/* 日期选择 */}
          <Dropdown
            menu={{ items: dateMenuItems, selectable: true, selectedKeys: [filterCondition?.dateRange?.key || ""] }}
            trigger={["click"]}
            open={open}
            placement="bottomRight"
            getPopupContainer={() => dropdownRef.current || document.body}
          >
            <div
              className="flex justify-between items-center gap-1 bg-gray-100 dark:bg-gray-100 p-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              onClick={handleClick}
            >
              <CalendarDays size={20} />
              <span className="text-sm">{selectedDateRangeLabel}</span>
              {!filterCondition.dateRange && <ChevronDown size={20} />}
              {filterCondition.dateRange && (
                <CircleX size={20} onClick={handleClearDate} />
              )}
            </div>
          </Dropdown>

          {/* 类型选择 */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-light text-gray-500 dark:text-gray-400">
              生成类型
            </div>
            <div className="grid grid-cols-2 gap-2">
              {outputTypeList.map((outputType) => (
                <div
                  key={outputType.value}
                  className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg cursor-pointer flex justify-between items-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  onClick={() => handleSelectOutputType(outputType.value)}
                >
                  <span className="text-sm">{outputType.label}</span>
                  {filterCondition.outputType?.includes(outputType.value) && (
                    <Check size={15} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrawRecordFilter;
