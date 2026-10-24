import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import TicketAttachmentEditor from "@/modules/ops/components/TicketAttachmentEditor";
import { UserSelect } from "@/shared/components/UserSelect";
import EntitySearchPickerDialog from "@/shared/components/EntitySearchPickerDialog";
import {
  createTicket,
  getTicket,
  listTicketDictionaries,
  updateTicket,
  type TicketAttachment,
  type TicketDictionaryResponse,
  type TicketMutationPayload,
} from "@/shared/api/ops/ops-ticket";
import { getUser, listUsers, type User } from "@/shared/api/ums/iam";
import { getMerchant, listMerchants, type Merchant } from "@/shared/api/ums/ums-merchant";
import { getStore, listStores, type Store } from "@/shared/api/ums/ums-store";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { formatDateTime } from "@/shared/lib/datetime";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { notify } from "@/shared/lib/notify";

type TicketFormState = {
  customerId: string;
  storeId: string;
  merchantId: string;
  ticketType: string;
  priority: string;
  title: string;
  description: string;
  attachments: TicketAttachment[];
  assigneeId: string;
};

const emptyForm: TicketFormState = {
  customerId: "",
  storeId: "",
  merchantId: "",
  ticketType: "",
  priority: "",
  title: "",
  description: "",
  attachments: [],
  assigneeId: "",
};

function buildLabelMap(options: { value: string; label: string }[]) {
  return new Map(options.map((item) => [item.value, item.label]));
}

function getUserDisplayName(user?: Partial<User> | null) {
  return user?.nickname || user?.displayName || user?.realName || user?.phone || user?.email || user?.principalId || user?.id || "";
}

function getReferenceInputValue(rawId: string, name: string, loading: boolean) {
  if (!rawId.trim()) return "";
  if (loading) return "加载中...";
  return name || rawId;
}

function resolveLookupTenantId(merchantId: string, storeId: string) {
  const normalizedStoreId = storeId.trim();
  if (normalizedStoreId) return normalizedStoreId;
  const normalizedMerchantId = merchantId.trim();
  if (normalizedMerchantId) return normalizedMerchantId;
  return "";
}

/** 与 ComfyUIServerEditorPage FormSection 保持一致 */
function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-2xl bg-background/85 px-5 py-5">
      <div className="min-w-0 space-y-1.5">
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground leading-relaxed">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function TicketEditorPage() {
  const navigate = useNavigate();
  const { ticketId } = useParams<{ ticketId: string }>();
  const isEdit = Boolean(ticketId);
  const sessionScope = useSessionScope();

  const [form, setForm] = useState<TicketFormState>(emptyForm);
  const [initialForm, setInitialForm] = useState<TicketFormState>(emptyForm);
  const [dictionaries, setDictionaries] = useState<TicketDictionaryResponse>({
    ticketTypes: [],
    ticketStatuses: [],
    priorities: [],
    ticketSources: [],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    source?: string | null;
    status?: string | null;
    replyCount?: number;
    createdAt?: string | null;
    updatedAt?: string | null;
    closedAt?: string | null;
  }>({});
  const [activeLookup, setActiveLookup] = useState<"customer" | "store" | "merchant" | null>(null);

  const sourceMap = useMemo(() => buildLabelMap(dictionaries.ticketSources), [dictionaries.ticketSources]);
  const debouncedCustomerId = useDebounce(form.customerId.trim(), 300);
  const debouncedStoreId = useDebounce(form.storeId.trim(), 300);
  const debouncedMerchantId = useDebounce(form.merchantId.trim(), 300);
  const lookupTenantId = useMemo(
    () => resolveLookupTenantId(form.merchantId, form.storeId),
    [form.merchantId, form.storeId],
  );

  const customerQuery = useQuery({
    queryKey: ["ticketEditor", sessionScope.scope.queryScopeKey, "customer", lookupTenantId || "current", debouncedCustomerId],
    queryFn: () => getUser({ id: debouncedCustomerId }),
    enabled: Boolean(debouncedCustomerId),
    retry: false,
  });

  const storeQuery = useQuery({
    queryKey: ["ticketEditor", sessionScope.scope.queryScopeKey, "store", debouncedStoreId],
    queryFn: () => getStore(debouncedStoreId),
    enabled: Boolean(debouncedStoreId),
    retry: false,
  });

  const merchantQuery = useQuery({
    queryKey: ["ticketEditor", sessionScope.scope.queryScopeKey, "merchant", debouncedMerchantId],
    queryFn: () => getMerchant(debouncedMerchantId),
    enabled: Boolean(debouncedMerchantId),
    retry: false,
  });

  const customerName = getUserDisplayName(customerQuery.data);
  const storeName = storeQuery.data?.name || "";
  const merchantName = merchantQuery.data?.name || "";

  const updateField = <K extends keyof TicketFormState>(key: K, value: TicketFormState[K]) => {
    setFormError(null);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialForm), [form, initialForm]);

  useEffect(() => {
    let active = true;

    const loadPage = async () => {
      setLoading(true);
      try {
        const dictionaryResponse = await listTicketDictionaries();
        if (!active) return;
        setDictionaries(dictionaryResponse);

        const defaultType = dictionaryResponse.ticketTypes[0]?.value ?? "";
        const defaultPriority = dictionaryResponse.priorities[0]?.value ?? "";

        if (!isEdit || !ticketId) {
          const next = {
            ...emptyForm,
            ticketType: defaultType,
            priority: defaultPriority,
          };
          setForm(next);
          setInitialForm(next);
          return;
        }

        const detail = await getTicket(ticketId);
        if (!active) return;

        const next = {
          customerId: detail.customerId || "",
          storeId: detail.storeId || "",
          merchantId: detail.merchantId || "",
          ticketType: detail.ticketType || defaultType,
          priority: detail.priority || defaultPriority,
          title: detail.title || "",
          description: detail.description || "",
          attachments: detail.attachments || [],
          assigneeId: detail.assigneeId || "",
        };
        setForm(next);
        setInitialForm(next);
        setMeta({
          source: detail.source,
          status: detail.ticketStatus,
          replyCount: detail.replyCount,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt,
          closedAt: detail.closedAt,
        });
      } catch (error) {
        notify.error(isEdit ? "加载工单失败" : "加载页面数据失败", { description: error instanceof Error ? error.message : "请求失败" });
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadPage();

    return () => {
      active = false;
    };
  }, [isEdit, ticketId]);

  const handleBack = () => {
    if (!isDirty || window.confirm("当前内容尚未保存，确认返回吗？")) {
      navigate("/ops/tickets");
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError("请输入工单标题");
      return;
    }
    if (!form.description.trim()) {
      setFormError("请输入工单描述");
      return;
    }
    if (!form.ticketType) {
      setFormError("请选择工单类型");
      return;
    }
    if (!form.priority) {
      setFormError("请选择优先级");
      return;
    }

    setFormError(null);

    const payload: TicketMutationPayload = {
      customerId: form.customerId.trim() || null,
      storeId: form.storeId.trim() || null,
      merchantId: form.merchantId.trim() || null,
      ticketType: form.ticketType,
      priority: form.priority,
      title: form.title.trim(),
      description: form.description.trim(),
      attachments: form.attachments,
      assigneeId: form.assigneeId || null,
    };

    setSaving(true);
    try {
      if (isEdit && ticketId) {
        await updateTicket(ticketId, payload);
      } else {
        await createTicket(payload);
      }
      navigate("/ops/tickets");
    } catch (error) {
      notify.error("保存工单失败", { description: error instanceof Error ? error.message : "请求失败" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-content-shell py-16 text-center text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="page-content-shell">
      <div className="subpage-toolbar mb-7">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-[18px] font-semibold text-foreground">{isEdit ? "编辑工单" : "新增工单"}</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1080px] space-y-5">
        {isEdit ? (
          <FormSection title="工单概览">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="space-y-2">
                <label className="workflow-form-label">工单状态</label>
                <div>
                  <Badge variant="outline">{meta.status || "-"}</Badge>
                </div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">创建来源</label>
                <div className="text-sm font-medium text-foreground">{meta.source ? sourceMap.get(meta.source) || meta.source : "-"}</div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">回复数</label>
                <div className="text-sm font-medium text-foreground">{meta.replyCount ?? 0}</div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">创建时间</label>
                <div className="text-sm text-foreground">{formatDateTime(meta.createdAt)}</div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">更新时间</label>
                <div className="text-sm text-foreground">{formatDateTime(meta.updatedAt)}</div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">关闭时间</label>
                <div className="text-sm text-foreground">{formatDateTime(meta.closedAt)}</div>
              </div>
            </div>
          </FormSection>
        ) : null}

        <FormSection title="基本信息" description="填写工单标题、类型与处理人等核心字段">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="workflow-form-label">
                <span className="text-destructive">*</span>工单标题
              </label>
              <Input
                className="workflow-form-input"
                placeholder="请输入工单标题"
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="workflow-form-label">处理人</label>
              <UserSelect
                value={form.assigneeId}
                onChange={(value) => updateField("assigneeId", value)}
                className="w-full"
                placeholder="选择处理人"
                tenantId={lookupTenantId}
              />
            </div>
            <div className="space-y-2">
              <label className="workflow-form-label">
                <span className="text-destructive">*</span>工单类型
              </label>
              <Select value={form.ticketType} onValueChange={(value) => updateField("ticketType", value)}>
                <SelectTrigger className="workflow-form-input h-10">
                  <SelectValue placeholder="请选择工单类型" />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {dictionaries.ticketTypes.map((option) => (
                    <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="workflow-form-label">
                <span className="text-destructive">*</span>优先级
              </label>
              <Select value={form.priority} onValueChange={(value) => updateField("priority", value)}>
                <SelectTrigger className="workflow-form-input h-10">
                  <SelectValue placeholder="请选择优先级" />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {dictionaries.priorities.map((option) => (
                    <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="space-y-2">
              <label className="workflow-form-label">客户</label>
              <div className="flex items-center gap-2">
                <Input
                  className="workflow-form-input"
                  placeholder="可选，输入或选择客户"
                  value={getReferenceInputValue(form.customerId, customerName, customerQuery.isFetching)}
                  onChange={(event) => updateField("customerId", event.target.value)}
                />
                <Button type="button" variant="outline" className="h-10 shrink-0 px-4" onClick={() => setActiveLookup("customer")}>
                  选择
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">客户 ID: {form.customerId.trim() || "未选择"}</p>
            </div>
            <div className="space-y-2">
              <label className="workflow-form-label">门店</label>
              <div className="flex items-center gap-2">
                <Input
                  className="workflow-form-input"
                  placeholder="可选，输入或选择门店"
                  value={getReferenceInputValue(form.storeId, storeName, storeQuery.isFetching)}
                  onChange={(event) => updateField("storeId", event.target.value)}
                />
                <Button type="button" variant="outline" className="h-10 shrink-0 px-4" onClick={() => setActiveLookup("store")}>
                  选择
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">门店 ID: {form.storeId.trim() || "未选择"}</p>
            </div>
            <div className="space-y-2">
              <label className="workflow-form-label">商户</label>
              <div className="flex items-center gap-2">
                <Input
                  className="workflow-form-input"
                  placeholder="可选，输入或选择商户"
                  value={getReferenceInputValue(form.merchantId, merchantName, merchantQuery.isFetching)}
                  onChange={(event) => updateField("merchantId", event.target.value)}
                />
                <Button type="button" variant="outline" className="h-10 shrink-0 px-4" onClick={() => setActiveLookup("merchant")}>
                  选择
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">商户 ID: {form.merchantId.trim() || "未选择"}</p>
            </div>
          </div>
        </FormSection>

        <FormSection title="问题详情" description="描述问题现象，并上传截图或其他相关附件">
          <div className="space-y-2">
            <label className="workflow-form-label">
              <span className="text-destructive">*</span>问题描述
            </label>
            <Textarea
              className="workflow-form-textarea min-h-[140px]"
              rows={5}
              placeholder="请描述问题现象、复现步骤、影响范围等信息"
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="workflow-form-label">附件</label>
            <TicketAttachmentEditor value={form.attachments} onChange={(items) => updateField("attachments", items)} disabled={saving} />
          </div>
        </FormSection>

        <div className="flex flex-col items-end gap-2 pt-2">
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <div className="flex justify-end gap-4">
            <Button variant="outline" className="h-10 px-5" onClick={handleBack} disabled={saving}>
              取消
            </Button>
            <Button className="h-10 px-5 bg-foreground text-background hover:bg-foreground/90" onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </div>

      <EntitySearchPickerDialog<User>
        open={activeLookup === "customer"}
        onOpenChange={(open) => setActiveLookup(open ? "customer" : null)}
        title="选择客户"
        queryKeyPrefix={["ticketEditor", "picker", "customer", sessionScope.scope.queryScopeKey, lookupTenantId || "current"]}
        fetchPage={({ keyword, pageNo, pageSize, total }) => listUsers({ keyword, pageNo, pageSize, total })}
        getId={(item) => item.id}
        getTitle={(item) => getUserDisplayName(item) || item.id}
        getDescription={(item) => `${item.phone ? `手机：${item.phone}` : "手机：-"}${item.email ? ` · 邮箱：${item.email}` : ""}`}
        getMeta={(item) => `主体ID：${item.principalId || "-"}${item.email ? ` · 邮箱：${item.email}` : ""}`}
        onPick={(item) => updateField("customerId", item.id)}
        searchPlaceholder="搜索客户昵称/姓名/手机号"
        emptyText="暂无可选客户"
        selectedId={form.customerId}
        pageSizeOptions={[10, 20, 50]}
      />

      <EntitySearchPickerDialog<Store>
        open={activeLookup === "store"}
        onOpenChange={(open) => setActiveLookup(open ? "store" : null)}
        title="选择门店"
        queryKeyPrefix={["ticketEditor", "picker", "store"]}
        fetchPage={({ keyword, pageNo, pageSize, total }) => listStores({ keyword, pageNo, pageSize, total })}
        getId={(item) => item.id}
        getTitle={(item) => item.name || item.code || item.id}
        getDescription={(item) => `编码：${item.code || "-"}${item.merchantName ? ` · 商户：${item.merchantName}` : ""}`}
        getMeta={(item) => `${item.contactPerson ? `联系人：${item.contactPerson}` : "联系人：-"}${item.contactPhone ? ` · 电话：${item.contactPhone}` : ""}`}
        onPick={(item) => updateField("storeId", item.id)}
        searchPlaceholder="搜索门店名称/编码"
        emptyText="暂无可选门店"
        selectedId={form.storeId}
        pageSizeOptions={[10, 20, 50]}
      />

      <EntitySearchPickerDialog<Merchant>
        open={activeLookup === "merchant"}
        onOpenChange={(open) => setActiveLookup(open ? "merchant" : null)}
        title="选择商户"
        queryKeyPrefix={["ticketEditor", "picker", "merchant"]}
        fetchPage={({ keyword, pageNo, pageSize, total }) => listMerchants({ keyword, pageNo, pageSize, total })}
        getId={(item) => item.id}
        getTitle={(item) => item.name || item.code || item.id}
        getDescription={(item) => `编码：${item.code || "-"}${item.contactPerson ? ` · 联系人：${item.contactPerson}` : ""}`}
        getMeta={(item) => `${item.contactPhone ? `电话：${item.contactPhone}` : "电话：-"}${item.address ? ` · 地址：${item.address}` : ""}`}
        onPick={(item) => updateField("merchantId", item.id)}
        searchPlaceholder="搜索商户名称/编码"
        emptyText="暂无可选商户"
        selectedId={form.merchantId}
        pageSizeOptions={[10, 20, 50]}
      />
    </div>
  );
}
