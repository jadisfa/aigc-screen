import { Dispatch, SetStateAction, useEffect, useMemo } from "react";
import { type UiSchemaV1 } from "@/modules/workflow/components/pagebuilder/ui-schema";
import {
  createInitialRuntimeValue,
  renderUiComponentRuntimeField,
} from "@/modules/workflow/components/pagebuilder/ui-component-registry";
import {
  applyConstraintToComponent,
  applyFieldConstraintsToRuntimeValues,
  matchFieldConstraint,
  type FieldConstraintMap,
} from "@/modules/workflow/runtime-model/constraints";
import { runtimeValueSlot } from "@/modules/workflow/runtime-model/identity";

function RuntimeFieldShell(props: {
  component: UiSchemaV1["components"][number];
  fields: FieldConstraintMap;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const constraint = matchFieldConstraint(props.component, props.fields);
  const display = constraint ? applyConstraintToComponent(props.component, constraint) : props.component;
  return renderUiComponentRuntimeField({
    comp: display,
    value: props.value,
    onChange: props.onChange,
  });
}

export function RuntimeForm(props: {
  schema: UiSchemaV1;
  values: Record<string, unknown>;
  onValuesChange: Dispatch<SetStateAction<Record<string, unknown>>>;
  fields: FieldConstraintMap;
  modelCode: string;
  fieldsReady: boolean;
}) {
  const { schema, values, onValuesChange, fields, modelCode, fieldsReady } = props;
  const sorted = useMemo(() => [...schema.components].sort((a, b) => (a.position || 0) - (b.position || 0)), [schema.components]);

  useEffect(() => {
    onValuesChange((prev) => {
      let next: Record<string, unknown> | null = null;
      for (const comp of sorted) {
        const key = runtimeValueSlot(comp);
        if (!key || prev[key] !== undefined) continue;
        if (!next) next = { ...prev };
        next[key] = createInitialRuntimeValue(comp);
      }
      return next ?? prev;
    });
  }, [onValuesChange, sorted]);

  useEffect(() => {
    if (!fieldsReady) return;
    onValuesChange((prev) => applyFieldConstraintsToRuntimeValues(sorted, prev, fields));
  }, [fields, fieldsReady, modelCode, onValuesChange, sorted]);

  return (
    <div className="space-y-[22px] pt-2">
      {sorted.length === 0 && <div className="text-sm text-muted-foreground">暂无 ui_schema 组件，请先在编辑页搭建页面。</div>}
      {sorted.map((comp) => {
        const key = runtimeValueSlot(comp);
        if (!key) return null;
        return (
          <div key={comp.id}>
            <RuntimeFieldShell
              component={comp}
              fields={fieldsReady ? fields : {}}
              value={values[key]}
              onChange={(v) => onValuesChange((prev) => ({ ...prev, [key]: v }))}
            />
          </div>
        );
      })}
    </div>
  );
}
