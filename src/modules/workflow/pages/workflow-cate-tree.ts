import type { WorkflowCate } from "@/shared/api/workflow/workflow-cate";

export type WorkflowCateTreeNode = WorkflowCate & { children: WorkflowCate[] };

export function buildTwoLevelWorkflowCateTree(items: WorkflowCate[]): WorkflowCateTreeNode[] {
  const roots = items
    .filter((c) => c.level === 1 || c.parentId == null)
    .sort((a, b) => (a.sortNo ?? 100) - (b.sortNo ?? 100));

  const childrenByParent = new Map<string, WorkflowCate[]>();
  for (const c of items) {
    if (!c.parentId) continue;
    if (c.level !== 2) continue;
    const prev = childrenByParent.get(c.parentId) ?? [];
    prev.push(c);
    childrenByParent.set(c.parentId, prev);
  }

  for (const [, list] of childrenByParent) {
    list.sort((a, b) => (a.sortNo ?? 100) - (b.sortNo ?? 100));
  }

  return roots.map((r) => ({
    ...r,
    children: childrenByParent.get(r.id) ?? [],
  }));
}

export function canAddChildCate(node: WorkflowCate): boolean {
  return node.level === 1 || node.parentId == null;
}
