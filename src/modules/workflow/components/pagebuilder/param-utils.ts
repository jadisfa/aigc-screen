import type { UiComponent, UiParam, UiSchemaV1 } from "./ui-schema";

export type UiParamNameValidationIssue = {
  componentId: string;
  componentTitle: string;
  componentPosition: number;
  paramIndex: number;
  paramName: string;
  code: "empty" | "duplicate";
  message: string;
  duplicateWithComponentId?: string;
  duplicateWithComponentTitle?: string;
  duplicateWithComponentPosition?: number;
};

export type UiParamNameValidationState = {
  emptyIndexes: Set<number>;
  duplicateIndexes: Set<number>;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getComponentLabel(componentTitle: string | null | undefined, componentPosition: number | null | undefined): string {
  const title = normalizeText(componentTitle);
  if (title) return `“${title}”控件`;
  return `第 ${componentPosition ?? "-"} 个控件`;
}

export function getParamAlias(param: UiParam | null | undefined): string {
  return normalizeText(param?.name);
}

export function getParamInputKey(param: UiParam | null | undefined): string {
  const inputKey = normalizeText(param?.inputKey);
  if (inputKey) return inputKey;
  return getParamAlias(param);
}

export function shouldSyncParamAliasWithInputKey(param: UiParam | null | undefined): boolean {
  const alias = getParamAlias(param);
  if (!alias) return true;
  return alias === getParamInputKey(param);
}

export function applyNodeInputSelection(param: UiParam, selection: { nodeId: string; inputKey: string }): UiParam {
  const nextAlias = shouldSyncParamAliasWithInputKey(param) ? selection.inputKey : getParamAlias(param);
  return {
    ...param,
    nodeId: selection.nodeId,
    inputKey: selection.inputKey,
    name: nextAlias,
  };
}

export function getNodeInputDisplayLabel(nodeLabel: string, inputKey: string): string {
  return `${nodeLabel}/${inputKey}`;
}

export function getUiParamNameValidationState(params: UiParam[]): UiParamNameValidationState {
  const emptyIndexes = new Set<number>();
  const duplicateIndexes = new Set<number>();
  const groupedIndexes = new Map<string, number[]>();

  params.forEach((param, index) => {
    const alias = getParamAlias(param);
    if (!alias) {
      emptyIndexes.add(index);
      return;
    }
    const indexes = groupedIndexes.get(alias) ?? [];
    indexes.push(index);
    groupedIndexes.set(alias, indexes);
  });

  groupedIndexes.forEach((indexes) => {
    if (indexes.length <= 1) return;
    indexes.forEach((index) => duplicateIndexes.add(index));
  });

  return { emptyIndexes, duplicateIndexes };
}

export function validateUiSchemaParamNames(schema: UiSchemaV1 | null): UiParamNameValidationIssue[] {
  if (!schema) return [];

  const issues: UiParamNameValidationIssue[] = [];
  const groupedIndexes = new Map<string, Array<{ component: UiComponent; paramIndex: number; param: UiParam }>>();

  for (const component of schema.components) {
    const params = component.basic?.params ?? [];
    params.forEach((param, index) => {
      const alias = getParamAlias(param);
      if (!alias) {
        issues.push({
          componentId: component.id,
          componentTitle: component.title,
          componentPosition: component.position,
          paramIndex: index,
          paramName: alias,
          code: "empty",
          message: "参数名称不能为空，请修改",
        });
        return;
      }
      const indexes = groupedIndexes.get(alias) ?? [];
      indexes.push({ component, paramIndex: index, param });
      groupedIndexes.set(alias, indexes);
    });
  }

  groupedIndexes.forEach((entries) => {
    if (entries.length <= 1) return;
    entries.forEach(({ component, paramIndex, param }) => {
      const duplicateWith = entries.find((entry) => entry.component.id !== component.id || entry.paramIndex !== paramIndex);
      const currentLabel = getComponentLabel(component.title, component.position);
      const duplicateWithLabel = duplicateWith
        ? getComponentLabel(duplicateWith.component.title, duplicateWith.component.position)
        : currentLabel;
      issues.push({
        componentId: component.id,
        componentTitle: component.title,
        componentPosition: component.position,
        paramIndex,
        paramName: getParamAlias(param),
        code: "duplicate",
        message: `${currentLabel}的参数与${duplicateWithLabel}的参数名称重复，请检查并重命名`,
        duplicateWithComponentId: duplicateWith?.component.id,
        duplicateWithComponentTitle: duplicateWith?.component.title,
        duplicateWithComponentPosition: duplicateWith?.component.position,
      });
    });
  });

  return issues;
}

export function formatParamValidationIssue(issue: UiParamNameValidationIssue): string {
  if (issue.code === "duplicate") {
    return issue.message;
  }
  const componentLabel = getComponentLabel(issue.componentTitle, issue.componentPosition);
  return `${componentLabel}的参数 ${issue.paramIndex + 1}：${issue.message}`;
}
