// shared/hooks/use-video-scrollEffect.ts
import { useRef, useCallback, useEffect } from "react";

interface VideoState {
  currentAngle: number;
  lastScrollTop: number;
  isTransitioning: boolean; // 是否正在过渡中
  hasCompletedDownTransition: boolean; // 是否已完成下滑过渡到0°
  hasCompletedUpTransition: boolean; // 是否已完成上滑过渡到45°
}

export function useVideoScrollEffect() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const videoStates = useRef<Map<number, VideoState>>(new Map());
  const rafId = useRef<number | null>(null);

  const setVideoRef = useCallback(
    (index: number) => (el: HTMLVideoElement | null) => {
      videoRefs.current[index] = el;
      if (el) {
        videoStates.current.set(index, {
          currentAngle: 45,
          lastScrollTop: 0,
          isTransitioning: false,
          hasCompletedDownTransition: false,
          hasCompletedUpTransition: true,
        });
        el.pause();
      } else {
        videoStates.current.delete(index);
      }
    },
    [],
  );

  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (rafId.current) return;

      rafId.current = requestAnimationFrame(() => {
        const scrollTop = container.scrollTop;
        const containerRect = container.getBoundingClientRect();
        const containerHeight = containerRect.height;

        videoRefs.current.forEach((video, index) => {
          if (!video) return;

          const rect = video.getBoundingClientRect();
          const state = videoStates.current.get(index);
          if (!state) return;

          // 计算视频在容器可视区域内的可见比例
          const visibleTop = Math.max(rect.top, containerRect.top);
          const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
          const visibleHeight = Math.max(0, visibleBottom - visibleTop);
          const totalHeight = rect.height;
          const visibleRatio =
            totalHeight > 0 ? visibleHeight / totalHeight : 0;

          // 判断视频是否完全不可见
          const isFullyInvisible =
            rect.bottom <= containerRect.top ||
            rect.top >= containerRect.bottom;

          // 判断滚动方向
          const isScrollingDown = scrollTop > state.lastScrollTop;
          const isScrollingUp = scrollTop < state.lastScrollTop;

          // 视频播放控制
          if (isFullyInvisible || visibleRatio < 0.108) {
            if (!video.paused) {
              video.pause();
            }
          } else {
            if (video.paused) {
              video.currentTime = 0;
              video.play().catch(() => {});
            }
          }

          let newAngle: number;
          let isTransitioning = state.isTransitioning;

          if (isFullyInvisible) {
            // 完全不可见时，保持当前角度
            newAngle = state.currentAngle;
            isTransitioning = false;
          } else if (visibleRatio < 0.106) {
            // 可见比例小于 10.6%（阈值），保持边界角度
            if (isScrollingDown) {
              newAngle = 45;
              // 重置过渡状态，准备新的下滑过渡
              state.hasCompletedDownTransition = false;
            } else if (isScrollingUp) {
              newAngle = 0;
              // 重置过渡状态，准备新的上滑过渡
              state.hasCompletedUpTransition = false;
            } else {
              newAngle = state.currentAngle;
            }
            isTransitioning = false;
          } else if (visibleRatio >= 0.96) {
            // 几乎完全可见（>= 96%）
            if (isScrollingDown) {
              newAngle = 0;
              state.hasCompletedDownTransition = true;
            } else if (isScrollingUp) {
              newAngle = 45;
              state.hasCompletedUpTransition = true;
            } else {
              newAngle = state.currentAngle;
            }
            isTransitioning = false;
          } else {
            // 可见比例在 10.6%~96% 之间，平滑过渡
            if (isScrollingDown && !state.hasCompletedDownTransition) {
              // 下滑过渡：从 45° 到 0°
              const progress = (visibleRatio - 0.101) / (0.964 - 0.021);
              const clampedProgress = Math.max(0, Math.min(1, progress));
              newAngle = 45 * (1 - clampedProgress);
              isTransitioning = true;
            } else if (isScrollingUp && !state.hasCompletedUpTransition) {
              // 上滑过渡：从 0° 到 45°
              const progress = (visibleRatio - 0.011) / (0.989 - 0.031);
              const clampedProgress = Math.max(0, Math.min(1, progress));
              newAngle = 45 * clampedProgress;
              isTransitioning = true;
            } else {
              // 已完成过渡或静止，保持当前角度
              newAngle = state.currentAngle;
              isTransitioning = false;
            }
          }

          // 平滑过渡
          const smoothingFactor = 0.1;
          const smoothedAngle =
            state.currentAngle +
            (newAngle - state.currentAngle) * smoothingFactor;

          // 如果接近目标角度，直接设置
          const finalAngle =
            Math.abs(smoothedAngle - newAngle) < 0.2 ? newAngle : smoothedAngle;

          // 确保角度在 0~45 范围内
          const clampedAngle = Math.max(0, Math.min(45, finalAngle));
          const roundedAngle = Math.round(clampedAngle * 100) / 100;

          // 更新状态
          videoStates.current.set(index, {
            currentAngle: roundedAngle,
            lastScrollTop: scrollTop,
            isTransitioning,
            hasCompletedDownTransition: state.hasCompletedDownTransition,
            hasCompletedUpTransition: state.hasCompletedUpTransition,
          });

          // 应用变换
          video.style.transform = `perspective(3029px) rotateX(${roundedAngle}deg)`;
        });

        rafId.current = null;
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  const initializeVideos = useCallback(() => {
    videoRefs.current.forEach((video, index) => {
      if (video) {
        videoStates.current.set(index, {
          currentAngle: 45,
          lastScrollTop: 0,
          isTransitioning: false,
          hasCompletedDownTransition: false,
          hasCompletedUpTransition: true,
        });
        video.style.transform = `perspective(3029px) rotateX(45deg)`;
        video.pause();
        video.currentTime = 0;
      }
    });
  }, []);

  return {
    setVideoRef,
    setContainerRef,
    initializeVideos,
  };
}
