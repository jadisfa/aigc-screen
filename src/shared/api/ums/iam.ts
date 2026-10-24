import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export type DictOption = {
  value: string;
  label: string;
};

export async function listAppClients(): Promise<DictOption[]> {
  const resp = await apiFetch<DictOption[]>("/api/admin/iam/dictionaries/app-clients");
  return resp || [];
}

export type Tenant = {
  tenantName: string;
  enabled?: boolean;
};

export type User = {
  id: string;
  userId?: number;
  principalId?: string;
  merchantId?: string;
  storeId?: string;
  avatarUrl?: string;
  username?: string;
  nickname?: string;
  displayName?: string;
  tenantId?: string;
  loginEnabled?: boolean;
  email?: string;
  phone?: string;
  principalStatus?: string;
  gender?: string;
  birthday?: string;
  realName?: string;
  remark?: string;
  org?: string;
  roles?: string[];
  groups?: string[];
  balance?: number;
};

/** 登录授权标识（手机/邮箱/微信/SSO 等）。 */
export type LoginIdentifier = {
  id: string;
  type: string;
  channel: string;
  channelLabel: string;
  typeLabel: string;
  value: string;
  primaryFlag?: boolean;
  verified?: boolean;
  verifiedAt?: string | null;
  createdAt?: string | null;
  deletable: boolean;
};

/** 用户编辑页详情（含登录授权标识）。 */
export type UserEditDetail = User & {
  wechatOpenId?: string | null;
  wechatUnionId?: string | null;
  identifiers?: LoginIdentifier[];
};

export type PrincipalAccountStatus = "active" | "disabled" | "closed";

export function normalizePrincipalStatus(status?: string | null): PrincipalAccountStatus {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) {
    return "active";
  }
  if (["1", "true", "active", "enable", "enabled", "normal", "正常"].includes(normalized)) {
    return "active";
  }
  if (["0", "false", "inactive", "disable", "disabled", "banned", "禁用", "封禁"].includes(normalized)) {
    return "disabled";
  }
  if (["closed", "关闭", "注销"].includes(normalized)) {
    return "closed";
  }
  return "active";
}

export function isPrincipalLoginEnabled(status?: string | null, loginEnabled?: boolean | null): boolean {
  if (typeof loginEnabled === "boolean") {
    return loginEnabled;
  }
  return normalizePrincipalStatus(status) === "active";
}

export type MePermissions = {
  principalId: string;
  userId?: string | null;
  avatarUrl?: string | null;
  roles: string[];
  permissions: Array<
    | string
    | {
        sourceCode?: string | null;
        source_code?: string | null;
        code?: string | null;
        permissionCode?: string | null;
      }
  >;
  sessionId?: string | null;
  scopeKey?: string | null;
  scopeLevel?: string | null;
  merchantId?: string | null;
  storeId?: string | null;
};

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type UmsCreateUserCommand = {
  principalId?: string | null;
  merchantId?: string | null;
  storeId?: string | null;
  nickname?: string | null;
  realName?: string | null;
  gender?: string | null;
  birthday?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  wechatId?: string | null;
  password?: string | null;
  status?: string | null;
  remark?: string | null;
  groups?: string[] | null;
};

export type UmsImportItemResult = {
  index: number;
  success: boolean;
  userId?: string | null;
  principalId?: string | null;
  error?: string | null;
};

export type UmsImportResult = {
  total: number;
  success: number;
  failed: number;
  items: UmsImportItemResult[];
};

export async function listTenants(): Promise<{ items: Tenant[] }> {
  return apiFetch<{ items: Tenant[] }>("/api/admin/iam/tenants", { method: "GET" });
}

export async function listUsers(params: {
  pageNo: number;
  pageSize: number;
  total?: number;
  tenantId?: string;
  keyword?: string;
}): Promise<{ page: PageResult; items: User[] }> {
  const { keyword } = params;
  const qs = buildPageSearchParams(params);
  if (keyword) qs.set("keyword", keyword);
  return apiFetch<{ page: PageResult; items: User[] }>(`/api/admin/ums/users?${qs.toString()}`, {
    method: "GET",
  });
}

export type UserSearchItem = {
  id: string;
  principalId: string;
  username?: string | null;
  nickname?: string | null;
  phone?: string | null;
  email?: string | null;
};

export async function searchUsers(params: {
  pageNo: number;
  pageSize: number;
  total?: number;
  merchantId?: string;
  storeId?: string;
  keyword?: string;
}): Promise<{ page: PageResult; items: UserSearchItem[] }> {
  const qs = buildPageSearchParams(params);
  if (params.merchantId) qs.set("merchantId", params.merchantId);
  if (params.storeId) qs.set("storeId", params.storeId);
  if (params.keyword) qs.set("keyword", params.keyword);
  return apiFetch<{ page: PageResult; items: UserSearchItem[] }>(`/api/admin/ums/users/search?${qs.toString()}`, {
    method: "GET",
  });
}

export async function getMePermissions(): Promise<MePermissions> {
  return apiFetch<MePermissions>("/api/admin/iam/me/permissions", { method: "GET" });
}

export async function importUmsUsers(params: { tenantId?: string; items: UmsCreateUserCommand[] }): Promise<UmsImportResult> {
  const { items } = params;
  return apiFetch<UmsImportResult>("/api/admin/ums/users/import", {
    method: "POST",
    body: JSON.stringify(items ?? []),
  });
}

export async function getUser(params: { tenantId?: string; id: string }): Promise<User> {
  const { id } = params;
  return apiFetch<User>(`/api/admin/ums/users/${id}`, {
    method: "GET",
  });
}

/** 用户编辑页专用：基础资料 + 全部登录授权标识。 */
export async function getUserEditDetail(params: { id: string }): Promise<UserEditDetail> {
  const { id } = params;
  return apiFetch<UserEditDetail>(`/api/admin/ums/users/${encodeURIComponent(id)}/edit-detail`, {
    method: "GET",
  });
}

/** 删除登录授权标识；删除后需用户再次绑定对应渠道。 */
export async function deleteUserLoginIdentifier(params: {
  userId: string;
  identifierId: string;
}): Promise<void> {
  const { userId, identifierId } = params;
  await apiFetch<null>(
    `/api/admin/ums/users/${encodeURIComponent(userId)}/identifiers/${encodeURIComponent(identifierId)}`,
    { method: "DELETE" },
  );
}

export async function createUser(params: {
  tenantId?: string;
  data: UmsCreateUserCommand;
}): Promise<string> {
  const { data } = params;
  return apiFetch<string>("/api/admin/ums/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteUser(_tenantId: string | undefined, id: string): Promise<void> {
  return apiFetch<void>(`/api/admin/ums/users/${id}`, {
    method: "DELETE",
  });
}

export async function resetUserPassword(_tenantId: string | undefined, id: string): Promise<void> {
  return apiFetch<void>(`/api/admin/ums/users/${id}/reset-password`, {
    method: "POST",
  });
}

export async function updateUser(params: {
  tenantId?: string;
  id: string;
  data: Partial<UmsCreateUserCommand>;
}): Promise<void> {
  const { id, data } = params;
  return apiFetch<void>(`/api/admin/ums/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function updateUserStatus(params: { tenantId?: string; id: string; status: string }) {
  return apiFetch(`/api/admin/ums/users/${params.id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status: params.status }),
  });
}

export async function updateUserGroups(params: { tenantId?: string; id: string; groups: string[] }) {
  return apiFetch(`/api/admin/ums/users/${params.id}/groups`, {
    method: "PUT",
    body: JSON.stringify({ groups: params.groups }),
  });
}

export type RoleView = {
  roleId: string;
  code: string;
  sourceCode: string;
  name: string;
  description?: string;
  createdAt?: string | null;
  scopeLevel?: string;
  isTemplate?: boolean;
  isSystem?: boolean;
  type?: string;
  scope?: string;
};

export type CreateRoleCommand = {
  code: string;
  name: string;
  description?: string | null;
  sourceCode?: string | null;
  scopeLevel?: string | null;
  isTemplate?: boolean | null;
};

export type PermissionView = {
  permissionId: string;
  code: string;
  sourceCode: string;
  name: string;
  description?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  sourceName?: string;
  directoryKey?: string;
  directoryName?: string;
  resourceKey?: string;
  resourceName?: string;
  actionKey?: string;
  identifierKey?: string | null;
  scopeLevels?: string[];
  apiGroups?: string[];
  menuPaths?: string[];
  sortOrder?: number;
  enabled?: boolean;
};

export type CreatePermissionCommand = {
  code: string;
  name: string;
  description?: string | null;
  sourceCode?: string | null;
};

export type PermissionMetadataItem = {
  permissionCode: string;
  sourceCode: string;
  sourceName?: string;
  directoryKey?: string;
  directoryName?: string;
  resourceKey?: string;
  resourceName?: string;
  actionKey?: string;
  identifierKey?: string | null;
  scopeLevels?: string[];
  apiGroups?: string[];
  menuPaths?: string[];
  sortOrder?: number;
  enabled?: boolean;
  permissionId?: string | null;
  permissionName?: string | null;
  permissionDescription?: string | null;
  permissionCreatedAt?: string | null;
  permissionUpdatedAt?: string | null;
  registered?: boolean;
};

export type UpsertPermissionMetadataCommand = {
  permissionCode: string;
  sourceCode?: string | null;
  sourceName?: string | null;
  directoryKey?: string | null;
  directoryName?: string | null;
  resourceKey?: string | null;
  resourceName?: string | null;
  actionKey?: string | null;
  identifierKey?: string | null;
  scopeLevels?: string[] | null;
  apiGroups?: string[] | null;
  menuPaths?: string[] | null;
  sortOrder?: number | null;
  enabled?: boolean | null;
};

export type UpdatePermissionMetadataCommand = UpsertPermissionMetadataCommand & {
  currentPermissionCode: string;
  currentSourceCode?: string | null;
};

export type RoleGrant = {
  roleCode: string;
  sourceCode: string;
  scopeLevel?: string | null;
  merchantId?: string | null;
  storeId?: string | null;
};

export type RbacSourceQuery = {
  sourceCode?: string | null;
};

function buildRbacQueryPath(path: string, query?: RbacSourceQuery): string {
  const sourceCode = query?.sourceCode?.trim();
  if (!sourceCode) {
    return path;
  }
  const searchParams = new URLSearchParams();
  searchParams.set("sourceCode", sourceCode);
  return `${path}?${searchParams.toString()}`;
}

export async function listRoles(query?: RbacSourceQuery): Promise<RoleView[]> {
  return apiFetch<RoleView[]>(buildRbacQueryPath("/api/admin/iam/rbac/roles", query), {
    method: "GET",
  });
}

export async function createRole(data: CreateRoleCommand): Promise<RoleView> {
  return apiFetch<RoleView>("/api/admin/iam/rbac/roles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateRole(roleId: string, data: CreateRoleCommand): Promise<RoleView> {
  return apiFetch<RoleView>(`/api/admin/iam/rbac/roles/${encodeURIComponent(roleId)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteRole(roleId: string): Promise<void> {
  await apiFetch<void>(`/api/admin/iam/rbac/roles/${encodeURIComponent(roleId)}`, {
    method: "DELETE",
  });
}

export async function listPermissions(query?: RbacSourceQuery): Promise<PermissionView[]> {
  return apiFetch<PermissionView[]>(buildRbacQueryPath("/api/admin/iam/rbac/permissions", query), {
    method: "GET",
  });
}

export async function createPermission(data: CreatePermissionCommand): Promise<PermissionView> {
  return apiFetch<PermissionView>("/api/admin/iam/rbac/permissions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listPermissionMetadata(query?: RbacSourceQuery): Promise<PermissionMetadataItem[]> {
  return apiFetch<PermissionMetadataItem[]>(buildRbacQueryPath("/api/admin/iam/rbac/permission-metadata", query), {
    method: "GET",
  });
}

export async function createPermissionMetadata(data: UpsertPermissionMetadataCommand): Promise<PermissionMetadataItem> {
  return apiFetch<PermissionMetadataItem>("/api/admin/iam/rbac/permission-metadata", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePermissionMetadata(data: UpdatePermissionMetadataCommand): Promise<PermissionMetadataItem> {
  return apiFetch<PermissionMetadataItem>("/api/admin/iam/rbac/permission-metadata", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function registerPermissionMetadata(data: { permissionCode: string; sourceCode?: string | null }): Promise<PermissionMetadataItem> {
  return apiFetch<PermissionMetadataItem>("/api/admin/iam/rbac/permission-metadata/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deletePermissionMetadata(data: { permissionCode: string; sourceCode?: string | null }): Promise<void> {
  const params = new URLSearchParams();
  params.set("permissionCode", data.permissionCode);
  if (data.sourceCode) {
    params.set("sourceCode", data.sourceCode);
  }
  await apiFetch<void>(`/api/admin/iam/rbac/permission-metadata?${params.toString()}`, {
    method: "DELETE",
  });
}

export async function deletePermission(permissionId: string): Promise<void> {
  await apiFetch<void>(`/api/admin/iam/rbac/permissions/${encodeURIComponent(permissionId)}`, {
    method: "DELETE",
  });
}

export async function listRolePermissions(roleId: string): Promise<PermissionView[]> {
  return apiFetch<PermissionView[]>(`/api/admin/iam/rbac/roles/${roleId}/permissions`, {
    method: "GET",
  });
}

export async function replaceRolePermissions(roleId: string, permissionCodes: string[]): Promise<void> {
  return apiFetch<void>(`/api/admin/iam/rbac/roles/${roleId}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissionCodes }),
  });
}

export async function listPrincipalRoles(
  _tenantId: string | undefined,
  principalId: string,
  query?: RbacSourceQuery,
): Promise<RoleGrant[]> {
  return apiFetch<RoleGrant[]>(buildRbacQueryPath(`/api/admin/iam/rbac/principals/${principalId}/roles`, query), {
    method: "GET",
  });
}

export async function updatePrincipalRoles(_tenantId: string | undefined, principalId: string, grants: RoleGrant[]): Promise<void> {
  return apiFetch<void>(`/api/admin/iam/rbac/principals/${principalId}/roles`, {
    method: "PUT",
    body: JSON.stringify({ grants }),
  });
}
