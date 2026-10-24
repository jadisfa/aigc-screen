import {
  ENTRY_LABEL,
  type RouteEntryCode,
  type RoutingProfileFormValue,
} from "@/modules/modelhub/types/routingManagementTypes";

/** Client-side routing profile form checks before create/update. */
export function buildRoutingValidationIssues(input: {
  editingId?: string;
  form: RoutingProfileFormValue;
  profiles: Array<{ id: string; name: string; isSystemDefault?: boolean }>;
}) {
  const issues: string[] = [];

  if (!input.form.code.trim()) {
    issues.push("策略编码不能为空。");
  }

  if (!input.form.name.trim()) {
    issues.push("策略名称不能为空。");
  }

  if (input.form.applicableTenantLevels.length === 0) {
    issues.push("至少选择一个适用租户级别。");
  }

  if (input.form.applicableRegions.length === 0) {
    issues.push("至少选择一个适用区域级别。");
  }

  if (input.form.isSystemDefault && input.form.status !== "enabled") {
    issues.push("系统默认策略必须保持启用。");
  }

  const duplicatedDefault = input.profiles.find((profile) => profile.isSystemDefault && profile.id !== input.editingId);
  if (input.form.isSystemDefault && duplicatedDefault) {
    issues.push(`系统默认策略最多一条，当前系统默认策略为“${duplicatedDefault.name}”。`);
  }

  const invalidFixedEntry = Object.entries(input.form.entries).find(
    ([, value]) => value.channelPolicy === "fixed" && value.fixedChannelId === "inherit",
  );
  if (invalidFixedEntry) {
    issues.push(`入口 ${ENTRY_LABEL[invalidFixedEntry[0] as RouteEntryCode]} 已选择固定渠道，但尚未指定具体渠道。`);
  }

  const missingPoolEntry = Object.entries(input.form.entries).find(([, value]) => !value.targetPoolId);
  if (missingPoolEntry) {
    issues.push(`入口 ${ENTRY_LABEL[missingPoolEntry[0] as RouteEntryCode]} 尚未绑定目标模型池。`);
  }

  if (!input.form.fallbackPoolId) {
    issues.push("请指定最终兜底池。");
  }

  return issues;
}
