import { ArrowLeft, Image as ImageIcon, Images, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Switch } from "@/shared/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
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
import {
  COMPUTE_PACKAGE_CREDIT_TARGET,
  COMPUTE_PACKAGE_CREDIT_TARGET_OPTIONS,
  COMPUTE_PACKAGE_TYPE,
  COMPUTE_PACKAGE_TYPE_OPTIONS,
  createComputePackage,
  getComputePackage,
  isRechargeComputePackageType,
  isRewardComputePackageType,
  normalizeComputePackageType,
  updateComputePackage,
} from "@/shared/api/ops/ops-compute-package";
import FileMaterialPickerDialog from "@/shared/components/FileMaterialPickerDialog";
import { getFileMaterialByHash, uploadFileMaterialForm } from "@/shared/api/materials/materials-file-material";
import { getMerchant, listMerchants, type Merchant } from "@/shared/api/ums/ums-merchant";
import { md5HexFromFile } from "@/shared/lib/md5";
import { getSessionScopeReadyError, useSessionScope, withSessionScope } from "@/shared/hooks/use-session-scope";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "请求失败";
}
import { notify } from "@/shared/lib/notify";

type FormData = {
  name: string;
  description: string;
  coverUrl: string;
  enabled: boolean;
  onlineRecharge: boolean;
  detailContent: string;
  amount: string;
  currency: string;
  computeQuota: string;
  bonusCompute: string;
  validityDays: string;
  packageType: string;
  creditTarget: string;
  exclusiveMerchantId: string;
  isExclusive: boolean;
  sortNo: string;
};

const emptyForm: FormData = {
  name: "",
  description: "",
  coverUrl: "",
  enabled: true,
  onlineRecharge: true,
  detailContent: "",
  amount: "0",
  currency: "CNY",
  computeQuota: "0",
  bonusCompute: "0",
  validityDays: "",
  packageType: COMPUTE_PACKAGE_TYPE.RECHARGE,
  creditTarget: COMPUTE_PACKAGE_CREDIT_TARGET.USER,
  exclusiveMerchantId: "",
  isExclusive: false,
  sortNo: "1",
};

export default function UserPackageEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const sessionScope = useSessionScope();

  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [initialData, setInitialData] = useState<FormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [merchantOptions, setMerchantOptions] = useState<Merchant[]>([]);
  const [merchantLoading, setMerchantLoading] = useState(false);

  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const [iconUploading, setIconUploading] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      setLoading(true);
      getComputePackage(id)
        .then((pkg) => {
          const loadedData: FormData = {
            name: pkg.name,
            description: pkg.description || "",
            coverUrl: pkg.coverUrl || "",
            enabled: pkg.enabled,
            onlineRecharge: pkg.onlineRecharge,
            detailContent: pkg.detailContent || "",
            amount: String(pkg.amount),
            currency: pkg.currency,
            computeQuota: String(pkg.computeQuota),
            bonusCompute: String(pkg.bonusCompute),
            validityDays: pkg.validityDays ? String(pkg.validityDays) : "",
            packageType: normalizeComputePackageType(pkg.packageType),
            creditTarget: pkg.creditTarget || COMPUTE_PACKAGE_CREDIT_TARGET.USER,
            exclusiveMerchantId: pkg.exclusiveMerchantId || "",
            isExclusive: pkg.isExclusive,
            sortNo: String(pkg.sortNo),
          };
          setFormData(loadedData);
          setInitialData(loadedData);
        })
        .catch((err) => {
          notify.error("加载套餐失败", { description: err.message });
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id, isEdit]);

  useEffect(() => {
    let active = true;

    const loadMerchants = async () => {
      if (!formData.isExclusive && !formData.exclusiveMerchantId) {
        return;
      }
      setMerchantLoading(true);
      try {
        const response = await listMerchants({ pageNo: 1, pageSize: 200 });
        const items = response.items || [];
        const selectedMerchantId = formData.exclusiveMerchantId.trim();
        if (selectedMerchantId && !items.some((item) => item.id === selectedMerchantId)) {
          try {
            const merchant = await getMerchant(selectedMerchantId);
            if (active) {
              setMerchantOptions([...items, merchant]);
            }
            return;
          } catch {
            // Ignore detail lookup failure and keep the base list available.
          }
        }
        if (active) {
          setMerchantOptions(items);
        }
      } catch (err) {
        if (active) {
          notify.error("加载商户列表失败", { description: err instanceof Error ? err.message : "请求失败" });
        }
      } finally {
        if (active) {
          setMerchantLoading(false);
        }
      }
    };

    void loadMerchants();

    return () => {
      active = false;
    };
  }, [formData.isExclusive, formData.exclusiveMerchantId]);

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormError(null);
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePackageTypeChange = (packageType: string) => {
    setFormData((prev) => {
      if (isRechargeComputePackageType(packageType)) {
        return {
          ...prev,
          packageType,
          creditTarget: prev.creditTarget || COMPUTE_PACKAGE_CREDIT_TARGET.USER,
        };
      }
      return {
        ...prev,
        packageType,
        amount: "0",
        onlineRecharge: isRewardComputePackageType(packageType) ? false : prev.onlineRecharge,
        creditTarget: COMPUTE_PACKAGE_CREDIT_TARGET.USER,
      };
    });
  };

  const isFormDirty = () => {
    return JSON.stringify(formData) !== JSON.stringify(initialData);
  };

  const handleIconLocalUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const uploadBlockReason = getSessionScopeReadyError(sessionScope);
    if (uploadBlockReason) {
      notify.error("上传暂不可用", { description: uploadBlockReason });
      return;
    }
    setIconUploading(true);
    try {
      const fileHash = await md5HexFromFile(file);
      const existing = await getFileMaterialByHash(withSessionScope(sessionScope.scope, { fileHash }));
      const material = existing ?? (await uploadFileMaterialForm(withSessionScope(sessionScope.scope, { file, fileType: "image", fileHash }))).file;
      updateField("coverUrl", (material.accessUrl || "").trim());
    } catch (err) {
      notify.error("上传失败", { description: err instanceof Error ? err.message : "请求失败" });
    } finally {
      setIconUploading(false);
      if (iconInputRef.current) iconInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setFormError("请输入套餐名称");
      return;
    }
    if (!formData.amount || Number(formData.amount) < 0) {
      setFormError("购买金额不能小于0");
      return;
    }
    if (!formData.currency) {
      setFormError("请选择货币类型");
      return;
    }
    if (formData.isExclusive && !formData.exclusiveMerchantId.trim()) {
      setFormError("请选择专属商户");
      return;
    }
    if (Number(formData.computeQuota) < 0) {
      setFormError("到账额度不能小于0");
      return;
    }
    if (Number(formData.bonusCompute) < 0) {
      setFormError("赠送额度不能小于0");
      return;
    }
    if (Number(formData.computeQuota) + Number(formData.bonusCompute) <= 0) {
      setFormError("到账额度与赠送额度之和必须大于0");
      return;
    }
    if (isRechargeComputePackageType(formData.packageType) && Number(formData.amount) <= 0) {
      setFormError("充值套餐的购买金额必须大于0");
      return;
    }
    if (isRewardComputePackageType(formData.packageType) && Number(formData.amount) !== 0) {
      setFormError("奖励类套餐的购买金额必须为0");
      return;
    }
    if (isRewardComputePackageType(formData.packageType) && formData.onlineRecharge) {
      setFormError("奖励类套餐不能开启线上充值");
      return;
    }
    if (isRechargeComputePackageType(formData.packageType) && !formData.creditTarget) {
      setFormError("请选择入账目标");
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        coverUrl: formData.coverUrl,
        enabled: formData.enabled,
        onlineRecharge: formData.onlineRecharge,
        detailContent: formData.detailContent,
        amount: Number(formData.amount),
        currency: formData.currency,
        computeQuota: Number(formData.computeQuota),
        bonusCompute: Number(formData.bonusCompute),
        validityDays: formData.validityDays ? Number(formData.validityDays) : null,
        packageType: formData.packageType,
        creditTarget: isRechargeComputePackageType(formData.packageType) ? formData.creditTarget : null,
        exclusiveMerchantId: formData.isExclusive ? formData.exclusiveMerchantId : null,
        isExclusive: formData.isExclusive,
        sortNo: Number(formData.sortNo),
      };

      if (isEdit && id) {
        await updateComputePackage(id, payload);
      } else {
        await createComputePackage(payload);
      }
      navigate("/ops/user-packages");
    } catch (err: unknown) {
      notify.error("保存失败", { description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (isFormDirty()) {
      setCancelDialogOpen(true);
    } else {
      navigate("/ops/user-packages");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">加载中...</div>;
  }

  const isRechargePackage = isRechargeComputePackageType(formData.packageType);

  return (
    <div className="page-content-shell">
      <div className="subpage-toolbar mb-7">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-[18px] font-semibold text-foreground">
            {isEdit ? "编辑套餐" : "新增用户套餐"}
          </h1>
        </div>
      </div>

      <div className="w-full max-w-[1000px] mx-auto space-y-8 pb-12">
        {/* Row 1: 套餐名称 & 套餐描述 */}
        <div className="grid grid-cols-2 gap-8">
          <div>
            <label className="text-sm mb-2 font-normal block">
              <span className="text-destructive mr-1">*</span>套餐名称
            </label>
            <Input
              placeholder="输入套餐名称"
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm mb-2 font-normal block">
              套餐描述
            </label>
            <Input
              placeholder="输入套餐描述"
              value={formData.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </div>
        </div>

        {/* Row 2: 套餐封面 & 启停配置 */}
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-sm mb-2 font-normal block">套餐封面</label>
            <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleIconLocalUpload(e.target.files)} />
            <div className="rounded-lg border border-dashed border-border p-4">
              <div className="flex flex-col md:flex-row gap-4 md:items-center">
                <div className="w-[140px] h-[100px] rounded-md overflow-hidden bg-muted/40 border border-border flex items-center justify-center shrink-0">
                  {(formData.coverUrl || "").trim() ? <img src={formData.coverUrl} alt="套餐封面" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button type="button" variant="outline" onClick={() => iconInputRef.current?.click()} disabled={iconUploading}>
                    <ImageIcon className="w-4 h-4 mr-1" />
                    {iconUploading ? "上传中..." : "本地上传"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIconPickerOpen(true)} disabled={iconUploading}>
                    <Images className="w-4 h-4 mr-1" />
                    从图库选择
                  </Button>
                  {!!formData.coverUrl.trim() && (
                    <Button type="button" variant="ghost" onClick={() => updateField("coverUrl", "")}>
                      清除
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">套餐封面图片，用于在充值页面展示</p>
          </div>
          <div className="space-y-6">
            <div>
              <label className="text-sm mb-2 font-normal block">
                启用
              </label>
              <div className="h-10 flex items-center">
                <Switch
                  checked={formData.enabled}
                  onCheckedChange={(v) => updateField("enabled", v)}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">关闭后套餐不会参与注册赠送、登录活动等自动发放场景</p>
            </div>
            <div>
              <label className="text-sm mb-2 font-normal block">
                启用线上充值
              </label>
              <div className="h-10 flex items-center">
                <Switch
                  checked={formData.onlineRecharge}
                  onCheckedChange={(v) => updateField("onlineRecharge", v)}
                />
              </div>
            </div>
          </div>
        </div>

  {/* Row 7: 套餐类型 & 专属组织 */}
        <div className="grid grid-cols-2 gap-8">
          <div>
            <label className="text-sm mb-2 font-normal block">
              套餐类型
            </label>
            <Select value={formData.packageType} onValueChange={handlePackageTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPUTE_PACKAGE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1.5">
              注册赠送与登录活动仅使用到账额度与赠送额度。
            </p>
          </div>
          {isRechargePackage && (
            <div>
              <label className="text-sm mb-2 font-normal block">
                <span className="text-destructive mr-1">*</span>入账目标
              </label>
              <Select
                value={formData.creditTarget}
                onValueChange={(value) => updateField("creditTarget", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPUTE_PACKAGE_CREDIT_TARGET_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1.5">
                个人入用户账户，门店入门店账户，商户入商户账户（编码对齐 FundAccountType：user/store/merchant）。
              </p>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="text-sm mb-2 font-normal block">
                是否专属组织
              </label>
              <div className="h-10 flex items-center">
                <Switch
                  checked={formData.isExclusive}
                  onCheckedChange={(v) => updateField("isExclusive", v)}
                />
              </div>
            </div>
            {formData.isExclusive && (
              <div>
                <label className="text-sm mb-2 font-normal block">
                  <span className="text-destructive mr-1">*</span>专属商户
                </label>
                <Select
                  value={formData.exclusiveMerchantId}
                  onValueChange={(value) => updateField("exclusiveMerchantId", value)}
                  disabled={merchantLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={merchantLoading ? "加载商户中..." : "请选择专属商户"} />
                  </SelectTrigger>
                  <SelectContent>
                    {merchantOptions.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id}>
                        {merchant.name || merchant.code || merchant.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  专属套餐仅对所选商户下的组织开放
                </p>
              </div>
            )}
          </div>
        </div>
        
        {isRechargePackage && (
          <div className="grid grid-cols-2 gap-8">
            <div>
              <label className="text-sm mb-2 font-normal block">
                <span className="text-destructive mr-1">*</span>购买金额（单位为分）
              </label>
              <Input
                type="number"
                placeholder="0"
                value={formData.amount}
                onChange={(e) => updateField("amount", e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                仅表示购买价格；最终到账不使用该字段，奖励类套餐默认固定为 0。
              </p>
            </div>
            <div>
              <label className="text-sm mb-2 font-normal block">
                <span className="text-destructive mr-1">*</span>货币
              </label>
              <Select value={formData.currency} onValueChange={(v) => updateField("currency", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择货币" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNY">CNY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Row 5: 到账额度（分） & 赠送额度（分） */}
        <div className="grid grid-cols-2 gap-8">
          <div>
            <label className="text-sm mb-2 font-normal block">
              <span className="text-destructive mr-1">*</span>到账额度（单位：分）
            </label>
            <Input
              type="number"
              placeholder="0"
              value={formData.computeQuota}
              onChange={(e) => updateField("computeQuota", e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1.5">实际入账到账户的基础额度，单位统一为分。</p>
          </div>
          <div>
            <label className="text-sm mb-2 font-normal block">
              赠送额度（单位：分）
            </label>
            <Input
              type="number"
              placeholder="0"
              value={formData.bonusCompute}
              onChange={(e) => updateField("bonusCompute", e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1.5">额外赠送的奖励额度，单位统一为分，不计入购买金额。</p>
          </div>
        </div>

        {/* Row 6: 算力额度有效期(天) & 排序 */}
        <div className="grid grid-cols-2 gap-8">
          <div>
            <label className="text-sm mb-2 font-normal block">
              到账额度有效期(天)
            </label>
            <Input
              type="number"
              placeholder="留空表示无限制"
              value={formData.validityDays}
              onChange={(e) => updateField("validityDays", e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1.5">到账额度与赠送额度的有效期，单位：天。</p>
          </div>
          <div>
            <label className="text-sm mb-2 font-normal block">
              排序
            </label>
            <Input
              type="number"
              placeholder="1"
              value={formData.sortNo}
              onChange={(e) => updateField("sortNo", e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1.5">数字越小越靠前</p>
          </div>
        </div>
        {/* Row 3: 套餐详情 */}
        <div>
          <label className="text-sm mb-2 font-normal block">
            套餐详情
          </label>
          <Textarea
            placeholder="输入套餐详情"
            rows={3}
            value={formData.detailContent}
            onChange={(e) => updateField("detailContent", e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1.5">套餐具体包含的详情内容，自动按行处理为不同的项目</p>
        </div>

        {/* Footer: Cancel & Save buttons */}
        <div className="flex flex-col items-end gap-2 pt-8 border-t">
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={handleBack} disabled={saving}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </div>

      <FileMaterialPickerDialog open={iconPickerOpen} onOpenChange={setIconPickerOpen} title="选择套餐封面" fileType="image" onPick={(url) => updateField("coverUrl", url)} />

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消</AlertDialogTitle>
            <AlertDialogDescription>
              您已修改部分内容，确定要放弃保存吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/ops/user-packages")}>确认放弃</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
