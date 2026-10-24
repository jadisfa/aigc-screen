// Filter.tsx
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { Dropdown, Menu, MenuProps, Button, Tooltip } from "antd";
import { getDateRange, toggleItem } from "@/utils/common";
import { DeleteFilled, CloseCircleOutlined } from '@ant-design/icons';
import { RotateCw, Layers } from "lucide-react";

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

const DrawRecordAction: React.FC<FilterProps> = ({ onFilterChange }) => {
  const [visible, setVisible] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [filterCondition, setFilterCondition] = useState<FilterCondition>({});

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

  // 切换下拉可见性
  const toggleVisible = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setVisible(!visible);
    },
    [visible],
  );

  const handleSetCondition = (type: 'deleteFailed' | 'clearWorkspace' | 'refreshStatus') => {
    const newCondition: FilterCondition = { ...filterCondition, type };
    setFilterCondition(newCondition);
    onFilterChange?.(newCondition);
    setVisible(false); // 关闭下拉
  }


  return (
    <div ref={dropdownRef} className="inline-block relative">
      {/* 触发按钮 */}
      <div
        className="cursor-pointer flex items-center p-1 pt-2 bg-theme-surface 
        hover:bg-theme-hover-surface rounded-lg gap-1 text-sm select-none relative"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleVisible}
      >
        <Layers size={18} />
      </div>

      {/* 下拉层 */}
      {visible && (
        <div className="absolute right-0 mt-2 z-50 bg-white dark:bg-gray-800 p-3 rounded-lg flex flex-col gap-3 w-48 
        shadow-lg border border-gray-200 dark:border-gray-700">
            <Button type="default" className="flex items-center bg-gray-100 text-gray-500 border-0 
            justify-start gap-1 hover:!bg-gray-100 hover:!border-0 hover:!text-gray-700" 
                onClick={() =>handleSetCondition('deleteFailed')} icon={<DeleteFilled />}
            >
              删除失败任务
            </Button>
            <Button type="default" className="flex items-center bg-gray-100 text-gray-500 border-0 
            justify-start gap-1 hover:!bg-gray-100 hover:!border-0 hover:!text-gray-700" 
                onClick={() =>handleSetCondition('clearWorkspace')} icon={<CloseCircleOutlined />}>
              清空工作区
            </Button>
            <Button type="default" className="flex items-center bg-gray-100 text-gray-500 border-0 
            justify-start gap-1 hover:!bg-gray-100 hover:!border-0 hover:!text-gray-700" 
                onClick={() =>handleSetCondition('refreshStatus')} icon={<RotateCw size={15} />}>
              刷新任务状态
            </Button>
        </div>
      )}
    </div>
  );
};

export default DrawRecordAction;
