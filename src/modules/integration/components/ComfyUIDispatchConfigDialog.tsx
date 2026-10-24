import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  getDispatchStrategyConfigOptions,
  getDispatchStrategyGlobalConfig,
  updateDispatchStrategyGlobalConfig,
} from "@/shared/api/sys/dispatch-strategy-config";
import { notify } from "@/shared/lib/notify";

function parseJsonObjectOrEmpty(json: string | null | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const value = JSON.parse(json) as unknown;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function getStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export default function ComfyUIDispatchConfigDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const [appliedToken, setAppliedToken] = useState<string | null>(null);
  const [configBase, setConfigBase] = useState<Record<string, unknown>>({});
  const [serverPickStrategy, setServerPickStrategy] = useState("least_queue");
  const [claimOrderStrategy, setClaimOrderStrategy] = useState("first_in_first_out");
  const [thresholdMaxQueueSize, setThresholdMaxQueueSize] = useState("50");
  const [thresholdAvoidOffline, setThresholdAvoidOffline] = useState(true);
  const [thresholdAvoidHighLoad, setThresholdAvoidHighLoad] = useState(true);

  const dispatchConfigOptionsQuery = useQuery({
    queryKey: ["intDispatchStrategyConfigOptions", props.open],
    queryFn: () => getDispatchStrategyConfigOptions(),
    enabled: props.open,
  });

  const dispatchConfigQuery = useQuery({
    queryKey: ["intDispatchStrategyConfigGlobal", props.open],
    queryFn: () => getDispatchStrategyGlobalConfig(),
    enabled: props.open,
  });

  useEffect(() => {
    if (!props.open || !dispatchConfigQuery.data) return;
    const nextAppliedToken = `${dispatchConfigQuery.dataUpdatedAt}`;
    if (appliedToken === nextAppliedToken) return;

    const base = parseJsonObjectOrEmpty(dispatchConfigQuery.data.configJson);
    setConfigBase(base);

    const serverPickRaw = getStringOrNull(base.serverPickStrategy) ?? getStringOrNull(base.strategy) ?? "least_queue";
    setServerPickStrategy(serverPickRaw.trim().toLowerCase());

    const claimRaw = getStringOrNull(base.claimOrderStrategy) ?? getStringOrNull(base.claimStrategy) ?? "first_in_first_out";
    const claim = claimRaw.trim().toLowerCase();
    const mappedClaim =
      claim === "fifo"
        ? "first_in_first_out"
        : claim === "sjf"
          ? "shortest_job_first"
          : claim === "ljf"
            ? "longest_job_first"
            : claim;
    setClaimOrderStrategy(mappedClaim);

    const thresholds =
      base.thresholds && typeof base.thresholds === "object" && !Array.isArray(base.thresholds)
        ? (base.thresholds as Record<string, unknown>)
        : {};
    const maxQueueSizeRaw =
      typeof thresholds.maxQueueSize === "number"
        ? String(thresholds.maxQueueSize)
        : typeof thresholds.maxQueueSize === "string"
          ? thresholds.maxQueueSize
          : "50";
    setThresholdMaxQueueSize(maxQueueSizeRaw);
    setThresholdAvoidOffline(typeof thresholds.avoidOffline === "boolean" ? thresholds.avoidOffline : true);
    setThresholdAvoidHighLoad(typeof thresholds.avoidHighLoad === "boolean" ? thresholds.avoidHighLoad : true);

    setAppliedToken(nextAppliedToken);
  }, [appliedToken, dispatchConfigQuery.data, dispatchConfigQuery.dataUpdatedAt, props.open]);

  const updateDispatchConfigMutation = useMutation({
    mutationFn: (configJson: string) => updateDispatchStrategyGlobalConfig(configJson),
    onSuccess: async () => {
      notify.success("保存成功");
      props.onOpenChange(false);
      setAppliedToken(null);
      await queryClient.invalidateQueries({ queryKey: ["intDispatchStrategyConfigGlobal"] });
    },
    onError: (error) => {
      notify.error("保存失败", { description: error instanceof Error ? error.message : "请求失败" });
    },
  });

  const handleOpenChange = (open: boolean) => {
    props.onOpenChange(open);
    if (!open) {
      setAppliedToken(null);
    }
  };

  const handleSave = async () => {
    const maxQueueSize = Math.max(1, Number(thresholdMaxQueueSize) || 50);
    const next: Record<string, unknown> = {
      ...configBase,
      serverPickStrategy,
      claimOrderStrategy,
      thresholds: {
        ...(configBase.thresholds && typeof configBase.thresholds === "object" && !Array.isArray(configBase.thresholds)
          ? (configBase.thresholds as Record<string, unknown>)
          : {}),
        maxQueueSize,
        avoidOffline: thresholdAvoidOffline,
        avoidHighLoad: thresholdAvoidHighLoad,
      },
    };

    await updateDispatchConfigMutation.mutateAsync(JSON.stringify(next));
  };

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>调度策略配置</DialogTitle>
        </DialogHeader>

        {dispatchConfigQuery.isFetching && <div className="text-sm text-muted-foreground">加载中...</div>}
        {dispatchConfigQuery.isError && <div className="text-sm text-destructive">加载失败，请稍后重试</div>}
        {dispatchConfigOptionsQuery.isError && <div className="text-sm text-destructive">策略字典加载失败，请稍后重试</div>}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="workflow-form-label">选服策略</label>
            <Select value={serverPickStrategy} onValueChange={setServerPickStrategy}>
              <SelectTrigger className="workflow-form-input h-10">
                <SelectValue placeholder="选择策略" />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                {(dispatchConfigOptionsQuery.data?.serverPickStrategies ?? []).map((option) => (
                  <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="workflow-form-label">任务调度策略</label>
            <Select value={claimOrderStrategy} onValueChange={setClaimOrderStrategy}>
              <SelectTrigger className="workflow-form-input h-10">
                <SelectValue placeholder="选择策略" />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                {(dispatchConfigOptionsQuery.data?.claimOrderStrategies ?? []).map((option) => (
                  <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="workflow-form-label">阈值：最大队列长度</label>
            <Input
              type="number"
              value={thresholdMaxQueueSize}
              onChange={(event) => setThresholdMaxQueueSize(event.target.value)}
              placeholder="50"
              className="workflow-form-input"
            />
          </div>

          <div className="space-y-2">
            <label className="workflow-form-label">阈值开关</label>
            <div className="flex h-10 items-center gap-4">
              <label className="flex select-none items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={thresholdAvoidOffline} onCheckedChange={setThresholdAvoidOffline} />
                规避离线
              </label>
              <label className="flex select-none items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={thresholdAvoidHighLoad} onCheckedChange={setThresholdAvoidHighLoad} />
                规避高负载
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              updateDispatchConfigMutation.isPending ||
              dispatchConfigQuery.isFetching ||
              dispatchConfigQuery.isError ||
              dispatchConfigOptionsQuery.isFetching ||
              dispatchConfigOptionsQuery.isError
            }
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
