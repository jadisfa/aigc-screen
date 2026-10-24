import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import EntitySearchPickerDialog from "@/shared/components/EntitySearchPickerDialog";
import {
  createNotificationBroadcast,
  listBroadcastEmailTemplates,
  listBroadcastSmsTemplates,
  previewNotificationBroadcast,
  type BroadcastAudienceType,
  type BroadcastMessageTemplate,
  type CreateBroadcastCommand,
} from "@/shared/api/ops/ops-notification-broadcast";
import { listMerchants, type Merchant } from "@/shared/api/ums/ums-merchant";
import { listStores, type Store } from "@/shared/api/ums/ums-store";
import { searchUsers, type UserSearchItem } from "@/shared/api/ums/iam";
import { parseMessageTemplateVariables } from "@/shared/api/integration/message-template";
import { notify } from "@/shared/lib/notify";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";

type SelectedEntity = { id: string; label: string };

export default function NotificationBroadcastComposerDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const sessionScope = useSessionScope();
  const scopeLevel = (sessionScope.scope.scopeLevel || "global").toLowerCase();
  const scopeMerchantId = sessionScope.scope.merchantId || undefined;
  const scopeStoreId = sessionScope.scope.storeId || undefined;

  const [enableInbox, setEnableInbox] = useState(true);
  const [enableSms, setEnableSms] = useState(false);
  const [enableEmail, setEnableEmail] = useState(false);
  const [audienceType, setAudienceType] = useState<BroadcastAudienceType>("ALL");
  const [merchants, setMerchants] = useState<SelectedEntity[]>([]);
  const [stores, setStores] = useState<SelectedEntity[]>([]);
  const [users, setUsers] = useState<SelectedEntity[]>([]);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [smsRegion, setSmsRegion] = useState("domestic");
  const [smsTemplateId, setSmsTemplateId] = useState("");
  const [smsVariables, setSmsVariables] = useState<Record<string, string>>({});
  const [emailRegion, setEmailRegion] = useState("domestic");
  const [emailTemplateId, setEmailTemplateId] = useState("");
  const [emailVariables, setEmailVariables] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);

  const [merchantPickerOpen, setMerchantPickerOpen] = useState(false);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [userPickerOpen, setUserPickerOpen] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setEnableInbox(true);
    setEnableSms(false);
    setEnableEmail(false);
    setAudienceType("ALL");
    setMerchants(scopeLevel === "merchant" && scopeMerchantId ? [{ id: scopeMerchantId, label: "当前商户" }] : []);
    setStores(scopeLevel === "store" && scopeStoreId ? [{ id: scopeStoreId, label: "当前门店" }] : []);
    setUsers([]);
    setSubject("");
    setContent("");
    setSmsRegion("domestic");
    setSmsTemplateId("");
    setSmsVariables({});
    setEmailRegion("domestic");
    setEmailTemplateId("");
    setEmailVariables({});
    setFormError(null);
    setPreviewText(null);
  }, [props.open, scopeLevel, scopeMerchantId, scopeStoreId]);

  const audienceOptions = useMemo(() => {
    if (scopeLevel === "store") {
      return [
        { value: "ALL" as const, label: "本门店全体用户" },
        { value: "USERS" as const, label: "指定用户" },
      ];
    }
    if (scopeLevel === "merchant") {
      return [
        { value: "ALL" as const, label: "本商户全体用户" },
        { value: "STORE" as const, label: "指定门店" },
        { value: "USERS" as const, label: "指定用户" },
      ];
    }
    return [
      { value: "ALL" as const, label: "全体用户" },
      { value: "MERCHANT" as const, label: "指定商户" },
      { value: "STORE" as const, label: "指定门店" },
      { value: "USERS" as const, label: "指定用户" },
    ];
  }, [scopeLevel]);

  const smsTemplatesQuery = useQuery({
    queryKey: ["ops", "broadcast", "sms-templates", smsRegion],
    queryFn: () =>
      listBroadcastSmsTemplates({
        pageNo: 1,
        pageSize: 100,
        region: smsRegion,
      }),
    enabled: props.open && enableSms,
  });

  const emailTemplatesQuery = useQuery({
    queryKey: ["ops", "broadcast", "email-templates", emailRegion],
    queryFn: () =>
      listBroadcastEmailTemplates({
        pageNo: 1,
        pageSize: 100,
        region: emailRegion,
      }),
    enabled: props.open && enableEmail,
  });

  const smsTemplates = smsTemplatesQuery.data?.items ?? [];
  const selectedSmsTemplate: BroadcastMessageTemplate | undefined = smsTemplates.find((item) => item.id === smsTemplateId);
  const smsVariableKeys = parseMessageTemplateVariables(selectedSmsTemplate);

  const emailTemplates = emailTemplatesQuery.data?.items ?? [];
  const selectedEmailTemplate: BroadcastMessageTemplate | undefined = emailTemplates.find((item) => item.id === emailTemplateId);
  const emailVariableKeys = parseMessageTemplateVariables(selectedEmailTemplate);

  useEffect(() => {
    if (!selectedSmsTemplate) {
      setSmsVariables({});
      return;
    }
    const keys = parseMessageTemplateVariables(selectedSmsTemplate);
    setSmsVariables((prev) => {
      const next: Record<string, string> = {};
      for (const key of keys) {
        next[key] = prev[key] ?? "";
      }
      return next;
    });
  }, [selectedSmsTemplate?.id]);

  useEffect(() => {
    if (!selectedEmailTemplate) {
      setEmailVariables({});
      return;
    }
    const keys = parseMessageTemplateVariables(selectedEmailTemplate);
    setEmailVariables((prev) => {
      const next: Record<string, string> = {};
      for (const key of keys) {
        next[key] = prev[key] ?? "";
      }
      return next;
    });
  }, [selectedEmailTemplate?.id]);

  const buildCommand = (): CreateBroadcastCommand | null => {
    const channels: string[] = [];
    if (enableInbox) channels.push("inbox");
    if (enableSms) channels.push("sms");
    if (enableEmail) channels.push("email");
    if (!channels.length) {
      setFormError("请至少选择一个通道");
      return null;
    }
    if (enableInbox) {
      if (!subject.trim()) {
        setFormError("请填写站内信主题");
        return null;
      }
      if (!content.trim()) {
        setFormError("请填写站内信内容");
        return null;
      }
    }
    if (enableSms) {
      if (!selectedSmsTemplate?.templateCode) {
        setFormError("请选择短信模板");
        return null;
      }
      for (const key of smsVariableKeys) {
        if (!String(smsVariables[key] ?? "").trim()) {
          setFormError(`请填写短信变量：${key}`);
          return null;
        }
      }
    }
    if (enableEmail) {
      if (!selectedEmailTemplate?.templateCode) {
        setFormError("请选择邮件模板");
        return null;
      }
      for (const key of emailVariableKeys) {
        if (!String(emailVariables[key] ?? "").trim()) {
          setFormError(`请填写邮件变量：${key}`);
          return null;
        }
      }
    }
    if (audienceType === "MERCHANT" && merchants.length === 0) {
      setFormError("请选择商户");
      return null;
    }
    if (audienceType === "STORE" && stores.length === 0) {
      setFormError("请选择门店");
      return null;
    }
    if (audienceType === "USERS" && users.length === 0) {
      setFormError("请选择用户");
      return null;
    }

    setFormError(null);
    return {
      audienceType,
      merchantIds: audienceType === "MERCHANT" ? merchants.map((item) => item.id) : undefined,
      storeIds: audienceType === "STORE" ? stores.map((item) => item.id) : undefined,
      principalIds: audienceType === "USERS" ? users.map((item) => item.id) : undefined,
      channels,
      subject: enableInbox ? subject.trim() : undefined,
      content: enableInbox ? content.trim() : undefined,
      smsTemplateCode: enableSms ? selectedSmsTemplate?.templateCode : undefined,
      smsRegion: enableSms ? smsRegion : undefined,
      smsVariables: enableSms ? smsVariables : undefined,
      emailTemplateCode: enableEmail ? selectedEmailTemplate?.templateCode : undefined,
      emailRegion: enableEmail ? emailRegion : undefined,
      emailVariables: enableEmail ? emailVariables : undefined,
    };
  };

  const previewMutation = useMutation({
    mutationFn: async () => {
      const cmd = buildCommand();
      if (!cmd) throw new Error("validation");
      return previewNotificationBroadcast(cmd);
    },
    onSuccess: (result) => {
      const parts = [`预估受众 ${result.estimatedCount} 人`];
      if (enableSms) parts.push(`缺手机号 ${result.missingPhoneCount} 人`);
      if (enableEmail) parts.push(`缺邮箱 ${result.missingEmailCount} 人`);
      setPreviewText(parts.join("，"));
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "validation") return;
      notify.fromError(error, "请稍后重试", "预览失败");
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const cmd = buildCommand();
      if (!cmd) throw new Error("validation");
      return createNotificationBroadcast(cmd);
    },
    onSuccess: () => {
      notify.success("群发任务已创建");
      props.onOpenChange(false);
      props.onCreated?.();
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "validation") return;
      notify.fromError(error, "请稍后重试", "创建群发失败");
    },
  });

  const removeChip = (list: SelectedEntity[], id: string, setter: (next: SelectedEntity[]) => void) => {
    setter(list.filter((item) => item.id !== id));
  };

  const addUnique = (list: SelectedEntity[], item: SelectedEntity, setter: (next: SelectedEntity[]) => void) => {
    if (list.some((x) => x.id === item.id)) return;
    setter([...list, item]);
  };

  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>群发消息</DialogTitle>
            <DialogDescription>按作用域选择受众，支持站内信、短信与邮件批量发送。</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            <div className="space-y-2">
              <label className="workflow-form-label">通道</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={enableInbox} onCheckedChange={(v) => setEnableInbox(v === true)} />
                  站内信
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={enableSms} onCheckedChange={(v) => setEnableSms(v === true)} />
                  短信
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={enableEmail} onCheckedChange={(v) => setEnableEmail(v === true)} />
                  邮件
                </label>
              </div>
              <p className="text-xs text-muted-foreground">可同时勾选多通道；短信/邮件需选择已配置的模板。</p>
            </div>

            <div className="space-y-2">
              <label className="workflow-form-label">受众</label>
              <Select
                value={audienceType}
                onValueChange={(value) => setAudienceType(value as BroadcastAudienceType)}
              >
                <SelectTrigger className="subpage-native-select h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {audienceOptions.map((opt) => (
                    <SelectItem key={opt.value} className="subpage-select-item" value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {audienceType === "MERCHANT" ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {merchants.map((item) => (
                      <Badge key={item.id} variant="outline" className="gap-1">
                        {item.label}
                        <button type="button" onClick={() => removeChip(merchants, item.id, setMerchants)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setMerchantPickerOpen(true)}>
                    添加商户
                  </Button>
                </div>
              ) : null}

              {audienceType === "STORE" ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {stores.map((item) => (
                      <Badge key={item.id} variant="outline" className="gap-1">
                        {item.label}
                        <button type="button" onClick={() => removeChip(stores, item.id, setStores)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setStorePickerOpen(true)}>
                    添加门店
                  </Button>
                </div>
              ) : null}

              {audienceType === "USERS" ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {users.map((item) => (
                      <Badge key={item.id} variant="outline" className="gap-1">
                        {item.label}
                        <button type="button" onClick={() => removeChip(users, item.id, setUsers)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setUserPickerOpen(true)}>
                    添加用户
                  </Button>
                </div>
              ) : null}
            </div>

            {enableInbox ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="workflow-form-label">站内信主题</label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="输入主题" />
                </div>
                <div className="space-y-2">
                  <label className="workflow-form-label">站内信内容</label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="输入消息内容"
                    className="min-h-[120px]"
                  />
                </div>
              </div>
            ) : null}

            {enableSms ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="workflow-form-label">短信地区</label>
                    <Select
                      value={smsRegion}
                      onValueChange={(value) => {
                        setSmsRegion(value);
                        setSmsTemplateId("");
                      }}
                    >
                      <SelectTrigger className="subpage-native-select h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="subpage-select-content">
                        <SelectItem className="subpage-select-item" value="domestic">
                          国内
                        </SelectItem>
                        <SelectItem className="subpage-select-item" value="international">
                          国际
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="workflow-form-label">短信模板</label>
                    <Select
                      value={smsTemplateId || undefined}
                      onValueChange={setSmsTemplateId}
                      disabled={smsTemplatesQuery.isFetching || smsTemplates.length === 0}
                    >
                      <SelectTrigger className="subpage-native-select h-9 w-full">
                        <SelectValue
                          placeholder={
                            smsTemplatesQuery.isFetching
                              ? "加载模板中..."
                              : smsTemplatesQuery.isError
                                ? "模板加载失败"
                                : smsTemplates.length === 0
                                  ? "暂无可用短信模板"
                                  : "选择模板"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="subpage-select-content">
                        {smsTemplates.map((item) => (
                          <SelectItem key={item.id} className="subpage-select-item" value={item.id}>
                            {item.templateName} ({item.templateCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {smsTemplatesQuery.isError ? (
                      <div className="text-xs text-destructive">短信模板加载失败，请确认权限或稍后重试</div>
                    ) : null}
                    {!smsTemplatesQuery.isFetching && !smsTemplatesQuery.isError && smsTemplates.length === 0 ? (
                      <div className="text-xs text-muted-foreground">当前地区暂无短信模板，请先在接入管理配置</div>
                    ) : null}
                  </div>
                </div>
                {smsVariableKeys.length ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {smsVariableKeys.map((key) => (
                      <div key={key} className="space-y-2">
                        <label className="workflow-form-label">{key}</label>
                        <Input
                          value={smsVariables[key] ?? ""}
                          onChange={(e) => setSmsVariables((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={`填写 ${key}`}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {enableEmail ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="workflow-form-label">邮件地区</label>
                    <Select
                      value={emailRegion}
                      onValueChange={(value) => {
                        setEmailRegion(value);
                        setEmailTemplateId("");
                      }}
                    >
                      <SelectTrigger className="subpage-native-select h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="subpage-select-content">
                        <SelectItem className="subpage-select-item" value="domestic">
                          国内
                        </SelectItem>
                        <SelectItem className="subpage-select-item" value="international">
                          国际
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="workflow-form-label">邮件模板</label>
                    <Select
                      value={emailTemplateId || undefined}
                      onValueChange={setEmailTemplateId}
                      disabled={emailTemplatesQuery.isFetching || emailTemplates.length === 0}
                    >
                      <SelectTrigger className="subpage-native-select h-9 w-full">
                        <SelectValue
                          placeholder={
                            emailTemplatesQuery.isFetching
                              ? "加载模板中..."
                              : emailTemplatesQuery.isError
                                ? "模板加载失败"
                                : emailTemplates.length === 0
                                  ? "暂无可用邮件模板"
                                  : "选择模板"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="subpage-select-content">
                        {emailTemplates.map((item) => (
                          <SelectItem key={item.id} className="subpage-select-item" value={item.id}>
                            {item.templateName} ({item.templateCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {emailTemplatesQuery.isError ? (
                      <div className="text-xs text-destructive">邮件模板加载失败，请确认权限或稍后重试</div>
                    ) : null}
                    {!emailTemplatesQuery.isFetching && !emailTemplatesQuery.isError && emailTemplates.length === 0 ? (
                      <div className="text-xs text-muted-foreground">当前地区暂无邮件模板，请先在接入管理配置</div>
                    ) : null}
                  </div>
                </div>
                {emailVariableKeys.length ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {emailVariableKeys.map((key) => (
                      <div key={key} className="space-y-2">
                        <label className="workflow-form-label">{key}</label>
                        <Input
                          value={emailVariables[key] ?? ""}
                          onChange={(e) => setEmailVariables((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={`填写 ${key}`}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {formError ? <div className="text-sm text-destructive">{formError}</div> : null}
            {previewText ? <div className="text-sm text-muted-foreground">{previewText}</div> : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => void previewMutation.mutateAsync()}
              disabled={previewMutation.isPending || createMutation.isPending}
            >
              {previewMutation.isPending ? "预览中..." : "预览人数"}
            </Button>
            <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={createMutation.isPending}>
              取消
            </Button>
            <Button onClick={() => void createMutation.mutateAsync()} disabled={createMutation.isPending || previewMutation.isPending}>
              {createMutation.isPending ? "提交中..." : "确认发送"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EntitySearchPickerDialog<Merchant>
        open={merchantPickerOpen}
        onOpenChange={setMerchantPickerOpen}
        title="选择商户"
        queryKeyPrefix={["ops", "broadcast", "pick-merchant"]}
        fetchPage={(params) => listMerchants(params)}
        getId={(item) => item.id}
        getTitle={(item) => item.name}
        getDescription={(item) => item.code}
        onPick={(item) => {
          addUnique(merchants, { id: item.id, label: item.name }, setMerchants);
          setMerchantPickerOpen(false);
        }}
      />

      <EntitySearchPickerDialog<Store>
        open={storePickerOpen}
        onOpenChange={setStorePickerOpen}
        title="选择门店"
        queryKeyPrefix={["ops", "broadcast", "pick-store", scopeMerchantId ?? ""]}
        fetchPage={(params) =>
          listStores({
            ...params,
            merchantId: scopeLevel === "merchant" || scopeLevel === "store" ? scopeMerchantId : undefined,
          })
        }
        getId={(item) => item.id}
        getTitle={(item) => item.name}
        getDescription={(item) => item.code}
        onPick={(item) => {
          addUnique(stores, { id: item.id, label: item.name }, setStores);
          setStorePickerOpen(false);
        }}
      />

      <EntitySearchPickerDialog<UserSearchItem>
        open={userPickerOpen}
        onOpenChange={setUserPickerOpen}
        title="选择用户"
        queryKeyPrefix={["ops", "broadcast", "pick-user", scopeMerchantId ?? "", scopeStoreId ?? ""]}
        fetchPage={(params) =>
          searchUsers({
            ...params,
            merchantId: scopeLevel === "global" ? undefined : scopeMerchantId,
            storeId: scopeLevel === "store" ? scopeStoreId : undefined,
          })
        }
        getId={(item) => item.principalId}
        getTitle={(item) => item.nickname || item.username || item.principalId}
        getDescription={(item) => item.phone || item.email || item.principalId}
        onPick={(item) => {
          addUnique(
            users,
            { id: item.principalId, label: item.nickname || item.username || item.principalId },
            setUsers,
          );
          setUserPickerOpen(false);
        }}
      />
    </>
  );
}
