import React, { useState, useEffect, useMemo, useCallback } from 'react';

type FileType = 'image' | 'video' | 'unknown';

interface MediaSizeTextProps {
  src: string;
  type?: FileType;
  /** bottom-center：节点底部居中（默认）；bottom-end：右下角；tile-bottom-center：媒体块底部居中 */
  placement?: 'bottom-center' | 'bottom-end' | 'tile-bottom-center';
}

// 从 URL 获取媒体信息（需要根据实际项目调整）
const getMediaInfoFromUrl = (url: string): { fileType: FileType } => {
  // 简单判断：根据文件扩展名
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || '';
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v'];
  
  if (imageExts.includes(ext)) return { fileType: 'image' };
  if (videoExts.includes(ext)) return { fileType: 'video' };
  return { fileType: 'unknown' };
};

// 获取图片尺寸
const getImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.src = src;
  });
};

// 获取视频尺寸
const getVideoDimensions = (src: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };
    video.src = src;
  });
};

const MediaSizeText: React.FC<MediaSizeTextProps> = ({
  src,
  type,
  placement = 'bottom-center',
}) => {
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  // 获取媒体尺寸
  const fetchDimensions = useCallback(async (url: string) => {
    if (!url) return;

    let { fileType } = getMediaInfoFromUrl(url);
    if (fileType === 'unknown' && type) {
      fileType = type;
    }

    try {
      if (fileType === 'image') {
        const size = await getImageDimensions(url);
        setWidth(size.width);
        setHeight(size.height);
      } else if (fileType === 'video') {
        const size = await getVideoDimensions(url);
        setWidth(size.width);
        setHeight(size.height);
      }
    } catch (error) {
      console.warn('Failed to get media dimensions:', error);
    }
  }, [type]);

  // 监听 src 变化
  useEffect(() => {
    fetchDimensions(src);
  }, [src, fetchDimensions]);

  // 格式化尺寸文本
  const showSizeText = useMemo(() => {
    if (!width || !height) return '';
    return `${width}x${height}`;
  }, [width, height]);

  // 计算位置类名
  const placementClass = useMemo(() => {
    if (placement === 'bottom-end') {
      return 'bottom-1 right-1 text-right';
    }
    if (placement === 'tile-bottom-center') {
      return 'bottom-1 left-1/2 -translate-x-1/2 text-center';
    }
    // bottom-center (默认)
    return 'bottom-0 right-[50%] mx-auto translate-x-[50%] text-center';
  }, [placement]);

  if (!showSizeText) return null;

  return (
    <span
      className={`z-20 text-gray-200 dark:text-gray-300 bg-neutral-500/50 px-1 py-0.5 rounded opacity-0 group-hover:!opacity-100 transition-opacity duration-200 absolute text-xs ${placementClass}`}
    >
      {showSizeText}
    </span>
  );
};

export default MediaSizeText;