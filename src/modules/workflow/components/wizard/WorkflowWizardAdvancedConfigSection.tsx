import { useEffect, useState } from "react";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import type { WorkflowTag } from "@/shared/api/workflow/workflow-tag";
import type { Merchant } from "@/shared/api/ums/ums-merchant";
import type { Store } from "@/shared/api/ums/ums-store";
import type { ComfyUIServer } from "@/shared/api/comfyui/comfyui-server";
import { listAppClients, type DictOption } from "@/shared/api/ums/iam";

import { APP_CLIENT_OPTIONS } from "@/shared/lib/dicts";

export default function WorkflowWizardAdvancedConfigSection(props: {
  sortNo: string;
  onSortNoChange: (next: string) => void;
  price: string;
  onPriceChange: (next: string) => void;

  appClients: string[];
  onAppClientsChange: (next: string[]) => void;

  tagIds: string[];
  onTagIdsChange: (next: string[]) => void;
  tags: WorkflowTag[];

  merchants: Merchant[];
  merchantIds: string[];
  onMerchantIdsChange: (next: string[]) => void;

  stores: Store[];
  storeIds: string[];
  onStoreIdsChange: (next: string[]) => void;

  servers: ComfyUIServer[];
  includeServerIds: string[];
  onIncludeServerIdsChange: (next: string[]) => void;
  excludeServerIds: string[];
  onExcludeServerIdsChange: (next: string[]) => void;
  /** RunningHub 时强制至少指定一台服务器 */
  requireIncludeServer?: boolean;
  hideServerSelect?: boolean;
  serverSelectHint?: string | null;

  mcpDescription: string;
  onMcpDescriptionChange: (next: string) => void;
  description: string;
  onDescriptionChange: (next: string) => void;
  detail: string;
  onDetailChange: (next: string) => void;
}) {
  const [appClients, setAppClients] = useState<DictOption[]>([]);
  useEffect(() => {
    listAppClients().then(setAppClients).catch(console.error);
  }, []);
  const tagOptions = props.tags.map((t) => ({ value: t.id, label: t.name || t.id }));
  const merchantOptions = props.merchants.map((m) => ({ value: m.id, label: m.name || m.code || m.id }));
  const storeOptions = props.stores.map((s) => ({ value: s.id, label: s.name || s.code || s.id }));
  const serverOptions = props.servers.map((s) => ({ value: s.id, label: s.name || s.baseUrl || s.id }));

  const updateMulti = (value: string, nextChecked: boolean, current: string[], onChange: (next: string[]) => void) => {
    const set = new Set(current);
    if (nextChecked) set.add(value);
    else set.delete(value);
    onChange(Array.from(set));
  };

  const renderMultiSelect = (args: {
    placeholder: string;
    options: Array<{ value: string; label: string }>;
    value: string[];
    onChange: (next: string[]) => void;
  }) => {
    const selectedSet = new Set(args.value);
    const selectedLabels = args.options.filter((o) => selectedSet.has(o.value)).map((o) => o.label);
    const summary = selectedLabels.length ? selectedLabels.join("、") : args.placeholder;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="justify-between w-full">
            <span className="truncate">{summary}</span>
            <span className="text-muted-foreground">▾</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[360px] max-h-72 overflow-auto">
          {args.options.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">暂无数据</div>}
          {args.options.map((o) => (
            <DropdownMenuCheckboxItem
              key={o.value}
              checked={selectedSet.has(o.value)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(checked) => updateMulti(o.value, checked === true, args.value, args.onChange)}
            >
              <span className="truncate">{o.label}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="workflow-form-label">单位结算金额（单位：分）</label>
          <Input
            value={props.price}
            onChange={(e) => props.onPriceChange(e.target.value)}
            placeholder="例如：500"
            className="workflow-form-input"
          />
          <p className="text-xs text-muted-foreground">单位结算金额为每个生成单位输出的结算金额，如输出4张图片，则最终金额为4*单位结算金额</p>
        </div>
        <div className="space-y-2">
          <label className="workflow-form-label">排序</label>
          <Input
            value={props.sortNo}
            onChange={(e) => props.onSortNoChange(e.target.value)}
            placeholder="例如：100"
            className="workflow-form-input"
          />
        </div>
      </div>


      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="workflow-form-label">
            <span className="text-destructive">*</span>所属应用端
          </label>
          {renderMultiSelect({ placeholder: "选择应用端", options: appClients.length ? appClients : APP_CLIENT_OPTIONS, value: props.appClients, onChange: props.onAppClientsChange })}
        </div>
        <div className="space-y-2">
          <label className="workflow-form-label">应用标签</label>
          {renderMultiSelect({ placeholder: "选择标签", options: tagOptions, value: props.tagIds, onChange: props.onTagIdsChange })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="workflow-form-label">专属组织</label>
          {renderMultiSelect({ placeholder: "选择组织", options: merchantOptions, value: props.merchantIds, onChange: props.onMerchantIdsChange })}
        </div>
        <div className="space-y-2">
          <label className="workflow-form-label">专属门店</label>
          {renderMultiSelect({ placeholder: "选择门店", options: storeOptions, value: props.storeIds, onChange: props.onStoreIdsChange })}
        </div>
      </div>

      {props.hideServerSelect ? (
        <p className="text-sm text-muted-foreground">{props.serverSelectHint || "无需选择算力服务器"}</p>
      ) : (
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="workflow-form-label">
            {props.requireIncludeServer ? <span className="text-destructive">*</span> : null}
            指定服务器
          </label>
          {renderMultiSelect({
            placeholder: props.serverSelectHint || "选择服务器",
            options: serverOptions,
            value: props.includeServerIds,
            onChange: (next) => {
              props.onIncludeServerIdsChange(next);
              props.onExcludeServerIdsChange(props.excludeServerIds.filter((x) => !next.includes(x)));
            },
          })}
          {props.serverSelectHint ? <p className="text-xs text-muted-foreground">{props.serverSelectHint}</p> : null}
        </div>
        <div className="space-y-2">
          <label className="workflow-form-label">排除服务器</label>
          {renderMultiSelect({
            placeholder: "选择服务器",
            options: serverOptions,
            value: props.excludeServerIds,
            onChange: (next) => props.onExcludeServerIdsChange(next.filter((x) => !props.includeServerIds.includes(x))),
          })}
        </div>
      </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="workflow-form-label">MCP描述</label>
          <Textarea
            value={props.mcpDescription}
            onChange={(e) => props.onMcpDescriptionChange(e.target.value)}
            placeholder="请输入 MCP 描述"
            rows={3}
            className="workflow-form-textarea"
          />
        </div>
        <div className="space-y-2">
          <label className="workflow-form-label">应用描述</label>
          <Textarea
            value={props.description}
            onChange={(e) => props.onDescriptionChange(e.target.value)}
            placeholder="请输入应用描述"
            rows={3}
            className="workflow-form-textarea"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="workflow-form-label">应用详情</label>
        <Textarea
          value={props.detail}
          onChange={(e) => props.onDetailChange(e.target.value)}
          placeholder="请输入应用详情"
          rows={4}
          className="workflow-form-textarea"
        />
      </div>
    </div>
  );
}
