/** 首页无操作计时。离开页面必须 stop，避免后台误触发全屏广告。 */
export function createIdleTimer(timeoutMs: number, onIdle: () => void) {
  let handle: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  function arm() {
    if (!running) {
      return;
    }
    if (handle) {
      clearTimeout(handle);
    }
    handle = setTimeout(() => {
      handle = null;
      onIdle();
    }, timeoutMs);
  }

  return {
    start() {
      running = true;
      arm();
    },
    bump() {
      if (running) {
        arm();
      }
    },
    stop() {
      running = false;
      if (handle) {
        clearTimeout(handle);
        handle = null;
      }
    },
  };
}
