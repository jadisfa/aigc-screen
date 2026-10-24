// DownLoadButtonHover.tsx
import React, { forwardRef, useState, useCallback } from 'react';
import { Modal, Switch, Button, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import "@/assets/css/scss/workflow-common.scss";

interface WatermarkDownloadSetting {
  removeWatermark: boolean;
  agreed: boolean;
  updatedAt?: number;
}

interface DownLoadButtonHoverProps {
  output: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const WATERMARK_SETTING_KEY = 'AI_WATERMARK_DOWNLOAD_SETTING';

const DownLoadButtonHover = forwardRef<HTMLDivElement, DownLoadButtonHoverProps>(
  ({ output, className = '', style = {}, children }, ref) => {
    const [showWatermarkSettingDialog, setShowWatermarkSettingDialog] = useState(false);
    const [removeWatermarkSwitch, setRemoveWatermarkSwitch] = useState(false);
    const [pendingDownloadUrl, setPendingDownloadUrl] = useState('');

    /**
     * 从 URL / 响应头中提取用于下载的文件名
     */
    const stripWatermarkSuffix = (value: string) => value.replace(/([._-]watermark=0)$/i, '');

    const sanitizeFilename = (value: string) =>
      stripWatermarkSuffix(decodeURIComponent(value).split('?')[0].split('#')[0]);

    const getFilenameFromContentDisposition = (value: string | null) => {
      if (!value) return null;
      const utf8Matched = value.match(/filename\*=UTF-8''([^;]+)/i);
      if (utf8Matched?.[1]) {
        return sanitizeFilename(utf8Matched[1]);
      }
      const plainMatched = value.match(/filename="?([^"]+)"?/i);
      if (plainMatched?.[1]) {
        return sanitizeFilename(plainMatched[1]);
      }
      return null;
    };

    const extractFilename = (url: string, contentDisposition?: string | null) => {
      const headerFilename = getFilenameFromContentDisposition(contentDisposition ?? null);
      if (headerFilename) return headerFilename;

      try {
        const parsedUrl = new URL(url, window.location.origin);
        const queryFilename =
          parsedUrl.searchParams.get('filename') ||
          parsedUrl.searchParams.get('file') ||
          parsedUrl.searchParams.get('name');
        if (queryFilename) {
          return sanitizeFilename(queryFilename);
        }
        const pathname = parsedUrl.pathname.split('/').pop();
        if (pathname) {
          return sanitizeFilename(pathname);
        }
      } catch {
        // ignore and fallback
      }

      const fallback = url.substring(url.lastIndexOf('/') + 1);
      return fallback ? sanitizeFilename(fallback) : null;
    };

    /**
     * 下载 - 修复跨域问题
     */
    const handleDownload = useCallback((fileUrl: string) => {
      // 方法1: 直接使用 a 标签下载（最简单，避免跨域）
      const downloadWithAnchor = () => {
        const anchor = document.createElement('a');
        anchor.href = fileUrl;
        // 尝试提取文件名
        const fileName = extractFilename(fileUrl) || fileUrl.substring(fileUrl.lastIndexOf('/') + 1);
        anchor.download = fileName;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        // console.log('下载已开始（a标签方式）');
      };

      // 尝试使用 fetch 下载（适用于需要修改 URL 参数的情况）
      fetch(fileUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Accept': '*/*',
        },
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const blob = await response.blob();
          const contentDisposition = response.headers.get('content-disposition');
          // 创建一个 Blob URL
          const blobUrl = URL.createObjectURL(blob);

          // 创建一个 a 标签，用于触发下载
          const anchor = document.createElement('a');

          const fileName =
            extractFilename(fileUrl, contentDisposition) ||
            fileUrl.substring(fileUrl.lastIndexOf('/') + 1);

          // 设置 href 为 Blob URL
          anchor.href = blobUrl;

          // 设置 download 属性以强制下载
          anchor.download = fileName;

          // 隐藏 a 标签并将其添加到文档
          anchor.style.display = 'none';
          document.body.appendChild(anchor);
          // 触发下载
          anchor.click();
          // 下载完成后移除 a 标签，并释放 Blob URL
          document.body.removeChild(anchor);
          URL.revokeObjectURL(blobUrl);
          
          message.success('下载成功');
        })
        .catch((error) => {
        //   console.error('Fetch 下载失败，使用 a 标签下载:', error);
          // ❌ fetch 失败时，使用 a 标签直接下载（降级方案）
          downloadWithAnchor();
        });
    }, []);

    const getSavedWatermarkSetting = useCallback((): WatermarkDownloadSetting => {
      if (typeof window === 'undefined') {
        return { removeWatermark: false, agreed: false };
      }
      try {
        const raw = localStorage.getItem(WATERMARK_SETTING_KEY);
        if (!raw) return { removeWatermark: false, agreed: false };
        const parsed = JSON.parse(raw) as Partial<WatermarkDownloadSetting>;
        return {
          removeWatermark: Boolean(parsed.removeWatermark),
          agreed: Boolean(parsed.agreed),
          updatedAt: parsed.updatedAt,
        };
      } catch {
        return { removeWatermark: false, agreed: false };
      }
    }, []);

    const saveWatermarkSetting = useCallback((setting: WatermarkDownloadSetting) => {
      if (typeof window === 'undefined') return;
      localStorage.setItem(WATERMARK_SETTING_KEY, JSON.stringify(setting));
    }, []);

    const buildNoWatermarkUrl = useCallback((originUrl: string) => {
      if (typeof window === 'undefined') return originUrl;
      try {
        const url = new URL(originUrl, window.location.origin);
        url.searchParams.set('watermark', '0');
        return url.toString();
      } catch {
        return originUrl;
      }
    }, []);

    const handleDownloadNoWatermark = useCallback(async (fileUrl: string) => {
      const noWatermarkUrl = buildNoWatermarkUrl(fileUrl);
      // 直接调用 handleDownload，它会自动处理跨域
      handleDownload(noWatermarkUrl);
    }, [buildNoWatermarkUrl, handleDownload]);

    const getMediaInfoFromUrl = useCallback((url: string) => {
      // 简单判断文件类型
      const extension = url.split('.').pop()?.toLowerCase() || '';
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'];
      const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
      const audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'flac'];

      if (imageExtensions.includes(extension)) {
        return { fileType: 'image' as const };
      }
      if (videoExtensions.includes(extension)) {
        return { fileType: 'video' as const };
      }
      if (audioExtensions.includes(extension)) {
        return { fileType: 'audio' as const };
      }
      return { fileType: 'other' as const };
    }, []);

    const handleClickDownload = useCallback(async (fileUrl: string) => {
      localStorage.removeItem(WATERMARK_SETTING_KEY)
      const { fileType } = getMediaInfoFromUrl(fileUrl);
      const isImage = fileType === 'image';

      if (!isImage) {
        handleDownload(fileUrl);
        return;
      }

      const setting = getSavedWatermarkSetting();
      if (!setting.agreed || !setting.removeWatermark) {
        setPendingDownloadUrl(fileUrl);
        setRemoveWatermarkSwitch(setting.removeWatermark);
        setShowWatermarkSettingDialog(true);
        return;
      }

      await handleDownloadNoWatermark(fileUrl);
    }, [getMediaInfoFromUrl, handleDownload, getSavedWatermarkSetting, handleDownloadNoWatermark]);

    const handleConfirmSetting = useCallback(async () => {
      saveWatermarkSetting({
        removeWatermark: removeWatermarkSwitch,
        agreed: true,
        updatedAt: Date.now(),
      });
      setShowWatermarkSettingDialog(false);

      if (!removeWatermarkSwitch || !pendingDownloadUrl) {
        return;
      }
      await handleDownloadNoWatermark(pendingDownloadUrl);
      setPendingDownloadUrl('');
    }, [removeWatermarkSwitch, pendingDownloadUrl, saveWatermarkSetting, handleDownloadNoWatermark]);

    return (
      <div
        ref={ref}
        className={`download-button-hover ${className}`}
        style={style}
      >
        {/* 悬浮下载按钮 */}
        <div
          className="p-2 rounded cursor-pointer inline-flex items-center gap-1"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClickDownload(output);
          }}
          style={{
            backgroundColor: '#7d33ff',
            color: 'white',
            transition: 'background-color 0.3s ease',
          }}
        >
          {children || <DownloadOutlined style={{ fontSize: '16px' }} />}
        </div>

        {/* 水印设置弹窗 */}
        <Modal
          open={showWatermarkSettingDialog}
          footer={null}
          width={760}
          centered
          onCancel={() => {
            setShowWatermarkSettingDialog(false);
             localStorage.removeItem(WATERMARK_SETTING_KEY)
          }}
          className="ai-watermark-setting-modal ndmy-custom-modal"
        >
          <div className="ai-watermark-setting-modal__content">
            <div className="ai-watermark-setting-modal__title" style={{ fontSize: '22px', fontWeight: 600, marginBottom: '14px' }}>
              AI生成水印设置
            </div>
            <p className="ai-watermark-setting-modal__desc" style={{ fontSize: '14px', lineHeight: 1.8, color: 'rgba(0,0,0,0.75)', marginBottom: '12px' }}>
              根据法律法规要求，本平台（"平台"）提供AI生成合成服务，可能导致公众混淆或者误认的，
              平台应当在AI生成合成内容上添加显式标识（即"AI生成"明水印），向公众进行提示。
              经过您的申请，平台可以向您提供未添加显式标识的AI生成合成内容。如您后续使用网络信息内容传播服务发布AI生成合成内容，
              请注意您还需主动声明并使用传播平台提供的标识功能进行标识。您理解并承诺，如您未按照法律法规要求在AI生成合成内容上添加显式标识，
              导致公众混淆或者误认，因此所发生的后果和责任均由您自行承担。
            </p>
            <p className="ai-watermark-setting-modal__desc" style={{ fontSize: '14px', lineHeight: 1.8, color: 'rgba(0,0,0,0.75)', marginBottom: '12px' }}>
              打开去除水印开关后，您下载的图片将不再添加"AI生成"明水印，但仍可能保留品牌水印和数字水印。
            </p>
            <div className="ai-watermark-setting-modal__switch-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 500, marginTop: '14px' }}>
              <Switch
                checked={removeWatermarkSwitch}
                onChange={setRemoveWatermarkSwitch}
                className='ndmy-custom-switch'
              />
              <span>去除水印</span>
            </div>
            <div className="ai-watermark-setting-modal__hint" style={{ marginTop: '6px', fontSize: '13px', color: 'rgba(0,0,0,0.65)' }}>
              打开开关并点击保存设置，代表您已确认充分了解上述情况并同意。
            </div>
            <div className="ai-watermark-setting-modal__actions" style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="primary"
                disabled={!removeWatermarkSwitch}
                onClick={handleConfirmSetting}
                className='bg-[#7d33ff] hover:!bg-[#7d33ff]'
              >
                同意并保存
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }
);

DownLoadButtonHover.displayName = 'DownLoadButtonHover';

export default DownLoadButtonHover;