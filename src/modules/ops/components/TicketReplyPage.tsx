import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Download, Eye, FileText, Pencil, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import TicketReplyComposer from "@/modules/ops/components/TicketReplyComposer";
import {
  OPS_TICKET_DELETE_CONFIRM_TEXT,
  addTicketReply,
  closeTicket,
  deleteTicketReply,
  getTicket,
  listTicketDictionaries,
  listTicketReplies,
  type TicketAttachment,
  type TicketDetail,
  type TicketDictionaryResponse,
  type TicketReply,
} from "@/shared/api/ops/ops-ticket";
import { getUser, listUsers, type User } from "@/shared/api/ums/iam";
import { getMerchant } from "@/shared/api/ums/ums-merchant";
import { getStore } from "@/shared/api/ums/ums-store";
import { formatDateTime } from "@/shared/lib/datetime";
import { getUserAvatarFallback, normalizeAvatarUrl } from "@/shared/lib/user-avatar";
import { StatusBadge, statusToneFromCode } from "@/shared/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

function buildLabelMap(options: { value: string; label: string }[]) {
  return new Map(options.map((item) => [item.value, item.label]));
}
import { notify } from "@/shared/lib/notify";

function priorityTone(priority: string) {
  if (priority === "urgent" || priority === "high") return "danger" as const;
  if (priority === "medium") return "warning" as const;
  return "neutral" as const;
}

function resolveLookupTenantId(baseTenantId: string | null | undefined, merchantId: string | null | undefined, storeId: string | null | undefined) {
  if (storeId?.trim()) return storeId.trim();
  if (merchantId?.trim()) return merchantId.trim();
  return baseTenantId?.trim() || undefined;
}

function getUserDisplayName(user?: Partial<User> | null) {
  return user?.nickname || user?.displayName || user?.realName || user?.phone || user?.email || "";
}

function sanitizeUrl(url?: string | null) {
  return (url || "").replace(/[`'"]/g, "").trim();
}

function isImageAttachment(item: TicketAttachment) {
  const mime = (item.mimeType || "").trim().toLowerCase();
  if (mime.startsWith("image/")) return true;
  const name = (item.name || item.url || "").trim().toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif)(\?|$)/i.test(name);
}

async function resolveUserProfile(scopeTenantId: string | undefined, identifier: string | null | undefined) {
  if (!scopeTenantId || !identifier) return { displayName: "", avatarUrl: "" };

  const toProfile = (user?: Partial<User> | null) => ({
    displayName: getUserDisplayName(user),
    avatarUrl: normalizeAvatarUrl(user?.avatarUrl),
  });

  try {
    const user = await getUser({ tenantId: scopeTenantId, id: identifier });
    const profile = toProfile(user);
    if (profile.displayName || profile.avatarUrl) return profile;
  } catch {
    // Ignore and fall back to fuzzy search by principalId / id.
  }

  try {
    const response = await listUsers({ tenantId: scopeTenantId, pageNo: 1, pageSize: 20, keyword: identifier });
    const matchedUser = response.items.find((item) => item.principalId === identifier || item.id === identifier);
    const profile = toProfile(matchedUser);
    if (profile.displayName || profile.avatarUrl) return profile;
  } catch {
    // Ignore and fall back to paged exact matching.
  }

  try {
    const pageSize = 100;
    const maxPages = 10;
    let lastTotal: number | undefined;
    for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
      const response = await listUsers({ tenantId: scopeTenantId, pageNo, pageSize, total: pageNo > 1 ? lastTotal : undefined });
      const matchedUser = response.items.find((item) => item.principalId === identifier || item.id === identifier);
      if (matchedUser) {
        return toProfile(matchedUser);
      }
      lastTotal = response.page?.total || lastTotal;
      const totalPages = Math.ceil((response.page?.total || 0) / pageSize);
      if (!totalPages || pageNo >= totalPages) {
        break;
      }
    }
  } catch {
    // Ignore and fall through to empty state.
  }

  return { displayName: "", avatarUrl: "" };
}

/** 与 ComfyUIServerEditorPage / TicketEditorPage FormSection 保持一致 */
function FormSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-2xl bg-background/85 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground leading-relaxed">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function TicketAttachmentsBlock(props: {
  items: TicketAttachment[];
  onPreview: (item: TicketAttachment) => void;
}) {
  if (!props.items.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {props.items.map((item, index) => {
        const url = sanitizeUrl(item.url);
        const image = isImageAttachment(item);
        return (
          <div
            key={`${url}-${index}`}
            className="group relative overflow-hidden rounded-xl bg-muted/30"
          >
            {image ? (
              <button type="button" className="block h-20 w-28 overflow-hidden" onClick={() => props.onPreview(item)} title="预览图片">
                <img src={url} alt={item.name || "附件"} className="h-full w-full object-cover" />
              </button>
            ) : (
              <div className="flex h-20 w-[180px] items-center gap-2 px-3">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-foreground">{item.name || "附件"}</div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.mimeType || "文件"}</div>
                </div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/50 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              {image ? (
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-foreground"
                  onClick={() => props.onPreview(item)}
                  title="预览"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-foreground"
                title="打开"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TicketReplyPage() {
  const navigate = useNavigate();
  const { ticketId } = useParams<{ ticketId: string }>();
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [dictionaries, setDictionaries] = useState<TicketDictionaryResponse>({
    ticketTypes: [],
    ticketStatuses: [],
    priorities: [],
    ticketSources: [],
  });
  const [relatedDisplayNames, setRelatedDisplayNames] = useState<{
    userNames: Record<string, string>;
    userAvatars: Record<string, string>;
    storeName: string;
    merchantName: string;
  }>({
    userNames: {},
    userAvatars: {},
    storeName: "",
    merchantName: "",
  });
  const [loading, setLoading] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<TicketAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<TicketAttachment | null>(null);

  const ticketTypeMap = useMemo(() => buildLabelMap(dictionaries.ticketTypes), [dictionaries.ticketTypes]);
  const ticketStatusMap = useMemo(() => buildLabelMap(dictionaries.ticketStatuses), [dictionaries.ticketStatuses]);
  const priorityMap = useMemo(() => buildLabelMap(dictionaries.priorities), [dictionaries.priorities]);
  const sourceMap = useMemo(() => buildLabelMap(dictionaries.ticketSources), [dictionaries.ticketSources]);

  const conversationItems = useMemo(() => {
    if (!detail) return [];

    const customerName = detail.customerId ? relatedDisplayNames.userNames[detail.customerId] || "未知客户" : "客户";
    const serviceName = detail.assigneeId ? relatedDisplayNames.userNames[detail.assigneeId] || "未知处理人" : "客服";
    const customerAvatar = detail.customerId ? relatedDisplayNames.userAvatars[detail.customerId] || "" : "";
    const serviceAvatar = detail.assigneeId ? relatedDisplayNames.userAvatars[detail.assigneeId] || "" : "";
    const initialCustomerName = customerName === "-" ? "客户" : customerName;

    const items = [
      {
        id: `ticket-${detail.id}`,
        role: "customer" as const,
        displayName: initialCustomerName,
        avatarUrl: customerAvatar,
        createdAt: detail.createdAt,
        content: detail.description || "暂无描述",
        attachments: detail.attachments || [],
        reply: null as TicketReply | null,
      },
    ];

    const replyItems = [...replies]
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
      .map((reply) => {
        const isCustomerReply = Boolean(detail.customerId) && reply.replierId === detail.customerId;
        const role: "customer" | "service" = isCustomerReply ? "customer" : "service";
        return {
          id: reply.id,
          role,
          displayName: isCustomerReply
            ? relatedDisplayNames.userNames[reply.replierId] || initialCustomerName
            : relatedDisplayNames.userNames[reply.replierId] || serviceName,
          avatarUrl:
            normalizeAvatarUrl(reply.replierAvatarUrl) ||
            (isCustomerReply
              ? relatedDisplayNames.userAvatars[reply.replierId] || customerAvatar
              : relatedDisplayNames.userAvatars[reply.replierId] || serviceAvatar),
          createdAt: reply.createdAt,
          content: reply.replyContent,
          attachments: reply.attachments || [],
          reply,
        };
      });

    return [...items, ...replyItems];
  }, [detail, relatedDisplayNames.userAvatars, relatedDisplayNames.userNames, replies]);

  const loadPage = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const [dictionaryResponse, detailResponse, repliesResponse] = await Promise.all([
        listTicketDictionaries(),
        getTicket(ticketId),
        listTicketReplies(ticketId),
      ]);
      const safeReplies = repliesResponse ?? [];
      const userIdentifiers = Array.from(
        new Set([detailResponse.customerId, detailResponse.assigneeId, ...safeReplies.map((reply) => reply.replierId)].filter(Boolean)),
      ) as string[];
      const userLookupTenantId = resolveLookupTenantId(detailResponse.scopeTenantId, detailResponse.merchantId, detailResponse.storeId);
      const [userEntries, storeResult, merchantName] = await Promise.all([
        Promise.all(userIdentifiers.map(async (identifier) => [identifier, await resolveUserProfile(userLookupTenantId, identifier)] as const)),
        detailResponse.storeId
          ? getStore(detailResponse.storeId)
              .then((store) => ({
                name: store.name || store.code || "",
                merchantName: store.merchantName || "",
              }))
              .catch(() => ({ name: "", merchantName: "" }))
          : Promise.resolve({ name: "", merchantName: "" }),
        detailResponse.merchantId
          ? getMerchant(detailResponse.merchantId)
              .then((merchant) => merchant.name || merchant.code || "")
              .catch(() => "")
          : Promise.resolve(""),
      ]);
      setDictionaries(dictionaryResponse);
      setDetail(detailResponse);
      setReplies(safeReplies);
      setRelatedDisplayNames({
        userNames: Object.fromEntries(userEntries.filter(([, profile]) => Boolean(profile.displayName)).map(([id, profile]) => [id, profile.displayName])),
        userAvatars: Object.fromEntries(userEntries.filter(([, profile]) => Boolean(profile.avatarUrl)).map(([id, profile]) => [id, profile.avatarUrl])),
        storeName: storeResult.name,
        merchantName: merchantName || storeResult.merchantName,
      });
    } catch (error) {
      notify.error("加载工单回复页失败", { description: error instanceof Error ? error.message : "请求失败" });
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const handleBack = () => {
    navigate("/ops/tickets");
  };

  const handleCloseTicket = async () => {
    if (!ticketId || !detail || detail.ticketStatus === "closed" || detail.ticketStatus === "deleted") return;
    if (!window.confirm(`确认关闭工单「${detail.title}」吗？`)) return;

    try {
      await closeTicket(ticketId);
      notify.success("工单已关闭");
      await loadPage();
    } catch (error) {
      notify.error("关闭工单失败", { description: error instanceof Error ? error.message : "请求失败" });
    }
  };

  const handleReplySubmit = async () => {
    if (!ticketId || !replyContent.trim()) return;

    setSubmitting(true);
    try {
      await addTicketReply(ticketId, {
        replyContent: replyContent.trim(),
        attachments: replyAttachments,
      });
      setReplyContent("");
      setReplyAttachments([]);
      notify.success("回复已发送");
      await loadPage();
    } catch (error) {
      notify.error("发送回复失败", { description: error instanceof Error ? error.message : "请求失败" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReply = async (reply: TicketReply) => {
    if (!ticketId) return;
    const confirmText = window.prompt(`删除该条回复前请输入 ${OPS_TICKET_DELETE_CONFIRM_TEXT}`);
    if (!confirmText) return;

    try {
      await deleteTicketReply(ticketId, reply.id, confirmText);
      notify.success("删除成功");
      await loadPage();
    } catch (error) {
      notify.error("删除回复失败", { description: error instanceof Error ? error.message : "请求失败" });
    }
  };

  if (loading && !detail) {
    return <div className="page-content-shell py-16 text-center text-muted-foreground">加载中...</div>;
  }

  if (!detail) {
    return <div className="page-content-shell py-16 text-center text-muted-foreground">未找到工单数据</div>;
  }

  const replyDisabled = detail.ticketStatus === "closed" || detail.ticketStatus === "deleted";
  const customerDisplayName = detail.customerId ? relatedDisplayNames.userNames[detail.customerId] || "未知客户" : "-";
  const assigneeDisplayName = detail.assigneeId ? relatedDisplayNames.userNames[detail.assigneeId] || "未知处理人" : "未指派";
  const storeDisplayName = detail.storeId ? relatedDisplayNames.storeName || "未知门店" : "-";
  const merchantDisplayName = detail.merchantId ? relatedDisplayNames.merchantName || "未知商户" : "-";

  return (
    <div className="page-content-shell flex flex-col overflow-hidden">
      <div className="shrink-0">
        <div className="subpage-toolbar mb-5">
          <div className="subpage-toolbar-start">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-[18px] font-semibold text-foreground">工单回复</h1>
          </div>
          <div className="subpage-toolbar-end">
            <button className="subpage-outline-btn" onClick={() => void loadPage()} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </button>
            <button
              className="subpage-outline-btn"
              onClick={() => navigate(`/ops/tickets/${detail.id}/edit`)}
              disabled={replyDisabled}
            >
              <Pencil className="h-4 w-4" />
              编辑
            </button>
            <Button
              className="h-9 px-4 bg-foreground text-background hover:bg-foreground/90"
              onClick={() => void handleCloseTicket()}
              disabled={replyDisabled}
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              关闭工单
            </Button>
          </div>
        </div>

        {replyDisabled ? (
          <Alert className="mb-5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{detail.ticketStatus === "deleted" ? "工单已删除" : "工单已关闭"}</AlertTitle>
            <AlertDescription>
              当前工单状态为 {ticketStatusMap.get(detail.ticketStatus) || detail.ticketStatus}，回复输入区已禁用，仅保留历史记录查看。
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto w-full max-w-[1080px] space-y-5 pb-5">
          <FormSection
            title={detail.title || "工单详情"}
            description={`工单编号：${detail.id}`}
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <StatusBadge tone={statusToneFromCode(detail.ticketStatus)}>
                  {ticketStatusMap.get(detail.ticketStatus) || detail.ticketStatus}
                </StatusBadge>
                <StatusBadge tone={priorityTone(detail.priority)}>
                  {priorityMap.get(detail.priority) || detail.priority}
                </StatusBadge>
                <StatusBadge tone="info">{ticketTypeMap.get(detail.ticketType) || detail.ticketType}</StatusBadge>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <label className="workflow-form-label">客户</label>
                <div className="text-sm font-medium text-foreground">{customerDisplayName}</div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">处理人</label>
                <div className="text-sm font-medium text-foreground">{assigneeDisplayName}</div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">门店</label>
                <div className="text-sm font-medium text-foreground">{storeDisplayName}</div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">商户</label>
                <div className="text-sm font-medium text-foreground">{merchantDisplayName}</div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">创建来源</label>
                <div className="text-sm text-foreground">{detail.source ? sourceMap.get(detail.source) || detail.source : "-"}</div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">创建时间</label>
                <div className="text-sm text-foreground">{formatDateTime(detail.createdAt)}</div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">更新时间</label>
                <div className="text-sm text-foreground">{formatDateTime(detail.updatedAt)}</div>
              </div>
              <div className="space-y-2">
                <label className="workflow-form-label">回复数</label>
                <div className="text-sm font-medium text-foreground">{replies.length}</div>
              </div>
            </div>
          </FormSection>

          <FormSection title="会话记录" description="按时间顺序展示客户与客服对话">
            <div className="space-y-5">
              {conversationItems.map((item) => {
                const isService = item.role === "service";
                return (
                  <div key={item.id} className={`flex ${isService ? "justify-end" : "justify-start"}`}>
                    <div className={`flex max-w-[min(100%,720px)] items-start gap-3 ${isService ? "flex-row-reverse" : ""}`}>
                      <Avatar className="mt-0.5 h-9 w-9 shrink-0 border border-border/60">
                        <AvatarImage src={item.avatarUrl || undefined} alt={item.displayName} className="object-cover" />
                        <AvatarFallback
                          className={
                            isService ? "bg-foreground/10 text-foreground text-xs font-medium" : "bg-muted text-muted-foreground text-xs font-medium"
                          }
                        >
                          {getUserAvatarFallback(item.displayName)}
                        </AvatarFallback>
                      </Avatar>

                      <div className={`min-w-0 space-y-2 ${isService ? "text-right" : ""}`}>
                        <div className={`flex flex-wrap items-center gap-2 text-xs text-muted-foreground ${isService ? "justify-end" : ""}`}>
                          <span className="font-medium text-foreground/80">{item.displayName}</span>
                          <span>{isService ? "客服" : "客户"}</span>
                          <span>{formatDateTime(item.createdAt)}</span>
                          {item.reply ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => void handleDeleteReply(item.reply!)}
                              aria-label="删除当前对话"
                              title="删除当前对话"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>

                        <div
                          className={`rounded-2xl px-4 py-3 text-left text-sm leading-6 ${
                            isService ? "bg-foreground text-background" : "bg-muted/40 text-foreground"
                          }`}
                        >
                          <div className="whitespace-pre-wrap break-words">{item.content}</div>
                        </div>

                        {item.attachments.length ? (
                          <div className={isService ? "flex justify-end" : ""}>
                            <TicketAttachmentsBlock items={item.attachments} onPreview={setPreviewAttachment} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </FormSection>
        </div>
      </div>

      <TicketReplyComposer
        value={replyContent}
        onChange={setReplyContent}
        attachments={replyAttachments}
        onAttachmentsChange={setReplyAttachments}
        onSubmit={() => void handleReplySubmit()}
        submitting={submitting}
        disabled={replyDisabled}
      />

      <Dialog open={Boolean(previewAttachment)} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
        <DialogContent className="max-w-[900px]">
          <DialogHeader>
            <DialogTitle className="truncate">{previewAttachment?.name || "图片预览"}</DialogTitle>
          </DialogHeader>
          {previewAttachment ? (
            <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-xl bg-muted/20 p-2">
              <img
                src={sanitizeUrl(previewAttachment.url)}
                alt={previewAttachment.name || "预览"}
                className="max-h-[66vh] max-w-full object-contain"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
