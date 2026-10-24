import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { formatDateTime } from "@/shared/lib/datetime";
import { Sparkles } from "lucide-react";
import { HistoryItem } from "@/utils/types/common";
import type { Param } from "@/utils/comfyuiApi";
import HoverImageStack from "@/modules/backendCenter/component/hover-Image-task";

interface TaskProps {
  task?: HistoryItem;
  custom?: boolean;
}

const TaskItemTop: React.FC<TaskProps> = ({ task, custom }) => {
  const taskImages = [
    "image_path",
    "image_first_frame",
    "image_last_frame",
    "multi_source_image_path",
  ].reduce<string[]>((acc, key) => {
    const value = task?.params[key as keyof Param];
    if (value !== undefined) {
      acc.push(value as string);
    }
    return acc;
  }, []);


  return (
    <>
      <div className="flex flex-row gap-[10px]">
        <HoverImageStack images={taskImages} />
        <div className="flex-1">
          <div className="flex flex-row gap-[4px] items-center">
            <Sparkles size={12} className="" />
            <span className="text-sm text-[#4b5563]">
              {task?.params?.workflow_name}
            </span>
            <span className="mx-2">|</span>
            <span className="text-sm text-[#4b5563]">
              {formatDateTime(task?.startedAt)}
            </span>
            <span className="mx-2">|</span>
            {/* 显示所选参数名称；风格、甲量、甲型、提示词选择、视频质量、时长 */}
            {task?.params?.info && (
              <>
                {task?.params?.info?.style && (
                  <>
                    <span className="text-sm text-[#4b5563]">
                      {task?.params?.info?.style}
                    </span>
                    <span className="mx-2">|</span>
                  </>
                )}
                {task?.params?.info?.nailNum && (
                  <>
                    <span className="text-sm text-[#4b5563]">
                      {task?.params?.info?.nailNum}
                    </span>
                    <span className="mx-2">|</span>
                  </>
                )}
                {task?.params?.info?.modal_title && (
                  <>
                    <span className="text-sm text-[#4b5563]">
                      {task?.params?.info?.modal_title}
                    </span>
                    <span className="mx-2">|</span>
                  </>
                )}
                {task?.params?.info?.positive && (
                  <>
                    <span className="text-sm text-[#4b5563]">
                      {task?.params?.info?.positive}
                    </span>
                    <span className="mx-2">|</span>
                  </>
                )}
                {task?.params?.info?.quality && (
                  <>
                    <span className="text-sm text-[#4b5563]">
                      {task?.params?.info?.quality}
                    </span>
                    <span className="mx-2">|</span>
                  </>
                )}
                {task?.params?.info?.time && (
                  <>
                    <span className="text-sm text-[#4b5563]">
                      {task?.params?.info?.time}
                    </span>
                    <span className="mx-2">|</span>
                  </>
                )}
              </>
            )}
            <span className="text-sm text-[#4b5563]">
              {task?.params?.aspect_ratio}
            </span>
          </div>
          <div className="task-prompt text-sm max-h-[3.6rem] leading-5 overflow-hidden hover:overflow-auto hover:max-h-[40vh]">
            {task?.params?.positiveCN || task?.params?.positive}
          </div>
        </div>
      </div>
    </>
  );
};

export default TaskItemTop;
