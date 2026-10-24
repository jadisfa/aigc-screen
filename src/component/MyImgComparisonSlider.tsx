import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { ImgComparisonSlider } from '@img-comparison-slider/react';
import { Tooltip } from 'antd';
import { ExpandOutlined } from '@ant-design/icons';

interface MyImgComparisonSliderProps {
  inputImg: string;
  outputImg: string;
  autoSwitch?: boolean;
}

export interface MyImgComparisonSliderRef {
  startAutoSwitch: () => void;
  stopAutoSwitch: () => void;
}

const MyImgComparisonSlider = forwardRef<MyImgComparisonSliderRef, MyImgComparisonSliderProps>(
  ({ inputImg, outputImg, autoSwitch = true }, ref) => {
    const [sliderValue, setSliderValue] = useState(30);
    const [outputSize, setOutputSize] = useState({ width: 0, height: 0 });
    const [realRatioFlag, setRealRatioFlag] = useState(false);
    const intervalRef = useRef<number | null>(null);
    const outputImgRef = useRef<HTMLImageElement | null>(null);

    // 停止自动切换
    const stopAutoSwitch = useCallback(() => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, []);

    // 开始自动切换
    const startAutoSwitch = useCallback(() => {
      stopAutoSwitch();
      let direction = 1;

      intervalRef.current = window.setInterval(() => {
        setSliderValue((prev) => {
          let newValue = prev + direction * 0.5;

          if (newValue >= 100) {
            newValue = 100;
            direction = -1;
          } else if (newValue <= 0) {
            newValue = 0;
            direction = 1;
          }
          return newValue;
        });
      }, 20);
    }, [stopAutoSwitch]);

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      startAutoSwitch,
      stopAutoSwitch,
    }));

    // 图片加载完成时回调
    const handleImageLoad = useCallback(() => {
      const img = outputImgRef.current;
      if (img) {
        setOutputSize({
          width: img.offsetWidth,
          height: img.offsetHeight,
        });
      }
    }, []);

    // 切换原始比例
    const handleChangeRealRatioFlag = useCallback(() => {
      setRealRatioFlag((prev) => !prev);
    }, []);

    // 自动切换
    useEffect(() => {
      if (autoSwitch) {
        startAutoSwitch();
      }
      return () => {
        stopAutoSwitch();
      };
    }, [autoSwitch, startAutoSwitch, stopAutoSwitch]);

    // 点击滑块时停止自动切换
    const handleSliderClick = useCallback(() => {
      stopAutoSwitch();
    }, [stopAutoSwitch]);

    return (
        <>
            <div className="relative">
            <ImgComparisonSlider
            value={sliderValue}
            onClick={handleSliderClick}
            >
            {/* first slot */}
            <figure
                slot="first"
                className="before bg-checkered m-0 h-full w-full flex justify-center items-center"
            >
                <img
                ref={outputImgRef}
                width={realRatioFlag ? undefined : '100%'}
                height={realRatioFlag ? '100%' : '100%'}
                style={{
                    maxHeight: 'calc(100vh - 150px)',
                    ...(realRatioFlag ? {} : { width: '100%' }),
                }}
                src={outputImg}
                onLoad={handleImageLoad}
                alt="生成图片"
                />
                <figcaption className="absolute left-3 top-1/2 -translate-y-1/2 bg-white border border-gray-300 rounded-2xl text-gray-700 opacity-60 px-3 py-2 text-xs leading-none">
                生成图片
                </figcaption>
            </figure>

            {/* second slot */}
            <figure
                slot="second"
                className="after bg-checkered m-0 h-full w-full flex justify-center items-center"
            >
                <div
                className="flex justify-center items-center bg-checkered"
                style={
                    outputSize.width && realRatioFlag
                    ? {
                        width: `${outputSize.width}px`,
                        height: `${outputSize.height}px`,
                        }
                    : {}
                }
                >
                <img
                    className="bg-checkered"
                    style={{
                    width: '100%',
                    height: '100%',
                    maxHeight: 'calc(100vh - 150px)',
                    objectFit: 'contain',
                    display: 'block',
                    userSelect: 'none',
                    }}
                    src={inputImg}
                    alt="原图"
                />
                </div>
                <figcaption className="absolute right-3 top-1/2 -translate-y-1/2 bg-white border border-gray-300 rounded-2xl text-gray-700 opacity-60 px-3 py-2 text-xs leading-none">
                原图
                </figcaption>
            </figure>
            </ImgComparisonSlider>
        </div>
        {/* 右下角切换比例按钮 */}
            <div
            className="absolute bottom-2 right-2 m-2 cursor-pointer z-10"
            onClick={handleChangeRealRatioFlag}
            >
            <Tooltip title={realRatioFlag ? '还原' : '原始比例'}>
                <ExpandOutlined
                className="text-gray-500 hover:text-gray-700 text-sm"
                />
            </Tooltip>
            </div>
      </>
    );
  }
);

MyImgComparisonSlider.displayName = 'MyImgComparisonSlider';

export default MyImgComparisonSlider;