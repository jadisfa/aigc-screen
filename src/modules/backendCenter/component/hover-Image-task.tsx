// HoverImageStack.tsx
import React, { useState, useMemo } from "react";

interface HoverImageStackProps {
  images: string[];
  width?: number;
  offset?: number;
}

const HoverImageStack: React.FC<HoverImageStackProps> = ({
  images,
  width = 35,
  offset = 45,
}) => {
  const [isHover, setIsHover] = useState(false);

  const height = useMemo(() => width * (4 / 3), [width]);

  const getAngle = (index: number) =>
    index % 2 === 0 ? -10 - index * 2 : 10 + index * 2;

  const itemStyles = useMemo(() => {
    return images.map((_, index) => {
      const angle = getAngle(index);
      return {
        transform: isHover
          ? `translateX(${index * offset}px) rotate(${angle}deg)`
          : `translateX(0px) rotate(${angle}deg)`,
        zIndex: index + 1,
      };
    });
  }, [images, isHover, offset]);

  return (
    <div
      className="relative cursor-pointer m-2 group"
      style={{ width, height }}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    >
      {images.map((url, index) => (
        <div
          key={index}
          className="absolute top-0 left-0 transition-transform duration-300 ease-in-out"
          style={{
            ...itemStyles[index],
            width,
            height,
          }}
        >
          <img
            src={url}
            alt={`img-${index}`}
            className="w-full h-full rounded shadow-lg object-cover object-center group-hover:scale-105"
          />
        </div>
      ))}
    </div>
  );
};

export default HoverImageStack;
