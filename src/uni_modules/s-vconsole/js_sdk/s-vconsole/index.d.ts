export type VConsoleEnabled = boolean | (() => boolean)

export type VConsoleWebviewScope = 'shared' | 'active' | 'all'

export interface VConsoleSharedWebviewOptions {
  id?: string
  launcherId?: string
  path?: string
  width?: number
  height?: number
  right?: number
  bottom?: number
  zindex?: number
  draggable?: boolean
  launcherColor?: string
  launcherText?: string
  launcherTextColor?: string
  launcherFontFamily?: string
  launcherFontSize?: number
  longPressDuration?: number
  longPressToHide?: boolean
  showLauncher?: boolean
  style?: Record<string, any>
}

export interface VConsoleOptions {
  enabled?: VConsoleEnabled
  captureConsole?: boolean
  captureRequest?: boolean
  captureStorage?: boolean
  persistLogs?: boolean
  persistNetwork?: boolean
  persistStorage?: boolean
  persistSwitchPosition?: boolean
  autoInject?: boolean
  lifecycle?: boolean
  injectDelay?: number
  injectThrottle?: number
  webviewScope?: VConsoleWebviewScope
  sharedWebview?: VConsoleSharedWebviewOptions
  scriptPath?: string
  scriptPaths?: string[]
  theme?: 'light' | 'dark' | string
  log?: Record<string, any>
  network?: Record<string, any>
  vConsoleOptions?: Record<string, any>
  maskHeaderKeys?: Array<string | RegExp>
}

export interface VConsoleNetworkItem {
  id: string
  method?: string
  url?: string
  status?: number | string
  statusText?: string
  readyState?: number
  header?: Record<string, any>
  responseType?: string
  requestType?: 'custom'
  requestHeader?: Record<string, any>
  response?: any
  responseSize?: number
  responseSizeText?: string
  startTime?: number
  startTimeText?: string
  endTime?: number
  costTime?: number
  getData?: Record<string, any> | null
  postData?: any
  noVConsole?: boolean
}

export type VConsoleLogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

export function configureVConsole(options?: VConsoleOptions): VConsoleOptions
export function hideVConsoleLauncher(): void
export function installVConsole(options?: VConsoleOptions): void
export function injectVConsole(options?: VConsoleOptions): void
export function pushVConsoleLog(level: VConsoleLogLevel, ...args: any[]): void
export function pushVConsoleNetwork(item: VConsoleNetworkItem): void
export function showVConsoleLauncher(): void

declare const plugin: {
  install(appOrVue: any, options?: VConsoleOptions): void
}

export default plugin
