/**
 * 响应状态
 * @property success 成功
 * @property fail 失败
 */
export enum ResStatus {
  success = 'success',
  fail = 'failed'
}

/**
 * 注册h或者登录结果消息接口
 * @property status 响应状态
 * @property message 响应消息
 * @property data 响应数据
 */
export type RegistRes = {
  status: ResStatus
  message: string
  data: User & { needInitPassword?: boolean }
}

/**
 * 余额明细
 * @property total 总余额
 * @property personalPackageRemaining 个人资源包总剩余
 * @property personalBalance 个人余额
 * @property organizationPackageRemaining 组织资源包总剩余（仅开启组织余额共享时存在）
 * @property organizationBalance 组织余额（仅开启组织余额共享时存在）
 */
export interface BalanceDetail {
  total: number
  personalPackageRemaining: number
  personalBalance: number
  organizationPackageRemaining?: number
  organizationBalance?: number
}

/**
 * 用户信息
 * @property _id 用户id
 * @property nickname 用户名
 * @property password 密码
 * @property username 用户名
 * @property wx_openid 微信openid
 * @property wx_unionid 微信unionid
 * @property avatar_url 头像url
 * @property email 邮箱
 * @property inviter_uid 邀请人id
 * @property last_login_date 最后一次登录时间
 * @property register_date 注册时间
 * @property last_login_ip 最后一次登录ip
 * @property mobile 手机号
 * @property my_invite_code 我的邀请码
 * @property role 用户角色
 * @property token 登录token
 * @property socket_id 用户socket id
 * @property status 用户状态
 * @property balance 用户余额
 * @property balanceDetail 余额明细
 */
export interface User {
  _id: string
  nickname?: string
  password?: string
  username: string
  wx_openid?: string
  wx_unionid?: string
  qyweixin_userid?: string // 企业微信成员 userid，用于 IM 消息与系统用户关联
  feishu_open_id?: string
  feishu_union_id?: string
  avatar_url?: string
  email?: string
  inviter_uid?: string | User
  last_login_date?: number
  register_date?: number
  last_login_ip?: string
  mobile?: string
  my_invite_code?: string[]
  role?: RoleEnum[]
  token?: string
  refresh_token?: string
  socket_id?: string
  status?: 0 | 1 | 2 // 0:正常，1:禁用，2:删除
  balance?: number // 余额
  balanceDetail?: BalanceDetail // 余额明细
  points?: number // 积分
  organizations?: Array<Pick<IOrganization, '_id' | 'name' | 'admin_ids'>> // 组织id列表
  totalPower?: number // 总积分
}

/**
 * 微信用户信息
 * @property openid 微信openid
 * @property nickname 用户名
 * @property sex 性别
 * @property language 语言
 * @property city 城市
 * @property province 省份
 * @property country 国家
 * @property headimgurl 头像url
 * @property privilege 用户特权信息
 * @property unionid 用户唯一标识
 * @property inviteCode 邀请码
 */
export interface WechatUser {
  openid: string
  nickname: string
  sex: number
  language: string
  city: string
  province: string
  country: string
  headimgurl: string
  privilege: any[]
  unionid: string
  inviteCode?: string
}

/**
 * 用户权限
 * @property PUBLIC 游客
 * @property USER 普通用户
 * @property CREATOR 创作者
 * @property OPERATOR 运营人员
 * @property MANAGER 普通管理员
 * @property ADMIN 超级管理员
 */
export enum RoleEnum {
  // 游客
  PUBLIC = 'public',
  // 普通用户
  USER = 'user',
  // 创作者
  CREATOR = 'creator',
  // 运营人员
  OPERATOR = 'operator',
  // 普通管理员
  MANAGER = 'manager',
  // 超级管理员
  ADMIN = 'admin'
}

/**
 * 菜单项
 * @property text 显示文本
 * @property icon 图标
 * @property key 唯一键值
 * @property link 链接
 * @property authority 权限
 * @property capability 产品能力
 * @property items 子菜单项
 */
export interface MenuItem {
  text: string
  icon?: string
  key?: string
  link?: string
  authority?: RoleEnum[]
  capability?: 'app' | 'agent'
  items?: MenuItem[]
  _featureKey?: string
}

/**
 * 消息类型
 * @property login 登录消息
 * @property resetPassword 重置密码消息
 * @property bindPhone 绑定手机消息
 */
export enum msgTypeEnum {
  login = 'login',
  resetPassword = 'resetPassword',
  bindPhone = 'bindPhone'
}

/**
 * 本地存储键值
 * @property inviteCode 邀请码
 * @property keywordList 关键词列表
 * @property drawEditor 画图编辑器
 */
export const enum localStorageKeyEnum {
  inviteCode = 'INVITE_CODE',
  keywordList = 'KEYWORD_LIST',
  drawEditor = 'DRAW_EDITOR',
  redirectPath = 'REDIRECT_PATH'
}

/**
 * 发送邮件消息类型
 */
export const CloudMailSceneTypeConst = {
  bindEmail: 'bindEmail',
  login: 'login',
  initPassword: 'initPassword'
} as const

export type ICloudMailSceneTypeEnum =
  (typeof CloudMailSceneTypeConst)[keyof typeof CloudMailSceneTypeConst]

export const RegisterTypeConst = {
  password: 'password',
  email: 'email'
} as const

export type RegisterType =
  (typeof RegisterTypeConst)[keyof typeof RegisterTypeConst]
