// ImageToText.tsx
import React, { forwardRef } from 'react';
import imageToTextIcon from '@/assets/svg/image-to-text.svg';

interface ImageToTextProps {
  data: any;
  className?: string;
  style?: React.CSSProperties;
  url?: string
}

const ImageToText = forwardRef<HTMLDivElement, ImageToTextProps>(
  ({ data, className = '', style = {}, url }, ref) => {
    const handleImageToText = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const value = JSON.stringify(data);
      window.dispatchEvent(
        new CustomEvent('imageToText-set', {
          detail: { value, url },
        })
      );
    };

    return (
      <div
        ref={ref}
        className={`image-to-text ${className}`}
        onClick={handleImageToText}
        style={{
          width: '32px',
          height: '32px',
          padding: '8px',
          cursor: 'pointer',
          ...style,
        }}
      >
        <img
          src={imageToTextIcon}
          alt="image-to-text"
          style={{ width: '16px', height: '16px' }}
        />
      </div>
    );
  }
);

ImageToText.displayName = 'ImageToText';

export default ImageToText;