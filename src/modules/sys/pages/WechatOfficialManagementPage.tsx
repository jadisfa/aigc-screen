import { Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, PageShell } from "@/shared/components/page";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import {
  createWechatMpConfig,
  listWechatMpConfigs,
  updateWechatMpConfig,
  type WechatMpConfig,
} from "@/shared/api/sys/system-config";
import { notify } from "@/shared/lib/notify";

const WechatOfficialManagement = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [existingAppId, setExistingAppId] = useState<string>("");
  const [hasSecret, setHasSecret] = useState(false);

  type FormState = {
    appId: string;
    enabled: boolean;
    secret: string;
    prompt: string;
    textToImageKeyword: string;
    imageToImageKeyword: string;
    imageToVideoKeyword: string;
    textToImageWorkflow: string;
    imageToImageWorkflow: string;
    imageToVideoWorkflow: string;
    uploadImagePrompt: string;
    startDrawingPrompt: string;
    aiChatWaitPrompt: string;
  };

  type FormStringKey = Exclude<keyof FormState, "enabled">;

  const [form, setForm] = useState<FormState>({
    appId: "",
    enabled: true,
    secret: "",
    prompt: "",
    textToImageKeyword: "",
    imageToImageKeyword: "",
    imageToVideoKeyword: "",
    textToImageWorkflow: "",
    imageToImageWorkflow: "",
    imageToVideoWorkflow: "",
    uploadImagePrompt: "",
    startDrawingPrompt: "",
    aiChatWaitPrompt: "",
  });

  const secretPlaceholder = useMemo(() => {
    if (hasSecret) return "已配置（不回显，留空表示不更新）";
    return "保存后不回显";
  }, [hasSecret]);

  const update = (key: FormStringKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const loadToForm = useCallback((item: WechatMpConfig) => {
    setHasSecret(!!item.hasSecret);
    setForm({
      appId: item.appId || "",
      enabled: !!item.enabled,
      secret: "",
      prompt: item.qaPrompt || "",
      textToImageKeyword: item.kwTxt2img || "",
      imageToImageKeyword: item.kwImg2img || "",
      imageToVideoKeyword: item.kwImg2video || "",
      textToImageWorkflow: item.wfTxt2img || "",
      imageToImageWorkflow: item.wfImg2img || "",
      imageToVideoWorkflow: item.wfImg2video || "",
      uploadImagePrompt: item.msgUploadImage || "",
      startDrawingPrompt: item.msgTaskWait || "",
      aiChatWaitPrompt: item.msgChatWait || "",
    });
  }, []);

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listWechatMpConfigs();
      const first = res[0] || null;
      if (first) {
        setExistingAppId(first.appId);
        loadToForm(first);
      } else {
        setExistingAppId("");
        setHasSecret(false);
        setForm({
          appId: "",
          enabled: true,
          secret: "",
          prompt: "",
          textToImageKeyword: "",
          imageToImageKeyword: "",
          imageToVideoKeyword: "",
          textToImageWorkflow: "",
          imageToImageWorkflow: "",
          imageToVideoWorkflow: "",
          uploadImagePrompt: "",
          startDrawingPrompt: "",
          aiChatWaitPrompt: "",
        });
      }
    } catch (e) {
      notify.error("加载失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setLoading(false);
    }
  }, [loadToForm]);

  const handleSave = async () => {
    if (saving) return;
    if (!form.appId.trim()) {
      setFormError("请填写 APPID");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      if (existingAppId) {
        await updateWechatMpConfig(existingAppId, {
          enabled: form.enabled,
          secretEnc: form.secret || undefined,
          clearSecret: false,
          qaPrompt: form.prompt || undefined,
          kwTxt2img: form.textToImageKeyword || undefined,
          kwImg2img: form.imageToImageKeyword || undefined,
          kwImg2video: form.imageToVideoKeyword || undefined,
          wfTxt2img: form.textToImageWorkflow || undefined,
          wfImg2img: form.imageToImageWorkflow || undefined,
          wfImg2video: form.imageToVideoWorkflow || undefined,
          msgUploadImage: form.uploadImagePrompt || undefined,
          msgTaskWait: form.startDrawingPrompt || undefined,
          msgChatWait: form.aiChatWaitPrompt || undefined,
        });
      } else {
        await createWechatMpConfig({
          appId: form.appId.trim(),
          enabled: true,
          secretEnc: form.secret || undefined,
          qaPrompt: form.prompt || undefined,
          kwTxt2img: form.textToImageKeyword || undefined,
          kwImg2img: form.imageToImageKeyword || undefined,
          kwImg2video: form.imageToVideoKeyword || undefined,
          wfTxt2img: form.textToImageWorkflow || undefined,
          wfImg2img: form.imageToImageWorkflow || undefined,
          wfImg2video: form.imageToVideoWorkflow || undefined,
          msgUploadImage: form.uploadImagePrompt || undefined,
          msgTaskWait: form.startDrawingPrompt || undefined,
          msgChatWait: form.aiChatWaitPrompt || undefined,
        });
      }
      notify.success("保存成功");
      await refreshList();
    } catch (e) {
      notify.error("保存失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setSaving(false);
    }
  };

  const fields: {
    key: FormStringKey;
    label: string;
    type: "input" | "textarea";
    placeholder?: string;
    description?: string;
    col?: "left" | "right";
  }[] = [
    { key: "appId", label: "APPID", type: "input", placeholder: "", description: "微信公众号APPID，微信公众平台获取,仅启用公众号登录，只需要配置APPID和SECRET", col: "left" },
    { key: "secret", label: "SECRET", type: "input", placeholder: secretPlaceholder, description: "微信公众号SECRET，微信公众平台获取，仅启用公众号登录，只需要配置APPID和SECRET", col: "right" },
    { key: "prompt", label: "公众号问答预设提示词", type: "textarea", description: "预设提示词将会被添加到每次对话的开头，特别注意：微信返回消息长度有限制，因此需要通过预设提示词限制AI回复的长度", col: "left" },
    { key: "textToImageKeyword", label: "文生图模式触发关键词", type: "input", description: "如果对话开头包含设置的关键词，则会触发相应的模式，默认为聊天模式", col: "right" },
    { key: "imageToImageKeyword", label: "图生图模式触发关键词", type: "input", description: "同文生图", col: "left" },
    { key: "imageToVideoKeyword", label: "图生视频模式触发关键词", type: "input", description: "同文生图", col: "right" },
    { key: "textToImageWorkflow", label: "文生图工作流名称", type: "input", description: "微信公众号文生图默认调用的工作流name，注意不是标题！！！，支持自定义工作流，工作流必须有配置正向提示词参数输入，因公众号绘图只能输入一个参数，因此其他参数需要有默认值", col: "left" },
    { key: "imageToImageWorkflow", label: "图生图工作流名称", type: "input", description: "微信公众号图生图默认调用的工作流name，注意不是标题！！！，支持自定义工作流，工作流必须有配置图像上传1作为图像参数输入，因公众号绘图只能输入一个参数，因此其他参数需要有默认值", col: "right" },
    { key: "imageToVideoWorkflow", label: "图生视频工作流名称", type: "input", description: "同图生图", col: "left" },
    { key: "uploadImagePrompt", label: "提示用户上传图片", type: "input", col: "right" },
    { key: "startDrawingPrompt", label: "开始绘图任务提示", type: "input", col: "left" },
    { key: "aiChatWaitPrompt", label: "AI聊天等待提示", type: "input", col: "right" },
  ];

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  return (
    <PageShell>
      <PageHeader title="公众号配置" />
      <div className="w-full max-w-[1000px] mx-auto">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          {fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <label className="text-sm font-normal">
                {field.label}
              </label>
              {field.type === "textarea" ? (
                <Textarea
                  value={form[field.key]}
                  onChange={(e) => update(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="min-h-[80px]"
                />
              ) : (
                <Input
                  value={form[field.key]}
                  onChange={(e) => update(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  type={field.key === "secret" ? "password" : "text"}
                  disabled={field.key === "appId" && !!existingAppId}
                />
              )}
              {field.description && (
                <p className="text-xs text-muted-foreground">{field.description}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-1">
          <p className="text-sm font-normal text-foreground">特别说明</p>
          <div className="text-xs text-destructive space-y-0.5">
            <p>1. 微信公众号接入和微信公众号登录需要录入微信公众号后台：微信公众平台→设置与开发→开发接口管理→服务器配置，服务器地址为：https://demo.naiduAI.com/api/wechatauth/handleMessage，令牌随意填写，密钥随机生成，消息加密方式选择明文模式，最后将状态设置为启用，并在IP白名单中将服务器IP地址添加进去。</p>
            <p>2. 微信公众号需要认证，且具有客服接口权限</p>
            <p>3. 如果绘图成功不返图，且确认是否有客服接口权限，另外检查微信公众平台后台的白名单设置（设置以后生效有延迟）</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-end gap-2">
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <Button variant="page" onClick={handleSave} disabled={saving || loading}>
            <Save className="w-4 h-4 mr-1" />
            保存
          </Button>
        </div>
      </div>
    </PageShell>
  );
};


export default WechatOfficialManagement;
