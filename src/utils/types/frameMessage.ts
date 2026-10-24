/** 消息通信接口 */

/**
 * 登录消息
 * @property username 用户名
 * @property password 密码
 * @property balance 用户余额
 */
export interface ILoginMessage {
  account: string
  password: string
  balance: number
}

/** 消息类型
 * @enum NAV_HOME 导航到首页
 * @enum NAV_ROUTE_CHANGE 路由改变
 * @enum AUTH_LOGIN 登录
 * @enum FILE_DOWNLOAD 文件下载
 * @enum TASK_START 绘图任务开始
 * */
export const enum MessageTypeEnum {

  // 导航相关
  NAV_HOME = 'nav_home',
  NAV_ROUTE_CHANGE = 'nav_route_change',

  AUTH_LOGIN = 'auth_login',

  FILE_DOWNLOAD = 'file_download',

  // AI绘图任务相关
  TASK_START = 'task_start',
  TASK_END = 'task_end',

  // 微信开放平台登录
  WECHAT_OPENPLATFORM_LOGIN = 'authenticated'
}

/** 消息映射 */
export type MessageMapping = {
  [MessageTypeEnum.NAV_HOME]: null
  [MessageTypeEnum.NAV_ROUTE_CHANGE]: { path: string }
  [MessageTypeEnum.AUTH_LOGIN]: ILoginMessage
  [MessageTypeEnum.FILE_DOWNLOAD]: {
    fileName: string
  }
  [MessageTypeEnum.TASK_START]: {
    taskId: string
  }
  [MessageTypeEnum.TASK_END]: {
    taskId: string
    result: DrawResponse
  }
}

export interface IMessagePayload<T extends MessageTypeEnum> {
  type: T
  data: MessageMapping[T]
  timestamp: number
  token?: string
}
