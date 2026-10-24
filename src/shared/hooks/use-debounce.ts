import { useEffect, useState, useRef, useCallback } from "react";

// ============ 原有的值防抖 Hook ============
/**
 * 值防抖 Hook - 用于防抖状态值的变化
 * @param value 需要防抖的值
 * @param delay 延迟时间（毫秒），默认 500ms
 * @returns 防抖后的值
 *
 * @example
 * const debouncedSearchTerm = useDebounce(searchTerm, 500);
 */
export function useDebounce<T>(value: T, delay?: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay || 500);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============ 新增的函数防抖 Hook ============
/**
 * 函数防抖 Hook - 用于防抖函数调用
 * @param fn 需要防抖的函数
 * @param delay 延迟时间（毫秒），默认 500ms
 * @param immediate 是否立即执行（首次立即执行，后续防抖），默认 false
 * @returns 包含 run 和 cancel 方法的对象
 *
 * @example
 * const { run: debouncedSearch, cancel } = useDebounceFn(
 *   (keyword) => fetchData(keyword),
 *   500
 * );
 *
 * // 调用防抖函数
 * debouncedSearch('keyword');
 *
 * // 取消防抖
 * cancel();
 */
export function useDebounceFn<T extends (...args: any[]) => any>(
  fn: T,
  delay?: number,
  immediate: boolean = false,
) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fnRef = useRef(fn);
  const isFirstCall = useRef(true);

  // 更新最新的 fn 引用
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  // 清理定时器
  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // 重置首次调用标记（如果需要）
    // isFirstCall.current = true;
  }, []);

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      // 如果设置了立即执行且是首次调用，立即执行
      if (immediate && isFirstCall.current) {
        isFirstCall.current = false;
        return fnRef.current(...args);
      }

      // 清除之前的定时器
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // 设置新的定时器
      timerRef.current = setTimeout(() => {
        fnRef.current(...args);
        timerRef.current = null;
        // 如果是立即执行模式，在延迟结束后重置标记，允许下一次立即执行
        if (immediate) {
          isFirstCall.current = true;
        }
      }, delay || 500);
    },
    [delay, immediate],
  );

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return { run: debouncedFn, cancel };
}

// ============ 兼容性导出（可选） ============
/**
 * @deprecated 请使用 useDebounceFn 替代
 * 为了保持向后兼容，如果之前有直接使用 useDebounce 作为函数防抖的代码
 * 可以添加此兼容函数，但不推荐
 */
export function useDebounceFunction<T extends (...args: any[]) => any>(
  fn: T,
  delay?: number,
) {
  console.warn(
    "useDebounceFunction is deprecated, please use useDebounceFn instead",
  );
  const { run, cancel } = useDebounceFn(fn, delay);
  return { run, cancel };
}

// ============ 便捷导出（可选的组合 Hook） ============
/**
 * 组合 Hook - 同时提供值和函数的防抖
 * 适用于需要同时防抖值和函数的场景
 */
export function useDebounceCombined<T>(
  value: T,
  fn: () => void,
  delay?: number,
) {
  const debouncedValue = useDebounce(value, delay);
  const { run: debouncedFn } = useDebounceFn(fn, delay);
  return { debouncedValue, debouncedFn };
}
