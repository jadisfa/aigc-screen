// stores/useCustomDrawSame.ts  做同款
import { useSyncExternalStore } from 'react';
import type { DrawHistoryItem } from '@/utils/comfyuiApi';

// ============ 全局状态 ============
let drawSameWorkData: DrawHistoryItem | null = null;
const listeners = new Set<() => void>();

// ============ 订阅函数 ============
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => drawSameWorkData;

// ============ 导出 Hook ============
export const useDrawSameStore = () => {
  const data = useSyncExternalStore(subscribe, getSnapshot);

  const setDrawSameWork = (newData: DrawHistoryItem) => {
    drawSameWorkData = newData;
    listeners.forEach(fn => fn());
  };

  const getDrawSameWork = () => drawSameWorkData;

  const clearDrawSameWork = () => {
    drawSameWorkData = null;
    listeners.forEach(fn => fn());
  };

  return {
    drawSameWorkData: data,
    setDrawSameWork,
    getDrawSameWork,
    clearDrawSameWork,
  };
};