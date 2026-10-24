import React, { useEffect, useMemo, useRef } from 'react';
import '@/assets/css/scss/task-result-media-stage.scss'; // 将原样式移入 scss 文件

interface TaskResultMediaStageProps {
  src?: string;
  type?: string;
  status?:string;
  single?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
}

const TaskResultMediaStage: React.FC<TaskResultMediaStageProps> = ({
  src = '',
  type = '',
  status,
  single = false,
  loading = false,
  children,
  onClick
}) => {

  const videoRef = useRef<HTMLVideoElement>(null);
  const isBackdropImage = useMemo(
    () => single && type === 'image' && Boolean(src),
    [single, type, src]
  );

  const isBackdropVideo = useMemo(
    () => single && type === 'video' && Boolean(src),
    [single, type, src]
  );

  const stageClassName = useMemo(() => {
    const classes = ['task-result-media-stage'];
    if (single) classes.push('task-result-media-stage--single');
    if (loading) classes.push('task-result-media-stage--loading');
    return classes.join(' ');
  }, [single, loading]);

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }

  return (
    <div className={`flex justify-center align-center relative group w-full rounded-lg ${type != 'text' && status != 'succeeded' ? stageClassName : 'flex-col'} ${single ? '' : (status != "succeeded" ? 'min-h-64' : "")} ${type == 'video' ? 'aspect-[16/9] overflow-hidden' : ''}`}
      onClick={onClick}
    >
      {isBackdropImage && (
        <img
          aria-hidden="true"
          className="task-result-media-stage__backdrop"
          src={src}
          alt=""
        />
      )}
      {isBackdropVideo && (
        <video
          ref={videoRef}
          aria-hidden="true"
          controls
          muted
          loop
          playsInline
          tabIndex={1}
          className="task-result-media-stage__backdrop video"
          src={src}
          onMouseLeave={handleMouseLeave}
        />
      )}
      {children}
    </div>
  );
};

export default TaskResultMediaStage;