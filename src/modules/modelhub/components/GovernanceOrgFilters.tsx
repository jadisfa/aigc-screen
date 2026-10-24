import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { GovernanceScopeChoice } from "@/shared/hooks/use-governance-scope-choice";

type GovernanceOrgFiltersProps = {
  choice: GovernanceScopeChoice;
  /** 切换商户/门店后重置列表页码。 */
  onScopeChange?: () => void;
  emptyValue?: string;
  emptyMerchantLabel?: string;
  emptyStoreLabel?: string;
  /** 锁定会话不展示只读输入（模型池筛选）。 */
  hideWhenLocked?: boolean;
  disableStoreWhenNoMerchant?: boolean;
  triggerClassName?: string;
};

/** 治理列表页共用的商户/门店筛选。各页空值文案与锁定态由调用方传入。 */
export function GovernanceOrgFilters(props: GovernanceOrgFiltersProps) {
  const emptyValue = props.emptyValue ?? "all";
  const triggerClassName = props.triggerClassName ?? "subpage-native-select h-9 w-48";
  const {
    canChooseMerchant,
    canChooseStore,
    fixedMerchantId,
    fixedStoreId,
    selectedMerchantId,
    selectedStoreId,
    setSelectedMerchantId,
    setSelectedStoreId,
    merchantOptions,
    storeOptions,
  } = props.choice;
  const activeMerchantId = (canChooseMerchant ? selectedMerchantId : fixedMerchantId).trim();

  const changeMerchant = (value: string) => {
    setSelectedMerchantId(value === emptyValue ? "" : value);
    setSelectedStoreId("");
    props.onScopeChange?.();
  };

  const changeStore = (value: string) => {
    setSelectedStoreId(value === emptyValue ? "" : value);
    props.onScopeChange?.();
  };

  const merchantFilter = canChooseMerchant ? (
    <Select value={selectedMerchantId || emptyValue} onValueChange={changeMerchant}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="subpage-select-content">
        <SelectItem className="subpage-select-item" value={emptyValue}>
          {props.emptyMerchantLabel ?? "全部"}
        </SelectItem>
        {merchantOptions.map((item) => (
          <SelectItem key={item.id} className="subpage-select-item" value={item.id}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : props.hideWhenLocked ? null : (
    <Input value={fixedMerchantId || "-"} className={`${triggerClassName} font-mono`} disabled />
  );

  const storeFilter = canChooseStore ? (
    <Select
      value={selectedStoreId || emptyValue}
      onValueChange={changeStore}
      disabled={props.disableStoreWhenNoMerchant && !activeMerchantId}
    >
      <SelectTrigger className={triggerClassName}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="subpage-select-content">
        <SelectItem className="subpage-select-item" value={emptyValue}>
          {props.emptyStoreLabel ?? "全部"}
        </SelectItem>
        {storeOptions.map((item) => (
          <SelectItem key={item.id} className="subpage-select-item" value={item.id}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : props.hideWhenLocked ? null : (
    <Input value={fixedStoreId || "-"} className={`${triggerClassName} font-mono`} disabled />
  );

  return (
    <>
      {merchantFilter ? <div className="flex items-center gap-2">{merchantFilter}</div> : null}
      {storeFilter ? <div className="flex items-center gap-2">{storeFilter}</div> : null}
    </>
  );
}
