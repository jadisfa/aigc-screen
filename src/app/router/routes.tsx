import { Suspense } from "react";
import { lazyWithChunkReload as lazy } from "@/shared/lib/app-update";
import { Navigate, Route, Routes } from "react-router-dom";
import ConsoleLayout from "@/app/layout/ConsoleLayout";
import RequireAuth from "@/app/router/RequireAuth";
import RequirePermission from "@/app/router/RequirePermission";
import { clearAuthSession, getAccessToken } from "@/shared/api/auth/auth";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import {
  buildPermissionSetForNamespace,
  CONSOLE_PERMISSION_NAMESPACE,
  CONSOLE_PERMISSIONS,
  CONSOLE_ROUTES,
  getDefaultAuthorizedRoute,
} from "@/shared/lib/permissions";
import { shouldForceLoginOnPermissionsError } from "@/shared/lib/session-guards";

/** 路由级懒加载：避免把全部业务页打进首屏主包 */
const DashboardPage = lazy(() => import("@/modules/home/pages/DashboardPage"));
const WorkflowAppsPage = lazy(() => import("@/modules/workflow/pages/WorkflowAppsPage"));
const WorkflowAppEditorPage = lazy(() => import("@/modules/workflow/pages/WorkflowAppEditorPage"));
const WorkflowAppPreviewPage = lazy(() => import("@/modules/workflow/pages/WorkflowAppPreviewPage"));
const WorkflowVersionsPage = lazy(() => import("@/modules/workflow/pages/WorkflowVersionsPage"));
const WorkflowCategoriesPage = lazy(() => import("@/modules/workflow/pages/WorkflowCategoriesPage"));
const SchedulerTaskManagementPage = lazy(() => import("@/modules/workflow/pages/SchedulerTaskManagementPage"));
const TagManagementPage = lazy(() => import("@/modules/workflow/pages/TagManagementPage"));
const CloudServiceManagementPage = lazy(() => import("@/modules/integration/pages/CloudServiceManagementPage"));
const ComfyUIServerManagementPage = lazy(() => import("@/modules/integration/pages/ComfyUIServerManagementPage"));
const MessageTemplateManagementPage = lazy(() => import("@/modules/integration/pages/MessageTemplateManagementPage"));
const FileMaterialsManagementPage = lazy(() => import("@/modules/materials/pages/FileMaterialsManagementPage"));
const ImageMaterialsManagementPage = lazy(() => import("@/modules/materials/pages/ImageMaterialsManagementPage"));
const ModelMaterialsManagementPage = lazy(() => import("@/modules/materials/pages/ModelMaterialsManagementPage"));
const VideoMaterialsManagementPage = lazy(() => import("@/modules/materials/pages/VideoMaterialsManagementPage"));
const WorkMaterialsManagementPage = lazy(() => import("@/modules/materials/pages/WorkMaterialsManagementPage"));
const LoginConfigManagementPage = lazy(() => import("@/modules/sys/pages/LoginConfigManagementPage"));
const MiniProgramManagementPage = lazy(() => import("@/modules/sys/pages/MiniProgramManagementPage"));
const PaymentGatewayConfigEditPage = lazy(() => import("@/modules/sys/pages/PaymentGatewayConfigEditPage"));
const PaymentManagementPage = lazy(() => import("@/modules/sys/pages/PaymentManagementPage"));
const PrivacyPolicyManagementPage = lazy(() => import("@/modules/sys/pages/PrivacyPolicyManagementPage"));
const StorageManagementPage = lazy(() => import("@/modules/sys/pages/StorageManagementPage"));
const UserAgreementManagementPage = lazy(() => import("@/modules/sys/pages/UserAgreementManagementPage"));
const WatermarkManagementPage = lazy(() => import("@/modules/sys/pages/WatermarkManagementPage"));
const OnlineUserPage = lazy(() => import("@/modules/sys/pages/OnlineUserPage"));
const WechatOfficialManagementPage = lazy(() => import("@/modules/sys/pages/WechatOfficialManagementPage"));
const AccountClosePage = lazy(() => import("@/modules/ums/pages/AccountClosePage"));
const PermissionManagementPage = lazy(() =>
  import("@/modules/iam/pages/PermissionManagementPage").then((m) => ({ default: m.PermissionManagementPage }))
);
const RoleManagementPage = lazy(() =>
  import("@/modules/iam/pages/RoleManagementPage").then((m) => ({ default: m.RoleManagementPage }))
);
const LoginPage = lazy(() => import("@/modules/ums/pages/LoginPage"));
const WechatMpCallbackPage = lazy(() => import("@/modules/ums/pages/WechatMpCallbackPage"));
const WechatMpScanPage = lazy(() => import("@/modules/ums/pages/WechatMpScanPage"));
const WechatOpenCallbackPage = lazy(() => import("@/modules/ums/pages/WechatOpenCallbackPage"));
const DingtalkCallbackPage = lazy(() =>
  import("@/modules/ums/pages/SsoOauthCallbackPage").then((m) => ({ default: m.DingtalkCallbackPage }))
);
const GoogleCallbackPage = lazy(() =>
  import("@/modules/ums/pages/SsoOauthCallbackPage").then((m) => ({ default: m.GoogleCallbackPage }))
);
const FeishuCallbackPage = lazy(() =>
  import("@/modules/ums/pages/SsoOauthCallbackPage").then((m) => ({ default: m.FeishuCallbackPage }))
);
const MerchantManagementPage = lazy(() => import("@/modules/ums/pages/MerchantManagementPage"));
const OidcCallbackPage = lazy(() => import("@/modules/ums/pages/OidcCallbackPage"));
const StoreManagementPage = lazy(() => import("@/modules/ums/pages/StoreManagementPage"));
const UserEditRoutePage = lazy(() => import("@/modules/ums/components/UserEditRoutePage"));
const UserManagementPage = lazy(() => import("@/modules/ums/pages/UserManagementPage"));
const ComingSoonPage = lazy(() => import("@/shared/pages/ComingSoonPage"));
const ForbiddenPage = lazy(() => import("@/shared/pages/ForbiddenPage"));
const NotFoundPage = lazy(() => import("@/shared/pages/NotFoundPage"));
const ApiDocsPage = lazy(() => import("@/modules/docs/pages/ApiDocsPage"));
const FundLedgerPage = lazy(() => import("@/modules/fund/pages/FundLedgerPage"));
const NotificationInboxPage = lazy(() => import("@/modules/ops/pages/NotificationInboxPage"));
const TicketDisposalConfigPage = lazy(() => import("@/modules/ops/pages/TicketDisposalConfigPage"));
const TicketManagementPage = lazy(() => import("@/modules/ops/pages/TicketManagementPage"));
const TicketEditorPage = lazy(() => import("@/modules/ops/components/TicketEditorPage"));
const TicketReplyPage = lazy(() => import("@/modules/ops/components/TicketReplyPage"));
const UserPackageManagementPage = lazy(() => import("@/modules/ops/pages/UserPackageManagementPage"));
const UserPackageEditorPage = lazy(() => import("@/modules/ops/components/UserPackageEditorPage"));
const OrderManagementPage = lazy(() => import("@/modules/ops/pages/OrderManagementPage"));
const AuditLogPage = lazy(() => import("@/modules/ops/pages/AuditLogPage"));
const ModelHubAlertsPage = lazy(() => import("@/modules/modelhub/pages/ModelHubAlertsPage"));
const ModelHubBizCapabilitiesPage = lazy(() => import("@/modules/modelhub/pages/ModelHubBizCapabilitiesPage"));
const ModelHubApiKeysPage = lazy(() => import("@/modules/modelhub/pages/ModelHubApiKeysPage"));
const ModelHubChannelsPage = lazy(() => import("@/modules/modelhub/pages/ModelHubChannelsPage"));
const ModelHubConsumptionRecordsPage = lazy(() => import("@/modules/modelhub/pages/ModelHubConsumptionRecordsPage"));
const ModelHubDashboardPage = lazy(() => import("@/modules/modelhub/pages/ModelHubDashboardPage"));
const ModelHubGuardrailsPage = lazy(() => import("@/modules/modelhub/pages/ModelHubGuardrailsPage"));
const ModelHubLogsPage = lazy(() => import("@/modules/modelhub/pages/ModelHubLogsPage"));
const ModelHubModelsPage = lazy(() => import("@/modules/modelhub/pages/ModelHubModelsPage"));
const ModelHubPoolsPage = lazy(() => import("@/modules/modelhub/pages/ModelHubPoolsPage"));
const ModelHubRoutingPage = lazy(() => import("@/modules/modelhub/pages/ModelHubRoutingPage"));

import HomePage from "@/modules/custom/home";
import BackendCenterLayout from "@/app/layout/BackendCenterLayout";
import Creation from "@/modules/backendCenter/creation";
import DrawRecord from "@/modules/backendCenter/draw-record";
import UserCenter from "@/modules/backendCenter/use-center";
import MembershipService from "@/modules/backendCenter/membership-service";
import PublicService from "@/modules/custom/service";
import PublicPrivacy from "@/modules/custom/privacy";
import CustomWechatOpenCallback from "@/component/custom-wechat-open-callback";
import InfiniteCanvas from "@/modules/backendCenter/canvas";

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-[13px] text-muted-foreground">
      页面加载中…
    </div>
  );
}

function DefaultAuthorizedRedirect() {
  const token = getAccessToken();
  const permissionsQuery = useMePermissions({
    sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode,
  });

  // console.log(token, permissionsQuery, 83, "route");
  if (!token) {
    return <Navigate to={CONSOLE_ROUTES.customHome} replace />;
    // return <Navigate to={CONSOLE_ROUTES.login} replace />;
  }

  if (permissionsQuery.isLoading) {
    return null;
  }

  if (permissionsQuery.isError) {
    if (shouldForceLoginOnPermissionsError(permissionsQuery.error)) {
      clearAuthSession();
      return <Navigate to={CONSOLE_ROUTES.login} replace />;
    }
    // 避免错误时盲跳 dashboard 再被守卫打回 /403 形成闭环
    return <Navigate to={CONSOLE_ROUTES.forbidden} replace />;
  }

  const permissionSet = buildPermissionSetForNamespace(
    CONSOLE_PERMISSION_NAMESPACE,
    permissionsQuery.data?.permissions ?? [],
  );
  // console.log(getDefaultAuthorizedRoute(permissionSet), 101);
  // debugger;
  return <Navigate to={CONSOLE_ROUTES.customHome} replace />;
  // return <Navigate to={getDefaultAuthorizedRoute(permissionSet)} replace />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/" element={<DefaultAuthorizedRedirect />} />
      {/* <Route path="/admin/panel" element={<DashboardPage />} /> */}
      <Route path={CONSOLE_ROUTES.login} element={<LoginPage />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/auth/callback" element={<OidcCallbackPage />} />
      <Route path="/auth/wechat/scan" element={<WechatMpScanPage />} />
      <Route path="/auth/wechat/callback" element={<WechatMpCallbackPage />} />
      <Route path="/auth/wechat/open/callback" element={<WechatOpenCallbackPage />} />
      <Route path="/auth/dingtalk/callback" element={<DingtalkCallbackPage />} />
      <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
      <Route path="/auth/feishu/callback" element={<FeishuCallbackPage />} />
      <Route
        path={CONSOLE_ROUTES.apiDocs}
        element={
          <RequireAuth>
            <ApiDocsPage />
          </RequireAuth>
        }
      />

      <Route path="/custom/home" element={<HomePage />} />
      <Route
        path="/app/preview/:id"
        element={
          <RequireAuth>
            <WorkflowAppPreviewPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app-preview/:id"
        element={
          <RequireAuth>
            <WorkflowAppPreviewPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/workflows/:id/preview"
        element={
          <RequirePermission
            permissionCode={CONSOLE_PERMISSIONS.workflowAppManage}
          >
            <WorkflowAppPreviewPage />
          </RequirePermission>
        }
      />
      <Route
        path="/workflow/apps/:id/preview"
        element={
          <RequirePermission
            permissionCode={CONSOLE_PERMISSIONS.workflowAppManage}
          >
            <WorkflowAppPreviewPage />
          </RequirePermission>
        }
      />

      <Route
        element={
          <RequireAuth>
            <ConsoleLayout />
          </RequireAuth>
        }
      >
        <Route path={CONSOLE_ROUTES.forbidden} element={<ForbiddenPage />} />

        <Route
          path={CONSOLE_ROUTES.dashboard}
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.dashboard}>
              <DashboardPage />
            </RequirePermission>
          }
        />
        <Route path="/model-hub" element={<Navigate to={CONSOLE_ROUTES.modelHubDashboard} replace />} />
        <Route
          path={CONSOLE_ROUTES.modelHubDashboard}
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.modelHubDashboardManage}>
              <ModelHubDashboardPage />
            </RequirePermission>
          }
        />
        <Route
          path={CONSOLE_ROUTES.modelHubChannels}
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.modelHubChannelManage}>
              <ModelHubChannelsPage />
            </RequirePermission>
          }
        />
        <Route
          path={CONSOLE_ROUTES.modelHubApiKeys}
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.modelHubApiKeyManage}>
              <ModelHubApiKeysPage />
            </RequirePermission>
          }
        />
        <Route
          path={CONSOLE_ROUTES.modelHubModels}
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.modelHubBaseModelManage}>
              <ModelHubModelsPage />
            </RequirePermission>
          }
        />
        <Route
          path={CONSOLE_ROUTES.modelHubPools}
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.modelHubPoolManage}>
              <ModelHubPoolsPage />
            </RequirePermission>
          }
        />
        <Route
          path={CONSOLE_ROUTES.modelHubGuardrails}
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.modelHubGuardrailManage}>
              <ModelHubGuardrailsPage />
            </RequirePermission>
          }
        />
        <Route
          path={CONSOLE_ROUTES.modelHubRouting}
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.modelHubRoutingManage}>
              <ModelHubRoutingPage />
            </RequirePermission>
          }
        />
        <Route
          path={CONSOLE_ROUTES.modelHubConsumptionRecords}
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.modelHubConsumptionRecordManage}>
              <ModelHubConsumptionRecordsPage />
            </RequirePermission>
          }
        />
        <Route
          path={CONSOLE_ROUTES.modelHubLogs}
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.modelHubLogManage}>
              <ModelHubLogsPage />
            </RequirePermission>
          }
        />
        <Route
          path={CONSOLE_ROUTES.modelHubAlerts}
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.modelHubAlertManage}>
              <ModelHubAlertsPage />
            </RequirePermission>
          }
        />
        <Route
          path={CONSOLE_ROUTES.modelHubBizCapabilities}
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.modelHubBizCapabilityManage}>
              <ModelHubBizCapabilitiesPage />
            </RequirePermission>
          }
        />
        <Route path="/console/dashboard" element={<DefaultAuthorizedRedirect />} />
        <Route path="/console/apps" element={<Navigate to="/app/workflows" replace />} />

        <Route
          path="/app/workflows"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.workflowAppManage}
            >
              <WorkflowAppsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/app/workflows/new"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.workflowAppManage}
            >
              <WorkflowAppEditorPage />
            </RequirePermission>
          }
        />
        <Route
          path="/app/workflows/:id/edit"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.workflowAppManage}
            >
              <WorkflowAppEditorPage />
            </RequirePermission>
          }
        />
        <Route
          path="/app/versions"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.workflowVersionManage}
            >
              <WorkflowVersionsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/app/categories"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.workflowCategoryManage}
            >
              <WorkflowCategoriesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/app/tags"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.workflowTagManage}
            >
              <TagManagementPage />
            </RequirePermission>
          }
        />
        {/*<Route*/}
        {/*  path="/app/skills"*/}
        {/*  element={*/}
        {/*    <RequirePermission permissionCode="workflow.manage">*/}
        {/*      <SkillManagementPage />*/}
        {/*    </RequirePermission>*/}
        {/*  }*/}
        {/*/>*/}
        {/*<Route*/}
        {/*  path="/app/knowledge-bases"*/}
        {/*  element={*/}
        {/*    <RequirePermission permissionCode="workflow.manage">*/}
        {/*      <KnowledgeBaseManagementPage />*/}
        {/*    </RequirePermission>*/}
        {/*  }*/}
        {/*/>*/}
        {/*<Route*/}
        {/*  path="/app/agents"*/}
        {/*  element={*/}
        {/*    <RequirePermission permissionCode="workflow.manage">*/}
        {/*      <AgentManagementPage />*/}
        {/*    </RequirePermission>*/}
        {/*  }*/}
        {/*/>*/}

        {/*<Route path="/workflow/apps" element={<Navigate to="/workflow/workflows" replace />} />*/}
        {/*<Route path="/workflow/apps/new" element={<Navigate to="/workflow/workflows/new" replace />} />*/}
        {/*<Route path="/workflow/apps/:id/edit" element={<Navigate to="/workflow/workflows" replace />} />*/}
        {/*<Route path="/workflow/versions" element={<Navigate to="/workflow/versions" replace />} />*/}
        {/*<Route path="/workflow/categories" element={<Navigate to="/workflow/categories" replace />} />*/}
        {/*<Route path="/app/tags" element={<Navigate to="/app/tags" replace />} />*/}
        {/*<Route path="/aigc/skills" element={<Navigate to="/app/skills" replace />} />*/}
        {/*<Route path="/aigc/knowledge-bases" element={<Navigate to="/app/knowledge-bases" replace />} />*/}
        {/*<Route path="/aigc/agents" element={<Navigate to="/app/agents" replace />} />*/}

        <Route
          path="/integration/cloud-services"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.integrationCloudServiceManage}
            >
              <CloudServiceManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/integration/message-templates"
          element={
            <RequirePermission
              permissionCode={
                CONSOLE_PERMISSIONS.integrationMessageTemplateManage
              }
            >
              <MessageTemplateManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/integration/comfyui-servers"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.integrationServerManage}
            >
              <ComfyUIServerManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/integration/api-platform"
          element={<Navigate to={CONSOLE_ROUTES.modelHubChannels} replace />}
        />
        <Route
          path="/integration/cloud-platform"
          element={<Navigate to={CONSOLE_ROUTES.integrationCloudServices} replace />}
        />
        <Route
          path="/integration/servers"
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.integrationServerManage}>
              <Navigate to={CONSOLE_ROUTES.integrationServers} replace />
            </RequirePermission>
          }
        />
        <Route
          path="/integration/models"
          element={<Navigate to={CONSOLE_ROUTES.modelHubChannels} replace />}
        />
        <Route
          path="/integration/knowledge-base-servers"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.integrationServerManage}
            >
              <ComingSoonPage title="知识库服务器" />
            </RequirePermission>
          }
        />

        <Route path="/console/api-platform" element={<Navigate to={CONSOLE_ROUTES.modelHubChannels} replace />} />
        <Route path="/console/cloud-platform" element={<Navigate to={CONSOLE_ROUTES.integrationCloudServices} replace />} />
        <Route path="/console/servers" element={<Navigate to="/integration/servers" replace />} />
        <Route path="/console/knowledge-base-servers" element={<Navigate to="/integration/knowledge-base-servers" replace />} />
        <Route path="/aigc/models" element={<Navigate to={CONSOLE_ROUTES.modelHubChannels} replace />} />

        <Route
          path="/materials/works"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.materialsWorkManage}
            >
              <WorkMaterialsManagementPage />
            </RequirePermission>
          }
        />
        <Route path="/materials/gallery-works" element={<Navigate to="/materials/works" replace />} />
          <Route
          path="/materials/images"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.materialsMediaManage}
            >
              <ImageMaterialsManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/materials/file-materials"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.materialsFileManage}
            >
              <FileMaterialsManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/materials/files"
          element={<Navigate to="/materials/file-materials" replace />}
        />
        <Route
          path="/materials/videos"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.materialsMediaManage}
            >
              <VideoMaterialsManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/materials/models"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.materialsModelManage}
            >
              <ModelMaterialsManagementPage />
            </RequirePermission>
          }
        />

        <Route
          path="/aigc/works"
          element={<Navigate to="/materials/works" replace />}
        />
        <Route
          path="/aigc/materials/images"
          element={<Navigate to="/materials/images" replace />}
        />
        <Route
          path="/aigc/materials/files"
          element={<Navigate to="/materials/file-materials" replace />}
        />
        <Route
          path="/aigc/materials/videos"
          element={<Navigate to="/materials/videos" replace />}
        />
        <Route
          path="/assets/works"
          element={<Navigate to="/materials/works" replace />}
        />

        <Route
          path="/ums/users"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.userAccountManage}
            >
              <UserManagementPage />
            </RequirePermission>
          }
        />
        <Route path="/ums/users/:id/edit" element={<UserEditRoutePage />} />
        <Route
          path="/ums/merchants"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.merchantManage}
            >
              <MerchantManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/ums/stores"
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.storeManage}>
              <StoreManagementPage />
            </RequirePermission>
          }
        />
        <Route path="/ums/account/close" element={<AccountClosePage />} />

        <Route
          path="/iam/users"
          element={<Navigate to="/ums/users" replace />}
        />
        <Route
          path="/iam/account/close"
          element={<Navigate to="/ums/account/close" replace />}
        />
        <Route
          path="/ops/merchants"
          element={<Navigate to="/ums/merchants" replace />}
        />
        <Route
          path="/ops/stores"
          element={<Navigate to="/ums/stores" replace />}
        />

        <Route
          path={CONSOLE_ROUTES.permissionManagement}
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.iamRbacManage}
            >
              <PermissionManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path={CONSOLE_ROUTES.roleManagement}
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.iamRbacManage}
            >
              <RoleManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/sys/storage"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.sysStorageManage}
            >
              <StorageManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/sys/payments"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.sysPaymentManage}
            >
              <PaymentManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/sys/payments/:gatewayCode"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.sysPaymentManage}
            >
              <PaymentGatewayConfigEditPage />
            </RequirePermission>
          }
        />
        <Route
          path="/sys/wechat-official"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.sysWechatManage}
            >
              <WechatOfficialManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/sys/mini-program"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.sysMiniProgramManage}
            >
              <MiniProgramManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/sys/login-config"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.sysLoginManage}
            >
              <LoginConfigManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/sys/privacy-policy"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.sysLegalManage}
            >
              <PrivacyPolicyManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/sys/user-agreement"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.sysLegalManage}
            >
              <UserAgreementManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/sys/watermark"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.sysWatermarkManage}
            >
              <WatermarkManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path={CONSOLE_ROUTES.systemOnlineUsers}
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.sysOnlineUserManage}>
              <OnlineUserPage />
            </RequirePermission>
          }
        />
        <Route
          path="/sys/biz-llm-config"
          element={<Navigate to={CONSOLE_ROUTES.modelHubBizCapabilities} replace />}
        />
        <Route
          path="/sys/seo-geo"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.sysLoginManage}
            >
              <ComingSoonPage title="SEO/GEO" />
            </RequirePermission>
          }
        />

        <Route
          path="/ops/storage"
          element={<Navigate to="/sys/storage" replace />}
        />
        <Route
          path="/ops/payments"
          element={<Navigate to="/sys/payments" replace />}
        />
        <Route
          path="/ops/payments/:gatewayCode"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.sysPaymentManage}
            >
              <PaymentGatewayConfigEditPage />
            </RequirePermission>
          }
        />
        <Route path="/ops/wechat-official" element={<Navigate to="/sys/wechat-official" replace />} />
        <Route path="/ops/mini-program" element={<Navigate to="/sys/mini-program" replace />} />
        <Route path="/ops/login-config" element={<Navigate to="/sys/login-config" replace />} />
        <Route path="/ops/privacy-policy" element={<Navigate to="/sys/privacy-policy" replace />} />
        <Route path="/ops/user-agreement" element={<Navigate to="/sys/user-agreement" replace />} />
        <Route path="/ops/watermark" element={<Navigate to="/sys/watermark" replace />} />
        <Route path="/ops/seo-geo" element={<Navigate to="/sys/seo-geo" replace />} />

        <Route
          path="/ops/user-packages"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.opsPackageManage}
            >
              <UserPackageManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/user-packages/new"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.opsPackageManage}
            >
              <UserPackageEditorPage />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/user-packages/:id/edit"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.opsPackageManage}
            >
              <UserPackageEditorPage />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/plans"
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.opsPackageManage}>
              <Navigate to={CONSOLE_ROUTES.userPackages} replace />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/orders"
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.opsPackageManage}>
              <OrderManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/fund-ledgers"
          element={
            <RequirePermission permissionCode={CONSOLE_PERMISSIONS.opsBillingManage}>
              <FundLedgerPage />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/notifications"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.opsNotificationManage}
            >
              <NotificationInboxPage />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/audit-log"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.opsAuditManage}
            >
              <AuditLogPage />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/audits"
          element={<Navigate to="/ops/audit-log" replace />}
        />
        <Route
          path="/app/scheduler/tasks"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.schedulerManage}
            >
              <SchedulerTaskManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/invite-codes"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.opsPackageManage}
            >
              <ComingSoonPage title="邀请码" />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/redeem-codes"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.opsBillingManage}
            >
              <ComingSoonPage title="兑换码" />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/compute-usage"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.opsBillingManage}
            >
              <ComingSoonPage title="算力消耗" />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/tickets"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.opsTicketManage}
            >
              <TicketManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/tickets/disposal-config"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.opsTicketManage}
            >
              <TicketDisposalConfigPage />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/tickets/new"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.opsTicketManage}
            >
              <TicketEditorPage />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/tickets/:ticketId/edit"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.opsTicketManage}
            >
              <TicketEditorPage />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/tickets/:ticketId/replies"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.opsTicketManage}
            >
              <TicketReplyPage />
            </RequirePermission>
          }
        />
        <Route
          path="/ops/finance"
          element={
            <RequirePermission
              permissionCode={CONSOLE_PERMISSIONS.opsBillingManage}
            >
              <ComingSoonPage title="财务管理" />
            </RequirePermission>
          }
        />

        <Route
          path="/billing/plans"
          element={<Navigate to="/ops/plans" replace />}
        />
        <Route
          path="/billing/orders"
          element={<Navigate to="/ops/orders" replace />}
        />
        <Route
          path="/logs/audits"
          element={<Navigate to="/ops/audit-log" replace />}
        />
        <Route
          path="/scheduler/tasks"
          element={<Navigate to="/app/scheduler/tasks" replace />}
        />
      </Route>
      {/* 自定义layout，BackendCenterLayout  */}
      <Route
        element={
          <RequireAuth>
            <BackendCenterLayout />
          </RequireAuth>
        }
      >
        {/* 创作页 */}
        <Route path={CONSOLE_ROUTES.creation} element={<Creation />} />
        <Route path={CONSOLE_ROUTES.drawRecord} element={<DrawRecord />} />
        <Route path={CONSOLE_ROUTES.userCenter} element={<UserCenter />} />
        <Route path={CONSOLE_ROUTES.membershipService } element={<MembershipService />} />
        <Route path='/backendCenter/canvas' element={<InfiniteCanvas />} />
      </Route>

      {/* 用户协议、隐私政策 */}
      <Route path="/public/service" element={<PublicService />} />
      <Route path="/public/privacy" element={<PublicPrivacy />} />
      <Route path="/custom/wechat/open/callback" element={<CustomWechatOpenCallback />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}
