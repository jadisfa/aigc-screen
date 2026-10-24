import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Tooltip, Button } from "antd";
import { HistoryItem } from "@/utils/types/common";
import { RefreshCcw, Sparkles, CircleArrowDown, Trash2 } from "lucide-react";
import { useDrawSameStore } from "@/shared/hooks/use-draw-same";
import { batchDownloadImages } from '@/utils/download';
import { deleteDispatchSessionTask } from "@/shared/api/sys/scheduler";
import "@/assets/css/scss/workflow-common.scss";

interface TaskProps {
  task?: HistoryItem;
  custom?: boolean;
}

const TaskItemBottom: React.FC<TaskProps> = ({ task, custom }) => {
  const { setDrawSameWork } = useDrawSameStore();

  // 做同款
  const handleDrawSame = (task: HistoryItem | undefined) => {
    setDrawSameWork(task);
  }
  // 批量下载
  const downMultip = async(task: HistoryItem) => {
    await batchDownloadImages(task?.output)
  }
  // 再次生成
  const handleRegenerate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const value = JSON.stringify(task);
    console.log(value, JSON.parse(value)?.params, 32)
    window.dispatchEvent(
      new CustomEvent('regenerate', {
        detail: { value },
      })
    );
  };

  //删除当前任务
  const handleDeleteTask = async() => {
    const res = await deleteDispatchSessionTask({
      sessionId: task?.sessionId,
      taskId: task?.taskId,
      deleteWorkMaterial: false,
    })
     window.dispatchEvent(
      new CustomEvent('deleteTask', {
        detail: { res },
      })
    );
  }

  return (
    <>
      <div className="flex flex-row gap-[10px] h-[28px]">
        {/* 再次生成 */}
        <Tooltip title="再次生成">
          <Button
            type="default"
            icon={<RefreshCcw size={15} />}
            className="custom-default-btn bg-gray-200 hover:!bg-gray-300 hover:!border-gray-200 px-3 borderRadius8 h-[28px]"
            onClick={handleRegenerate}
          >
            <span className="text-xs">再次生成</span>
          </Button>
        </Tooltip>
        {/* 做同款 */}
        <Tooltip title="做同款">
          <Button
            type="default"
            icon={<Sparkles size={15} />}
            className="custom-default-btn bg-gray-200 hover:!bg-gray-300 hover:!border-gray-200 px-3 borderRadius8 h-[28px]"
            onClick={() =>  handleDrawSame(task)}
          >
            <span className="text-xs">做同款</span>
          </Button>
        </Tooltip>
        {/* 批量下载 */}
        <Tooltip title="批量下载">
          <Button
            type="default"
            icon={<CircleArrowDown size={15} />}
            className="custom-default-btn bg-gray-200 hover:!bg-gray-300 hover:!border-gray-200 px-3 borderRadius8 h-[28px]"
            onClick={() => downMultip(task)}
          >
            <span className="text-xs">批量下载</span>
          </Button>
        </Tooltip>
        {/* 删除 */}
        <Tooltip title="删除">
          <Button
            type="default"
            icon={<Trash2 size={15} />}
            className="custom-default-btn bg-gray-200 hover:!bg-gray-300 hover:!border-gray-200 px-3 borderRadius8 h-[28px]"
            onClick={handleDeleteTask}
          >
            <span className="text-xs">删除</span>
          </Button>
        </Tooltip>
      </div>
    </>
  );
};

export default TaskItemBottom;
