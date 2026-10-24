import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listModelHubCatalogPicker } from "@/shared/api/model-hub/model-hub";
import { yuanAmountToFen } from "@/shared/lib/format";
import { modelPickerCatalogQueryKey, snapshotFromPickerModel } from "./catalog";
import type { FieldConstraintMap } from "./constraints";
import { findCatalogModelBinding, readCanonicalRuntimeValues } from "./identity";
import { estimateRuntimeYuan } from "./pricing";

const EMPTY_FIELDS: FieldConstraintMap = {};

type SelectedRuntimeModel = {
  fields: FieldConstraintMap;
  isReady: boolean;
  modelCode: string;
  canonicalValues: Record<string, unknown>;
  estimateFen: number;
};

export function useSelectedRuntimeModel(
  schema: unknown,
  values: Record<string, unknown>,
): SelectedRuntimeModel {
  const binding = useMemo(
    () => findCatalogModelBinding(schema, values),
    [schema, values],
  );
  const capability = binding?.capability ?? "";
  const modelCode = binding?.modelCode ?? "";
  const canonicalValues = useMemo(
    () => readCanonicalRuntimeValues(schema, values),
    [schema, values],
  );

  const catalogQuery = useQuery({
    queryKey: modelPickerCatalogQueryKey(capability),
    queryFn: () => listModelHubCatalogPicker(capability),
    enabled: !!capability,
    staleTime: 60_000,
  });

  return useMemo(() => {
    if (!binding) {
      return {
        fields: EMPTY_FIELDS,
        isReady: true,
        modelCode,
        canonicalValues,
        estimateFen: 0,
      };
    }
    const model = (catalogQuery.data?.models ?? []).find((item) => item.code === modelCode);
    const snapshot = snapshotFromPickerModel(model);
    return {
      fields: snapshot.fields,
      isReady: catalogQuery.isSuccess || catalogQuery.isError,
      modelCode,
      canonicalValues,
      estimateFen: yuanAmountToFen(estimateRuntimeYuan(snapshot.pricing, canonicalValues)),
    };
  }, [
    binding,
    canonicalValues,
    catalogQuery.data,
    catalogQuery.isError,
    catalogQuery.isSuccess,
    modelCode,
  ]);
}
