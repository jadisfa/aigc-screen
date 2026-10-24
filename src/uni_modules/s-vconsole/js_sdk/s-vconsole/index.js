const READY_FLAG = '__UNI_VCONSOLE_READY__'
const LOADING_FLAG = '__UNI_VCONSOLE_LOADING__'
const CONSOLE_BRIDGE_FLAG = '__UNI_VCONSOLE_CONSOLE_BRIDGE_INSTALLED__'
const APP_LOG_BRIDGE_FLAG = '__UNI_VCONSOLE_APP_LOG_BRIDGE_INSTALLED__'
const REQUEST_BRIDGE_FLAG = '__UNI_VCONSOLE_REQUEST_BRIDGE_INSTALLED__'
const STORAGE_BRIDGE_FLAG = '__UNI_VCONSOLE_STORAGE_BRIDGE_INSTALLED__'
const POSITION_STORAGE_KEY = 's-vconsole-switch-position'
const LAUNCHER_POSITION_STORAGE_KEY = 's-vconsole-launcher-position'
const LAUNCHER_VISIBILITY_STORAGE_KEY = 's-vconsole-launcher-hidden'
const SHARED_WEBVIEW_ID = '__UNI_VCONSOLE_SHARED_WEBVIEW__'
const SHARED_LAUNCHER_ID = '__UNI_VCONSOLE_SHARED_LAUNCHER__'
const SHARED_WEBVIEW_PATH = '_www/uni_modules/s-vconsole/static/s-vconsole.html'

const DEFAULT_SCRIPT_PATHS = [
  'uni_modules/s-vconsole/static/vendor/vconsole.min.js',
  './uni_modules/s-vconsole/static/vendor/vconsole.min.js',
  '/uni_modules/s-vconsole/static/vendor/vconsole.min.js',
  '_www/uni_modules/s-vconsole/static/vendor/vconsole.min.js',
  'static/vendor/vconsole.min.js',
  './static/vendor/vconsole.min.js',
  '/static/vendor/vconsole.min.js',
  '_www/static/vendor/vconsole.min.js',
]

const DEFAULT_OPTIONS = {
  enabled: true,
  captureConsole: true,
  captureRequest: true,
  captureStorage: true,
  persistLogs: true,
  persistNetwork: true,
  persistStorage: true,
  persistSwitchPosition: true,
  autoInject: true,
  lifecycle: true,
  injectDelay: 300,
  injectThrottle: 1000,
  webviewScope: 'shared',
  sharedWebview: {
    id: SHARED_WEBVIEW_ID,
    path: SHARED_WEBVIEW_PATH,
    width: 82,
    height: 36,
    right: 10,
    bottom: 10,
    zindex: 2147483647,
    draggable: true,
    launcherColor: '#07c160',
    launcherText: 'vConsole',
    launcherTextColor: '#ffffff',
    launcherFontFamily: 'Helvetica Neue',
    launcherFontSize: 14,
    longPressDuration: 700,
    longPressToHide: true,
    showLauncher: true,
    style: {},
  },
  scriptPaths: DEFAULT_SCRIPT_PATHS,
  theme: 'light',
  log: {
    maxLogNumber: 200,
  },
  network: {
    maxNetworkNumber: 100,
  },
  storage: {
    defaultStorages: ['localStorage', 'sessionStorage', 'cookies'],
  },
  vConsoleOptions: {},
  maskHeaderKeys: ['authorization', 'token', 'cookie'],
}

const state = {
  options: mergeOptions(DEFAULT_OPTIONS),
  sessionId: `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`,
  injectTimer: null,
  lastInjectTime: 0,
  activeWebview: null,
  injectedWebviewIds: Object.create(null),
  injectedWebviews: new WeakSet(),
  sharedWebview: null,
  sharedWebviewListeners: new WeakSet(),
  sharedLauncher: null,
  sharedLauncherListeners: new WeakSet(),
  sharedLauncherPosition: null,
  sharedLauncherDrag: null,
  sharedLauncherLongPressTimer: null,
  sharedLauncherLongPressTriggered: false,
  suppressLauncherClickUntil: 0,
  sharedLauncherHidden: null,
  requestId: 0,
  logId: 0,
  lifecycleInstalled: false,
  suppressConsoleCapture: false,
  logHistory: [],
  networkHistory: [],
  storageHistory: Object.create(null),
}

const consoleLevels = ['log', 'info', 'warn', 'error', 'debug']

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function mergeOptions(base, extra) {
  const result = Object.assign({}, base || {})
  const source = extra || {}

  Object.keys(source).forEach(key => {
    const baseValue = result[key]
    const nextValue = source[key]
    result[key] =
      isPlainObject(baseValue) && isPlainObject(nextValue)
        ? mergeOptions(baseValue, nextValue)
        : nextValue
  })

  return result
}

function getOptions() {
  return state.options
}

function isEnabled() {
  const enabled = getOptions().enabled
  return typeof enabled === 'function' ? !!enabled() : enabled !== false
}

function normalizeScriptPaths() {
  const options = getOptions()
  const paths = options.scriptPath ? [options.scriptPath] : options.scriptPaths
  const list =
    Array.isArray(paths) && paths.length ? paths : DEFAULT_SCRIPT_PATHS
  return list.filter(Boolean)
}

function getVConsoleOptions() {
  const options = getOptions()
  return mergeOptions(
    {
      theme: options.theme,
      log: options.log,
      network: options.network,
      storage: options.storage,
    },
    options.vConsoleOptions,
  )
}

function createInitScript(syncHistory = true) {
  const options = getOptions()
  const scriptPaths = JSON.stringify(normalizeScriptPaths())
  const vConsoleOptions = JSON.stringify(getVConsoleOptions())
  const positionStorageKey = JSON.stringify(POSITION_STORAGE_KEY)
  const logHistory = JSON.stringify(options.persistLogs ? state.logHistory : [])
  const networkHistory = JSON.stringify(
    options.persistNetwork ? state.networkHistory : [],
  )
  const storageHistory = JSON.stringify(
    options.persistStorage ? getStorageHistoryList() : [],
  )
  const sharedHostConfig =
    options.webviewScope === 'shared' ? getSharedHostConfig() : null
  const persistSwitchPosition =
    !sharedHostConfig && options.persistSwitchPosition !== false
  const logIdLimit = getHistoryLimit('log', 'maxLogNumber', 200) * 2
  const networkIdLimit = getHistoryLimit('network', 'maxNetworkNumber', 100) * 2

  return `
;(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.documentElement) return;
  if (!window.navigator) {
    window.navigator = {};
  }
  if (typeof window.navigator.sendBeacon !== 'function') {
    window.navigator.sendBeacon = function () { return false; };
  }
  window.__UNI_VCONSOLE_QUEUE__ = window.__UNI_VCONSOLE_QUEUE__ || [];
  window.__UNI_VCONSOLE_NETWORK_QUEUE__ = window.__UNI_VCONSOLE_NETWORK_QUEUE__ || [];
  window.__UNI_VCONSOLE_NETWORK_IDS__ = window.__UNI_VCONSOLE_NETWORK_IDS__ || {};
  window.__UNI_VCONSOLE_LOG_IDS__ = window.__UNI_VCONSOLE_LOG_IDS__ || {};
  window.__UNI_VCONSOLE_NETWORK_ID_ORDER__ = window.__UNI_VCONSOLE_NETWORK_ID_ORDER__ || [];
  window.__UNI_VCONSOLE_LOG_ID_ORDER__ = window.__UNI_VCONSOLE_LOG_ID_ORDER__ || [];
  var VCONSOLE_LOG_HISTORY = ${logHistory};
  var VCONSOLE_NETWORK_HISTORY = ${networkHistory};
  var VCONSOLE_STORAGE_HISTORY = ${storageHistory};
  var VCONSOLE_SYNC_HISTORY = ${syncHistory};
  var VCONSOLE_SHARED_HOST = ${JSON.stringify(sharedHostConfig)};
  var VCONSOLE_LOG_ID_LIMIT = ${logIdLimit};
  var VCONSOLE_NETWORK_ID_LIMIT = ${networkIdLimit};
  var SWITCH_POSITION_STORAGE_KEY = ${positionStorageKey};
  var PERSIST_SWITCH_POSITION = ${persistSwitchPosition};
  function installVConsoleStyleOverrides() {
    var styleId = '__uni-vconsole-style-overrides';
    if (document.getElementById(styleId)) return;
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = '.vc-cmd .vc-cmd-btn { flex: 0 0 56px; width: 56px; font-weight: normal; }';
    (document.head || document.documentElement).appendChild(style);
  }
  function normalizeSwitchPosition(position) {
    if (!position) return;
    var x = Number(position.x);
    var y = Number(position.y);
    if (!isFinite(x) || !isFinite(y)) return null;
    return {
      x: x,
      y: y
    };
  }
  function readStoredSwitchPosition() {
    try {
      if (!PERSIST_SWITCH_POSITION) return null;
      if (typeof plus === 'undefined' || !plus.storage || typeof plus.storage.getItem !== 'function') return null;
      var value = plus.storage.getItem(SWITCH_POSITION_STORAGE_KEY);
      if (!value) return null;
      return normalizeSwitchPosition(JSON.parse(value));
    } catch (error) {
      return null;
    }
  }
  function saveStoredSwitchPosition(position) {
    var next = normalizeSwitchPosition(position);
    if (!next) return;
    try {
      if (!PERSIST_SWITCH_POSITION) return;
      if (typeof plus === 'undefined' || !plus.storage || typeof plus.storage.setItem !== 'function') return;
      plus.storage.setItem(SWITCH_POSITION_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
    }
  }
  var storedSwitchPosition = readStoredSwitchPosition();
  if (storedSwitchPosition) {
    window.__UNI_VCONSOLE_SWITCH_POSITION__ = storedSwitchPosition;
  }
  function applySwitchPosition(position) {
    var next = normalizeSwitchPosition(position);
    if (!next) return;
    var x = next.x;
    var y = next.y;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('vConsole_switch_x', String(x));
        localStorage.setItem('vConsole_switch_y', String(y));
      }
    } catch (error) {
    }
    if (!window.__VCONSOLE__) return;
    if (typeof window.__VCONSOLE__.setSwitchPosition === 'function') {
      window.__VCONSOLE__.setSwitchPosition(x, y);
      return;
    }
    if (window.__VCONSOLE__.compInstance) {
      window.__VCONSOLE__.compInstance.switchButtonPosition = {
        x: x,
        y: y
      };
    }
  }
  function readSwitchPosition() {
    try {
      if (typeof localStorage === 'undefined') return null;
      var x = localStorage.getItem('vConsole_switch_x');
      var y = localStorage.getItem('vConsole_switch_y');
      if (x === null && y === null) return null;
      return normalizeSwitchPosition({
        x: Number(x),
        y: Number(y)
      });
    } catch (error) {
      return null;
    }
  }
  function installSwitchPositionSync() {
    if (VCONSOLE_SHARED_HOST) return;
    if (window.__UNI_VCONSOLE_SWITCH_POSITION_SYNC__) return;
    window.__UNI_VCONSOLE_SWITCH_POSITION_SYNC__ = true;
    var last = '';
    var sync = function () {
      var position = readSwitchPosition();
      if (!position) return;
      var next = JSON.stringify(position);
      if (next === last) return;
      last = next;
      window.__UNI_VCONSOLE_SWITCH_POSITION__ = position;
      saveStoredSwitchPosition(position);
    };
    var scheduleSync = function () {
      setTimeout(sync, 0);
      setTimeout(sync, 120);
      setTimeout(sync, 300);
    };
    window.addEventListener('touchend', function () {
      scheduleSync();
    }, true);
    window.addEventListener('mouseup', function () {
      scheduleSync();
    }, true);
    setTimeout(sync, 500);
  }
  function installSharedWebviewHost() {
    if (!VCONSOLE_SHARED_HOST || !window.__VCONSOLE__) return;
    var host;
    try {
      if (typeof plus === 'undefined' || !plus.webview || typeof plus.webview.currentWebview !== 'function') return;
      host = plus.webview.currentWebview();
    } catch (error) {
      return;
    }
    if (!host || typeof host.hide !== 'function') return;
    if (window.__UNI_VCONSOLE_SHARED_HOST_INSTALLED__) return;
    window.__UNI_VCONSOLE_SHARED_HOST_INSTALLED__ = true;
    var vConsole = window.__VCONSOLE__;
    var originalShow = vConsole.show.bind(vConsole);
    var originalHide = vConsole.hide.bind(vConsole);
    var getLauncher = function () {
      try {
        var NativeView = plus.nativeObj && plus.nativeObj.View;
        if (NativeView && typeof NativeView.getViewById === 'function') {
          return NativeView.getViewById(VCONSOLE_SHARED_HOST.launcherId);
        }
      } catch (error) {
      }
      return null;
    };
    vConsole.show = function () {
      return originalShow.apply(vConsole, arguments);
    };
    vConsole.hide = function () {
      var result = originalHide.apply(vConsole, arguments);
      setTimeout(function () {
        try {
          if (typeof host.hide === 'function') host.hide('none', 0);
          var launcher = getLauncher();
          var hidden = '';
          if (plus.storage && typeof plus.storage.getItem === 'function') {
            hidden = plus.storage.getItem(VCONSOLE_SHARED_HOST.launcherVisibilityStorageKey) || '';
          }
          var shouldShowLauncher = hidden === 'false' ||
            (hidden !== 'true' && VCONSOLE_SHARED_HOST.showLauncher);
          if (shouldShowLauncher && launcher && typeof launcher.show === 'function') launcher.show();
        } catch (error) {
        }
      }, 0);
      return result;
    };
    setTimeout(function () {
      if (typeof vConsole.hideSwitch === 'function') vConsole.hideSwitch();
      vConsole.show();
      try {
        if (typeof host.isVisible === 'function' && host.isVisible()) {
          var launcher = getLauncher();
          if (launcher && typeof launcher.hide === 'function') launcher.hide();
        }
      } catch (error) {
      }
    }, 0);
  }
  installVConsoleStyleOverrides();
  applySwitchPosition(window.__UNI_VCONSOLE_SWITCH_POSITION__);
  installSwitchPositionSync();
  if (window.${READY_FLAG}) {
    installSharedWebviewHost();
    if (VCONSOLE_SYNC_HISTORY && typeof window.__UNI_VCONSOLE_SYNC_HISTORY__ === 'function') {
      window.__UNI_VCONSOLE_SYNC_HISTORY__(
        VCONSOLE_LOG_HISTORY,
        VCONSOLE_NETWORK_HISTORY,
        VCONSOLE_STORAGE_HISTORY
      );
    }
    return;
  }
  if (window.${LOADING_FLAG}) return;
  window.${LOADING_FLAG} = true;
  function rememberId(ids, order, id, limit) {
    if (!id) return;
    if (!ids[id]) {
      ids[id] = true;
      order.push(id);
    }
    while (order.length > limit) {
      delete ids[order.shift()];
    }
  }
  window.__UNI_VCONSOLE_PUSH_LOG_ITEM__ = function (item) {
    if (!item) return;
    var level = item.level || 'log';
    var args = item.args || [];
    if (!window.${READY_FLAG}) {
      window.__UNI_VCONSOLE_QUEUE__.push([level, args, item.id]);
      return;
    }
    if (item.id) {
      if (window.__UNI_VCONSOLE_LOG_IDS__[item.id]) return;
      rememberId(
        window.__UNI_VCONSOLE_LOG_IDS__,
        window.__UNI_VCONSOLE_LOG_ID_ORDER__,
        item.id,
        VCONSOLE_LOG_ID_LIMIT
      );
    }
    var method = console[level] || console.log;
    method.apply(console, args);
  };
  window.__UNI_VCONSOLE_PUSH__ = function (level, args) {
    window.__UNI_VCONSOLE_PUSH_LOG_ITEM__({
      level: level,
      args: args
    });
  };
  window.__UNI_VCONSOLE_PUSH_NETWORK__ = function (item) {
    if (!item || !item.id) return;
    var network = window.__VCONSOLE__ && window.__VCONSOLE__.network;
    if (!network || (!network.add && !network.update)) {
      window.__UNI_VCONSOLE_NETWORK_QUEUE__.push(item);
      return;
    }

    var ids = window.__UNI_VCONSOLE_NETWORK_IDS__;
    if (!ids[item.id] && network.add) {
      network.add(item);
      rememberId(
        ids,
        window.__UNI_VCONSOLE_NETWORK_ID_ORDER__,
        item.id,
        VCONSOLE_NETWORK_ID_LIMIT
      );
      return;
    }

    if (network.update) {
      network.update(item.id, item);
      rememberId(
        ids,
        window.__UNI_VCONSOLE_NETWORK_ID_ORDER__,
        item.id,
        VCONSOLE_NETWORK_ID_LIMIT
      );
      return;
    }

    network.add(item);
    rememberId(
      ids,
      window.__UNI_VCONSOLE_NETWORK_ID_ORDER__,
      item.id,
      VCONSOLE_NETWORK_ID_LIMIT
    );
  };
  function flushNetworkQueue() {
    var queue = window.__UNI_VCONSOLE_NETWORK_QUEUE__ || [];
    if (!queue.length) return;
    window.__UNI_VCONSOLE_NETWORK_QUEUE__ = [];
    queue.forEach(function (item) {
      window.__UNI_VCONSOLE_PUSH_NETWORK__(item);
    });
    if (window.__UNI_VCONSOLE_NETWORK_QUEUE__.length) {
      setTimeout(flushNetworkQueue, 80);
    }
  }
  function refreshStoragePanel() {
    var vc = window.__VCONSOLE__;
    if (vc && typeof vc.setOption === 'function') {
      vc.setOption('storage.defaultStorages', ['localStorage', 'sessionStorage', 'cookies']);
    }
    var storagePlugin = vc && vc.pluginList && vc.pluginList.storage;
    if (storagePlugin && storagePlugin.model && typeof storagePlugin.model.refresh === 'function') {
      storagePlugin.model.refresh();
    }
  }
  function replayStorageHistory(storageHistory) {
    try {
      if (typeof localStorage === 'undefined') return;
      var prefix = 'uni-storage:';
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var storageKey = localStorage.key(i);
        if (storageKey && storageKey.indexOf(prefix) === 0) {
          localStorage.removeItem(storageKey);
        }
      }
      (storageHistory || []).forEach(function (item) {
        localStorage.setItem(prefix + item.key, item.value);
      });
      refreshStoragePanel();
    } catch (error) {
    }
  }
  window.__UNI_VCONSOLE_SYNC_HISTORY__ = function (logHistory, networkHistory, storageHistory) {
    replayStorageHistory(storageHistory);
    (logHistory || []).forEach(function (item) {
      window.__UNI_VCONSOLE_PUSH_LOG_ITEM__(item);
    });
    (networkHistory || []).forEach(function (item) {
      window.__UNI_VCONSOLE_PUSH_NETWORK__(item);
    });
  };
  function replayHistory() {
    window.__UNI_VCONSOLE_SYNC_HISTORY__(
      VCONSOLE_LOG_HISTORY,
      VCONSOLE_NETWORK_HISTORY,
      VCONSOLE_STORAGE_HISTORY
    );
  }
  function init() {
    if (!window.__VCONSOLE__ && window.VConsole) {
      window.__VCONSOLE__ = new window.VConsole(${vConsoleOptions});
    }
    installSharedWebviewHost();
    applySwitchPosition(window.__UNI_VCONSOLE_SWITCH_POSITION__);
    installSwitchPositionSync();
    window.${READY_FLAG} = true;
    window.${LOADING_FLAG} = false;
    var queue = window.__UNI_VCONSOLE_QUEUE__ || [];
    window.__UNI_VCONSOLE_QUEUE__ = [];
    queue.forEach(function (item) {
      window.__UNI_VCONSOLE_PUSH_LOG_ITEM__({
        level: item[0],
        args: item[1],
        id: item[2]
      });
    });
    setTimeout(function () {
      flushNetworkQueue();
      replayHistory();
    }, 0);
  }
  if (window.VConsole) {
    init();
    return;
  }
  var sources = ${scriptPaths};
  function load(index) {
    if (index >= sources.length) {
      window.${LOADING_FLAG} = false;
      console.warn('[vconsole] vConsole load failed');
      return;
    }
    var script = document.createElement('script');
    script.src = sources[index];
    script.onload = init;
    script.onerror = function () {
      script.parentNode && script.parentNode.removeChild(script);
      load(index + 1);
    };
    document.documentElement.appendChild(script);
  }
  load(0);
})();
`
}

function getAppWebviews() {
  if (
    typeof plus === 'undefined' ||
    !plus.webview ||
    typeof plus.webview.all !== 'function'
  ) {
    return []
  }

  try {
    return plus.webview.all() || []
  } catch (error) {
    return []
  }
}

function getSharedWebviewOptions() {
  return getOptions().sharedWebview || DEFAULT_OPTIONS.sharedWebview
}

function getNumericOption(value, fallback, minimum = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= minimum ? number : fallback
}

function getSharedScreenMetrics() {
  const metrics = {
    height: 667,
    width: 375,
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  }
  if (typeof plus === 'undefined') return metrics

  try {
    if (plus.screen) {
      metrics.width = getNumericOption(
        plus.screen.resolutionWidth,
        metrics.width,
        1,
      )
      metrics.height = getNumericOption(
        plus.screen.resolutionHeight,
        metrics.height,
        1,
      )
    }
  } catch (error) {
    // Fall back to a conventional mobile viewport before plus is fully ready.
  }

  try {
    if (
      plus.navigator &&
      typeof plus.navigator.getSafeAreaInsets === 'function'
    ) {
      const safeArea = plus.navigator.getSafeAreaInsets() || {}
      metrics.safeArea = {
        top: getNumericOption(safeArea.top, 0),
        right: getNumericOption(safeArea.right, 0),
        bottom: getNumericOption(safeArea.bottom, 0),
        left: getNumericOption(safeArea.left, 0),
      }
    }
  } catch (error) {}

  const isAndroid =
    plus.os && String(plus.os.name || '').toLowerCase() === 'android'
  if (!isAndroid) return metrics

  try {
    if (
      typeof uni !== 'undefined' &&
      typeof uni.getSystemInfoSync === 'function'
    ) {
      const systemInfo = uni.getSystemInfoSync() || {}
      const safeArea = systemInfo.safeArea || {}
      const safeAreaInsets = systemInfo.safeAreaInsets || {}
      const screenHeight = getNumericOption(
        systemInfo.screenHeight,
        metrics.height,
        1,
      )
      const safeAreaBottom = getNumericOption(
        safeArea.bottom,
        screenHeight,
      )
      metrics.safeArea.top = Math.max(
        metrics.safeArea.top,
        getNumericOption(
          safeAreaInsets.top,
          getNumericOption(safeArea.top, 0),
        ),
      )
      metrics.safeArea.bottom = Math.max(
        metrics.safeArea.bottom,
        getNumericOption(
          safeAreaInsets.bottom,
          Math.max(0, screenHeight - safeAreaBottom),
        ),
      )
    }
  } catch (error) {}

  try {
    const statusbarHeight =
      plus.navigator &&
      typeof plus.navigator.getStatusbarHeight === 'function'
        ? getNumericOption(plus.navigator.getStatusbarHeight(), 0)
        : 0
    metrics.safeArea.top = Math.max(metrics.safeArea.top, statusbarHeight)
  } catch (error) {}

  return metrics
}

function clampSharedLauncherPosition(position, width, height) {
  if (!position) return null
  const metrics = getSharedScreenMetrics()
  const safeArea = metrics.safeArea
  const left = Number(position.left)
  const top = Number(position.top)
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null
  return {
    left: Math.min(
      Math.max(left, safeArea.left),
      Math.max(safeArea.left, metrics.width - width - safeArea.right),
    ),
    top: Math.min(
      Math.max(top, safeArea.top),
      Math.max(safeArea.top, metrics.height - height - safeArea.bottom),
    ),
  }
}

function readSharedLauncherPosition(width, height) {
  if (state.sharedLauncherPosition) {
    return clampSharedLauncherPosition(
      state.sharedLauncherPosition,
      width,
      height,
    )
  }
  if (getOptions().persistSwitchPosition === false) return null
  try {
    if (!plus.storage || typeof plus.storage.getItem !== 'function') return null
    const value = plus.storage.getItem(LAUNCHER_POSITION_STORAGE_KEY)
    if (!value) return null
    state.sharedLauncherPosition = JSON.parse(value)
    return clampSharedLauncherPosition(
      state.sharedLauncherPosition,
      width,
      height,
    )
  } catch (error) {
    return null
  }
}

function saveSharedLauncherPosition(position) {
  state.sharedLauncherPosition = position
  if (getOptions().persistSwitchPosition === false) return
  try {
    if (plus.storage && typeof plus.storage.setItem === 'function') {
      plus.storage.setItem(
        LAUNCHER_POSITION_STORAGE_KEY,
        JSON.stringify(position),
      )
    }
  } catch (error) {}
}

function isSharedLauncherHidden() {
  if (typeof state.sharedLauncherHidden === 'boolean') {
    return state.sharedLauncherHidden
  }
  if (getSharedWebviewOptions().showLauncher === false) return true
  try {
    if (plus.storage && typeof plus.storage.getItem === 'function') {
      const value = plus.storage.getItem(LAUNCHER_VISIBILITY_STORAGE_KEY)
      if (value === 'true' || value === 'false') {
        state.sharedLauncherHidden = value === 'true'
        return state.sharedLauncherHidden
      }
    }
  } catch (error) {}
  return false
}

function saveSharedLauncherHidden(hidden) {
  state.sharedLauncherHidden = hidden
  try {
    if (plus.storage && typeof plus.storage.setItem === 'function') {
      plus.storage.setItem(
        LAUNCHER_VISIBILITY_STORAGE_KEY,
        hidden ? 'true' : 'false',
      )
    }
  } catch (error) {}
}

function getSharedLayout() {
  const options = getSharedWebviewOptions()
  const width = getNumericOption(options.width, 82, 44)
  const height = getNumericOption(options.height, 36, 32)
  const right = getNumericOption(options.right, 10)
  const bottom = getNumericOption(options.bottom, 10)
  const metrics = getSharedScreenMetrics()
  const safeArea = metrics.safeArea
  const storedPosition = readSharedLauncherPosition(width, height)
  const launcherPosition =
    storedPosition ||
    clampSharedLauncherPosition(
      {
        left: metrics.width - width - right - safeArea.right,
        top: metrics.height - height - bottom - safeArea.bottom,
      },
      width,
      height,
    )
  const buttonWidth = Math.max(1, width - 2)
  const buttonHeight = Math.max(1, height - 2)

  const zindex = getNumericOption(options.zindex, 2147483647)
  const webviewStyle = Object.assign(
    {
      background: '#ffffff',
      height: '100%',
      left: '0px',
      popGesture: 'none',
      top: '0px',
      width: '100%',
      zindex,
    },
    options.style || {},
  )

  return {
    launcherStyle: {
      height: `${height}px`,
      left: `${launcherPosition.left}px`,
      position: 'absolute',
      top: `${launcherPosition.top}px`,
      width: `${width}px`,
    },
    launcherTags: [
      {
        tag: 'rect',
        id: 'background',
        position: {
          top: '0px',
          left: '0px',
          width: `${buttonWidth}px`,
          height: `${buttonHeight}px`,
        },
        rectStyles: {
          color: options.launcherColor || '#07c160',
          radius: '4px',
        },
      },
      {
        tag: 'font',
        id: 'label',
        text: String(options.launcherText || 'vConsole'),
        position: {
          top: '0px',
          left: '0px',
          width: `${buttonWidth}px`,
          height: `${buttonHeight}px`,
        },
        textStyles: {
          align: 'center',
          color: options.launcherTextColor || '#ffffff',
          family: options.launcherFontFamily || 'Helvetica Neue',
          size: `${getNumericOption(options.launcherFontSize, 14, 8)}px`,
          verticalAlign: 'middle',
          weight: 'normal',
        },
      },
    ],
    webviewStyle,
  }
}

function getSharedHostConfig() {
  const options = getSharedWebviewOptions()
  return {
    launcherId: options.launcherId || SHARED_LAUNCHER_ID,
    launcherVisibilityStorageKey: LAUNCHER_VISIBILITY_STORAGE_KEY,
    showLauncher: options.showLauncher !== false,
  }
}

function getWebviewId(webview) {
  try {
    return webview && webview.id != null ? String(webview.id) : ''
  } catch (error) {
    return ''
  }
}

function hasInjectedWebview(webview) {
  const id = getWebviewId(webview)
  return id
    ? !!state.injectedWebviewIds[id]
    : state.injectedWebviews.has(webview)
}

function markInjectedWebview(webview) {
  const id = getWebviewId(webview)
  if (id) {
    state.injectedWebviewIds[id] = true
  } else if (webview) {
    state.injectedWebviews.add(webview)
  }
}

function forgetInjectedWebview(webview) {
  const id = getWebviewId(webview)
  if (id) {
    delete state.injectedWebviewIds[id]
  } else if (webview) {
    state.injectedWebviews.delete(webview)
  }
}

function openSharedWebview() {
  const webview = ensureSharedWebview()
  if (!webview) return

  try {
    if (typeof webview.setStyle === 'function') {
      webview.setStyle(getSharedLayout().webviewStyle)
    }
    if (typeof webview.show === 'function') {
      webview.show('none', 0)
    }
    const launcherId = JSON.stringify(
      getSharedWebviewOptions().launcherId || SHARED_LAUNCHER_ID,
    )
    webview.evalJS(`
;(function () {
  var vConsole = window.__VCONSOLE__;
  if (!vConsole) return;
  try {
    var NativeView = plus.nativeObj && plus.nativeObj.View;
    var launcher = NativeView && typeof NativeView.getViewById === 'function'
      ? NativeView.getViewById(${launcherId})
      : null;
    if (launcher && typeof launcher.hide === 'function') launcher.hide();
  } catch (error) {
  }
  if (typeof vConsole.hideSwitch === 'function') vConsole.hideSwitch();
  if (typeof vConsole.show === 'function') vConsole.show();
})();
`)
  } catch (error) {
    state.sharedWebview = null
    forgetInjectedWebview(webview)
  }
}

function getLauncherTouchPoint(event) {
  const source =
    (event && event.touches && event.touches[0]) ||
    (event && event.changedTouches && event.changedTouches[0]) ||
    event
  if (!source) return null
  const readCoordinate = keys => {
    for (let index = 0; index < keys.length; index += 1) {
      const value = Number(source[keys[index]])
      if (Number.isFinite(value)) return value
    }
    return NaN
  }
  const x = readCoordinate(['screenX', 'pageX', 'clientX'])
  const y = readCoordinate(['screenY', 'pageY', 'clientY'])
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

function clearSharedLauncherLongPress() {
  if (!state.sharedLauncherLongPressTimer) return
  clearTimeout(state.sharedLauncherLongPressTimer)
  state.sharedLauncherLongPressTimer = null
}

function hideSharedLauncherForSession() {
  state.sharedLauncherHidden = true
  const launcher = state.sharedLauncher
  if (!launcher || typeof launcher.hide !== 'function') return
  try {
    launcher.hide()
  } catch (error) {
    state.sharedLauncher = null
  }
}

function confirmHideSharedLauncher() {
  const hide = () => hideSharedLauncherForSession()
  if (typeof uni !== 'undefined' && typeof uni.showModal === 'function') {
    uni.showModal({
      title: 'vConsole',
      content: '是否确认隐藏调试浮标？',
      confirmText: '确认',
      cancelText: '取消',
      success(result) {
        if (result && result.confirm) hide()
      },
    })
    return
  }
  try {
    if (plus.nativeUI && typeof plus.nativeUI.confirm === 'function') {
      plus.nativeUI.confirm(
        '是否确认隐藏调试浮标？',
        event => {
          if (event && event.index === 0) hide()
        },
        {
          title: 'vConsole',
          buttons: ['确认', '取消'],
        },
      )
      return
    }
  } catch (error) {}
  hide()
}

function bindSharedLauncher(launcher) {
  if (
    !launcher ||
    state.sharedLauncherListeners.has(launcher) ||
    typeof launcher.addEventListener !== 'function'
  ) {
    return
  }
  state.sharedLauncherListeners.add(launcher)
  launcher.addEventListener('touchstart', event => {
    const options = getSharedWebviewOptions()
    clearSharedLauncherLongPress()
    const previousDrag = state.sharedLauncherDrag
    state.sharedLauncherDrag = null
    if (previousDrag && previousDrag.moved && previousDrag.position) {
      saveSharedLauncherPosition(previousDrag.position)
    }
    state.sharedLauncherLongPressTriggered = false
    if (options.longPressToHide !== false) {
      const duration = getNumericOption(options.longPressDuration, 700, 300)
      state.sharedLauncherLongPressTimer = setTimeout(() => {
        state.sharedLauncherLongPressTimer = null
        state.sharedLauncherLongPressTriggered = true
        state.sharedLauncherDrag = null
        state.suppressLauncherClickUntil = Date.now() + 500
        confirmHideSharedLauncher()
      }, duration)
    }
    const point = getLauncherTouchPoint(event)
    if (!point) return
    const layout = getSharedLayout().launcherStyle
    state.sharedLauncherDrag = {
      draggable:
        options.draggable !== false && typeof launcher.setStyle === 'function',
      startX: point.x,
      startY: point.y,
      left: Number.parseFloat(layout.left) || 0,
      top: Number.parseFloat(layout.top) || 0,
      width: Number.parseFloat(layout.width) || 0,
      height: Number.parseFloat(layout.height) || 0,
      moved: false,
    }
  })
  launcher.addEventListener('touchmove', event => {
    const drag = state.sharedLauncherDrag
    const point = getLauncherTouchPoint(event)
    if (!drag || !point) return
    const next = clampSharedLauncherPosition(
      {
        left: drag.left + point.x - drag.startX,
        top: drag.top + point.y - drag.startY,
      },
      drag.width,
      drag.height,
    )
    if (!next) return
    if (
      Math.abs(point.x - drag.startX) > 4 ||
      Math.abs(point.y - drag.startY) > 4
    ) {
      drag.moved = true
      clearSharedLauncherLongPress()
    }
    if (!drag.draggable) return
    try {
      launcher.setStyle({
        left: `${next.left}px`,
        top: `${next.top}px`,
      })
      drag.position = next
      state.sharedLauncherPosition = next
    } catch (error) {
      state.sharedLauncherDrag = null
    }
  })
  const finishDrag = () => {
    clearSharedLauncherLongPress()
    const drag = state.sharedLauncherDrag
    state.sharedLauncherDrag = null
    if (state.sharedLauncherLongPressTriggered) {
      state.sharedLauncherLongPressTriggered = false
      return
    }
    if (!drag || !drag.moved) return
    if (drag.position) saveSharedLauncherPosition(drag.position)
    state.suppressLauncherClickUntil = Date.now() + 300
  }
  launcher.addEventListener('touchend', finishDrag)
  try {
    launcher.addEventListener('touchcancel', finishDrag)
  } catch (error) {}
  launcher.addEventListener('click', () => {
    if (Date.now() < state.suppressLauncherClickUntil) return
    openSharedWebview()
  })
}

function ensureSharedLauncher() {
  if (
    typeof plus === 'undefined' ||
    !plus.nativeObj ||
    typeof plus.nativeObj.View !== 'function'
  ) {
    return null
  }
  if (state.sharedLauncher) return state.sharedLauncher

  const NativeView = plus.nativeObj.View
  const options = getSharedWebviewOptions()
  const id = options.launcherId || SHARED_LAUNCHER_ID
  let launcher = null
  try {
    if (typeof NativeView.getViewById === 'function') {
      launcher = NativeView.getViewById(id)
      if (launcher && typeof launcher.close === 'function') {
        launcher.close()
        launcher = null
      }
    }
    if (!launcher) {
      const layout = getSharedLayout()
      launcher = new NativeView(id, layout.launcherStyle, layout.launcherTags)
    }
  } catch (error) {
    return null
  }

  state.sharedLauncher = launcher
  bindSharedLauncher(launcher)
  return launcher
}

function showSharedLauncher(force = false) {
  if (!force && isSharedLauncherHidden()) return
  const launcher = ensureSharedLauncher()
  if (!launcher || typeof launcher.show !== 'function') return
  try {
    if (typeof launcher.setStyle === 'function') {
      launcher.setStyle(getSharedLayout().launcherStyle)
    }
    launcher.show()
  } catch (error) {
    state.sharedLauncher = null
  }
}

function showVConsoleLauncher() {
  if (!isEnabled()) return
  saveSharedLauncherHidden(false)
  showSharedLauncher(true)
}

function hideVConsoleLauncher() {
  saveSharedLauncherHidden(true)
  const launcher = state.sharedLauncher
  if (!launcher || typeof launcher.hide !== 'function') return
  try {
    launcher.hide()
  } catch (error) {
    state.sharedLauncher = null
  }
}

function bindSharedWebview(webview) {
  if (
    !webview ||
    state.sharedWebviewListeners.has(webview) ||
    typeof webview.addEventListener !== 'function'
  ) {
    return
  }

  state.sharedWebviewListeners.add(webview)
  webview.addEventListener('loaded', () => {
    if (getOptions().webviewScope !== 'shared') {
      return
    }
    state.sharedWebview = webview
    injectVConsole({}, webview)
    showSharedLauncher()
  })
  webview.addEventListener('close', () => {
    if (state.sharedWebview === webview) {
      state.sharedWebview = null
    }
    forgetInjectedWebview(webview)
  })
}

function ensureSharedWebview() {
  if (
    typeof plus === 'undefined' ||
    !plus.webview ||
    typeof plus.webview.create !== 'function'
  ) {
    return null
  }

  if (state.sharedWebview && typeof state.sharedWebview.evalJS === 'function') {
    return state.sharedWebview
  }

  const options = getSharedWebviewOptions()
  const id = options.id || SHARED_WEBVIEW_ID
  let webview = null
  let created = false
  try {
    if (typeof plus.webview.getWebviewById === 'function') {
      webview = plus.webview.getWebviewById(id)
    }
    if (!webview) {
      created = true
      webview = plus.webview.create(
        options.path || SHARED_WEBVIEW_PATH,
        id,
        getSharedLayout().webviewStyle,
        { __sVConsoleShared: true },
      )
    }
  } catch (error) {
    return null
  }

  state.sharedWebview = webview
  bindSharedWebview(webview)
  if (created && typeof webview.hide === 'function') {
    try {
      webview.hide('none', 0)
    } catch (error) {}
  }
  showSharedLauncher()
  return webview
}

function getWebviewVisibility(webview) {
  if (!webview || typeof webview.isVisible !== 'function') {
    return null
  }
  try {
    return !!webview.isVisible()
  } catch (error) {
    return false
  }
}

function getTargetWebviews(targetWebview) {
  const scope = getOptions().webviewScope
  if (scope === 'shared') {
    const webview = ensureSharedWebview()
    return webview ? [webview] : []
  }
  if (scope === 'all') {
    return getAppWebviews().filter(
      webview => webview && typeof webview.evalJS === 'function',
    )
  }
  if (targetWebview && typeof targetWebview.evalJS === 'function') {
    return [targetWebview]
  }
  if (state.activeWebview && typeof state.activeWebview.evalJS === 'function') {
    return [state.activeWebview]
  }

  const webviews = getAppWebviews().filter(
    webview => webview && typeof webview.evalJS === 'function',
  )
  const visibleWebviews = webviews.filter(
    webview => getWebviewVisibility(webview) === true,
  )
  return visibleWebviews.length
    ? visibleWebviews
    : webviews.slice(Math.max(0, webviews.length - 1))
}

function resolvePageWebview(context) {
  const candidates = [context && context.$scope, context]
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    if (!candidate || typeof candidate.$getAppWebview !== 'function') {
      continue
    }
    try {
      const webview = candidate.$getAppWebview()
      if (webview && typeof webview.evalJS === 'function') {
        return webview
      }
    } catch (error) {
      // The page WebView may not be ready during an early onShow hook.
    }
  }
  return null
}

function activatePageWebview(context) {
  const webview = resolvePageWebview(context)
  if (webview) {
    state.activeWebview = webview
  }
  return webview
}

function deactivatePageWebview(context) {
  const webview = resolvePageWebview(context)
  if (!webview) {
    return
  }
  if (state.activeWebview === webview) {
    state.activeWebview = null
  }
  forgetInjectedWebview(webview)
}

function evalInWebviews(script, targetWebviews) {
  const evaluatedWebviews = []
  const webviews = targetWebviews || getTargetWebviews()
  webviews.forEach(webview => {
    if (!webview || typeof webview.evalJS !== 'function') {
      return
    }

    try {
      webview.evalJS(script)
      evaluatedWebviews.push(webview)
    } catch (error) {
      forgetInjectedWebview(webview)
      if (state.sharedWebview === webview) {
        state.sharedWebview = null
      }
      if (state.activeWebview === webview) {
        state.activeWebview = null
      }
    }
  })
  return evaluatedWebviews
}

function getHistoryLimit(group, key, fallback) {
  const options = getOptions()[group] || {}
  const value = Number(options[key])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function trimHistory(list, max) {
  if (list.length > max) {
    list.splice(0, list.length - max)
  }
}

function rememberLogItem(level, args) {
  if (!getOptions().persistLogs) {
    return null
  }

  const item = {
    id: `vconsole-log-${state.sessionId}-${++state.logId}`,
    level: normalizeConsoleLevel(level),
    args,
  }
  state.logHistory.push(item)
  trimHistory(state.logHistory, getHistoryLimit('log', 'maxLogNumber', 200))
  return item
}

function rememberNetworkItem(item) {
  const next = {
    ...item,
    header: maskHeaders(item.header),
    requestHeader: maskHeaders(item.requestHeader),
    response: safeSerialize(item.response),
    postData: safeSerialize(item.postData),
  }
  if (!getOptions().persistNetwork) {
    return next
  }

  const index = state.networkHistory.findIndex(
    historyItem => historyItem.id === next.id,
  )
  if (index >= 0) {
    state.networkHistory.splice(index, 1, next)
  } else {
    state.networkHistory.push(next)
  }
  trimHistory(
    state.networkHistory,
    getHistoryLimit('network', 'maxNetworkNumber', 100),
  )
  return next
}

function getStorageHistoryValue(value) {
  const next = safeSerialize(value)
  if (typeof next === 'string') {
    return next
  }

  try {
    return JSON.stringify(next)
  } catch (error) {
    return String(next)
  }
}

function rememberStorageItem(action, key, value) {
  if (!getOptions().persistStorage) {
    return
  }

  if (action === 'clear') {
    state.storageHistory = Object.create(null)
    return
  }

  const storageKey = String(key)
  if (action === 'remove') {
    delete state.storageHistory[storageKey]
    return
  }

  if (action === 'set') {
    state.storageHistory[storageKey] = getStorageHistoryValue(value)
  }
}

function getStorageHistoryList() {
  return Object.keys(state.storageHistory).map(key => ({
    key,
    value: state.storageHistory[key],
  }))
}

function safeSerialize(value) {
  if (typeof value === 'undefined') {
    return 'undefined'
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }
  if (!value || typeof value !== 'object') {
    return value
  }

  const seen = new WeakSet()
  try {
    const json = JSON.stringify(value, (_key, item) => {
      if (typeof item === 'bigint') {
        return item.toString()
      }
      if (typeof item === 'function') {
        return `[Function ${item.name || 'anonymous'}]`
      }
      if (item instanceof Error) {
        return {
          name: item.name,
          message: item.message,
          stack: item.stack,
        }
      }
      if (item && typeof item === 'object') {
        if (seen.has(item)) {
          return '[Circular]'
        }
        seen.add(item)
      }
      return item
    })

    if (json.length > 12000) {
      return {
        __truncated: true,
        text: json.slice(0, 12000),
      }
    }

    return JSON.parse(json)
  } catch (error) {
    return String(value)
  }
}

function shouldMaskHeader(key) {
  const maskHeaderKeys = getOptions().maskHeaderKeys || []
  return maskHeaderKeys.some(item => {
    if (item instanceof RegExp) {
      return item.test(key)
    }

    return String(key).toLowerCase().indexOf(String(item).toLowerCase()) >= 0
  })
}

function maskHeaders(headers) {
  const source = headers || {}
  return Object.keys(source).reduce((result, key) => {
    result[key] = shouldMaskHeader(key) ? '***' : source[key]
    return result
  }, {})
}

function getResponseSize(value) {
  try {
    return JSON.stringify(value == null ? '' : value).length
  } catch (error) {
    return String(value == null ? '' : value).length
  }
}

function normalizeRequestResult(result, unwrapPromiseTuple = false) {
  let value = result

  if (
    unwrapPromiseTuple &&
    Array.isArray(value) &&
    value.length === 2 &&
    (value[0] == null || value[1] == null)
  ) {
    if (value[0] != null) {
      return {
        status: 0,
        statusText: 'Fail',
        response: value[0],
        header: {},
      }
    }
    value = value[1]
  }

  const isObject = value !== null && typeof value === 'object'
  const hasOwn = key =>
    isObject && Object.prototype.hasOwnProperty.call(value, key)
  const isTransportResponse =
    hasOwn('data') &&
    (hasOwn('statusCode') || (hasOwn('status') && hasOwn('headers')))

  if (!isTransportResponse) {
    return {
      status: 200,
      statusText: '200',
      response: value,
      header: {},
    }
  }

  const statusValue = hasOwn('statusCode') ? value.statusCode : value.status
  const status = Number(statusValue) || 200
  return {
    status,
    statusText: String(status),
    response: value.data,
    header: value.header || value.headers || {},
  }
}

function formatBytes(size) {
  if (size < 1024) {
    return `${size} B`
  }

  return `${(size / 1024).toFixed(1)} KB`
}

function formatTime(time) {
  const date = new Date(time)
  const pad = (value, length = 2) => `${value}`.padStart(length, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

function normalizeConsoleLevel(level) {
  const value = String(level || 'log')
  return consoleLevels.indexOf(value) >= 0 ? value : 'log'
}

function ensureRecentInjection() {
  const targetWebviews = getTargetWebviews()
  if (
    !targetWebviews.length ||
    targetWebviews.every(webview => hasInjectedWebview(webview))
  ) {
    return
  }

  const now = Date.now()
  if (now - state.lastInjectTime < getOptions().injectThrottle) {
    return
  }

  state.lastInjectTime = now
  injectVConsole()
}

function pushVConsoleLog(level, ...args) {
  if (!isEnabled() || typeof plus === 'undefined' || !plus.webview) {
    return
  }

  ensureRecentInjection()
  const serializedArgs = args.map(safeSerialize)
  const item = rememberLogItem(level, serializedArgs)
  const payload = JSON.stringify(
    item || {
      level: normalizeConsoleLevel(level),
      args: serializedArgs,
    },
  )
  const script = `
;(function () {
  var item = ${payload};
  if (window.__UNI_VCONSOLE_PUSH_LOG_ITEM__) {
    window.__UNI_VCONSOLE_PUSH_LOG_ITEM__(item);
    return;
  }
  window.__UNI_VCONSOLE_QUEUE__ = window.__UNI_VCONSOLE_QUEUE__ || [];
  window.__UNI_VCONSOLE_QUEUE__.push([item.level, item.args, item.id]);
})();
`

  evalInWebviews(script)
}

function pushVConsoleNetwork(item) {
  if (!isEnabled() || typeof plus === 'undefined' || !plus.webview) {
    return
  }

  ensureRecentInjection()
  const payload = JSON.stringify(rememberNetworkItem(item))
  const script = `
;(function () {
  var item = ${payload};
  if (window.__UNI_VCONSOLE_PUSH_NETWORK__) {
    window.__UNI_VCONSOLE_PUSH_NETWORK__(item);
    return;
  }
  window.__UNI_VCONSOLE_NETWORK_QUEUE__ = window.__UNI_VCONSOLE_NETWORK_QUEUE__ || [];
  window.__UNI_VCONSOLE_NETWORK_QUEUE__.push(item);
})();
`

  evalInWebviews(script)
}

function pushVConsoleStorage(action, key, value) {
  if (
    !isEnabled() ||
    !getOptions().captureStorage ||
    typeof plus === 'undefined' ||
    !plus.webview
  ) {
    return
  }

  ensureRecentInjection()
  rememberStorageItem(action, key, value)
  const payload = JSON.stringify({
    action,
    key,
    value: safeSerialize(value),
    updateTimeText: formatTime(Date.now()),
  })
  const script = `
;(function () {
  try {
    var item = ${payload};
    var prefix = 'uni-storage:';
    if (typeof localStorage !== 'undefined') {
      if (item.action === 'clear') {
        for (var i = localStorage.length - 1; i >= 0; i--) {
          var storageKey = localStorage.key(i);
          if (storageKey && storageKey.indexOf(prefix) === 0) {
            localStorage.removeItem(storageKey);
          }
        }
      } else if (item.action === 'remove') {
        localStorage.removeItem(prefix + item.key);
      } else if (item.action === 'set') {
        var value = item.value;
        if (typeof value !== 'string') {
          try {
            value = JSON.stringify(value);
          } catch (error) {
            value = String(value);
          }
        }
        localStorage.setItem(prefix + item.key, value);
      }
    }
    var vc = window.__VCONSOLE__;
    if (vc && typeof vc.setOption === 'function') {
      vc.setOption('storage.defaultStorages', ['localStorage', 'sessionStorage', 'cookies']);
    }
    var storagePlugin = window.__VCONSOLE__ && window.__VCONSOLE__.pluginList && window.__VCONSOLE__.pluginList.storage;
    if (storagePlugin && storagePlugin.model && typeof storagePlugin.model.refresh === 'function') {
      storagePlugin.model.refresh();
    }
  } catch (error) {
  }
})();
`

  evalInWebviews(script)
}

function installConsoleBridge() {
  const root = typeof globalThis !== 'undefined' ? globalThis : {}
  if (root[CONSOLE_BRIDGE_FLAG] || !getOptions().captureConsole) {
    return
  }

  root[CONSOLE_BRIDGE_FLAG] = true
  consoleLevels.forEach(level => {
    const original = (console[level] || console.log).bind(console)
    console[level] = (...args) => {
      original(...args)
      if (state.suppressConsoleCapture) {
        return
      }
      pushVConsoleLog(level, ...args)
    }
  })
}

function installAppLogBridge() {
  const root = typeof globalThis !== 'undefined' ? globalThis : {}
  if (!getOptions().captureConsole) {
    return
  }

  if (typeof uni === 'undefined' || typeof uni.__log__ !== 'function') {
    return
  }

  if (root[APP_LOG_BRIDGE_FLAG] && uni.__log__.__UNI_VCONSOLE_WRAPPED__) {
    return
  }

  const originalLog = (
    uni.__log__.__UNI_VCONSOLE_ORIGINAL__ || uni.__log__
  ).bind(uni)
  uni.__log__ = (type, filename, ...args) => {
    state.suppressConsoleCapture = true
    try {
      originalLog(type, filename, ...args)
    } finally {
      state.suppressConsoleCapture = false
    }

    const level = normalizeConsoleLevel(type)
    const logArgs = filename ? [...args, filename] : args
    pushVConsoleLog(level, ...logArgs)
  }
  uni.__log__.__UNI_VCONSOLE_WRAPPED__ = true
  uni.__log__.__UNI_VCONSOLE_ORIGINAL__ = originalLog
  root[APP_LOG_BRIDGE_FLAG] = true
}

function installStorageBridge() {
  const root = typeof globalThis !== 'undefined' ? globalThis : {}
  if (root[STORAGE_BRIDGE_FLAG] || !getOptions().captureStorage) {
    return
  }

  if (typeof uni === 'undefined') {
    return
  }

  root[STORAGE_BRIDGE_FLAG] = true

  if (typeof uni.setStorageSync === 'function') {
    const originalSetStorageSync = uni.setStorageSync.bind(uni)
    uni.setStorageSync = (key, data) => {
      const result = originalSetStorageSync(key, data)
      pushVConsoleStorage('set', key, data)
      return result
    }
  }

  if (typeof uni.removeStorageSync === 'function') {
    const originalRemoveStorageSync = uni.removeStorageSync.bind(uni)
    uni.removeStorageSync = key => {
      const result = originalRemoveStorageSync(key)
      pushVConsoleStorage('remove', key)
      return result
    }
  }

  if (typeof uni.clearStorageSync === 'function') {
    const originalClearStorageSync = uni.clearStorageSync.bind(uni)
    uni.clearStorageSync = () => {
      const result = originalClearStorageSync()
      pushVConsoleStorage('clear')
      return result
    }
  }
}

function installRequestBridge() {
  const root = typeof globalThis !== 'undefined' ? globalThis : {}
  if (root[REQUEST_BRIDGE_FLAG] || !getOptions().captureRequest) {
    return
  }

  if (typeof uni === 'undefined' || !uni.request) {
    return
  }

  root[REQUEST_BRIDGE_FLAG] = true
  const originalRequest = uni.request.bind(uni)

  uni.request = (options = {}) => {
    const currentRequestId = ++state.requestId
    const id = `vconsole-request-${state.sessionId}-${currentRequestId}`
    const method = (options.method || 'GET').toUpperCase()
    const startTime = Date.now()
    const hasCallback = !!(options.success || options.fail || options.complete)
    const baseItem = {
      id,
      method,
      url: options.url,
      status: 0,
      statusText: 'Pending',
      readyState: 1,
      requestType: 'custom',
      requestHeader: options.header || {},
      responseType: options.responseType || '',
      startTime,
      startTimeText: formatTime(startTime),
      postData: options.data,
      noVConsole: false,
    }

    const updateNetwork = (status, statusText, response, header) => {
      const endTime = Date.now()
      const responseSize = getResponseSize(response)
      pushVConsoleNetwork({
        ...baseItem,
        status,
        statusText,
        readyState: 4,
        header: header || {},
        response,
        responseSize,
        responseSizeText: formatBytes(responseSize),
        endTime,
        costTime: endTime - startTime,
      })
    }

    const updateNetworkFromResult = (result, unwrapPromiseTuple = false) => {
      const normalized = normalizeRequestResult(result, unwrapPromiseTuple)
      updateNetwork(
        normalized.status,
        normalized.statusText,
        normalized.response,
        normalized.header,
      )
    }

    const userSuccess = options.success
    const userFail = options.fail
    const userComplete = options.complete
    const patchedOptions = hasCallback
      ? {
          ...options,
          success(res) {
            updateNetworkFromResult(res)
            if (typeof userSuccess === 'function') {
              userSuccess(res)
            }
          },
          fail(err) {
            updateNetwork(0, 'Fail', err)
            if (typeof userFail === 'function') {
              userFail(err)
            }
          },
          complete(res) {
            if (typeof userComplete === 'function') {
              userComplete(res)
            }
          },
        }
      : options

    const result = originalRequest(patchedOptions)
    baseItem.url = patchedOptions.url || options.url
    baseItem.requestHeader = patchedOptions.header || options.header || {}

    pushVConsoleNetwork(baseItem)

    if (result && typeof result.then === 'function' && !hasCallback) {
      result.then(
        res => {
          updateNetworkFromResult(res, true)
        },
        err => {
          updateNetwork(0, 'Fail', err)
        },
      )
    }

    return result
  }
}

function configureVConsole(options = {}) {
  state.options = mergeOptions(state.options, options)
  return state.options
}

function injectVConsole(options = {}, targetWebview) {
  if (isPlainObject(options)) {
    configureVConsole(options)
  }

  if (!isEnabled()) {
    return
  }

  if (state.injectTimer) {
    clearTimeout(state.injectTimer)
    state.injectTimer = null
  }

  if (typeof plus === 'undefined') {
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('plusready', () => injectVConsole(), {
        once: true,
      })
    }
    return
  }

  const targetWebviews = getTargetWebviews(targetWebview)
  if (!targetWebviews.length) {
    return
  }

  evalInWebviews(createInitScript(), targetWebviews).forEach(
    markInjectedWebview,
  )
  state.injectTimer = setTimeout(() => {
    evalInWebviews(createInitScript(false), targetWebviews)
    state.injectTimer = null
  }, getOptions().injectDelay)
}

function installLifecycleMixin(appOrVue) {
  if (
    state.lifecycleInstalled ||
    !getOptions().lifecycle ||
    !appOrVue ||
    typeof appOrVue.mixin !== 'function'
  ) {
    return
  }

  state.lifecycleInstalled = true
  appOrVue.mixin({
    onShow() {
      if (!isEnabled()) {
        return
      }
      if (getOptions().webviewScope === 'shared') {
        const webview = ensureSharedWebview()
        showSharedLauncher()
        if (webview && !hasInjectedWebview(webview)) {
          injectVConsole({}, webview)
        }
        return
      }
      const webview = activatePageWebview(this)
      injectVConsole({}, webview)
    },
    onReady() {
      if (!isEnabled()) {
        return
      }
      if (getOptions().webviewScope === 'shared') {
        ensureSharedWebview()
        showSharedLauncher()
        return
      }
      const webview = activatePageWebview(this)
      injectVConsole({}, webview)
    },
    onUnload() {
      if (getOptions().webviewScope === 'active') {
        deactivatePageWebview(this)
      }
    },
  })
}

function installVConsole(options = {}) {
  configureVConsole(options)

  if (!isEnabled()) {
    return
  }

  if (getOptions().autoInject) {
    injectVConsole()
  }
  installAppLogBridge()
  installConsoleBridge()
  installStorageBridge()
  installRequestBridge()
}

const plugin = {
  install(appOrVue, options = {}) {
    installVConsole(options)
    installLifecycleMixin(appOrVue)
  },
}

export {
  configureVConsole,
  hideVConsoleLauncher,
  injectVConsole,
  installVConsole,
  pushVConsoleLog,
  pushVConsoleNetwork,
  pushVConsoleStorage,
  showVConsoleLauncher,
}

export default plugin
