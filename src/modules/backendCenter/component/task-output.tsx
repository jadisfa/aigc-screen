import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Image, Tooltip  } from "antd";
import { LoadingOutlined } from '@ant-design/icons';
import { HistoryItem } from "@/utils/types/common";
import { createFilledArray } from "@/utils/common";
import { useDispatchStream } from "@/modules/workflow/hooks/use-dispatch-stream";
import HoverImageStack from "@/modules/backendCenter/component/hover-Image-task";
import TaskResultMediaStage from "@/component/TaskResultMediaStage";
import ProgressBarMulte from "@/component/ProgressBarMulte";
import MediaWithWatermark from "@/component/MediaWithWatermark";
import MediaSizeText from "@/component/MediaSizeText";
import CommonViewImgComparisonBtnHover from "@/component/ViewImgComparisonBtnHover";
import DownLoadButtonHover from "@/component/DownLoadButtonHover";
import ImageToText from "@/component/imageToText";
import ImageToVideo from "@/component/imageToVideo";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDuration } from "@/utils/common";
import WorkPreviewDialog from "./work-preview-dialog";
import {
  listWorkflows,
  getWorkflowConfigById,
  getWorkflowConfigByVersionId,
} from "@/shared/api/workflow/workflow";
import {
  listWorkflowVersions,
  getWorkflowVersion,
} from "@/shared/api/workflow/workflow-version";
import { fetchAllPagesConcurrent } from "@/utils/fetchAll";
import "@/assets/css/scss/task-result-media-stage.scss";

interface TaskOutputProps {
  task?: HistoryItem;
  custom?: boolean;
  sessionId?: string
}

interface Output {
  [key:string]: string
}
interface TaskOutput {
  type: string,
  list: Output[]
}


const useRemainingTime = (
  startedAt?: string,
  submittedAt?: string,
  etaSeconds?: number,
  progress?: number,
  generateTimeSec?: number,
  expectedImageCount?: number
): { remainingSeconds: number; totalEta: number; elapsedSec: number } => {
  const [now, setNow] = useState(Date.now());

  // 每秒更新一次
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startStr = startedAt || submittedAt;
  const start = startStr ? Date.parse(startStr) : Date.now();
  const elapsedSec = Math.max(0, (now - start) / 1000);

  let totalEta = etaSeconds || 60;

  // 如果有生成时间和预期图片数量，计算更精确的总耗时
  if (generateTimeSec && generateTimeSec > 0 && expectedImageCount && expectedImageCount > 0) {
    // 根据进度调整总耗时估算
    if (progress && progress > 0) {
      // 如果已有进度，按当前进度反推总耗时
      const estimatedTotal = elapsedSec / (progress / 100);
      totalEta = Math.max(totalEta, estimatedTotal);
    } else {
      totalEta = generateTimeSec * expectedImageCount;
    }
  }

  // 计算剩余时间，至少保留1秒（除非进度已达100%）
  const remaining = progress && progress >= 100 ? 0 : Math.max(1, Math.round(totalEta - elapsedSec));

  return { remainingSeconds: remaining, totalEta, elapsedSec };
};

const TaskOutput: React.FC<TaskOutputProps> = ({ task, custom, sessionId }) => {
  const [taskOutput, setTaskOutput] = useState<TaskOutput | null>(null)
  const [visibleOpen, setVisibleOpen] = useState(false);
  const [clickIndex, setClickIndex] = useState<number | null>(null);
  const previewTask = useRef<HistoryItem | null>(null); // 预览所需task

  // 判断是否需要请求socket
  const shouldEnableStream = useMemo(() => {
    return task?.status === 'running' && !!task?.taskId && !!sessionId;
  }, [task?.status, task?.taskId, sessionId]);

   const {
    detail: dispatchDetail,
    streamMode,
    streamHint,
    reset: resetDispatchStream,
  } = useDispatchStream({
    taskId: shouldEnableStream ? task?.taskId || '' : '',
    sessionId: shouldEnableStream ? sessionId : ''
  });

  // 输出信息的个数
  // const outputLength = useCallback(() => {
  //   const cols =
  //     task?.status == "failed" || task?.status == 'running'
  //       ? task?.params?.batch_size
  //       : task?.output?.length;
  //       return cols;
  // }, [task])

  const mergedTask = useMemo(() => {
    if (!dispatchDetail || !shouldEnableStream) return task;
    return {
      ...task,
      // 用 WebSocket 数据覆盖进度
      progress: dispatchDetail.progress ?? task?.progress,
      // 用 WebSocket 数据覆盖状态（如果有更细粒度的事件）
      status: dispatchDetail.status ?? task?.status,
      // 其他需要合并的字段
      queuePosition: dispatchDetail.queuePosition ?? task?.queuePosition,
      etaSeconds: dispatchDetail.etaSeconds ?? task?.etaSeconds,
      errorMessage: dispatchDetail.errorMessage ?? task?.errorMessage,
      assets: dispatchDetail.assets ?? dispatchDetail.assets,
      output: JSON.parse(dispatchDetail?.outputJson).items,
      ...dispatchDetail
    };
  }, [task, dispatchDetail, shouldEnableStream]);

  // 3. 将 mergedTask 传递给子组件
  const outputLength = useMemo(() => {
    if (mergedTask?.status === 'failed' || mergedTask?.status === 'running') {
      return mergedTask?.params?.batch_size || 1;
    }
    return mergedTask?.output?.length || 0;
  }, [mergedTask]);

  const generateTimePerItem = useMemo(() => {
    // 从 task 的 params 或 workflow 中获取预计生成时间
    // 具体字段根据你的数据结构调整
    return mergedTask?.etaSeconds || 30; // 默认30秒
  }, [mergedTask]);

  // ========== 5. 使用剩余时间 Hook ==========
  const { remainingSeconds, totalEta, elapsedSec } = useRemainingTime(
    mergedTask?.startedAt,
    mergedTask?.submittedAt,
    mergedTask?.etaSeconds,
    mergedTask?.progress,
    generateTimePerItem,
    outputLength
  );

  // ========== 6. 格式化显示文本 ==========
  const showText = useMemo(() => {
    const progress = mergedTask?.progress || 0;
    
    if (progress >= 100) {
      return '即将完成';
    }
    
    if (mergedTask?.status === 'queued') {
      return `排队中... 剩余 ${formatDuration(remainingSeconds * 1000)}`;
    }
    
    if (mergedTask?.status === 'running') {
      return `预估剩余 ${formatDuration(remainingSeconds * 1000)}`;
    }
    
    return `预估剩余 ${formatDuration(remainingSeconds * 1000)}`;
  }, [mergedTask?.status, mergedTask?.progress, remainingSeconds]);

     useEffect(() => {
      if (mergedTask.status === 'succeeded') {
      setTaskOutput({
        type: mergedTask?.assets[0]?.kind,
        list: mergedTask?.assets.map((item, index) => {
          return {
            ...item, 
            url: item?.textContent
          }
        })
      })
      // 可以在这里触发完成后的逻辑
    }
    
  }, [mergedTask]);

  const isSingleBlurredMediaOutput = useMemo(() => {
    return taskOutput?.type == 'image' || taskOutput?.type == 'video' && taskOutput?.list?.length == 1
  }, [taskOutput])

const getDragSourceFromEvent = (e: DragEvent) => {
  const target = e.target as HTMLImageElement | HTMLVideoElement | null
  return target?.currentSrc || target?.src || ''
}

const handleDragStart = (e: DragEvent, url?: string) => {
  const dragUrl = url || getDragSourceFromEvent(e)
  if (!dragUrl || !e.dataTransfer) return

  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('text/plain', dragUrl)
  e.dataTransfer.setData('text/uri-list', dragUrl)
}

const getInputImagePath = (task) => {
  return task?.params?.image_path || ""
}

const handleClickItem = async(index: number) => {
  // console.log(`点击了第 ${index} 个输出项`, task, taskOutput?.type);
  if (taskOutput?.type == 'text') return ;
  const {items} = await listWorkflowVersions({
    pageNo: 1,
    pageSize: 50,
    workflowId: task?.appId || task?.app?.id});
  const filterVision = items.filter((item) => item.id == task?.workflowVersionId);
  const { workflow: newWorkflow, version: versionConfig } =
      await getWorkflowConfigById({ appId: task?.appId || task?.app?.id, currentVersionNo: filterVision[0]?.versionNo });
  previewTask.current = {
    ...task,
    workType: taskOutput?.type,
    workflow: newWorkflow,
  }
  setClickIndex(index);
  setVisibleOpen(true);
}

  return (
    <>
      <div className="w-full">
        <div className={`grid gap-1 mt-2 grid-cols-${Math.min(outputLength, 4)}`}>
          {/* { task?.status != "succeeded" && createFilledArray(outputLength()).map((outputItem, outputIndex) => {
            return (
              <TaskResultMediaStage single={outputLength() == 1} loading={outputLength()  } key={outputIndex}>
                <ProgressBarMulte id={task?.taskId} single={outputLength() == 1} on-dark={outputLength() == 1} sessionId={sessionId} taskStatus={task?.status || 'running'} />
              </TaskResultMediaStage>
            )
          }) } */}
          {mergedTask?.status != "succeeded" && createFilledArray(outputLength).map((_, index) => {
          const isSingle = outputLength === 1;
          return (
            <TaskResultMediaStage 
              key={`${index}grid`} 
              status={mergedTask?.status}
              single={isSingle} 
              loading={mergedTask?.status != "successed"}
            >
              <ProgressBarMulte 
                  id={mergedTask?.taskId || ''} 
                  single={isSingle} 
                  onDark={false} 
                  showText={showText}
                  progress={mergedTask?.progress || 0}
                  taskStatus={mergedTask?.status }
                />
            </TaskResultMediaStage>
          );
        })}
        {/* 成功展示 */}
        {mergedTask?.status == "succeeded" && taskOutput && taskOutput?.list.map((taskItem, taskIndex) => {
          const isSingle = outputLength === 1;
          return (
            <React.Fragment key={`${taskIndex}${taskItem?.url}`}>
              <TaskResultMediaStage status={mergedTask?.status} single={isSingle} loading={false} type={taskOutput.type} src={taskItem.url} 
              onClick={() => {handleClickItem(taskIndex)}}
              >
                {taskOutput.type == "image" && taskItem.url && (
                  <>
                    <MediaWithWatermark
                      className={`w-full h-full ${isSingleBlurredMediaOutput ? 'task-result-media-foreground' : ''}`}
                      showWatermark={false}
                      watermarkText="AI生成"
                      offset={0}
                    >
                      {/* <Image
                        key={taskItem.url}
                        src={taskItem.url}
                        alt=""
                        preview={false}
                        draggable
                        className={`cursor-pointer custom-img rounded task-result-media-image !object-contain ${
                          isSingleBlurredMediaOutput ? 'task-result-media-image--contain' : ''
                        }`}
                        // onDragStart={(e) => handleDragStart(e, taskItem.url)}
                        // onClick={() => handleClickFullScreen(task, taskIndex)}
                        placeholder={
                          <div className="flex items-center justify-center w-full h-full">
                            <LoadingOutlined style={{ fontSize: 24, color: '#ccc' }} />
                          </div>
                        }
                      /> */}
                      <img key={taskItem.url} className={`cursor-pointer rounded task-result-media-image !object-contain ${
                          isSingleBlurredMediaOutput ? 'task-result-media-image--contain' : ''
                        }`}
                        src={taskItem.url} />
                    </MediaWithWatermark>
                    {
                      (taskOutput.type == "image" || taskOutput.type == "video") && (
                        <MediaSizeText  src={taskItem?.url} placement="bottom-center" />
                      )
                    }
                    <div
                      className="absolute top-2 right-2 z-20 flex opacity-0 group-hover:!opacity-100 transition-opacity duration-200 bg-theme-surface rounded ndmy-bg"
                    >
                      {(taskOutput.type == "image" && getInputImagePath(mergedTask) ) && (
                        <CommonViewImgComparisonBtnHover input={getInputImagePath(mergedTask)} output={taskItem?.url} />
                      )}
                      <Tooltip title="下载">
                        <DownLoadButtonHover output={taskItem.url} />
                      </Tooltip>
                      <Tooltip title="图转文">
                        <ImageToText data={mergedTask} url={taskItem?.url} />
                      </Tooltip>
                       <Tooltip title="图转视频">
                        <ImageToVideo data={mergedTask} index={taskIndex} />
                      </Tooltip>
                    </div>
                  </>
                )}
                {taskOutput.type == 'text' && (
                  <div className="max-w-none break-words text-[14px] leading-7 text-foreground/95 [&_h1]:mt-6 [&_h1]:mb-4 [&_h1]:font-semibold [&_h1]:text-[20px] [&_h1]:leading-8 [&_h2]:mt-6 [&_h2]:mb-4 [&_h2]:font-semibold [&_h2]:text-[18px] [&_h2]:leading-8 [&_h3]:mt-5 [&_h3]:mb-3 [&_h3]:font-semibold [&_h3]:text-[16px] [&_h3]:leading-7 [&_h4]:mt-5 [&_h4]:mb-3 [&_h4]:font-semibold [&_h4]:text-[15px] [&_h4]:leading-7 [&_p]:my-3 [&_p]:leading-7 [&_a]:text-primary hover:[&_a]:underline [&_strong]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_li]:leading-7 [&_hr]:hidden [&_code]:rounded-sm [&_code]:bg-muted/40 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.92em] [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted/50 [&_pre]:px-4 [&_pre]:py-3 [&_pre>code]:bg-transparent [&_pre>code]:p-0 [&_pre>code]:text-inherit [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/25 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {taskItem?.textContent || ""}
                    </ReactMarkdown>
                  </div>
                  
                )}
              </TaskResultMediaStage>
            </React.Fragment>
          )
        })}
        </div>
      </div>
      {
        visibleOpen && <WorkPreviewDialog task={previewTask.current} visible={visibleOpen} close={() => setVisibleOpen(false)} itemIndex={clickIndex} />
      }
    </>
  );
};

export default TaskOutput;
