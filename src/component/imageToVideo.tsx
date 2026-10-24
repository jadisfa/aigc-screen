// ImageToVideo.tsx
import React, { forwardRef } from 'react';
import imageToVideoIcon from '@/assets/svg/image-to-video.svg';

interface ImageToVideoProps {
  data: any;
  index: number;
  className?: string;
  style?: React.CSSProperties;
}

const ImageToVideo = forwardRef<HTMLDivElement, ImageToVideoProps>(
  ({ data, index, className = '', style = {} }, ref) => {
    const handleImageToVideo = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const propsData = { ...data, activeIndex: index };
      const value = JSON.stringify(propsData);
      window.dispatchEvent(
        new CustomEvent('imageToVideo-set', {
          detail: { value },
        })
      );
    };

    return (
      <div
        ref={ref}
        className={`image-to-video ${className}`}
        onClick={handleImageToVideo}
        style={{
          width: '32px',
          height: '32px',
          padding: '8px',
          cursor: 'pointer',
          ...style,
        }}
      >
        <img
          src={imageToVideoIcon}
          alt="image-to-video"
          style={{ width: '16px', height: '16px' }}
        />
      </div>
    );
  }
);

ImageToVideo.displayName = 'ImageToVideo';

export default ImageToVideo;