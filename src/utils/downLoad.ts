// utils/download.ts
import { message } from 'antd';

/**
 * 批量下载图片到本地
 * @param urls - 图片网络地址数组
 * @param folderName - 文件夹名称（可选）
 */
export const batchDownloadImages = async (urls: string[], folderName?: string) => {
  if (!urls || urls.length === 0) {
    message.warning('没有可下载的图片');
    return;
  }

  // 过滤无效 URL
  const validUrls = urls.filter(url => url && url.trim() !== '');
  if (validUrls.length === 0) {
    message.warning('没有有效的图片地址');
    return;
  }

  // 显示加载提示
  const loadingMessage = message.loading(`正在准备下载 ${validUrls.length} 张图片...`, 0);

  try {
    // 使用 File System Access API 选择文件夹
    if ('showDirectoryPicker' in window) {
      try {
        // 选择文件夹
        const dirHandle = await (window as any).showDirectoryPicker();
        
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < validUrls.length; i++) {
          const url = validUrls[i];
          try {
            // 获取文件名
            const fileName = url.split('/').pop()?.split('?')[0] || `image_${i + 1}.png`;
            
            // 下载图片
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            
            const blob = await response.blob();
            
            // 创建文件并保存到选择的文件夹
            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            
            successCount++;
          } catch (error) {
            failCount++;
            console.error(`下载图片 ${url} 失败:`, error);
          }
        }

        loadingMessage();
        
        if (failCount === 0) {
          message.success(`✅ 全部 ${successCount} 张图片下载成功！`);
        } else {
          message.warning(`下载完成：成功 ${successCount} 张，失败 ${failCount} 张`);
        }
        
        return { successCount, failCount };
      } catch (error: any) {
        // 用户取消选择文件夹
        if (error.name === 'AbortError' || error.message?.includes('abort')) {
          loadingMessage();
          message.info('已取消下载');
          return { successCount: 0, failCount: 0, cancelled: true };
        }
        // 如果 File System Access API 失败，降级到传统下载方式
        loadingMessage();
        return downloadImagesViaAnchor(validUrls);
      }
    } else {
      // 浏览器不支持 File System Access API，使用传统方式
      loadingMessage();
      return downloadImagesViaAnchor(validUrls);
    }
  } catch (error) {
    loadingMessage();
    console.error('批量下载失败:', error);
    message.error('批量下载失败，请重试');
    return { successCount: 0, failCount: validUrls.length };
  }
};

/**
 * 传统方式：使用 a 标签逐个下载
 */
const downloadImagesViaAnchor = async (urls: string[]): Promise<{ successCount: number; failCount: number }> => {
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const fileName = url.split('/').pop()?.split('?')[0] || `image_${i + 1}.png`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 释放 URL
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      
      successCount++;
    } catch (error) {
      failCount++;
      console.error(`下载图片 ${url} 失败:`, error);
    }
  }

  if (failCount === 0) {
    message.success(`✅ 全部 ${successCount} 张图片下载成功！`);
  } else {
    message.warning(`下载完成：成功 ${successCount} 张，失败 ${failCount} 张`);
  }

  return { successCount, failCount };
};
