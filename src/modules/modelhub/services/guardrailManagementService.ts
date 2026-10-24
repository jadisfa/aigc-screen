import {
  createModelHubGuardrail,
  getModelHubGuardrail,
  listModelHubGuardrails,
  type ListModelHubGuardrailsParams,
  type ModelHubGuardrail,
  type ModelHubGuardrailDataset,
  updateModelHubGuardrail,
} from "@/shared/api/model-hub/model-hub";
import { formatModelHubDateTime } from "@/modules/modelhub/services/modelhubAdminUi";
import type {
  GuardrailListItem,
  GuardrailRuleDetail,
} from "@/modules/modelhub/types/guardrailManagementTypes";
import {
  GUARDRAIL_ACTION_LABEL,
  GUARDRAIL_RISK_LABEL,
  GUARDRAIL_STATUS_LABEL,
} from "@/modules/modelhub/types/guardrailManagementTypes";

function buildMatchSummary(matchItems: string[]) {
  if (matchItems.length === 0) {
    return "未配置匹配项";
  }
  if (matchItems.length <= 2) {
    return matchItems.join(" / ");
  }
  return `${matchItems.slice(0, 2).join(" / ")} 等 ${matchItems.length} 项`;
}

function toDetail(item: ModelHubGuardrail): GuardrailRuleDetail {
  return {
    id: item.id,
    name: item.name,
    riskLevel: item.riskLevel,
    status: item.status,
    isSystemBaseline: item.isSystemBaseline,
    matchItems: item.matchItems.length > 0 ? item.matchItems : [""],
    action: item.action,
    referenceCount: item.referenceCount,
  };
}

function toListItem(item: ModelHubGuardrail): GuardrailListItem {
  return {
    id: item.id,
    name: item.name,
    riskLevel: item.riskLevel,
    riskLabel: GUARDRAIL_RISK_LABEL[item.riskLevel],
    matchSummary: buildMatchSummary(item.matchItems),
    actionLabel: GUARDRAIL_ACTION_LABEL[item.action],
    action: item.action,
    status: item.status,
    statusLabel: GUARDRAIL_STATUS_LABEL[item.status],
    isSystemBaseline: item.isSystemBaseline,
    referenceCount: item.referenceCount,
    hitCount24h: item.hitCount24h,
    updatedAt: item.updatedAt,
    updatedAtLabel: formatModelHubDateTime(item.updatedAt),
    referenceSummary: item.referenceSummary,
  };
}

export type GuardrailListPageData = {
  summary: ModelHubGuardrailDataset["summary"];
  page: ModelHubGuardrailDataset["page"];
  items: GuardrailListItem[];
};

export async function fetchGuardrailListPage(params: ListModelHubGuardrailsParams): Promise<GuardrailListPageData> {
  const dataset = await listModelHubGuardrails(params);
  return {
    ...dataset,
    items: dataset.items.map(toListItem),
  };
}

export async function fetchGuardrailListItems(): Promise<GuardrailListItem[]> {
  const dataset = await fetchGuardrailListPage({ pageNo: 1, pageSize: 200 });
  return dataset.items;
}

export async function fetchGuardrailRuleDetail(id: string): Promise<GuardrailRuleDetail> {
  const item = await getModelHubGuardrail(id);
  return toDetail(item);
}

export async function saveGuardrailRule(
  mode: "create" | "edit",
  detail: Pick<GuardrailRuleDetail, "name" | "riskLevel" | "status" | "isSystemBaseline" | "matchItems" | "action">,
  editingId?: string,
): Promise<void> {
  const command = {
    name: detail.name.trim(),
    riskLevel: detail.riskLevel,
    matchItems: detail.matchItems.map((item) => item.trim()).filter(Boolean),
    action: detail.action,
    isSystemBaseline: detail.isSystemBaseline,
    status: detail.status,
  };

  if (mode === "create") {
    await createModelHubGuardrail(command);
    return;
  }

  if (!editingId) {
    throw new Error("缺少待编辑的安全规则 ID");
  }
  await updateModelHubGuardrail(editingId, command);
}
