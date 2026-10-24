import { useState, useEffect } from 'react';
export const BIND_REQUIRE_EVENT = 'bindRequireChange';

export const emitBindRequireChange = (value: boolean) => {
  const event = new CustomEvent(BIND_REQUIRE_EVENT, {
    detail: { value },
  });
  window.dispatchEvent(event);
};
// 自定义设置微信登录回调
export const useSetOpenCallback = (initialValue: boolean = false) => {
  const [bindRequire, setBindRequire] = useState(initialValue);
  
  // 监听自定义事件
  useEffect(() => {
    const handler = (event: CustomEvent<{ value: boolean }>) => {
      setBindRequire(event.detail.value);
    };

    window.addEventListener(BIND_REQUIRE_EVENT, handler as EventListener);

    return () => {
      window.removeEventListener(BIND_REQUIRE_EVENT, handler as EventListener);
    };
  }, []);


  return {
    bindRequire,
    setBindRequire,
    clearBind: () => setBindRequire(false),
    // 暴露一个触发事件的方法（供其他组件调用）
    triggerBindRequire: (value: boolean) => {
      emitBindRequireChange(value);
    },
  };
};