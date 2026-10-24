export const CONSOLE_SOURCE_CODE = "ai_admin" as const;

export type PermissionKey = `${string}:${string}`;
export type PermissionRequirement =
  | PermissionKey
  | readonly PermissionKey[]
  | undefined;
export type AuthorizedRouteCandidate = Readonly<{
  to: string;
  permissionCode: PermissionRequirement;
}>;

export type PermissionSnapshot = {
  sourceCode: string;
  code: string;
};

export type PermissionSnapshotLike =
  | string
  | PermissionSnapshot
  | {
      sourceCode?: string | null;
      source_code?: string | null;
      code?: string | null;
      permissionCode?: string | null;
    };

export function toPermissionKey(
  sourceCode: string,
  code: string,
): PermissionKey {
  return `${sourceCode}:${code}`;
}

export type PermissionNamespace<
  TRoutes extends Record<string, string>,
  TPermissionCodes extends Record<string, string>,
> = {
  sourceCode: string;
  routes: TRoutes;
  permissions: { [K in keyof TPermissionCodes]: PermissionKey };
  defaultAuthorizedRouteCandidates: ReadonlyArray<AuthorizedRouteCandidate>;
};

function definePermissionNamespace<
  const TRoutes extends Record<string, string>,
  const TPermissionCodes extends Record<string, string>,
>(definition: {
  sourceCode: string;
  routes: TRoutes;
  permissionCodes: TPermissionCodes;
  createDefaultAuthorizedRouteCandidates: (
    routes: TRoutes,
    permissions: { [K in keyof TPermissionCodes]: PermissionKey },
  ) => ReadonlyArray<AuthorizedRouteCandidate>;
}): PermissionNamespace<TRoutes, TPermissionCodes> {
  const permissions = Object.fromEntries(
    Object.entries(definition.permissionCodes).map(([key, code]) => [
      key,
      toPermissionKey(definition.sourceCode, code),
    ]),
  ) as { [K in keyof TPermissionCodes]: PermissionKey };

  return {
    sourceCode: definition.sourceCode,
    routes: definition.routes,
    permissions,
    defaultAuthorizedRouteCandidates:
      definition.createDefaultAuthorizedRouteCandidates(
        definition.routes,
        permissions,
      ),
  };
}

function normalizePermissionSnapshot(
  sourceCode: string,
  permission: PermissionSnapshotLike,
): PermissionSnapshot | null {
  if (typeof permission === "string") {
    const normalizedCode = permission.trim();
    return normalizedCode ? { sourceCode, code: normalizedCode } : null;
  }

  const normalizedSourceCode = (
    permission.sourceCode ??
    permission.source_code ??
    sourceCode
  )?.trim();
  const normalizedCode = (
    permission.code ??
    permission.permissionCode ??
    ""
  )?.trim();
  if (!normalizedSourceCode || !normalizedCode) {
    return null;
  }
  return {
    sourceCode: normalizedSourceCode,
    code: normalizedCode,
  };
}

export function buildPermissionSet(
  sourceCode: string,
  permissions: Iterable<PermissionSnapshotLike>,
) {
  const permissionSet = new Set<PermissionKey>();
  for (const permission of permissions) {
    const snapshot = normalizePermissionSnapshot(sourceCode, permission);
    if (!snapshot || snapshot.sourceCode !== sourceCode) {
      continue;
    }
    permissionSet.add(toPermissionKey(snapshot.sourceCode, snapshot.code));
  }
  return permissionSet;
}

export function buildPermissionSetForNamespace(
  namespace: Pick<
    PermissionNamespace<Record<string, string>, Record<string, string>>,
    "sourceCode"
  >,
  permissions: Iterable<PermissionSnapshotLike>,
) {
  return buildPermissionSet(namespace.sourceCode, permissions);
}

export const CONSOLE_PERMISSION_NAMESPACE = definePermissionNamespace({
  sourceCode: CONSOLE_SOURCE_CODE,
  routes: {
    login: "/login",
    forbidden: "/403",
    customHome: "/custom/home",
    dashboard: "/app/dashboard",
    modelHubDashboard: "/model-hub/dashboard",
    modelHubChannels: "/model-hub/channels",
    modelHubApiKeys: "/model-hub/api-keys",
    modelHubModels: "/model-hub/models",
    modelHubPools: "/model-hub/pools",
    modelHubGuardrails: "/model-hub/guardrails",
    modelHubRouting: "/model-hub/routing",
    modelHubConsumptionRecords: "/model-hub/consumption-records",
    modelHubLogs: "/model-hub/logs",
    modelHubAlerts: "/model-hub/alerts",
    modelHubBizCapabilities: "/model-hub/biz-capabilities",

    workflowList: "/app/workflows",
    workflowCategories: "/app/categories",
    workflowVersions: "/app/versions",
    workflowTags: "/app/tags",
    materialsWorks: "/materials/works",
    integrationCloudServices: "/integration/cloud-services",
    integrationMessageTemplates: "/integration/message-templates",
    integrationServers: "/integration/comfyui-servers",
    userManagement: "/ums/users",
    permissionManagement: "/sys/iam/permissions",
    roleManagement: "/sys/iam/roles",
    systemStorage: "/sys/storage",
    systemOnlineUsers: "/sys/online-users",
    userPackages: "/ops/user-packages",
    orders: "/ops/orders",
    fundLedgers: "/ops/fund-ledgers",
    notifications: "/ops/notifications",
    tickets: "/ops/tickets",
    auditLogs: "/ops/audit-log",
    apiDocs: "/docs/api",
    publicService: "/public/service",
    publicPrivacy: "/public/privacy",
    creation: "/backendCenter/creation",
    drawRecord: "/backendCenter/draw-record",
    userCenter: "/backendCenter/use-center",
    membershipService: "/backendCenter/membership-service"
  },
  permissionCodes: {
    customHome: "custom.home",
    dashboard: "dashboard.overview.view",
    modelHubDashboardManage: "modelhub.dashboard.manage",
    modelHubChannelManage: "modelhub.channel.manage",
    modelHubApiKeyManage: "modelhub.api-key.manage",
    modelHubBaseModelManage: "modelhub.base-model.manage",
    modelHubPoolManage: "modelhub.pool.manage",
    modelHubGuardrailManage: "modelhub.guardrail.manage",
    modelHubRoutingManage: "modelhub.routing.manage",
    modelHubConsumptionRecordManage: "modelhub.consumption-record.manage",
    modelHubLogManage: "modelhub.log.manage",
    modelHubAlertManage: "modelhub.alert.manage",
    modelHubBizCapabilityManage: "modelhub.biz-capability.manage",
    workflowAppManage: "workflow.app.manage",
    workflowCategoryManage: "workflow.category.manage",
    workflowTagManage: "workflow.tag.manage",
    workflowVersionManage: "workflow.version.manage",
    schedulerManage: "scheduler.task.manage",
    integrationCloudServiceManage: "integration.cloud-service.manage",
    integrationMessageTemplateManage: "integration.message-template.manage",
    integrationServerManage: "integration.server.manage",
    materialsWorkManage: "materials.work.manage",
    materialsMediaManage: "materials.media.manage",
    materialsFileManage: "materials.file.manage",
    materialsModelManage: "materials.model.manage",
    materialsCategoryManage: "materials.category.manage",
    materialsTagManage: "materials.tag.manage",
    userAccountManage: "iam.user-account.manage",
    merchantManage: "iam.merchant.manage",
    storeManage: "iam.store.manage",
    iamRbacManage: "iam.rbac.manage",
    sysStorageManage: "sys.storage.manage",
    sysPaymentManage: "sys.payment.manage",
    sysWechatManage: "sys.wechat.manage",
    sysMiniProgramManage: "sys.miniprogram.manage",
    sysLegalManage: "sys.legal.manage",
    sysWatermarkManage: "sys.watermark.manage",
    sysLoginManage: "sys.login.manage",
    sysOnlineUserManage: "sys.online-user.manage",
    opsPackageManage: "ops.package.manage",
    opsBillingManage: "ops.billing.manage",
    opsNotificationManage: "ops.notification.manage",
    opsNotificationBroadcast: "ops.notification.broadcast",
    opsTicketManage: "ops.ticket.manage",
    opsAuditManage: "ops.audit.manage",
    opsAccountManage: "ops.account.manage",
  },
  createDefaultAuthorizedRouteCandidates: (routes, permissions) => [
    { to: routes.customHome, permissionCode: permissions.customHome },
    { to: routes.dashboard, permissionCode: permissions.dashboard },
    { to: routes.modelHubDashboard, permissionCode: permissions.modelHubDashboardManage },
    { to: routes.modelHubChannels, permissionCode: permissions.modelHubChannelManage },
    { to: routes.modelHubApiKeys, permissionCode: permissions.modelHubApiKeyManage },
    { to: routes.modelHubModels, permissionCode: permissions.modelHubBaseModelManage },
    { to: routes.modelHubPools, permissionCode: permissions.modelHubPoolManage },
    { to: routes.modelHubGuardrails, permissionCode: permissions.modelHubGuardrailManage },
    { to: routes.modelHubRouting, permissionCode: permissions.modelHubRoutingManage },
    { to: routes.modelHubConsumptionRecords, permissionCode: permissions.modelHubConsumptionRecordManage },
    { to: routes.modelHubLogs, permissionCode: permissions.modelHubLogManage },
    { to: routes.modelHubAlerts, permissionCode: permissions.modelHubAlertManage },
    { to: routes.modelHubBizCapabilities, permissionCode: permissions.modelHubBizCapabilityManage },
    { to: routes.workflowList, permissionCode: permissions.workflowAppManage },
    {
      to: routes.workflowCategories,
      permissionCode: permissions.workflowCategoryManage,
    },
    {
      to: routes.workflowVersions,
      permissionCode: permissions.workflowVersionManage,
    },
    { to: routes.workflowTags, permissionCode: permissions.workflowTagManage },
    { to: routes.materialsWorks, permissionCode: permissions.materialsWorkManage },
    { to: "/materials/images", permissionCode: permissions.materialsMediaManage },
    { to: "/materials/file-materials", permissionCode: permissions.materialsFileManage },
    { to: "/materials/videos", permissionCode: permissions.materialsMediaManage },
    { to: "/materials/models", permissionCode: permissions.materialsModelManage },
    { to: routes.integrationCloudServices, permissionCode: permissions.integrationCloudServiceManage },
    { to: routes.integrationMessageTemplates, permissionCode: permissions.integrationMessageTemplateManage },
    { to: routes.integrationServers, permissionCode: permissions.integrationServerManage },
    { to: routes.userManagement, permissionCode: permissions.userAccountManage },
    { to: "/ums/merchants", permissionCode: permissions.merchantManage },
    { to: "/ums/stores", permissionCode: permissions.storeManage },
    {
      to: routes.permissionManagement,
      permissionCode: permissions.iamRbacManage,
    },
    { to: routes.roleManagement, permissionCode: permissions.iamRbacManage },
    { to: routes.systemStorage, permissionCode: permissions.sysStorageManage },
    { to: "/sys/payments", permissionCode: permissions.sysPaymentManage },
    { to: "/sys/wechat-official", permissionCode: permissions.sysWechatManage },
    {
      to: "/sys/mini-program",
      permissionCode: permissions.sysMiniProgramManage,
    },
    { to: "/sys/login-config", permissionCode: permissions.sysLoginManage },
    { to: "/sys/privacy-policy", permissionCode: permissions.sysLegalManage },
    { to: "/sys/user-agreement", permissionCode: permissions.sysLegalManage },
    { to: "/sys/watermark", permissionCode: permissions.sysWatermarkManage },
    { to: routes.systemOnlineUsers, permissionCode: permissions.sysOnlineUserManage },
    { to: routes.userPackages, permissionCode: permissions.opsPackageManage },
    { to: routes.fundLedgers, permissionCode: permissions.opsBillingManage },
    { to: routes.notifications, permissionCode: permissions.opsNotificationManage },
    { to: routes.tickets, permissionCode: permissions.opsTicketManage },
    { to: routes.auditLogs, permissionCode: permissions.opsAuditManage },
  ],
});

export const CONSOLE_ROUTES = CONSOLE_PERMISSION_NAMESPACE.routes;
export const CONSOLE_PERMISSIONS = CONSOLE_PERMISSION_NAMESPACE.permissions;

export function hasPermission(
  permissionSet: Iterable<PermissionKey>,
  requirement?: PermissionRequirement,
) {
  if (!requirement) {
    return true;
  }

  const current =
    permissionSet instanceof Set ? permissionSet : new Set(permissionSet);
  const candidates = Array.isArray(requirement) ? requirement : [requirement];
  return candidates.some((code) => current.has(code));
}

export function getAuthorizedRoute(
  permissionSet: Iterable<string>,
  candidates: ReadonlyArray<AuthorizedRouteCandidate>,
  fallbackRoute: string,
) {
  return (
    candidates.find((candidate) =>
      hasPermission(permissionSet, candidate.permissionCode),
    )?.to ?? fallbackRoute
  );
}

export function getDefaultAuthorizedRoute(permissionSet: Iterable<string>) {
  return getAuthorizedRoute(
    permissionSet,
    CONSOLE_PERMISSION_NAMESPACE.defaultAuthorizedRouteCandidates,
    CONSOLE_ROUTES.forbidden,
  );
}
