import { useEffect, useState, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { useAuthShowLoginDialog } from "@/shared/hooks/use-auth-show-login";
import { useSetOpenCallback } from "@/shared/hooks/use-set-open-callback";
import { Badge } from "@/shared/ui/badge";
import { apiFetch, HttpError } from "@/shared/api/sys/http";
import { handleLogout, useMessage } from "@/utils/common";
import { resolveUserAvatarUrl } from "@/shared/lib/user-avatar";
import { getAccountBalance } from "@/shared/api/user/user-info";
import { getAccessToken, setAccessToken, setRefreshToken } from "@/shared/api/auth/auth";
import { getUser, listRoles } from "@/shared/api/ums/iam";
import { useToast } from "@/shared/hooks/use-toast";
import { Modal, Row, Col, Form, Input, Checkbox, Button, Spin } from "antd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  User,
  PencilLine,
  ChevronRight,
  Copy,
  Coins,
  Loader2,
  UserRoundCog,
} from "lucide-react";
import {
  buildPermissionSetForNamespace,
  CONSOLE_PERMISSION_NAMESPACE,
  CONSOLE_PERMISSIONS,
  hasPermission,
} from "@/shared/lib/permissions";
import {
  getFundAccountBalance,
  getFundAccountScopedBalanceQueryKey,
  resolveFundUserOwnerId,
} from "@/shared/api/fund/admin-fund";
import { CircleUserRound } from "lucide-react";
import { WechatOutlined, DingdingOutlined, GoogleOutlined } from "@ant-design/icons";
import {  resolveUserErrorNotice } from "@/shared/api/sys/error-message";
import {
  createWechatOpenOauthState,
  fetchWechatScanMode,
  fetchWetchatScanModeRedirect,
  mountWechatOpenQr,
  WECHAT_OPEN_QR_DISPLAY_PX,
} from "@/shared/api/auth/wechat-open-oauth";
import { Phone, MessageSquare } from "lucide-react";
import "@/assets/css/scss/workflow-common.scss";
import "@/assets/css/scss/global.scss";

type OtpSendResponse = {
  status: string;
  requestId: string;
};

type mode = {
  appId: string;
  mode: string;
  redirectUri: string | null
}


type AuthFlowAction = {
  action: "bind_phone";
  bindToken: string;
  expiresAt: number;
  channel: "email" | "wechat" | "username" | "dingtalk" | "google" | "feishu";
};

const platformCode = "ai_admin";

const loginImg = "https://static.nailoffice.cn/2026-04-29/6811db59c58c28287e07e45c/upload/20260429173302331-logo-1-inycun.png"

const CommonUser = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { messageError, messageSuccess } = useMessage();
  const { showLogin, setShowLogin, openLogin, closeLogin } = useAuthShowLoginDialog();
  const { bindRequire: bindRequireVisible , setBindRequire, clearBind  } = useSetOpenCallback();
  const [ wechatVisible, setWechatVisible ] = useState(false); // 微信登录弹框
  const [ loading, setLoading ] = useState(true); // 微信登录弹框状态
  const token = getAccessToken();
  const [form] = Form.useForm();
  const [isAgree, setIsAgree] = useState(false); //是否同意条款
  const [rememberMe, setRememberMe] = useState(false); //是否同7天登录
  const [isLogining, setIsLogining] = useState(false); //登录状态
  const bindRequired = useRef(false); //是否需要绑定手机号
  const wechatModeRef = useRef<mode>(); // wechat info


    // 1. 监听表单字段变化
  const phoneValue = Form.useWatch('phone', form);
  const codeValue = Form.useWatch('code', form);

   // 验证码倒计时相关状态
  const [countdown, setCountdown] = useState(0);
  const [isSending, setIsSending] = useState(false);

  // 判断是否正在倒计时
  const isCountingDown = countdown > 0;

  const otherWays = [
    {
      label: 'wechat',
      icon: <WechatOutlined style={{fontSize: 20, color: 'rgb(6, 223, 96)'}} />
    },
    // {
    //   label: 'dingding',
    //   icon: <DingdingOutlined />
    // },
    // {
    //   label: 'google',
    //   icon: <GoogleOutlined />
    // }
  ]

  const { data: meInfo, refetch: refetchMePermissions } = useMePermissions({
    sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode,
  });
  const permissionSet = useMemo(
    () =>
      {buildPermissionSetForNamespace(
        CONSOLE_PERMISSION_NAMESPACE,
        meInfo?.permissions ?? [],
      )},
    [meInfo?.permissions],
  );
  const canManageAccountBalance = hasPermission(
    permissionSet,
    CONSOLE_PERMISSIONS.opsAccountManage,
  );
  const meProfileQuery = useQuery({
    queryKey: ["topbar-me-profile", meInfo?.userId],
    enabled: Boolean(meInfo?.userId),
    queryFn: () => getUser({ id: String(meInfo?.userId) }),
    staleTime: 5 * 60 * 1000,
  });
  const canManageRoles = hasPermission(
    permissionSet,
    CONSOLE_PERMISSIONS.iamRbacManage,
  );
  const roleCatalogQuery = useQuery({
    queryKey: ["topbar-role-catalog"],
    queryFn: () => listRoles(),
    enabled: canManageRoles,
    staleTime: 30 * 60 * 1000,
  });
  const canEditCurrentUser = Boolean(meInfo?.userId);
  const balanceOwnerId = meInfo?.principalId || meInfo?.userId || "";
  const principalId = meInfo?.principalId ?? "";
  const principalIdShort = principalId ? principalId.substring(0, 12) : "未知";
  const meProfile = meProfileQuery.data;
  // const balanceQuery = useQuery({
  //   queryKey: ["user", balanceOwnerId],
  //   enabled: Boolean(balanceOwnerId),
  //   queryFn: () => getAccountBalance("user", String(balanceOwnerId)),
  //   staleTime: 60 * 1000,
  // });
  const balanceQuery = useQuery({
    queryKey: getFundAccountScopedBalanceQueryKey('user', balanceOwnerId),
    enabled: Boolean(balanceOwnerId) && canManageAccountBalance,
    queryFn: () => getFundAccountBalance('user', balanceOwnerId),
    staleTime: 60 * 1000,
  });
  const displayName =
    meProfile?.nickname?.trim() ||
    meProfile?.displayName?.trim() ||
    meProfile?.realName?.trim() ||
    meProfile?.phone?.trim() ||
    principalIdShort;
  const roleNames = useMemo(() => {
    const currentRoles = meInfo?.roles ?? [];
    const roleCatalog = roleCatalogQuery.data ?? [];
    if (!currentRoles.length) {
      return [];
    }
    return currentRoles.map((roleCode) => {
      const matchedRole = roleCatalog.find(
        (item) => item.code === roleCode || item.name === roleCode,
      );
      // console.log("matchedRole", matchedRole, roleCode, 100);
      return matchedRole?.name || roleCode;
    });
  }, [meInfo?.roles, roleCatalogQuery.data]);

  // 判断是否显示管理后台
  const showAdminEntry = useMemo(() => {
    return roleNames.length > 0 && roleNames.some(
      (roleItem) =>
        roleItem === "platform_admin" ||
        roleItem?.includes("管理员"),
    );
  }, [roleNames]);

  const avatarSrc = resolveUserAvatarUrl(
    meInfo?.avatarUrl,
    meInfo?.principalId || "user",
    64,
  );
  const accountBalance =
    typeof meProfileQuery.data?.balance === "number"
      ? new Intl.NumberFormat("zh-CN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(meProfileQuery.data.balance)
      : canManageAccountBalance
        ? "--"
        : "无权限";

  const handleProfileMenuOpenChange = (open: boolean) => {
    if (!open) {
      return;
    }

    const refreshTasks = [refetchMePermissions()];
    if (canManageAccountBalance) {
      refreshTasks.push(balanceQuery.refetch());
    }
    if (meInfo?.userId) {
      refreshTasks.push(meProfileQuery.refetch());
    }

    void Promise.allSettled(refreshTasks);
  };

  const handleCopyPrincipalId = async () => {
    if (!principalId) {
      toast({
        title: "复制失败",
        description: "当前用户 UID 不存在",
        variant: "destructive",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(principalId);
      toast({ title: "复制成功", description: "UID 已复制到剪贴板" });
    } catch {
      toast({
        title: "复制失败",
        description: "当前环境不支持剪贴板复制",
        variant: "destructive",
      });
    }
  };
  const handleEditCurrentUser = () => {
    if (!meInfo?.userId) {
      return;
    }
    navigate(`/ums/users/${meInfo.userId}/edit`);
  };

  const handleLogin = () => {
    openLogin()
    // navigate("/login");
  };

    // 校验手机号格式
  const isPhoneValid = useMemo(() => {
    if (!phoneValue) return false;
    return /^1[3-9]\d{9}$/.test(phoneValue);
  }, [phoneValue]);

  // 校验整个表单
  const isFormValid = useMemo(() => {
    const errors = form.getFieldsError();
    const hasError = errors.some((field) => field.errors.length > 0);
    const allFieldsFilled = !!phoneValue && !!codeValue;
    return !hasError && allFieldsFilled;
  }, [form, phoneValue, codeValue]);

    // 判断发送按钮是否禁用（手机号无效 或 正在倒计时 或 正在发送中）
  const isSendCodeDisabled = !isPhoneValid || isCountingDown || isSending;

  const handleSendCode = async() => {
    if (isSendCodeDisabled) return;
    // 开始发送
    setIsSending(true);
    // 模拟发送请求（实际替换为真实 API）
    try {
      const scene = bindRequired.current ? "bind_phone" : "login";
      await apiFetch<OtpSendResponse>("/api/auth/sms/send", {
        method: "POST",
        withAuth: false,
        body: JSON.stringify({ phone:phoneValue, platformCode: platformCode, scene }),
      });
      setIsSending(false);
      setCountdown(60);
      messageSuccess('验证码发送成功，请注意查收！')
    } catch (error) {
      setIsSending(false);
      const notice = resolveUserErrorNotice(error, "验证码发送失败，请稍后重试", "发送失败");
      messageError(notice.title ?? "发送失败");
    }
    
  }

  const loginByPhone = async(values) => {
    const { phone, code } = values;
    return await apiFetch("/api/auth/login/phone", {
          method: "POST",
          withAuth: false,
          body: JSON.stringify({ phone, code: code, platformCode: 'ai_admin', rememberMe: true }),
        });
  }
  // 登录
  const onFinish = async (values: any) => {
    if (!isAgree) {
      messageError('您必须同意用户协议和隐私政策')
      return
    }
    // 执行登录
    // setIsLogining(true)
    try {
      const response = await loginByPhone(values)
      if (response?.status !=="authenticated" || !response?.token?.accessToken) {
        messageError('登录流程返回了未识别状态，请重试');
        setIsLogining(false);
      } else {
        setAccessToken(response?.token?.accessToken);
        setRefreshToken(response?.token?.refreshToken);
        setIsLogining(false);
        closeLogin();
        messageSuccess('登录成功！')
        // navigate('/');
      }
    } catch (error) {
      setIsLogining(false);
      messageError('校验失败，请重试！')
    }
    
  };

  // 绑定手机号接口请求
  const handleBindPhone = async(values) => {
    const { phone, code } = values;
    return await apiFetch("/api/auth/login/phone/bind", {
      method: "POST",
      withAuth: false,
      body: JSON.stringify({ 
        phone, 
        code: code, 
        platformCode: 'ai_admin', 
        password: null, 
        bindToken: window?.localStorage.getItem('wechat_bind_token')
       }),
    });
  }

  // 绑定手机号
  const onFinishBind = async (values: any) => {
    setIsLogining(true);
    const response = await handleBindPhone(values);
    if (response?.status !=="authenticated" || !response?.token?.accessToken) {
      messageError('登录流程返回了未识别状态，请重试');
      setIsLogining(false);
    } else {
      setAccessToken(response?.token?.accessToken);
      setRefreshToken(response?.token?.refreshToken);
      setIsLogining(false);
      setBindRequire(false);
      closeLogin();
      messageSuccess('登录成功！');
      window?.localStorage.moveItem('wechat_bind_token');
      navigate('/');
    }
  }

  const Logout = () => {
    navigate('/');
    handleLogout()
    setShowLogin(true)
  }

   // 倒计时逻辑
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const handleWechat = async() => {
    setWechatVisible(true)
    try {
      const mode = await fetchWechatScanMode();
      if (mode.mode === "open" && mode.appId && mode.redirectUri) {
        const customMode = await fetchWetchatScanModeRedirect('https://11842ww9xe438.vicp.fun/custom/wechat/open/callback');
        wechatModeRef.current = mode;
        const state = createWechatOpenOauthState();
        mountWechatOpenQr({
          containerId: "wechat-custom-open-qr",
          appId: mode.appId,
          redirectUri: customMode.redirectUri,
          state: state,
          sizePx: 460,
          stylelite: 1
        });
         setTimeout(() => {
        setLoading(false);
      }, 300);
        return;
      }
      messageError("微信登录未启用");
    } catch (e) {
      setLoading(false)
      setWechatVisible(false)
      const notice = resolveUserErrorNotice(e, "无法生成微信登录二维码");
      messageError(notice.title ?? "无法生成微信登录二维码");
    }
  }

  // 其他登录方式
  const handleOtherLogin = (type:string) => {
    switch (type) {
      case "wechat":
        handleWechat()
        break;
      case "Copywriting":
        break;
      case "VideoCreation":
        break;
      default:
        break;
    }
  }

  useEffect(() => {
    // 注册全局函数，供微信回调页面调用
    (window as any).__handleWechatBind = (bindToken?: string) => {
      console.log('收到微信绑定请求，bindToken:', bindToken);
      // 1. 关闭微信弹窗
      setWechatVisible(false);
      // 4. 存储 bindToken 供后续使用
      if (bindToken) {
        // 2. 打开登录弹窗
        openLogin();
        // 3. 显示绑定手机号界面
        setBindRequire(true);
        localStorage.setItem('wechat_bind_token', bindToken);
      } else {
        closeLogin()
        messageSuccess('登录成功！');
      }
    };

    // 清理函数
    return () => {
      delete (window as any).__handleWechatBind;
    };
  }, []);

  // 监听自定义事件打开登录弹框
  useEffect(() => {

    const handleOpenLogin = (e: CustomEvent) => {
      const value = e.detail.value;
      if (value) openLogin()
    }
    window.addEventListener('openLogin', handleOpenLogin as EventListener)

    return () => {
    window.removeEventListener('openLogin', handleOpenLogin as EventListener)
    }
  }, [])

  return (
    <>
      {!token && (
       <div className="px-4">
          <div
            className="w-[70px] h-[28px] flex flex-row items-center justify-between text-white rounded-l-2xl rounded-r-2xl bg-[#7d33ff] px-3 cursor-pointer gradient primary z-9999"
            onClick={handleLogin}
          >
            <CircleUserRound className="h-4 w-4" />
            <span className="text-[0.75rem]">登录</span>
          </div>
       </div>
      )}
      {token && (
        <div style={{ width: "32px", height: "32px" }}>
          <DropdownMenu onOpenChange={handleProfileMenuOpenChange}>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 z-9999 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors overflow-hidden">
                <Avatar className="h-full w-full">
                  <AvatarImage
                    src={avatarSrc}
                    alt=""
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={10}
              className="w-[296px] rounded-2xl border border-violet-200/60 bg-popover p-2.5 text-popover-foreground shadow-[0_14px_32px_rgba(88,63,190,0.14)]"
              style={{ zIndex: 100 }}
            >
              <div className="px-0.5 py-0.5">
                <div className="flex items-start gap-2.5 px-1 py-1">
                  <Avatar className="h-10 w-10 border border-violet-200/60 shadow-sm">
                    <AvatarImage
                      src={avatarSrc}
                      alt=""
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[13px] font-semibold leading-5 text-foreground">
                        {displayName}
                      </p>
                      <Badge
                        variant="secondary"
                        className="h-4 rounded-full border border-violet-200/70 bg-violet-100/80 px-1.5 text-[12px] font-medium text-violet-700 hover:bg-violet-100/80"
                      >
                        {roleNames.length > 0 ? roleNames[0] : "普通用户"}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="truncate">{principalId || "-"}</span>
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-violet-700 transition-colors hover:bg-violet-50 hover:text-violet-800"
                        onClick={() => {
                          void handleCopyPrincipalId();
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    {/* <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                    角色：{roleSummary}
                  </p> */}
                  </div>
                </div>

                <div className="flex items-center justify-between px-1 py-1.5 text-[12px]">
                  <span className="flex items-center gap-2 font-medium leading-none text-foreground">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/12 text-violet-700">
                      <Coins className="h-3.5 w-3.5" />
                    </span>
                    <span className="leading-none">账户余额</span>
                  </span>
                  <span className="min-w-[72px] text-right text-[12px] font-semibold leading-none tabular-nums text-violet-800">
                    {balanceQuery.isFetching ? (
                      <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-violet-500" />
                    ) : (
                      accountBalance
                    )}
                  </span>
                </div>
              </div>

              {/* <DropdownMenuSeparator className="mx-0 my-2 bg-violet-100" /> */}

              <div className="space-y-1">
                {canEditCurrentUser ? (
                  <DropdownMenuItem
                    className="cursor-pointer rounded-lg px-2.5 py-2.5 text-[12px] font-medium text-foreground focus:bg-violet-50 focus:text-violet-800"
                    onClick={handleEditCurrentUser}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 leading-none">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-violet-600">
                        <PencilLine className="h-3.5 w-3.5" />
                      </span>
                      <span className="leading-none">完善账号</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </DropdownMenuItem>
                ) : null}
              </div>
              {showAdminEntry && (
                  <div
                    className="flex items-center justify-between px-1 py-1.5 text-[12px]"
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate("/app/dashboard")}
                  >
                    <span className="flex items-center gap-2 font-medium leading-none text-foreground">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/12 text-violet-700">
                        <UserRoundCog className="h-3.5 w-3.5" />
                      </span>
                      <span className="leading-none">管理后台</span>
                    </span>
                  </div>
                )}
              <DropdownMenuSeparator className="mx-0 my-1.5 bg-violet-100" />
              <button
                type="button"
                className="flex h-9 w-full items-center justify-center rounded-lg text-[12px] font-medium text-foreground transition-colors hover:bg-violet-50 hover:text-violet-800"
                onClick={() => Logout()}
              >
                退出登录
              </button>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {/* 登录弹框 */}
      <Modal open={showLogin} onCancel={() => {
        closeLogin();
        setIsAgree(false);
        form.resetFields()
      }} transitionName=""  maskTransitionName="" scrollLock={false} className="ndmy-custom-modal login" footer={null} centered={true} width={850} closeIcon={null} >
        <div className="w-full h-[500px]">
          <Row className="w-full  h-[500px]">
            <Col span={10} className="relative">
              <img src={loginImg} className="absolute w-full h-full object-cover object-center rounded-tl-lg rounded-bl-lg" />
            </Col>
            { !bindRequireVisible && (
              <Col span={14} className="flex-col p-3 pb-0">
              <div className="w-full px-4 py-2 leading-1.6 h-[48px] text-[1.25rem] flex items-center leading-tight font-medium">登录</div>
              <div className="w-full px-8 pt-2 pb-4 flex-1 d-flex flex-column">
                <Form form={form} onFinish={onFinish} className="ndmy-login-form mt-4" validateTrigger={['onChange', 'onBlur']} >
                  <Form.Item name="phone" label={null} rules={[
                    { required: true, message: '请输入手机号' },
                    {pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号'}]} >
                    <Input placeholder="手机号" size="large" className="hover:border-[#7d33ff] !focus:border-[#7d33ff] outline-0 ndmy-form-item" prefix={<Phone size={15} className="text-gray-400" />} />
                  </Form.Item>
                  <Form.Item name="code" label={null} rules={[{ required: true, message: '请输入验证码' }]}>
                    <Input placeholder="验证码" size="large" maxLength={6} className="hover:border-[#7d33ff] !focus:border-[#7d33ff] outline-0 ndmy-form-item" prefix={<MessageSquare size={15} className="text-gray-400" />} suffix={
                      <>
                        <Button size="small" type="text" className="hover:!bg-none hover:bg-transparent ndmy-text-btn text-sm" 
                        disabled={isSendCodeDisabled} onClick={handleSendCode}>
                          {isCountingDown ? `${countdown}s 后重发` : isSending ? '发送中...' : '获取验证码'}
                        </Button>
                      </>
                    } />
                  </Form.Item>
                  <Form.Item className="!h-[32px]">
                    <Checkbox checked={isAgree} className="ml-2" onChange={(e) => {
                      setIsAgree(!isAgree)
                    }} />
                    <span className="text-gray-500 ml-2">已阅读并同意</span>
                    <a href="/public/service" className="text-black cursor-pointer px-1 hover:!text-[#7d33ff]">用户协议</a>
                    <span className="text-gray-500 ml-1">和</span>
                    <a href="/public/privacy" className="text-black cursor-pointer px-1 hover:!text-[#7d33ff]">隐私政策</a>
                  </Form.Item>

                  <Form.Item className="w-full !mb-0 !h-[44px] mt-8" >
                    <Button disabled={!isFormValid} type="primary" size="large" htmlType="submit" 
                    className={`w-full gradient primary outlind-0 border-0 hover:!outline-0 hover:!border-0 ${!isFormValid ? 'disabled' : ''}`}>
                      {isLogining ? "登录中..." : "登录"}
                    </Button>
                  </Form.Item>
                </Form>
                {/* 其他登录方式 */}
                <div className="w-full mt-16 flex-col">
                  <div className="w-full flex justify-center items-center">其他登录方式</div>
                  <div className="w-full flex gap-1 item-center justify-center mt-4">
                    {otherWays.map((otherItem, otherIndex) => {
                      return (
                        <Button key={otherIndex} icon={otherItem?.icon} 
                          onClick={() => handleOtherLogin(otherItem.label)}
                          className="hover:!bg-gray-100 hover:!border-gray-200" style={{ width: '48px', height: '48px' }} shape="circle" size="large"
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            </Col>
            )}

            {bindRequireVisible && (
              <Col span={14} className="flex-col p-3 pb-0">
                <div className="rounded-lg border border-border border-l-4 border-l-primary bg-muted/20 p-4">
                  <div className="text-[14px] font-medium text-foreground mb-1">绑定手机号</div>
                  <div className="text-[13px] text-muted-foreground leading-relaxed">
                    微信 / 邮箱等非手机号方式登录时，需先验证手机号。若该手机号已注册将自动合并账号。
                  </div>
                </div>
                <Form form={form} onFinish={onFinishBind} className="ndmy-login-form mt-4" validateTrigger={['onChange', 'onBlur']} >
                  <Form.Item name="phone" label={null} rules={[
                    { required: true, message: '请输入手机号' },
                    {pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号'}]} >
                    <Input placeholder="手机号" size="large" className="hover:border-[#666] focus:border-[#666] outline-0 ndmy-form-item" />
                  </Form.Item>
                  <Form.Item name="code" label={null} rules={[{ required: true, message: '请输入验证码' }]}>
                    <Input placeholder="验证码" size="large" className="hover:border-[#666] focus:border-[#666] outline-0 ndmy-form-item" suffix={
                      <>
                        <Button size="small" type="text" className="hover:!bg-none hover:bg-transparent ndmy-text-btn text-sm" 
                        disabled={isSendCodeDisabled} onClick={handleSendCode}>
                          {isCountingDown ? `${countdown}s 后重发` : isSending ? '发送中...' : '获取验证码'}
                        </Button>
                      </>
                    } />
                  </Form.Item>
                  <Form.Item name="rememberMe" >
                    <Checkbox checked={rememberMe} className="ml-2" onChange={(e) => {
                      setRememberMe(!rememberMe)
                    }} >7天内自动登录</Checkbox>
                  </Form.Item>

                  <Form.Item className="w-full !mb-0 !h-[44px] mt-8" >
                    <Button disabled={!isFormValid} type="primary" size="large" htmlType="submit" 
                    className={`w-full gradient primary outlind-0 border-0 hover:!outline-0 hover:!border-0 ${!isFormValid ? 'disabled' : ''}`}>
                      {isLogining ? "处理中..." : "绑定并登录"}
                    </Button>
                  </Form.Item>
                </Form>
              </Col>
            )}
          </Row>
        </div>
      </Modal>
      {/* 微信登录弹框 */}
      <Modal open={wechatVisible && !bindRequireVisible} onCancel={() => setWechatVisible(!wechatVisible)} transitionName=""  maskTransitionName="" scrollLock={false} className="ndmy-custom-modal login" 
      footer={null} centered={true} width={850} closeIcon={null} >
        <Spin spinning={loading}>
          <div id="wechat-custom-open-qr" className="w-full h-full pa-8 items-center"></div>
        </Spin>
      </Modal>
    </>
  );
};

export default CommonUser;
