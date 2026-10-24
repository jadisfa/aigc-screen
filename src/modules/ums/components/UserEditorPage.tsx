import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Scissors, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  createUser,
  deleteUserLoginIdentifier,
  getUserEditDetail,
  normalizePrincipalStatus,
  listPrincipalRoles,
  updateUser,
  type LoginIdentifier,
  type RoleGrant,
} from "@/shared/api/ums/iam";
import { listMerchants, type Merchant } from "@/shared/api/ums/ums-merchant";
import { listStores, type Store } from "@/shared/api/ums/ums-store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Checkbox } from "@/shared/ui/checkbox";
import { APP_CLIENT_OPTIONS } from "@/shared/lib/dicts";
import { listAppClients, type DictOption } from "@/shared/api/ums/iam";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { md5HexFromFile } from "@/shared/lib/md5";
import { downloadUserAvatarCropSource, selectUserAvatar, uploadUserAvatar, type UserAvatar } from "@/modules/ums/api/user-avatar";
import { createAvatarCropObjectUrl, isBlobAvatarUrl } from "@/modules/ums/lib/avatar-crop";
import UserAvatarCropDialog from "@/modules/ums/components/UserAvatarCropDialog";
import UserAvatarHistoryDialog from "@/modules/ums/components/UserAvatarHistoryDialog";
import { getUserAvatarFallback, normalizeAvatarUrl, resolveUserAvatarUrl } from "@/shared/lib/user-avatar";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { notify } from "@/shared/lib/notify";
import { affiliationChangeConflictMessage } from "@/shared/lib/role-privilege";

export interface UserEditorPageProps {
  mode: "create" | "edit";
  editScope?: "admin" | "self";
  user?: {
    id: string;
    principalId?: string;
    merchantId?: string;
    storeId?: string;
    displayName?: string;
    nickname: string;
    realName?: string;
    avatarUrl?: string;
    gender?: string;
    birthday?: string;
    phone: string;
    email: string;
    status: string;
    remark?: string;
    groups?: string[];
    wechatOpenId?: string | null;
    wechatUnionId?: string | null;
    identifiers?: LoginIdentifier[];
  };
  onBack: () => void;
  onSuccess: () => void;
}

const createEmptyFormData = () => ({
  merchantId: "",
  storeId: "",
  nickname: "",
  realName: "",
  avatarUrl: "",
  gender: "",
  birthday: "",
  phone: "",
  email: "",
  status: "active",
  remark: "",
});

export default function UserEditorPage({ mode, editScope = "admin", user, onBack, onSuccess }: UserEditorPageProps) {
  const queryClient = useQueryClient();
  const sessionScope = useSessionScope();
  const isCreateMode = mode === "create";
  const isSelfEditing = mode === "edit" && editScope === "self";

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarHistoryOpen, setAvatarHistoryOpen] = useState(false);
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);
  const [avatarCropSourceUrl, setAvatarCropSourceUrl] = useState("");
  const [avatarDraftPreviewUrl, setAvatarDraftPreviewUrl] = useState("");
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [selectedHistoryAvatar, setSelectedHistoryAvatar] = useState<UserAvatar | null>(null);
  const [formData, setFormData] = useState(createEmptyFormData);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const cropSourceUrlRef = useRef<string | null>(null);
  const draftPreviewUrlRef = useRef<string | null>(null);

  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [identifiers, setIdentifiers] = useState<LoginIdentifier[]>([]);
  const [identifierToDelete, setIdentifierToDelete] = useState<LoginIdentifier | null>(null);
  const [deletingIdentifier, setDeletingIdentifier] = useState(false);
  const [appClients, setAppClients] = useState<DictOption[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [storeOptionsByMerchant, setStoreOptionsByMerchant] = useState<Record<string, Store[]>>({});
  const [existingRoleGrants, setExistingRoleGrants] = useState<RoleGrant[]>([]);
  const [avatarPreparing, setAvatarPreparing] = useState(false);

  useEffect(() => {
    if (!isSelfEditing) {
      listMerchants({ pageNo: 1, pageSize: 200 }).then(res => setMerchants(res.items)).catch(console.error);
      listAppClients().then(setAppClients).catch(console.error);
    } else if (isSelfEditing) {
      setMerchants([]);
    }
  }, [isSelfEditing]);

  const ensureStoreOptionsLoaded = useCallback((merchantId?: string | null) => {
    const normalizedMerchantId = merchantId?.trim();
    if (!normalizedMerchantId) {
      return;
    }
    if (storeOptionsByMerchant[normalizedMerchantId]) {
      return;
    }
    listStores({ merchantId: normalizedMerchantId, pageNo: 1, pageSize: 200 })
      .then((res) => {
        setStoreOptionsByMerchant((current) => ({
          ...current,
          [normalizedMerchantId]: res.items ?? [],
        }));
      })
      .catch(console.error);
  }, [storeOptionsByMerchant]);

  const revokeObjectUrl = useCallback((url: string | null) => {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }, []);

  const resetPendingAvatar = useCallback(() => {
    revokeObjectUrl(draftPreviewUrlRef.current);
    draftPreviewUrlRef.current = null;
    setAvatarDraftPreviewUrl("");
    setPendingAvatarFile(null);
  }, [revokeObjectUrl]);

  const resetCropSource = useCallback(() => {
    revokeObjectUrl(cropSourceUrlRef.current);
    cropSourceUrlRef.current = null;
    setAvatarCropSourceUrl("");
  }, [revokeObjectUrl]);

  useEffect(() => {
    resetPendingAvatar();
    resetCropSource();
    setAvatarHistoryOpen(false);
    setAvatarCropOpen(false);
    setSelectedHistoryAvatar(null);

    if (isCreateMode || !user) {
      setFormData(createEmptyFormData());
      setSelectedGroups([]);
      setIdentifiers([]);
      setExistingRoleGrants([]);
      return;
    }

    setFormData({
      merchantId: user.merchantId || "",
      storeId: user.storeId || "",
      nickname: user.nickname || "",
      realName: user.realName || "",
      avatarUrl: user.avatarUrl || "",
      gender: user.gender || "",
      birthday: user.birthday ? user.birthday.substring(0, 10) : "",
      phone: user.phone || "",
      email: user.email || "",
      status: normalizePrincipalStatus(user.status),
      remark: user.remark || "",
    });

    setSelectedGroups(user.groups || []);
    setIdentifiers(user.identifiers || []);

    let cancelled = false;
    getUserEditDetail({ id: user.id }).then((detail) => {
      if (cancelled) return;
      setFormData({
        merchantId: detail.merchantId || "",
        storeId: detail.storeId || "",
        nickname: detail.nickname || detail.displayName || "",
        realName: detail.realName || "",
        avatarUrl: detail.avatarUrl || "",
        gender: detail.gender || "",
        birthday: detail.birthday ? detail.birthday.substring(0, 10) : "",
        phone: detail.phone || "",
        email: detail.email || "",
        status: normalizePrincipalStatus(detail.principalStatus),
        remark: detail.remark || "",
      });
      setSelectedGroups(detail.groups || []);
      setIdentifiers(detail.identifiers || []);
    }).catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [isCreateMode, isSelfEditing, resetCropSource, resetPendingAvatar, user]);

  const currentFormStores = useMemo(
    () => (formData.merchantId ? storeOptionsByMerchant[formData.merchantId] || [] : []),
    [formData.merchantId, storeOptionsByMerchant],
  );

  useEffect(() => {
    return () => {
      revokeObjectUrl(cropSourceUrlRef.current);
      revokeObjectUrl(draftPreviewUrlRef.current);
    };
  }, [revokeObjectUrl]);

  useEffect(() => {
    if (!isSelfEditing && formData.merchantId) {
      ensureStoreOptionsLoaded(formData.merchantId);
    }
  }, [ensureStoreOptionsLoaded, formData.merchantId, isSelfEditing]);

  useEffect(() => {
    if (isCreateMode || isSelfEditing || !user?.principalId) {
      setExistingRoleGrants([]);
      return;
    }
    let cancelled = false;
    listPrincipalRoles(undefined, user.principalId)
      .then((grants) => {
        if (!cancelled) {
          setExistingRoleGrants(grants ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExistingRoleGrants([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isCreateMode, isSelfEditing, user?.principalId]);

  const openAvatarCropper = (file: File) => {
    resetCropSource();
    setSelectedHistoryAvatar(null);
    const sourceUrl = URL.createObjectURL(file);
    cropSourceUrlRef.current = sourceUrl;
    setAvatarCropSourceUrl(sourceUrl);
    setAvatarCropOpen(true);
  };

  const handleAvatarLocalUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    openAvatarCropper(file);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  const handleAvatarHistoryPick = (avatar: UserAvatar) => {
    resetPendingAvatar();
    resetCropSource();
    setSelectedHistoryAvatar(avatar);
    setFormData((prev) => ({ ...prev, avatarUrl: normalizeAvatarUrl(avatar.avatarUrl) || avatar.avatarUrl }));
  };

  const handleAvatarCropConfirm = async (blob: Blob) => {
    const file = new File([blob], `avatar-${Date.now()}.png`, {
      type: blob.type || "image/png",
    });
    resetPendingAvatar();
    setSelectedHistoryAvatar(null);
    const previewUrl = URL.createObjectURL(file);
    draftPreviewUrlRef.current = previewUrl;
    setAvatarDraftPreviewUrl(previewUrl);
    setPendingAvatarFile(file);
    resetCropSource();
  };

  const handleAvatarCropOpenChange = (open: boolean) => {
    setAvatarCropOpen(open);
    if (!open) {
      resetCropSource();
    }
  };

  const clearAvatar = () => {
    resetPendingAvatar();
    setSelectedHistoryAvatar(null);
    setFormData((prev) => ({ ...prev, avatarUrl: "" }));
  };

  const uploadPendingAvatar = async (targetUserId: string) => {
    if (!pendingAvatarFile) {
      return normalizeAvatarUrl(formData.avatarUrl) || null;
    }
    setAvatarUploading(true);
    try {
      const fileHash = await md5HexFromFile(pendingAvatarFile);
      const result = await uploadUserAvatar({
        userId: targetUserId,
        file: pendingAvatarFile,
        fileHash,
      });
      const uploadedAvatarUrl = normalizeAvatarUrl(result.avatar.avatarUrl);
      setSelectedHistoryAvatar(null);
      setFormData((prev) => ({ ...prev, avatarUrl: uploadedAvatarUrl }));
      return uploadedAvatarUrl;
    } finally {
      setAvatarUploading(false);
    }
  };

  const avatarPreviewUrl = avatarDraftPreviewUrl || resolveUserAvatarUrl(
    formData.avatarUrl,
    formData.nickname || user?.displayName || user?.phone || "user",
    128,
  );
  const currentAvatarCropUrl = avatarCropSourceUrl || avatarDraftPreviewUrl || (normalizeAvatarUrl(formData.avatarUrl) || "");
  const canCropAvatar = Boolean(currentAvatarCropUrl);
  const avatarFallback = getUserAvatarFallback(formData.nickname || user?.displayName || user?.phone || "U");

  const openCurrentAvatarCropper = async () => {
    if (!currentAvatarCropUrl) {
      return;
    }
    if (isBlobAvatarUrl(currentAvatarCropUrl)) {
      setAvatarCropOpen(true);
      return;
    }
    setAvatarPreparing(true);
    try {
      resetCropSource();
      const blob = await downloadUserAvatarCropSource(currentAvatarCropUrl);
      const sourceUrl = await createAvatarCropObjectUrl(currentAvatarCropUrl, blob);
      cropSourceUrlRef.current = sourceUrl;
      setAvatarCropSourceUrl(sourceUrl);
      setAvatarCropOpen(true);
    } catch (err) {
      notify.error("头像裁剪源加载失败", { description: resolveUserErrorMessage(err, "无法加载当前头像用于裁剪") });
    } finally {
      setAvatarPreparing(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.nickname || !formData.nickname.trim()) {
      setFormError("昵称为必填项");
      return;
    }

    if (!formData.phone || !formData.phone.trim()) {
      setFormError("手机号为必填项");
      return;
    }

    if (!isCreateMode && !isSelfEditing) {
      const affiliationConflict = affiliationChangeConflictMessage(
        existingRoleGrants.map((grant) => ({
          roleCode: grant.roleCode,
          roleScopeLevel: grant.scopeLevel,
          merchantId: grant.merchantId,
          storeId: grant.storeId,
        })),
        formData.merchantId,
        formData.storeId,
      );
      if (affiliationConflict) {
        setFormError(affiliationConflict);
        notify.error("无法修改组织归属", { description: affiliationConflict });
        return;
      }
    }
    setFormError(null);

    try {
      setSaving(true);

      const normalizedPhone = formData.phone.trim();
      const normalizedEmail = formData.email.trim().toLowerCase();
      const normalizedAvatar = normalizeAvatarUrl(formData.avatarUrl) || null;
      const selectedHistoryAvatarId = selectedHistoryAvatar?.id || null;

      if (isCreateMode) {
        const createdUserId = await createUser({
          data: {
            merchantId: formData.merchantId || null,
            storeId: formData.storeId || null,
            nickname: formData.nickname.trim(),
            realName: formData.realName.trim() || null,
            avatarUrl: pendingAvatarFile ? null : normalizedAvatar,
            gender: formData.gender || null,
            birthday: formData.birthday || null,
            phone: normalizedPhone,
            email: normalizedEmail || null,
            status: formData.status || "active",
            remark: formData.remark.trim() || null,
            groups: selectedGroups.length > 0 ? selectedGroups : null,
          }
        });
        if (pendingAvatarFile) {
          await uploadPendingAvatar(createdUserId);
        } else if (selectedHistoryAvatarId) {
          const selectedAvatar = await selectUserAvatar({
            userId: createdUserId,
            avatarId: selectedHistoryAvatarId,
          });
          setFormData((prev) => ({ ...prev, avatarUrl: normalizeAvatarUrl(selectedAvatar.avatarUrl) || selectedAvatar.avatarUrl }));
        }
      } else {
        if (!user) return;
        await updateUser({
          id: user.id,
          data: isSelfEditing
            ? {
                nickname: formData.nickname.trim(),
                realName: formData.realName.trim() || null,
                avatarUrl: normalizedAvatar,
                gender: formData.gender || null,
                birthday: formData.birthday || null,
                phone: normalizedPhone,
                email: normalizedEmail || null,
                remark: formData.remark.trim() || null,
              }
            : {
                merchantId: formData.merchantId || null,
                storeId: formData.storeId || null,
                nickname: formData.nickname.trim(),
                realName: formData.realName.trim() || null,
                avatarUrl: normalizedAvatar,
                gender: formData.gender || null,
                birthday: formData.birthday || null,
                phone: normalizedPhone,
                email: normalizedEmail || null,
                status: formData.status || null,
                remark: formData.remark.trim() || null,
                groups: selectedGroups.length > 0 ? selectedGroups : null,
              }
        });

        if (pendingAvatarFile) {
          await uploadPendingAvatar(user.id);
        } else if (!isSelfEditing && selectedHistoryAvatarId) {
          const selectedAvatar = await selectUserAvatar({
            userId: user.id,
            avatarId: selectedHistoryAvatarId,
          });
          setFormData((prev) => ({ ...prev, avatarUrl: normalizeAvatarUrl(selectedAvatar.avatarUrl) || selectedAvatar.avatarUrl }));
        }
      }

      resetPendingAvatar();
      setSelectedHistoryAvatar(null);
      await queryClient.invalidateQueries({ queryKey: ["iamUsers", sessionScope.scope.queryScopeKey] });
      onSuccess();
    } catch (err: unknown) {
      notify.error(isCreateMode ? "创建失败" : "更新失败", { description: resolveUserErrorMessage(err, "请求失败") });
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (code: string) => {
    setSelectedGroups(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const refreshIdentifiers = useCallback(async () => {
    if (!user?.id) return;
    const detail = await getUserEditDetail({ id: user.id });
    setIdentifiers(detail.identifiers || []);
    if (detail.email !== undefined) {
      setFormData((prev) => ({ ...prev, email: detail.email || "" }));
    }
  }, [user?.id]);

  const handleConfirmDeleteIdentifier = async () => {
    if (!user?.id || !identifierToDelete) return;
    setDeletingIdentifier(true);
    try {
      await deleteUserLoginIdentifier({
        userId: user.id,
        identifierId: identifierToDelete.id,
      });
      notify.success("已解除绑定", { description: `${identifierToDelete.channelLabel} 授权已删除，用户需再次绑定后才能通过该渠道登录本账户` });
      setIdentifierToDelete(null);
      await refreshIdentifiers();
      await queryClient.invalidateQueries({ queryKey: ["umsUserEditRoute", sessionScope.scope.queryScopeKey, user.id] });
    } catch (err: unknown) {
      notify.error("解除失败", { description: resolveUserErrorMessage(err, "删除授权凭证失败") });
    } finally {
      setDeletingIdentifier(false);
    }
  };

  return (
    <div className="page-content-shell">
      <div className="subpage-toolbar mb-7">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-[18px] font-semibold text-foreground">{isCreateMode ? "新增用户" : `编辑用户 - ${user?.nickname || user?.displayName || user?.phone || "-"}`}</h1>
        </div>
      </div>

      <div className="w-full max-w-[1000px] mx-auto space-y-5">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="workflow-form-label"><span className="text-destructive mr-1">*</span>昵称</label>
            <Input value={formData.nickname} onChange={e => setFormData(prev => ({ ...prev, nickname: e.target.value }))} className="workflow-form-input" placeholder="必填" />
          </div>
          <div className="space-y-2">
            <label className="workflow-form-label">真实姓名</label>
            <Input value={formData.realName} onChange={e => setFormData(prev => ({ ...prev, realName: e.target.value }))} className="workflow-form-input" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="workflow-form-label"><span className="text-destructive mr-1">*</span>手机号</label>
            <Input value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} className="workflow-form-input" placeholder="必填" />
          </div>
          <div className="space-y-2">
            <label className="workflow-form-label">邮箱</label>
            <Input type="email" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} className="workflow-form-input" placeholder="留空则不绑定邮箱登录" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[160px_minmax(0,1fr)] gap-6 rounded-xl border border-border/60 bg-muted/10 p-5">
          <div className="space-y-3">
            <label className="workflow-form-label">用户头像</label>
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={isSelfEditing ? undefined : () => setAvatarHistoryOpen(true)}
                disabled={saving || isSelfEditing}
                className="group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                title={isSelfEditing ? "当前用户不支持从历史头像库选择" : "从历史头像库选择"}
              >
                <Avatar className="h-28 w-28 border border-border/70 shadow-sm transition-all group-hover:border-primary/50 group-hover:shadow-md">
                  <AvatarImage src={avatarPreviewUrl} alt={formData.nickname || user?.displayName || user?.phone || "用户头像"} className="object-cover" />
                  <AvatarFallback className="text-xl font-medium">{avatarFallback}</AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full bg-black/35 text-white opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center text-xs font-medium">
                  {isSelfEditing ? "当前头像" : "历史头像库"}
                </div>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleAvatarLocalUpload(e.target.files)}
                disabled={saving}
              />
            </div>
          </div>
          <div className="space-y-3">
            <label className="workflow-form-label">头像操作</label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => avatarInputRef.current?.click()}
                disabled={saving}
              >
                <Upload className="w-3.5 h-3.5" />
                本地上传
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => void openCurrentAvatarCropper()}
                disabled={!canCropAvatar || saving || avatarPreparing}
              >
                {avatarPreparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5" />}
                重新裁剪
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={clearAvatar}
                disabled={!formData.avatarUrl && !pendingAvatarFile}
              >
                <X className="w-3.5 h-3.5" />
                清除
              </Button>
            </div>
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
              <div>支持本地选择后即时预览，并在保存前完成裁剪。</div>
              <div>{isSelfEditing ? "当前用户可通过本地上传更新头像。" : "点击左侧头像可随时打开历史头像库选择已有头像。"}</div>
    
              {pendingAvatarFile ? (
                <div className="mt-2 text-foreground">当前头像已裁剪，保存后生效。</div>
              ) : null}
              {selectedHistoryAvatar ? (
                <div className="mt-2 text-foreground">已选择历史头像，保存后生效。</div>
              ) : null}
              {avatarUploading ? (
                <div className="mt-2 flex items-center text-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在上传裁剪后的头像...
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 items-center">
          <div className="space-y-2">
            <label className="workflow-form-label">性别</label>
            <Select value={formData.gender || "none"} onValueChange={(v) => setFormData(prev => ({ ...prev, gender: v === "none" ? "" : v }))}>
              <SelectTrigger className="subpage-native-select w-full h-10">
                <SelectValue placeholder="选择性别" />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                <SelectItem className="subpage-select-item" value="none">未知</SelectItem>
                <SelectItem className="subpage-select-item" value="M">男</SelectItem>
                <SelectItem className="subpage-select-item" value="F">女</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="workflow-form-label">生日</label>
            <Input type="date" value={formData.birthday} onChange={e => setFormData(prev => ({ ...prev, birthday: e.target.value }))} className="workflow-form-input" />
          </div>
        </div>

        {!isSelfEditing ? (
          <div className="grid grid-cols-2 gap-10 items-center">
          <div className="space-y-2">
            <label className="workflow-form-label">组织归属</label>
            <Select value={formData.merchantId || "none"} onValueChange={(v) => setFormData(prev => ({ ...prev, merchantId: v === "none" ? "" : v, storeId: "" }))}>
              <SelectTrigger className="subpage-native-select w-full h-10">
                <SelectValue placeholder="选择机构" />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                <SelectItem className="subpage-select-item" value="none">(空)</SelectItem>
                {merchants.map(m => (
                  <SelectItem className="subpage-select-item" key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">用于资金扣费与锁定商户/门店角色；与登录数据会话相互独立。若与已有授权冲突将被拒绝。</p>
          </div>
          <div className="space-y-2">
            <label className="workflow-form-label">归属门店</label>
            <Select value={formData.storeId || "none"} onValueChange={(v) => setFormData(prev => ({ ...prev, storeId: v === "none" ? "" : v }))} disabled={!formData.merchantId}>
              <SelectTrigger className="subpage-native-select w-full h-10">
                <SelectValue placeholder="选择门店" />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                <SelectItem className="subpage-select-item" value="none">(空)</SelectItem>
                {currentFormStores.map(s => (
                  <SelectItem className="subpage-select-item" key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-10 items-center">
          {!isSelfEditing ? (
            <div className="space-y-2">
              <label className="workflow-form-label">登录状态</label>
              <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                <SelectTrigger className="subpage-native-select w-full h-10">
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  <SelectItem className="subpage-select-item" value="active">启用</SelectItem>
                  <SelectItem className="subpage-select-item" value="disabled">禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <label className="workflow-form-label">备注</label>
            <Input value={formData.remark} onChange={e => setFormData(prev => ({ ...prev, remark: e.target.value }))} className="workflow-form-input" />
          </div>
        </div>

        {!isSelfEditing ? (
          <div className="space-y-2">
            <label className="workflow-form-label">用户分组</label>
            <div className="grid grid-cols-2 gap-4 border p-5 rounded-md bg-muted/20">
              {(appClients.length ? appClients : APP_CLIENT_OPTIONS).map(group => (
                <div key={group.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`group-${group.value}`}
                    checked={selectedGroups.includes(group.value)}
                    onCheckedChange={() => toggleGroup(group.value)}
                  />
                  <label
                    htmlFor={`group-${group.value}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {group.label} <span className="text-muted-foreground text-xs">({group.value})</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        ) : null}

{!isCreateMode ? (
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="workflow-form-label">登录授权凭证</div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  展示该用户已绑定的登录渠道。删除后需用户再次绑定才能关联本账户；手机号请在上方资料中修改。
                </p>
              </div>
            </div>
            {identifiers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 bg-background/60 px-4 py-6 text-center text-sm text-muted-foreground">
                暂无登录授权凭证
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
                <div className="grid grid-cols-[100px_90px_minmax(0,1fr)_72px_88px] gap-2 border-b border-border/60 bg-muted/30 px-3 py-2 text-[12px] font-medium text-muted-foreground">
                  <div>渠道</div>
                  <div>凭证类型</div>
                  <div>凭证值</div>
                  <div>状态</div>
                  <div className="text-right">操作</div>
                </div>
                <div className="divide-y divide-border/50">
                  {identifiers.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[100px_90px_minmax(0,1fr)_72px_88px] items-center gap-2 px-3 py-2.5 text-[13px]"
                    >
                      <div className="font-medium text-foreground">{item.channelLabel}</div>
                      <div className="text-muted-foreground">{item.typeLabel}</div>
                      <div className="truncate font-mono text-[12px] text-foreground" title={item.value}>
                        {item.value}
                      </div>
                      <div className="text-muted-foreground">
                        {item.verified ? "已验证" : "未验证"}
                      </div>
                      <div className="flex justify-end">
                        {item.deletable && !isSelfEditing ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 px-2 text-destructive hover:text-destructive"
                            disabled={saving || deletingIdentifier}
                            onClick={() => setIdentifierToDelete(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            删除
                          </Button>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">
                            {item.type === "phone" ? "资料维护" : "—"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
        

        <div className="flex flex-col items-end gap-2 pt-3 pb-8 mt-6">
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" className="h-10 px-5" onClick={onBack} disabled={saving}>
              取消
            </Button>
            <Button className="h-10 px-5 bg-foreground text-background hover:bg-foreground/90" onClick={handleSubmit} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? (isCreateMode ? "创建中..." : "保存中...") : (isCreateMode ? "创建用户" : "保存")}
            </Button>
          </div>
        </div>
      </div>
      {!isSelfEditing ? (
        <UserAvatarHistoryDialog
          open={avatarHistoryOpen}
          onOpenChange={setAvatarHistoryOpen}
          onPick={handleAvatarHistoryPick}
        />
      ) : null}
      <UserAvatarCropDialog
        open={avatarCropOpen}
        imageUrl={currentAvatarCropUrl}
        onOpenChange={handleAvatarCropOpenChange}
        onConfirm={handleAvatarCropConfirm}
      />
      <AlertDialog
        open={Boolean(identifierToDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingIdentifier) setIdentifierToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除授权凭证？</AlertDialogTitle>
            <AlertDialogDescription>
              {identifierToDelete
                ? `将删除「${identifierToDelete.channelLabel} / ${identifierToDelete.typeLabel}」凭证。删除后该用户需再次绑定才能通过此渠道关联本账户。${
                    identifierToDelete.channel === "wechat" ? "（微信 OpenID 与 UnionID 将一并解除）" : ""
                  }`
                : "删除后需重新绑定。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingIdentifier}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingIdentifier}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDeleteIdentifier();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingIdentifier ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
