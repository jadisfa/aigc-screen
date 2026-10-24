import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import "@/assets/css/scss/task-result-media-stage.scss";

interface MediaWithWatermarkProps {
  showWatermark?: boolean;
  watermarkText?: string;
  offset?: number;
  children?: ReactNode;
  className?: string;
}

export interface MediaWithWatermarkRef {
  updatePosition: () => void;
}

// 水印
const MediaWithWatermark = forwardRef<MediaWithWatermarkRef, MediaWithWatermarkProps>(
  (
    {
      showWatermark = false,
      watermarkText = 'AI生成',
      offset = 12,
      children,
      className = '',
    },
    ref
  ) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const mediaHostRef = useRef<HTMLDivElement>(null);
    const watermarkRef = useRef<HTMLDivElement>(null);

    const [watermarkPos, setWatermarkPos] = useState({ top: offset, left: offset });
    const [isPositionReady, setIsPositionReady] = useState(false);

    const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
    const retryCountRef = useRef(0);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const mutationObserverRef = useRef<MutationObserver | null>(null);

    // 暴露更新方法给父组件
    useImperativeHandle(ref, () => ({
      updatePosition: requestUpdate,
    }));

    const isElementVisible = useCallback((el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (Number.parseFloat(style.opacity || '1') < 0.05) return false;
      return true;
    }, []);

    const isMediaLoaded = useCallback((el: HTMLElement) => {
      if (el instanceof HTMLImageElement) {
        return Boolean(el.complete && el.naturalWidth > 0 && el.naturalHeight > 0);
      }
      if (el instanceof HTMLVideoElement) {
        return Boolean(el.readyState >= 1 && el.videoWidth > 0 && el.videoHeight > 0);
      }
      return false;
    }, []);

    const getMediaElement = useCallback(() => {
      const host = mediaHostRef.current;
      if (!host) return null;

      const hostRect = host.getBoundingClientRect();
      const candidates = Array.from(host.querySelectorAll<HTMLElement>('img, video'));
      if (candidates.length === 0) return null;

      const scored = candidates
        .map((el) => {
          const rect = el.getBoundingClientRect();
          const area = rect.width * rect.height;
          const cls = el.className || '';
          const isPreload =
            typeof cls === 'string' &&
            (cls.includes('preload') ||
              cls.includes('lazy') ||
              cls.includes('placeholder'));
          const visible = isElementVisible(el);
          const loaded = isMediaLoaded(el);
          const intersectionWidth = Math.max(
            0,
            Math.min(rect.right, hostRect.right) - Math.max(rect.left, hostRect.left)
          );
          const intersectionHeight = Math.max(
            0,
            Math.min(rect.bottom, hostRect.bottom) - Math.max(rect.top, hostRect.top)
          );
          const intersectionArea = intersectionWidth * intersectionHeight;
          return {
            el,
            area,
            score:
              (visible ? 1000000 : 0) +
              (loaded ? 500000 : 0) +
              (isPreload ? -100000 : 0) +
              intersectionArea +
              area * 0.1,
          };
        })
        .sort((a, b) => b.score - a.score);

      return scored[0]?.el ?? candidates[0];
    }, [isElementVisible, isMediaLoaded]);

    const getIntrinsicSize = useCallback((el: HTMLElement) => {
      if (el instanceof HTMLVideoElement) {
        return {
          width: el.videoWidth || 0,
          height: el.videoHeight || 0,
        };
      }

      if (el instanceof HTMLImageElement) {
        return {
          width: el.naturalWidth || 0,
          height: el.naturalHeight || 0,
        };
      }

      return { width: 0, height: 0 };
    }, []);

    const getRenderedMediaRect = useCallback((el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const fit = style.objectFit || 'fill';
      const { width: sourceWidth, height: sourceHeight } = getIntrinsicSize(el);

      if (
        (fit === 'contain' || fit === 'scale-down') &&
        sourceWidth > 0 &&
        sourceHeight > 0 &&
        rect.width > 0 &&
        rect.height > 0
      ) {
        const sourceRatio = sourceWidth / sourceHeight;
        const boxRatio = rect.width / rect.height;

        if (sourceRatio > boxRatio) {
          const renderedWidth = rect.width;
          const renderedHeight = renderedWidth / sourceRatio;
          const offsetTop = (rect.height - renderedHeight) / 2;
          return {
            top: rect.top + offsetTop,
            left: rect.left,
            width: renderedWidth,
            height: renderedHeight,
          };
        }

        const renderedHeight = rect.height;
        const renderedWidth = renderedHeight * sourceRatio;
        const offsetLeft = (rect.width - renderedWidth) / 2;
        return {
          top: rect.top,
          left: rect.left + offsetLeft,
          width: renderedWidth,
          height: renderedHeight,
        };
      }

      return rect;
    }, [getIntrinsicSize]);

    const updateWatermarkPosition = useCallback(() => {
      const rootEl = rootRef.current;
      if (!rootEl) return;

      const mediaEl = getMediaElement();
      if (!mediaEl) {
        setIsPositionReady(false);
        setWatermarkPos({ top: offset, left: offset });
        retryCountRef.current = 0;
        return;
      }

      const { width: sourceWidth, height: sourceHeight } = getIntrinsicSize(mediaEl);
      if (
        (mediaEl instanceof HTMLImageElement || mediaEl instanceof HTMLVideoElement) &&
        (sourceWidth <= 0 || sourceHeight <= 0)
      ) {
        setIsPositionReady(false);
        if (retryCountRef.current < 8) {
          retryCountRef.current += 1;
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(requestUpdate, 120);
        }
        return;
      }
      retryCountRef.current = 0;

      const rootRect = rootEl.getBoundingClientRect();
      const mediaRect = getRenderedMediaRect(mediaEl);
      if (mediaRect.width <= 0 || mediaRect.height <= 0) {
        setIsPositionReady(false);
        if (retryCountRef.current < 8) {
          retryCountRef.current += 1;
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(requestUpdate, 120);
        }
        return;
      }

      const mediaTopInRoot = mediaRect.top - rootRect.top;
      const mediaLeftInRoot = mediaRect.left - rootRect.left;
      const wmWidth = watermarkRef.current?.offsetWidth ?? 0;
      const wmHeight = watermarkRef.current?.offsetHeight ?? 0;
      const minTop = mediaTopInRoot + offset;
      const minLeft = mediaLeftInRoot + offset;
      const maxTop = mediaTopInRoot + mediaRect.height - wmHeight - offset;
      const maxLeft = mediaLeftInRoot + mediaRect.width - wmWidth - offset;

      const rawTop = minTop;
      const rawLeft = minLeft;

      setWatermarkPos({
        top: Number.isFinite(rawTop)
          ? Math.max(minTop, Math.min(rawTop, Math.max(minTop, maxTop)))
          : offset,
        left: Number.isFinite(rawLeft)
          ? Math.max(minLeft, Math.min(rawLeft, Math.max(minLeft, maxLeft)))
          : offset,
      });
      setIsPositionReady(true);
    }, [getMediaElement, getIntrinsicSize, getRenderedMediaRect, offset]);

    const requestUpdate = useCallback(() => {
      requestAnimationFrame(() => {
        updateWatermarkPosition();
      });
    }, [updateWatermarkPosition]);

    // 清理函数
    const cleanup = useCallback(() => {
      resizeObserverRef.current?.disconnect();
      mutationObserverRef.current?.disconnect();
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      const hostEl = mediaHostRef.current;
      if (hostEl) {
        hostEl.removeEventListener('load', requestUpdate, true);
        hostEl.removeEventListener('loadedmetadata', requestUpdate, true);
      }
    }, [requestUpdate]);

    // 设置监听
    useEffect(() => {
      const rootEl = rootRef.current;
      const hostEl = mediaHostRef.current;
      if (!rootEl || !hostEl) return;

      resizeObserverRef.current = new ResizeObserver(() => requestUpdate());
      resizeObserverRef.current.observe(rootEl);
      resizeObserverRef.current.observe(hostEl);

      mutationObserverRef.current = new MutationObserver(() => requestUpdate());
      mutationObserverRef.current.observe(hostEl, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'src'],
      });

      hostEl.addEventListener('load', requestUpdate, true);
      hostEl.addEventListener('loadedmetadata', requestUpdate, true);

      // 初始更新
      const timer = setTimeout(() => {
        requestUpdate();
        setTimeout(requestUpdate, 80);
      }, 0);

      return () => {
        cleanup();
        clearTimeout(timer);
      };
    }, [requestUpdate, cleanup]);

    // 监听 props 变化
    useEffect(() => {
      const timer = setTimeout(requestUpdate, 0);
      return () => clearTimeout(timer);
    }, [showWatermark, offset, requestUpdate]);

    return (
      <div
        ref={rootRef}
        className={`relative w-full max-w-full overflow-hidden flex items-center justify-center ${className}`}
      >
        <div
          ref={mediaHostRef}
          className="relative w-full h-full max-w-full overflow-hidden flex items-center justify-center"
        >
          {children}
        </div>
        {showWatermark && isPositionReady && (
          <div
            ref={watermarkRef}
            className="absolute px-2 py-1 rounded-md bg-black/15 text-lg font-semibold tracking-[0.08em] text-white opacity-50 pointer-events-none select-none z-20"
            style={{
              top: `${watermarkPos.top}px`,
              left: `${watermarkPos.left}px`,
            }}
          >
            {watermarkText}
          </div>
        )}
      </div>
    );
  }
);

MediaWithWatermark.displayName = 'MediaWithWatermark';

export default MediaWithWatermark;