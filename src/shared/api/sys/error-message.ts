import { HttpError } from "@/shared/api/sys/http";

type TraceMetadata = {
  traceId?: string;
  requestedAt?: string;
  tenantId?: string;
};

type ErrorResponse = {
  code?: string;
  message?: string;
  data?: unknown;
  trace?: TraceMetadata;
};

type HttpErrorLike = {
  status?: number;
  body?: unknown;
  trace?: TraceMetadata;
  traceId?: string;
  message?: string;
};

type ErrorHint = {
  title?: string;
  description: string;
};

const ROUTING_PROFILE_NOT_MATCHED_HINT: ErrorHint = {
  title: "路由未配置",
  description:
    "当前场景没有启用中的路由策略。请到「路由管理」打开已启用策略，为对应入口（如视频生成入口）绑定目标模型池并保存；只打开编辑页不保存不会生效。再在「业务配置」确认该业务已启用且绑定同一入口后重试。",
};

const ROUTING_ENTRY_NOT_FOUND_HINT: ErrorHint = {
  title: "路由入口未配置",
  description:
    "当前路由策略缺少该场景入口。请到「路由管理」打开已启用策略，为对应入口（如视频生成入口）绑定目标模型池并保存后再试。",
};

const REQUESTED_MODEL_NOT_OPEN_HINT: ErrorHint = {
  title: "模型未开通",
  description:
    "当前选择的模型未在该入口绑定的路由池中开通。未配置可执行模型时使用默认路由池；已配置则还须在名单内。请更换模型，或到「路由管理」将该模型加入目标模型池后再试。",
};

const CHANNEL_BALANCE_HINT: ErrorHint = {
  title: "渠道余额不足",
  description: "渠道账户余额不足，请到渠道控制台充值后再试",
};

const CHANNEL_JOB_FAILED_HINT: ErrorHint = {
  title: "生成失败",
  description: "渠道生成任务失败，请稍后重试",
};

/**
 * 后端 error.code → 前端可展示文案的映射表。
 *
 * 设计目标：
 * - 将“错误码到用户提示”的策略集中在单点，避免各页面散写导致口径漂移；
 * - 文案尽量面向用户，保留一致的兜底路径（fallback）。
 */
const CODE_HINT_MAP: Record<string, ErrorHint> = {
  "COMMON-AUTH-401": { title: "未登录", description: "登录已失效或尚未登录，请重新登录后重试" },
  "AUTH-401": { title: "未登录", description: "登录已失效或尚未登录，请重新登录后重试" },
  "AUTH-ACCOUNT-DISABLED": { title: "账号被封禁", description: "您的账号已被管理员封禁，暂时无法登录和操作。如有疑问请联系客服或管理员。" },
  "COMMON-FORBIDDEN-403": { title: "无权限", description: "暂无权限执行该操作" },
  "AUTH-403": { title: "无权限", description: "暂无权限执行该操作" },
  "AUTH-428-PHONE-BIND-REQUIRED": { title: "需要绑定手机号", description: "请绑定手机号以完成登录" },
  "AUTH-400-BIND-TOKEN-INVALID": { title: "绑定无效", description: "绑定流程无效，请重新发起登录后再试" },
  "AUTH-410-BIND-TOKEN-EXPIRED": { title: "绑定已过期", description: "绑定流程已过期，请重新发起登录并完成绑定" },
  "AUTH-409-IDENTIFIER-CONFLICT": { title: "账号冲突", description: "当前标识已被其他账号占用，请更换信息或联系客服处理" },
  "AUTH-409-WECHAT-MERGE": { title: "微信已被占用", description: "当前微信标识已绑定到其他账号，请联系客服处理" },
  "AUTH-WECHAT-CODE-INVALID": { title: "微信授权失败", description: "微信授权码无效或已过期，请重新授权登录" },
  "AUTH-WECHAT-NOT-CONFIGURED": { title: "微信未配置", description: "微信登录通道未配置，请联系管理员在系统中启用公众号" },
  "AUTH-SSO-NOT-CONFIGURED": { title: "第三方登录未配置", description: "钉钉/谷歌/飞书登录通道未配置或未启用，请联系管理员" },
  "AUTH-SSO-CODE-INVALID": { title: "授权失败", description: "第三方授权码无效或已过期，请返回登录页重新授权" },
  "AUTH-500-SMS-NOT-CONFIGURED": { title: "短信未开通", description: "短信验证码通道未配置或未启用，请联系管理员" },
  "AUTH-429-OTP-SEND-TOO-FREQUENT": { title: "发送过于频繁", description: "验证码发送过于频繁，请稍后再试" },
  "AUTH-500-SMS-SEND-FAILED": { title: "短信发送失败", description: "验证码短信发送失败，请稍后重试；若持续失败请联系管理员检查短信通道配置" },
  "AUTH-500-EMAIL-NOT-CONFIGURED": { title: "邮箱未开通", description: "邮箱验证码通道未配置或未启用，请联系管理员" },
  "AUTH-500-EMAIL-SEND-FAILED": { title: "邮件发送失败", description: "验证码邮件发送失败，请稍后重试；若持续失败请联系管理员检查邮件通道配置" },
  "AUTH-INVALID-PHONE": { title: "手机号错误", description: "手机号格式不正确，请检查后重试" },
  "AUTH-INVALID-EMAIL": { title: "邮箱错误", description: "邮箱格式不正确，请检查后重试" },
  "AUTH-INVALID-IDENTIFIER": { title: "账号错误", description: "账号标识不合法，请检查后重试" },
  "AUTH-INVALID-CHANNEL": { title: "渠道错误", description: "认证渠道不合法，请刷新后重试" },
  "AUTH-IDENTIFIER-REQUIRED": { title: "缺少账号", description: "账号标识不能为空" },
  "AUTH-PASSWORD-REQUIRED": { title: "缺少密码", description: "密码不能为空" },
  "AUTH-PRINCIPAL-REQUIRED": { title: "缺少主体", description: "账号主体不能为空" },
  "AUTH-SESSION-REQUIRED": { title: "会话无效", description: "会话标识不能为空，请重新登录后重试" },
  "AUTH-SESSION-PRINCIPAL-MISMATCH": { title: "会话不匹配", description: "会话与账号不匹配，请重新登录后重试" },
  "AUTH-CONTEXT-REQUIRED": { title: "上下文缺失", description: "认证上下文不能为空，请重新发起登录后重试" },
  "AUTH-CRYPTO-OPERATION-FAILED": { title: "认证失败", description: "认证服务内部处理失败，请稍后重试" },
  "AUTH-INTERNAL-SECRET-MISSING": { title: "认证配置异常", description: "认证服务配置异常，请联系管理员处理" },
  "AUTH-INTERNAL-REMOTE-CALL-FAILED": { title: "服务暂不可用", description: "登录相关服务暂时不可用，请稍后重试；若持续出现请联系管理员" },
  "AUTH-BOOTSTRAP-ROLE-FAILED": { title: "认证初始化失败", description: "认证初始化失败，请联系管理员处理" },
  "COMMON-VALIDATION-001": { title: "参数错误", description: "参数校验失败，请检查输入后重试" },
  "COMMON-400": { title: "暂时无法完成", description: "当前操作条件不满足，请按提示补全配置后再试" },
  "COMMON-NOTFOUND-404": { title: "未找到", description: "资源不存在或已删除" },
  "COMMON-CONFLICT-409": { title: "冲突", description: "数据已存在或发生冲突，请检查后重试" },
  "COMMON-INTERNAL-500": { title: "系统错误", description: "系统繁忙，请稍后重试" },
  "COMMON-METHOD-405": { title: "不支持", description: "当前操作不被支持" },
  "INTEGRATION-RESOURCE-NOT-FOUND": { title: "未找到", description: "集成资源不存在或已删除" },
  "INTEGRATION-RESOURCE-ALREADY-EXISTS": { title: "已存在", description: "集成资源已存在，请勿重复创建或修改" },
  "INTEGRATION-PROVIDER-409-IN-USE": { title: "存在关联", description: "供应商仍被其他资源引用，暂时不能删除" },
  "INTEGRATION-MODEL-PROVIDER-HAS-MODEL-REFS": { title: "存在关联", description: "模型供应商下仍有关联模型" },
  "INTEGRATION-API-PLATFORM-TYPE-HAS-PLATFORM-REFS": { title: "存在关联", description: "接口平台类型下仍有关联平台" },
  "INTEGRATION-COMFYUI-SERVER-GROUP-HAS-SERVER-REFS": { title: "存在关联", description: "ComfyUI 服务分组下仍有关联服务" },
  "INTEGRATION-COMFYUI-SERVER-GROUP-COMMAND-REQUIRED": { title: "参数错误", description: "ComfyUI 服务分组参数不能为空" },
  "INTEGRATION-COMFYUI-SERVER-GROUP-NAME-ALREADY-EXISTS": { title: "分组已存在", description: "ComfyUI 服务分组名称已存在，请更换后重试" },
  "INTEGRATION-COMFYUI-SERVER-GROUP-NOT-FOUND": { title: "分组不存在", description: "ComfyUI 服务分组不存在或已被删除，请刷新后重试" },
  "INTEGRATION-COMFYUI-SERVER-COMMAND-REQUIRED": { title: "参数错误", description: "ComfyUI 服务请求不能为空" },
  "INTEGRATION-COMFYUI-SERVER-NOT-FOUND": { title: "服务不存在", description: "当前 ComfyUI 服务不存在或已被删除，请刷新后重试" },
  "INTEGRATION-COMFYUI-SERVER-BASE-URL-ALREADY-EXISTS": { title: "地址已存在", description: "该 ComfyUI 服务地址已存在，请更换地址后重试" },
  "INTEGRATION-COMFYUI-SERVER-GPU-COUNT-INVALID": { title: "GPU 数量错误", description: "GPU 数量不合法，请检查后重试" },
  "INTEGRATION-COMFYUI-SERVER-TENANT-TYPE-INVALID": { title: "范围配置错误", description: "租户类型不合法，请检查适用范围后重试" },
  "INTEGRATION-COMFYUI-SERVER-SCOPE-BINDING-INVALID": { title: "范围配置错误", description: "服务适用范围配置不合法，请检查专属组织和门店设置后重试" },
  "INTEGRATION-COMFYUI-SERVER-SCOPE-LEVEL-INVALID": { title: "范围层级错误", description: "服务适用范围层级不合法，请检查后重试" },
  "INTEGRATION-COMFYUI-SERVER-APP-SCOPE-INVALID": { title: "应用范围错误", description: "服务应用范围配置不合法，请检查后重试" },
  "INTEGRATION-COMFYUI-SERVER-SCOPE-TYPE-INVALID": { title: "应用范围错误", description: "服务应用范围类型不合法，请检查后重试" },
  "INTEGRATION-COMFYUI-SERVER-TAGS-JSON-INVALID": { title: "标签格式错误", description: "服务标签格式不合法，请检查后重试" },
  "INTEGRATION-COMFYUI-SERVER-ACTIVE-TASKS-EXIST": { title: "无法删除", description: "ComfyUI 服务仍在处理任务，暂时不能删除" },
  "INTEGRATION-COMFYUI-SERVER-SCOPE-BINDING-REFS-EXIST": { title: "存在关联", description: "ComfyUI 服务仍存在适用范围关联，暂时不能删除" },
  "INTEGRATION-COMFYUI-SERVER-APP-SCOPE-REFS-EXIST": { title: "存在关联", description: "ComfyUI 服务仍存在应用关联，暂时不能删除" },
  "INTEGRATION-COMFYUI-SERVER-DISPATCH-STRATEGY-REFS-EXIST": { title: "存在关联", description: "ComfyUI 服务仍有关联调度策略，暂时不能删除" },
  "INTEGRATION-COMFYUI-SERVER-IN-USE": { title: "存在关联", description: "ComfyUI 服务仍存在资源关联，暂时不能删除" },
  "MATERIALS-COMMAND-REQUIRED": { title: "参数错误", description: "素材操作参数不能为空" },
  "MATERIALS-SCOPE-REQUIRED": { title: "范围缺失", description: "素材归属范围不完整，请检查后重试" },
  "MATERIALS-PARAM-INVALID": { title: "参数错误", description: "素材参数不合法，请检查后重试" },
  "MATERIALS-AUDIT-REJECTED": { title: "审核未通过", description: "素材内容未通过审核，暂时不能继续使用" },
  "MATERIALS-AUDIT-REVIEW-REQUIRED": { title: "等待审核", description: "素材内容需要人工审核，请审核通过后再继续操作" },
  "MATERIALS-AUDIT-FAILED": { title: "审核失败", description: "素材审核失败，请稍后重试" },
  "MATERIALS-RESOURCE-NOT-FOUND": { title: "未找到", description: "素材资源不存在或已删除" },
  "MATERIALS-RESOURCE-ALREADY-EXISTS": { title: "已存在", description: "素材资源已存在，请调整后重试" },
  "MATERIALS-RESOURCE-IN-USE": { title: "存在关联", description: "当前素材资源仍被引用，请先解除关联后再删除" },
  "MATERIALS-STATUS-INVALID": { title: "状态不允许", description: "仅审核通过的素材才允许上架或调整发布状态" },
  "MATERIALS-UPLOAD-FAILED": { title: "上传失败", description: "素材上传失败，请稍后重试" },
  "UMS-RESOURCE-NOT-FOUND": { title: "未找到", description: "用户或关联账号不存在，可能已被删除" },
  "UMS-STATUS-INVALID": { title: "状态不允许", description: "当前用户状态不允许执行该操作" },
  "IAM-COMMAND-REQUIRED": { title: "参数错误", description: "权限操作参数不能为空" },
  "IAM-PARAM-INVALID": { title: "参数错误", description: "权限参数不合法，请检查后重试" },
  "IAM-RESOURCE-NOT-FOUND": { title: "未找到", description: "权限资源不存在或已删除" },
  "IAM-RESOURCE-ALREADY-EXISTS": { title: "已存在", description: "权限资源已存在，请勿重复创建" },
  "IAM-METADATA-JSON-INVALID": { title: "元数据异常", description: "权限元数据处理失败，请稍后重试" },
  "IAM-INTERNAL-PRINCIPAL-REQUIRED": { title: "参数错误", description: "授权主体不能为空，请刷新后重试" },
  "IAM-INTERNAL-SCOPE-LEVEL-REQUIRED": { title: "参数错误", description: "授权范围层级不能为空，请刷新后重试" },
  "WORKFLOW-PAGE-NO-INVALID": { title: "分页参数错误", description: "分页页码不合法，请检查后重试" },
  "WORKFLOW-PAGE-SIZE-INVALID": { title: "分页参数错误", description: "分页大小不合法，请检查后重试" },
  "WORKFLOW-COMMAND-REQUIRED": { title: "参数错误", description: "工作流参数不能为空" },
  "WORKFLOW-UPDATE-COMMAND-REQUIRED": { title: "参数错误", description: "工作流更新参数不能为空" },
  "WORKFLOW-JSON-INVALID": { title: "配置错误", description: "工作流配置格式不正确，请检查后重试" },
  "WORKFLOW-JSON-FIELD-REQUIRED": { title: "配置缺失", description: "工作流配置缺少必填字段，请检查后重试" },
  "WORKFLOW-COMFYUI-REL-SCOPE-TYPE-INVALID": { title: "范围配置错误", description: "工作流关联的 ComfyUI 范围类型不合法，请检查后重试" },
  "WORKFLOW-RESOURCE-NOT-FOUND": { title: "未找到", description: "工作流资源不存在或已删除" },
  "WORKFLOW-CODE-ALREADY-EXISTS": { title: "编码已占用", description: "应用编码已被占用（含已删除应用），请更换编码后重试" },
  "WORKFLOW-VERSION-RESOURCE-NOT-FOUND": { title: "版本不存在", description: "工作流版本不存在或已被删除，请刷新后重试" },
  "WORKFLOW-STATUS-INVALID": { title: "状态不允许", description: "当前工作流状态不允许执行该操作" },
  "WORKFLOW-TAG-RESOURCE-NOT-FOUND": { title: "标签不存在", description: "工作流标签不存在或已被删除，请刷新后重试" },
  "WORKFLOW-CATE-RESOURCE-NOT-FOUND": { title: "分类不存在", description: "工作流分类不存在或已被删除，请刷新后重试" },
  "WORKFLOW-CATE-PARENT-NOT-FOUND": { title: "上级分类不存在", description: "上级分类不存在或已被删除，请刷新后重试" },
  "WORKFLOW-CATE-PARENT-INVALID": { title: "分类错误", description: "分类父级设置不合法，请调整后重试" },
  "WORKFLOW-CATE-DEPTH-LIMIT": { title: "层级超限", description: "工作流分类最多支持两级，请调整后重试" },
  "WORKFLOW-SCOPE-LEVEL-INVALID": { title: "范围层级错误", description: "工作流范围层级不合法，请检查后重试" },
  "WORKFLOW-COMFYUI-SERVER-NOT-FOUND": { title: "服务不存在", description: "所选 ComfyUI 服务不存在或已删除，请刷新后重新选择" },
  "WORKFLOW-TAG-REF-NOT-FOUND": { title: "标签不存在", description: "所选工作流标签不存在或已删除，请刷新后重新选择" },
  "WORKFLOW-CATE-REF-NOT-FOUND": { title: "分类不存在", description: "所选工作流分类不存在或已删除，请刷新后重新选择" },
  "WORKFLOW-SCOPE-MERCHANT-NOT-FOUND": { title: "商户不存在", description: "所选商户不存在或已删除，请刷新后重新选择" },
  "WORKFLOW-SCOPE-STORE-NOT-FOUND": { title: "门店不存在", description: "所选门店不存在或已删除，请刷新后重新选择" },
  "WORKFLOW-SCOPE-STORE-MERCHANT-MISMATCH": { title: "门店不匹配", description: "所选门店与商户不匹配，请刷新后重新选择" },
  "OPS-RESOURCE-NOT-FOUND": { title: "未找到", description: "运营资源不存在或已删除" },
  "OPS-COMMAND-REQUIRED": { title: "参数错误", description: "运维操作参数不能为空" },
  "OPS-QUERY-REQUIRED": { title: "参数错误", description: "运维查询参数不能为空" },
  "OPS-SCOPE-REQUIRED": { title: "参数错误", description: "运维范围参数不能为空" },
  "OPS-PARAM-INVALID": { title: "参数错误", description: "运维参数不合法，请检查后重试" },
  "OPS-STATUS-INVALID": { title: "状态不允许", description: "当前运营资源状态不允许执行该操作" },
  "OPS-ASSIGNEE-ONLY": { title: "无权限", description: "仅当前处理人可以操作该工单" },
  "OPS-CONFIG-SAVE-FAILED": { title: "保存失败", description: "运维配置保存失败，请稍后重试" },
  "SYS-RESOURCE-NOT-FOUND": { title: "未找到", description: "系统配置不存在或已删除" },
  "SYS-RESOURCE-ALREADY-EXISTS": { title: "已存在", description: "系统配置已存在，请勿重复创建" },
  "SYS-STATUS-INVALID": { title: "状态不允许", description: "仅离线状态的配置才允许删除" },
  "WORKFLOW-CATE-HAS-CHILDREN": { title: "无法删除", description: "当前分类下还有子分类，请先删除或调整子分类后再试" },
  "WORKFLOW-CATE-HAS-WORKFLOW-REFS": { title: "存在关联", description: "当前分类已关联工作流，继续删除将自动解除这些工作流的分类关系" },
  "WORKFLOW-TAG-HAS-WORKFLOW-REFS": { title: "存在关联", description: "当前标签已关联工作流，请先解除关联后再删除" },

  "SCHEDULER-QUOTA-429": { title: "余额不足", description: "账户余额不足，请充值后重试" },
  "FUND_BALANCE_NOT_ENOUGH": { title: "余额不足", description: "账户余额不足，请充值后再试" },
  "FUND_ACCOUNT_NOT_FOUND": { title: "账户未开通", description: "未找到可用资金账户，请联系管理员开通后重试" },
  "FUND_ACCOUNT_STATUS_INVALID": { title: "账户不可用", description: "资金账户状态异常，暂时无法扣费，请联系管理员" },
  "FUND_PRICING_RULE_NOT_FOUND": { title: "计费未配置", description: "当前模型缺少计费规则，请联系管理员配置后重试" },
  "FUND_INTERNAL_ERROR": { title: "扣费失败", description: "资金服务暂时异常，请稍后重试" },
  PAY_GATEWAY_NOT_CONFIGURED: { title: "支付未配置", description: "支付渠道未配置或未启用，请先在支付配置中完成启用" },
  PAY_CHANNEL_UNSUPPORTED: { title: "渠道不支持", description: "当前支付渠道不受支持，请更换后重试" },
  PAY_PACKAGE_NOT_PURCHASABLE: { title: "套餐不可购买", description: "当前套餐不可线上购买，请更换套餐后重试" },
  PAY_PURCHASE_SUBJECT_INVALID: { title: "购买主体无效", description: "当前用户不满足套餐购买条件，请检查用户归属后重试" },
  PAY_STORE_SELECTION_REQUIRED: { title: "请选择门店", description: "该套餐需指定门店后再下单" },
  PAY_CHANNEL_REQUEST_FAILED: { title: "支付渠道失败", description: "支付渠道请求失败，请稍后重试" },
  PAY_NOTIFY_INVALID: { title: "支付回调异常", description: "支付回调验签失败" },
  PAY_ORDER_STATUS_INVALID: { title: "订单状态不允许", description: "当前订单状态不允许执行该操作" },
  "MODELHUB-ROUTING-PROFILE-NOT-MATCHED": ROUTING_PROFILE_NOT_MATCHED_HINT,
  "MODELHUB-ROUTING-ENTRY-NOT-FOUND": ROUTING_ENTRY_NOT_FOUND_HINT,
  "MODELHUB-REQUESTED-MODEL-NOT-OPEN": REQUESTED_MODEL_NOT_OPEN_HINT,
  "MODELHUB-UPSTREAM-MODEL-NOT-FOUND": {
    title: "渠道模型未开通",
    description:
      "渠道模型未开通或无权访问。请到渠道控制台开通该模型，并把控制台复制的 Model ID 或推理接入点填到渠道部署的渠道模型编码。",
  },
  "MODELHUB-PRICING-UNSETTLEABLE": {
    title: "计费配置不可用",
    description: "当前模型的正式计费规则无法结算。请到「模型管理」补全单位价与默认分辨率/帧率后重试",
  },
  "MODELHUB-ROUTING-PROFILE-NOT-FOUND": {
    title: "路由策略不存在",
    description: "指定的路由策略不存在或已删除，请刷新后重试",
  },
  "SCHEDULER-APP-DISABLED": { title: "不可用", description: "该应用当前不可用，请联系管理员确认状态" },
  "SCHEDULER-APP-404": { title: "未找到", description: "未找到对应应用或应用版本，请刷新后重试" },
  "SCHEDULER-APP-400": { title: "请求错误", description: "调度请求参数错误，请检查后重试" },
  "SCHEDULER-AUTH-401": { title: "未登录", description: "登录已失效或尚未登录，请重新登录后重试" },
  "SCHEDULER-TENANT-404": { title: "租户无效", description: "未找到当前租户范围，请刷新后重试" },
  "SCHEDULER-404": { title: "节点不可用", description: "暂无可用调度节点，请稍后重试" },
  "SCHEDULER-NOTFOUND-404": { title: "未找到", description: "未找到对应调度资源，请刷新后重试" },
  "SCHEDULER-WORKFLOW-VERSION-404": { title: "版本不存在", description: "未找到该应用版本，可能已被删除，请刷新后重试" },
  "SCHEDULER-WORKFLOW-MISMATCH": { title: "版本不匹配", description: "应用与版本不匹配，请刷新页面后重试" },
  "SCHEDULER-WORKFLOW-VERSION-ID-INVALID": { title: "参数错误", description: "工作流版本 ID 不合法，请检查后重试" },
  "SCHEDULER-COMFYUI-BASE-URL-MISSING": { title: "调度配置异常", description: "当前调度节点未配置 ComfyUI 地址，请联系管理员处理" },
  "SCHEDULER-COMFYUI-NO-OUTPUT": { title: "执行无结果", description: "本次任务未产出有效结果，请稍后重试" },
  "SCHEDULER-COMFYUI-OUTPUT-INVALID": { title: "执行结果异常", description: "本次任务未产出有效结果，请稍后重试" },
  "SCHEDULER-COMFYUI-SUBMIT-FAILED": { title: "提交失败", description: "生成服务暂时不可用，请稍后重试" },
  "SCHEDULER-COMFYUI-POLL-TIMEOUT": { title: "执行超时", description: "任务执行超时，请稍后重试。若经常超时，可提高应用的执行超时时间或减少单次生成数量" },
  "SCHEDULER-COMFYUI-QUEUE-WAIT-TIMEOUT": { title: "排队超时", description: "任务排队等待超时，服务器较忙，请稍后重试" },
  "SCHEDULER-WORKFLOW-VERSION-MISSING": { title: "版本缺失", description: "工作流版本缺失，请联系管理员检查配置" },
  "SCHEDULER-WORKFLOW-JSON-MISSING": { title: "配置缺失", description: "工作流配置缺失，请联系管理员检查版本配置" },
  "SCHEDULER-WORKFLOW-JSON-INVALID": { title: "配置异常", description: "工作流配置异常，请联系管理员检查版本内容" },
  "SCHEDULER-WORKFLOW-UI-SCHEMA-INVALID": { title: "表单配置异常", description: "工作流表单配置异常，请联系管理员检查版本配置" },
  "SCHEDULER-WORKFLOW-PROMPT-INVALID": { title: "执行参数异常", description: "工作流执行参数异常，请联系管理员检查版本配置" },
  "SCHEDULER-COMFYUI-RESPONSE-INVALID": { title: "调度响应异常", description: "调度服务返回异常，请稍后重试" },
  "SCHEDULER-COMFYUI-FILE-DOWNLOAD-FAILED": { title: "结果下载失败", description: "从 ComfyUI 下载文件失败，请稍后重试" },
  "SCHEDULER-COMFYUI-INPUT-UPLOAD-FAILED": { title: "输入素材上传失败", description: "向算力节点上传输入素材失败，请稍后重试" },
  "SCHEDULER-COMFYUI-INPUT-MATERIALIZE-FAILED": { title: "输入素材处理失败", description: "执行前物化输入素材失败，请稍后重试" },
  "SCHEDULER-RH-INPUT-UPLOAD-FAILED": { title: "RunningHub 素材上传失败", description: "向 RunningHub 上传输入素材失败，请稍后重试" },
  "SCHEDULER-RH-INPUT-MATERIALIZE-FAILED": { title: "RunningHub 素材处理失败", description: "RunningHub 执行前物化输入素材失败，请稍后重试" },

  // Worker 退款/落库侧稳定错误码（与 BizErrorCode 文案对齐）
  WORKER_EXECUTION_TIMEOUT: { title: "执行超时", description: "任务执行超时，请稍后重试。若经常超时，可提高应用的执行超时时间或减少单次生成数量" },
  WORKER_QUEUE_WAIT_TIMEOUT: { title: "排队超时", description: "任务排队等待超时，服务器较忙，请稍后重试" },
  WORKER_NETWORK_TIMEOUT: { title: "网络超时", description: "连接生成服务超时，请检查网络后重试" },
  WORKER_INTERNAL_ERROR: { title: "处理异常", description: "任务处理异常，请稍后重试；若持续出现请联系管理员" },
  COMFYUI_API_ERROR: { title: "生成服务异常", description: "生成服务暂时不可用，请稍后重试" },
  COMFYUI_NODE_UNAUTHORIZED: {
    title: "节点认证失败",
    description: "算力节点认证失败，请检查节点访问密钥或反向代理鉴权后重试",
  },
  SCHEDULER_API_ERROR: { title: "调度异常", description: "调度服务异常，请稍后重试" },
  SCHEDULER_WORKER_FAILED: { title: "生成失败", description: "任务执行失败，请稍后重试" },

  "STORE-OPS-COMMAND-REQUIRED": { title: "参数错误", description: "门店运营操作参数不能为空" },
  "STORE-OPS-RESOURCE-NOT-FOUND": { title: "未找到", description: "门店运营资源不存在或已删除" },
  "STORE-OPS-REMOTE-CALL-FAILED": { title: "服务异常", description: "门店运营服务内部调用失败，请稍后重试" },
  "STORE-OPS-PERMISSION-BOOTSTRAP-FAILED": { title: "权限初始化失败", description: "门店运营权限初始化失败，请稍后重试" },
  "STORE-OPS-PERMISSION-CATALOG-EMPTY": { title: "权限目录异常", description: "门店运营权限目录为空，请联系管理员处理" },
  "STORE-OPS-PERMISSION-CATALOG-MISSING": { title: "权限目录异常", description: "门店运营权限目录缺失，请联系管理员处理" },
  "STORE-OPS-FUND-CONTEXT-REQUIRED": { title: "资金上下文缺失", description: "资金主体上下文不能为空，请刷新后重试" },
  "STORE-OPS-FUND-REMOTE-CALL-FAILED": { title: "资金服务异常", description: "统一资金服务调用失败，请稍后重试" },
  "STORE-OPS-AUTH-CHANNEL-UNSUPPORTED": { title: "登录渠道错误", description: "登录渠道不受支持，请检查后重试" },
  "STORE-OPS-AUTH-UPSTREAM-UNAVAILABLE": { title: "认证服务不可用", description: "认证服务暂不可用，请稍后重试" },
  "STORE-OPS-PRODUCT-IDS-REQUIRED": { title: "参数错误", description: "商品 ID 列表不能为空" },
  "STORE-OPS-RESOURCE-ALREADY-EXISTS": { title: "已存在", description: "门店运营资源已存在，请勿重复创建" },
  "STORE-OPS-JSON-PAYLOAD-INVALID": { title: "数据异常", description: "门店运营数据格式异常，请联系管理员处理" },
  "STORE-OPS-MEDIA-FILE-TYPE-UNSUPPORTED": { title: "媒体类型错误", description: "媒体类型仅支持图片或视频" },
  "STORE-OPS-MEDIA-UPLOAD-FAILED": { title: "上传失败", description: "素材上传失败，请稍后重试" },
  "STORE-OPS-SORT-ORDER-PAYLOAD-INVALID": { title: "排序参数错误", description: "排序请求与当前数据不匹配，请刷新后重试" },
  "STORE-OPS-CONFIG-IDS-REQUIRED": { title: "参数错误", description: "配置 ID 列表不能为空" },
  "STORE-OPS-IDS-REQUIRED": { title: "参数错误", description: "ID 列表不能为空" },
  "STORE-OPS-SCOPE-REQUIRED": { title: "范围缺失", description: "当前门店运营上下文不完整，请刷新后重试" },
  "STORE-OPS-FORMAT-INVALID": { title: "格式错误", description: "请求数据格式不正确，请检查后重试" },
  "STORE-OPS-DEVICE-TYPE-INVALID": { title: "设备类型错误", description: "设备类型不合法，请检查后重试" },
  "STORE-OPS-VERSION-NO-INVALID": { title: "版本号错误", description: "版本号不合法，请检查后重试" },
  "STORE-OPS-FILE-REQUIRED": { title: "缺少文件", description: "请先上传文件" },
  "STORE-OPS-FILE-TYPE-UNSUPPORTED": { title: "文件类型错误", description: "文件类型不受支持，请检查后重试" },
  "STORE-OPS-MODEL-CATEGORY-INVALID": { title: "素材分类错误", description: "素材分类不符合门店运营要求，请调整后重试" },

  "MESSAGE-TEMPLATE-VARIABLE-MISSING": { title: "模板变量缺失", description: "消息模板缺少必要变量，请检查后重试" },
  "MESSAGE-TEMPLATE-RENDER-INVALID": { title: "模板渲染失败", description: "消息模板渲染失败，请检查模板变量" },
  "MESSAGE-TEMPLATE-TYPE-INVALID": { title: "模板类型错误", description: "消息模板类型不合法，请检查后重试" },
  "MESSAGE-DISPATCH-COMMAND-REQUIRED": { title: "参数错误", description: "消息发送参数不能为空" },
  "MESSAGE-CHANNEL-REQUIRED": { title: "渠道缺失", description: "消息渠道不能为空" },
  "MESSAGE-CHANNEL-INVALID": { title: "渠道错误", description: "消息渠道不合法，请检查后重试" },
  "MESSAGE-REGION-REQUIRED": { title: "地区缺失", description: "消息地区不能为空" },
  "MESSAGE-RUNTIME-CONFIG-INVALID": { title: "通道配置异常", description: "消息通道配置不完整，请联系管理员处理" },
  "MESSAGE-PROVIDER-SEND-FAILED": { title: "发送失败", description: "消息发送失败，请稍后重试" },
  "MESSAGE-SCOPE-INVALID": { title: "范围错误", description: "消息发送范围参数不合法，请检查后重试" },
  "MESSAGE-IDENTIFIER-INVALID": { title: "标识错误", description: "消息标识参数不合法，请检查后重试" },

  "USER-PHONE-CONFLICT": { title: "手机号冲突", description: "该手机号已被占用，请使用其他手机号" },
  "USER-EMAIL-CONFLICT": { title: "邮箱冲突", description: "该邮箱已被占用，请使用其他邮箱" },
  "USER-PHONE-EMAIL-CONFLICT": { title: "账号冲突", description: "该手机号、邮箱已被注册，请使用未注册的信息" },
  "USER-WECHAT-CONFLICT": { title: "微信冲突", description: "该微信账号已被占用" },
  "USER-IDENTIFIER-CONFLICT": { title: "账号冲突", description: "提供的多个标识（如手机号、邮箱）分别被不同的账号占用，存在冲突" },
};

const STATUS_HINT_MAP: Record<string, ErrorHint> = {
  invalid_request: { title: "参数错误", description: "请求参数不完整或格式不正确，请检查输入后重试" },
  invalid_credentials: { title: "登录失败", description: "账号或密码不正确，请检查后重新登录" },
  invalid_code: { title: "验证码错误", description: "验证码无效或已失效，请重新获取后再试" },
  identifier_conflict: { title: "账号冲突", description: "当前标识已归属于其他账号，请更换信息或联系客服处理" },
  forbidden: { title: "无权限", description: "当前操作不被允许，请联系管理员确认权限" },
  unauthorized: { title: "需要登录", description: "当前登录状态无效，请重新登录后再试" },
  account_disabled: { title: "账号被封禁", description: "您的账号已被管理员封禁，暂时无法继续操作" },
  bind_token_expired: { title: "绑定已过期", description: "绑定流程已过期，请重新发起登录并完成绑定" },
  invalid_bind_token: { title: "绑定无效", description: "绑定流程无效，请重新发起登录后再试" },
  message_channel_unavailable: { title: "通道未配置", description: "当前验证码发送通道未配置，请联系管理员处理" },
  message_dispatch_failed: { title: "发送失败", description: "验证码发送失败，请稍后重试" },
  too_frequent: { title: "发送过于频繁", description: "验证码发送过于频繁，请稍后再试" },
};

function tryGetErrorResponse(body: unknown): ErrorResponse | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const code = typeof o.code === "string" ? o.code : "";
  const message = typeof o.message === "string" ? o.message : "";
  const trace = typeof o.trace === "object" ? (o.trace as ErrorResponse["trace"]) : undefined;
  if (!code && !message && !trace) return null;
  return {
    code,
    message,
    data: o.data,
    trace,
  };
}

function isHttpErrorLike(error: unknown): error is HttpErrorLike {
  if (!error || typeof error !== "object") return false;
  const candidate = error as Record<string, unknown>;
  return "status" in candidate || "body" in candidate || "traceId" in candidate;
}

function normalizeMessage(message: string | null | undefined): string {
  return typeof message === "string" ? message.replace(/\s+/g, " ").trim() : "";
}

function isGenericBackendMessage(message: string): boolean {
  const normalized = normalizeMessage(message);
  if (!normalized) return true;
  const lower = normalized.toLowerCase();
  return (
    lower === "internal error" ||
    lower === "internal server error" ||
    lower === "request failed" ||
    lower === "bad request" ||
    lower === "forbidden" ||
    lower === "unauthorized" ||
    lower === "service is currently unavailable, please try again later." ||
    normalized === "系统错误" ||
    normalized === "系统内部错误" ||
    normalized === "服务器内部错误" ||
    normalized === "服务异常" ||
    normalized === "请求失败" ||
    normalized === "请求发生冲突" ||
    normalized === "请求参数不合法" ||
    normalized === "请求参数错误" ||
    normalized === "参数错误" ||
    normalized === "认证失败"
  );
}

function looksLikeUpstreamQuotaMessage(text: string): boolean {
  return /reached the set inference limit|Safe Experience Mode/i.test(text);
}

function looksLikeChannelBalanceFailure(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("accountoverdueerror")
    || lower.includes("insufficient balance")
    || /"status_code"\s*:\s*1008/.test(lower)
    || text.includes("欠费")
    || /渠道账户余额不足|渠道余额不足/.test(text)
  );
}

function looksLikeJsonBlob(text: string): boolean {
  const trimmed = text.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
    || (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

function sanitizeUpstreamUserMessage(text: string): string {
  if (looksLikeChannelBalanceFailure(text)) {
    return CHANNEL_BALANCE_HINT.description;
  }
  if (looksLikeJsonBlob(text)) {
    return CHANNEL_JOB_FAILED_HINT.description;
  }
  return text;
}

function keepModelHubBackendMessage(code: string | null | undefined, backendMessage: string | null | undefined): boolean {
  if (!code || !backendMessage) return false;
  if (code.startsWith("MODELHUB-UPSTREAM-")) return true;
  return code.startsWith("MODELHUB-") && /[\u4e00-\u9fff]/.test(backendMessage);
}

function tryGetErrorStatus(body: unknown): string | null {
  const resp = tryGetErrorResponse(body);
  if (!resp?.data || typeof resp.data !== "object" || Array.isArray(resp.data)) return null;
  const data = resp.data as Record<string, unknown>;
  if (typeof data.status === "string" && data.status.trim()) return data.status;
  const nested = data.error;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const nestedStatus = (nested as Record<string, unknown>).status;
    if (typeof nestedStatus === "string" && nestedStatus.trim()) return nestedStatus;
  }
  return null;
}

/** AUTH-401 同时表示会话未登录和登录校验失败；有结构化 status 时以后者为准。 */
function isGenericAuthEnvelopeCode(code: string | null): boolean {
  return !code || code === "AUTH-401" || code === "COMMON-AUTH-401" || code === "AUTH-400";
}

function tryResolveComfyuiOfflineHint(error: unknown): ErrorHint | null {
  if (!isHttpErrorLike(error)) return null;
  const resp = tryGetErrorResponse(error.body);
  const msg = [resp?.message || "", error.message || ""].filter(Boolean).join(" ");
  if (!msg) return null;
  if (msg.includes("ComfyUI 服务器未在线") || msg.includes("服务器未在线") || msg.includes("服务器离线")) {
    return { title: "服务器不可用", description: "服务器不可用，不能提交" };
  }
  const lower = msg.toLowerCase();
  if (lower.includes("comfyui") && (lower.includes("offline") || lower.includes("not online") || lower.includes("unavailable"))) {
    return { title: "服务器不可用", description: "服务器不可用，不能提交" };
  }
  return null;
}

function tryResolveDuplicateKeyHint(error: unknown): ErrorHint | null {
  if (!isHttpErrorLike(error)) return null;
  const resp = tryGetErrorResponse(error.body);
  const msg = [resp?.message || "", error.message || "", typeof error.body === "string" ? error.body : ""]
    .filter(Boolean)
    .join(" ");
  if (!msg) return null;
  const lower = msg.toLowerCase();
  if (
    lower.includes("app_workflow_code_key") ||
    (lower.includes("duplicate key") && lower.includes("code")) ||
    msg.includes("应用编码已被占用")
  ) {
    return {
      title: "编码已占用",
      description: "应用编码已被占用（含已删除应用），请更换编码后重试",
    };
  }
  if (lower.includes("duplicate key") || lower.includes("unique constraint") || lower.includes("unique_violation")) {
    return { title: "冲突", description: "数据已存在或发生冲突，请检查后重试" };
  }
  return null;
}

/**
 * 从异常对象中提取后端业务错误码（若存在）。
 *
 * @param error 任意异常
 * @returns 后端返回的 error.code；若无法识别返回 null
 */
export function tryGetBackendErrorCode(error: unknown): string | null {
  if (!isHttpErrorLike(error)) return null;
  const body = tryGetErrorResponse(error.body);
  return body?.code ?? null;
}

export function hasBackendErrorCode(error: unknown, ...codes: string[]): boolean {
  if (codes.length === 0) return false;
  const code = tryGetBackendErrorCode(error);
  return !!code && codes.includes(code);
}

/**
 * 从异常对象中提取后端返回的结构化错误状态（若存在）。
 */
export function tryGetBackendErrorStatus(error: unknown): string | null {
  if (!isHttpErrorLike(error)) return null;
  return tryGetErrorStatus(error.body);
}

/**
 * 从异常对象中提取后端返回的业务 message。
 * 若 message 只是通用 internal error / request failed，则视为无有效业务提示。
 */
export function tryGetBackendErrorMessage(error: unknown): string | null {
  if (!isHttpErrorLike(error)) return null;
  const body = tryGetErrorResponse(error.body);
  const message = normalizeMessage(body?.message);
  if (!message || isGenericBackendMessage(message)) return null;
  return message;
}

/**
 * 从异常对象中提取 traceId，便于展示给用户或用于问题排查。
 */
export function tryGetBackendTraceId(error: unknown): string | null {
  if (isHttpErrorLike(error) && typeof error.traceId === "string" && error.traceId.trim()) {
    return error.traceId.trim();
  }
  if (!isHttpErrorLike(error)) return null;
  const body = tryGetErrorResponse(error.body);
  const traceId = body?.trace?.traceId;
  return typeof traceId === "string" && traceId.trim() ? traceId.trim() : null;
}

/**
 * 将异常对象解析为可展示的错误提示（title/description）。
 *
 * @param error 任意异常
 * @returns 匹配到 error.code 时返回提示；否则返回 null
 */
export function resolveBackendErrorHint(error: unknown): ErrorHint | null {
  const status = tryGetBackendErrorStatus(error);
  const statusHint = status ? STATUS_HINT_MAP[status] : undefined;
  const code = tryGetBackendErrorCode(error);
  if (statusHint && isGenericAuthEnvelopeCode(code)) return statusHint;
  if (code && CODE_HINT_MAP[code]) return CODE_HINT_MAP[code];
  if (statusHint) return statusHint;
  const duplicateHint = tryResolveDuplicateKeyHint(error);
  if (duplicateHint) return duplicateHint;
  const comfyOfflineHint = tryResolveComfyuiOfflineHint(error);
  if (comfyOfflineHint) return comfyOfflineHint;
  return null;
}

/**
 * 解析“用户可读”的错误提示文本。
 *
 * 策略：
 * - 优先使用后端 error.code 映射的 description；
 * - 再使用 Error.message；
 * - 最后回退到 fallback。
 */
export function resolveUserErrorMessage(error: unknown, fallback: string): string {
  const backendMessage = tryGetBackendErrorMessage(error);
  const code = tryGetBackendErrorCode(error);
  // COMMON-400 / COMMON-FORBIDDEN-403 / MODELHUB-* / PAY_*：后端已给出具体业务文案时优先展示。
  if (
    (code === "COMMON-400"
      || code === "COMMON-FORBIDDEN-403"
      || (typeof code === "string" && code.startsWith("PAY_"))
      || keepModelHubBackendMessage(code, backendMessage))
    && backendMessage
  ) {
    return sanitizeUpstreamUserMessage(backendMessage);
  }
  const hint = resolveBackendErrorHint(error);
  if (hint) return hint.description;
  if (backendMessage) return sanitizeUpstreamUserMessage(backendMessage);
  if (error instanceof Error) return sanitizeUpstreamUserMessage(error.message || fallback);
  return fallback;
}

/**
 * 解析“用户可读”的错误标题（可选）。
 *
 * @param error 任意异常
 * @param fallback 未匹配到 code 映射时的兜底标题
 */
export function resolveUserErrorTitle(error: unknown, fallback?: string): string | undefined {
  const backendMessage = tryGetBackendErrorMessage(error);
  if (backendMessage?.includes("缺少可用凭证")) {
    return "渠道凭证缺失";
  }
  const code = tryGetBackendErrorCode(error);
  if (
    code === "MODELHUB-PRICING-UNSETTLEABLE"
    || backendMessage?.includes("正式计费")
    || backendMessage?.includes("无法确定性结算")
    || backendMessage?.includes("无法按目录计价")
  ) {
    return "计费配置不可用";
  }
  if (tryGetBackendErrorCode(error) === "MODELHUB-UPSTREAM-JOB-FAILED") {
    if (backendMessage && looksLikeChannelBalanceFailure(backendMessage)) {
      return CHANNEL_BALANCE_HINT.title;
    }
    if (backendMessage && looksLikeUpstreamQuotaMessage(backendMessage)) {
      return "渠道额度已满";
    }
    return "生成失败";
  }
  const hint = resolveBackendErrorHint(error);
  if (hint?.title) return hint.title;
  return fallback;
}

export function resolveUserErrorNotice(
  error: unknown,
  fallbackDescription: string,
  fallbackTitle = "操作失败"
): ErrorHint {
  return {
    title: resolveUserErrorTitle(error, fallbackTitle),
    description: resolveUserErrorMessage(error, fallbackDescription),
  };
}

const TASK_FAILURE_TEXT_HINTS: Array<{ pattern: RegExp; hint: ErrorHint }> = [
  {
    pattern: /MODELHUB-ROUTING-PROFILE-NOT-MATCHED|未匹配到可用路由|没有启用中的路由策略|当前生成能力暂不可用|no active routing profile/i,
    hint: ROUTING_PROFILE_NOT_MATCHED_HINT,
  },
  {
    pattern: /MODELHUB-ROUTING-ENTRY-NOT-FOUND|缺少该场景入口|routing profile does not contain entry/i,
    hint: ROUTING_ENTRY_NOT_FOUND_HINT,
  },
  {
    pattern: /MODELHUB-REQUESTED-MODEL-NOT-OPEN|此模型未开通/i,
    hint: REQUESTED_MODEL_NOT_OPEN_HINT,
  },
  {
    pattern: /MODELHUB-UPSTREAM-MODEL-NOT-FOUND|does not exist or you do not have access/i,
    hint: {
      title: "渠道模型未开通",
      description:
        "渠道模型未开通或无权访问。请到渠道控制台开通该模型，并把控制台复制的 Model ID 或推理接入点填到渠道部署的渠道模型编码。",
    },
  },
  {
    pattern: /当前模型不支持(文生视频|图生视频)/,
    hint: {
      title: "模型能力不匹配",
      description: "当前模型不支持这种生成方式，请更换模型或去掉/补上参考图后再试",
    },
  },
  {
    pattern: /comfyui\s*poll\s*timeout|execution\s*timeout/i,
    hint: {
      title: "执行超时",
      description: "任务执行超时，请稍后重试。若经常超时，可提高应用的执行超时时间或减少单次生成数量",
    },
  },
  {
    pattern: /comfyui\s*queue\s*wait\s*timeout|queue\s*wait\s*timeout/i,
    hint: {
      title: "排队超时",
      description: "任务排队等待超时，服务器较忙，请稍后重试",
    },
  },
  {
    pattern: /cannot find current proxy|exposeproxy/i,
    hint: {
      title: "处理异常",
      description: "任务处理异常，请稍后重试；若持续出现请联系管理员",
    },
  },
  {
    pattern: /comfyui\s*submit|no schedulable server|no available server/i,
    hint: {
      title: "提交失败",
      description: "暂时没有可用的生成节点，请稍后重试",
    },
  },
  {
    pattern: /comfyui\s*(poll failed|invalid json|response)/i,
    hint: {
      title: "生成服务异常",
      description: "生成服务返回异常，请稍后重试",
    },
  },
];

function isGenericInternalErrorCode(code: string): boolean {
  return code === "COMMON-INTERNAL-500" || code === "FUND_INTERNAL_ERROR";
}

function looksLikeTechnicalFailureMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    looksLikeJsonBlob(message)
    || lower.includes("exception")
    || lower.includes("stack")
    || lower.includes("comfyui")
    || lower.includes("proxy")
    || lower.includes("nullpointer")
  );
}

function stripSchedulerJobFailurePrefix(message: string): string {
  return message.replace(/^template task failed:\s*/i, "").trim();
}

function resolveChannelJobFailureHint(code: string, raw: string): ErrorHint | null {
  const fromCode = code.startsWith("MODELHUB-UPSTREAM-") || code === "SCHEDULER-TEMPLATE-TASK-FAILED";
  const fromText = /MODELHUB-UPSTREAM-|template task failed:/i.test(raw);
  const fromQuota = looksLikeUpstreamQuotaMessage(raw);
  const fromBalance = looksLikeChannelBalanceFailure(raw);
  if (!fromCode && !fromText && !fromQuota && !fromBalance) return null;
  const description = stripSchedulerJobFailurePrefix(raw);
  if (!description) {
    return CHANNEL_JOB_FAILED_HINT;
  }
  if (looksLikeChannelBalanceFailure(description)) {
    return CHANNEL_BALANCE_HINT;
  }
  for (const item of TASK_FAILURE_TEXT_HINTS) {
    if (item.pattern.test(description)) {
      return item.hint;
    }
  }
  const byCode = CODE_HINT_MAP[code] || CODE_HINT_MAP[code.toUpperCase()];
  if (byCode) {
    return {
      title: byCode.title,
      description: /[\u4e00-\u9fff]/.test(description) ? description : byCode.description,
    };
  }
  if (fromQuota) {
    return { title: "渠道额度已满", description };
  }
  if (/下载成片失败/.test(description)) {
    return { title: "成片下载失败", description };
  }
  if (looksLikeJsonBlob(description)) {
    return CHANNEL_JOB_FAILED_HINT;
  }
  return { title: "生成失败", description };
}

/**
 * 将任务失败落库的 errorMessage / errorCode 转为用户可读文案。
 * 用于预览时间线、任务详情等展示（非 HttpError 路径）。
 */
export function resolveTaskFailureHint(
  errorMessage: string | null | undefined,
  errorCode?: string | null
): ErrorHint {
  const code = typeof errorCode === "string" ? errorCode.trim() : "";
  const raw = normalizeMessage(errorMessage);
  if (raw && looksLikeChannelBalanceFailure(raw)) {
    return CHANNEL_BALANCE_HINT;
  }
  if (raw && looksLikeJsonBlob(raw) && !looksLikeUpstreamQuotaMessage(raw)) {
    return CHANNEL_JOB_FAILED_HINT;
  }
  if (code === "MODELHUB-VIDEO-PARAM-INVALID" || /MODELHUB-VIDEO-PARAM-INVALID/.test(raw)) {
    return {
      title: "参数不符合要求",
      description: raw && raw !== "视频参数超出当前模型能力范围"
        ? raw
        : "视频参数超出当前模型能力范围",
    };
  }
  if (
    code === "MODELHUB-PRICING-UNSETTLEABLE"
    || /MODELHUB-PRICING-UNSETTLEABLE|无法确定性结算|无法按目录计价|未配置可结算的单位价/.test(raw)
  ) {
    return {
      title: "计费配置不可用",
      description: raw || "当前模型的正式计费规则无法结算。请到「模型管理」补全单位价与默认分辨率/帧率后重试",
    };
  }
  const channelJobHint = resolveChannelJobFailureHint(code, raw);
  if (channelJobHint) return channelJobHint;
  if (code) {
    const byCode = CODE_HINT_MAP[code] || CODE_HINT_MAP[code.toUpperCase()];
    if (byCode) {
      if (
        isGenericInternalErrorCode(code)
        && raw
        && !isGenericBackendMessage(raw)
        && !looksLikeTechnicalFailureMessage(raw)
      ) {
        return {
          title: /下载成片失败/.test(raw) ? "成片下载失败" : "生成失败",
          description: raw,
        };
      }
      return byCode;
    }
  }
  if (raw) {
    for (const item of TASK_FAILURE_TEXT_HINTS) {
      if (item.pattern.test(raw)) {
        return item.hint;
      }
    }
    if (!looksLikeTechnicalFailureMessage(raw) && !isGenericBackendMessage(raw)) {
      return { title: "生成失败", description: raw };
    }
  }

  return {
    title: "生成失败",
    description: "任务执行失败，请稍后重试；若持续出现请联系管理员",
  };
}

export function resolveTaskFailureMessage(
  errorMessage: string | null | undefined,
  errorCode?: string | null
): string {
  return resolveTaskFailureHint(errorMessage, errorCode).description;
}

/**
 * 判断是否为未登录/登录失效（401）。
 */
export function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof HttpError) return error.status === 401;
  return false;
}
