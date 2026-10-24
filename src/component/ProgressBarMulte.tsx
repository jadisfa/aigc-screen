/**
 * 多任务状态的进度条显示
 * @author Bobovinch
 * @since
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Progress } from 'antd';
import { useDispatchStream } from "@/modules/workflow/hooks/use-dispatch-stream";

interface ProgressBarMulteProps {
  id: string; // 任务ID
  showText: string;
  progress: number;
  taskStatus: string;
  single?: boolean;
  onDark?: boolean;
  enable?: boolean; // 支持 v-model 的双向绑定
  sessionId?: string;
  onEnableChange?: (value: boolean) => void;
}

const ProgressBarMulte: React.FC<ProgressBarMulteProps> = ({
  id,
  showText,
  progress,
  taskStatus,
  single = false,
  onDark = true,
  enable = true,
  sessionId,
  onEnableChange,
}) => {
  const darkTheme = "white";
//   const { localTasks } = storeToRefs(useStableDiffusionStore());

  // 计算任务项
//   const taskItem = useMemo(() => {
//     return localTasks.value.find((item: any) => item._id === id) || ({} as DrawTaskStatus);
//   }, [localTasks.value, id]);

  // 目标进度
//   const targetProgress = useMemo(() => {
//     const raw = Number(taskItem.progress ?? 0);
//     if (!Number.isFinite(raw)) return 0;
//     return Math.min(100, Math.max(0, raw));
//   }, [taskItem.progress]);

  // 显示的进度值
  const [displayedProgress, setDisplayedProgress] = useState(0);
  const progressAnimationFrameRef = useRef<number | undefined>(undefined);

  // 取消动画
  const cancelProgressAnimation = useCallback(() => {
    if (progressAnimationFrameRef.current === undefined) return;
    window.cancelAnimationFrame(progressAnimationFrameRef.current);
    progressAnimationFrameRef.current = undefined;
  }, []);



//   // 计算样式
  const useLightProgress = useMemo(() => onDark || darkTheme, [onDark, darkTheme]);

  const progressColor = useMemo(() => (useLightProgress ? 'white' : 'primary'), [useLightProgress]);

  const progressTextClass = useMemo(() => (useLightProgress ? 'text-white' : 'text-black'), [useLightProgress]);

  const messageClass = useMemo(() => (useLightProgress ? 'text-white/80' : ''), [useLightProgress]);

 // 进度文本
  const progressText = useMemo(() => {
    return `${Math.round(displayedProgress)}%`;
  }, [displayedProgress]);

  useEffect(() => {
    // 动画逻辑...
    setDisplayedProgress(progress);
  }, [progress]);

//   // 通知消息
//   const noticeMessage = useMemo(() => {
//     const t = (key: string) => key; // 替换为你的 i18n 函数

//     if (taskItem.queue && taskItem.queue > 0) {
//       return `${t('draw.currentQueue')}: ${taskItem.queue} ${t('draw.estimatedTime')}: ${taskItem.remainingTime}s`;
//     } else if (
//       taskItem.queue &&
//       taskItem.progress &&
//       taskItem.progress > 0 &&
//       taskItem.progress < 100
//     ) {
//       return `${t('draw.estimatedTime')}: ${taskItem.remainingTime}s`;
//     } else if (
//       taskItem.remainingTime === 0 &&
//       taskItem.progress === 100
//     ) {
//       return t('draw.drawSuccess');
//     } else if (taskItem.remainingTime && taskItem.remainingTime > 0) {
//       return t('draw.estimatedTime') + ': ' + taskItem.remainingTime + 's';
//     } else if (taskItem?.message) {
//       return taskItem.message;
//     }
//     return '';
//   }, [taskItem]);

  return (
    <div className={`flex flex-row justify-center align-center w-full h-full ${single ? 'task-result-media-progress' : 'aspect-square'}`}>
      <div className="text-center flex flex-col justify-center align-center text-center ">
        {taskStatus == 'failed' ? (
          <p
            style={{ display: enable ? 'block' : 'none' }}
            className={`text-caption font-weight-medium ${messageClass}`}
          >
            {/* $t("draw.taskFailed") */}
            { '生成失败'}
          </p>
        ) : (
          <p
            style={{ display: enable ? 'block' : 'none' }}
            className={`text-caption font-weight-medium ${messageClass}`}
          >
            <span>{`${showText}`}</span>
          </p>
        )}
        <div style={{ margin: '8px 0' }} /> {/* v-spacer 的替代 */}
       <Progress className='mx-auto' type="circle" size={50} strokeWidth={3} percent={displayedProgress} format={() => {return <><span className={`text-xs ${progressTextClass}`}>{progressText}</span>  </>}} />
      </div>
    </div>
  );
};

export default ProgressBarMulte;