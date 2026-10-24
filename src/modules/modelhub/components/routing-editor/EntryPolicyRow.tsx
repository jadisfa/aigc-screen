import { Badge } from "@/shared/ui/badge";
import { FieldGroup } from "@/modules/modelhub/components/EditorFormSection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  CHANNEL_POLICY_OPTIONS,
  ENTRY_HINT,
  ENTRY_LABEL,
  ROUTING_MODE_OPTIONS,
  type ChannelPolicy,
  type EntryRoutingMode,
  type FixedChannelOption,
  type FixedChannelId,
  type PoolOption,
  type PoolId,
  type RouteEntryCode,
  type RouteEntryPolicyValue,
} from "@/modules/modelhub/types/routingManagementTypes";
import { ROUTE_ENTRY_REQUIRED_CAPABILITY_LABEL } from "@/shared/lib/route-entry-dicts";

type EntryPolicyRowProps = {
  entry: RouteEntryCode;
  poolOptions: PoolOption[];
  fixedChannelOptions: FixedChannelOption[];
  value: RouteEntryPolicyValue;
  persisted?: boolean;
  onChange: (nextValue: RouteEntryPolicyValue) => void;
};

export function EntryPolicyRow(props: EntryPolicyRowProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-background px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">{ENTRY_LABEL[props.entry]}</div>
          <div className="mt-1 text-xs text-muted-foreground">{ENTRY_HINT[props.entry]}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {props.persisted === false ? (
            <Badge variant="outline">未写入策略</Badge>
          ) : null}
          <Badge variant="secondary">需{ROUTE_ENTRY_REQUIRED_CAPABILITY_LABEL[props.entry]}</Badge>
          <Badge variant="outline">入口映射</Badge>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <FieldGroup label="目标模型池" required>
          <Select
            value={props.value.targetPoolId}
            onValueChange={(value) =>
              props.onChange({
                ...props.value,
                targetPoolId: value as PoolId,
              })
            }
          >
            <SelectTrigger className="subpage-native-select h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              {props.poolOptions.map((option) => (
                <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="渠道选择">
          <Select
            value={props.value.channelPolicy}
            onValueChange={(value) =>
              props.onChange({
                ...props.value,
                channelPolicy: value as ChannelPolicy,
                fixedChannelId: value === "fixed" ? props.value.fixedChannelId : "inherit",
              })
            }
          >
            <SelectTrigger className="subpage-native-select h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              {CHANNEL_POLICY_OPTIONS.map((option) => (
                <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="固定渠道">
          <Select
            value={props.value.fixedChannelId}
            onValueChange={(value) =>
              props.onChange({
                ...props.value,
                fixedChannelId: value as FixedChannelId,
              })
            }
            disabled={props.value.channelPolicy !== "fixed"}
          >
            <SelectTrigger className="subpage-native-select h-10 w-full">
              <SelectValue placeholder="选择正式渠道" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              {props.fixedChannelOptions.map((option) => (
                <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                  {option.code ? `${option.label} (${option.code})` : option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="策略覆盖">
          <Select
            value={props.value.routingMode || "inherit"}
            onValueChange={(value) =>
              props.onChange({
                ...props.value,
                routingMode: (value === "inherit" ? "" : value) as EntryRoutingMode,
              })
            }
          >
            <SelectTrigger className="subpage-native-select h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value="inherit">
                继承模型池
              </SelectItem>
              {ROUTING_MODE_OPTIONS.map((option) => (
                <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldGroup>
      </div>
    </div>
  );
}
