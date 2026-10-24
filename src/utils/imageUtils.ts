/**
 * 图片处理工具函数
 */

import { getImageSize, getImageFileSize } from './FileUtils'

/**
 * 图片压缩配置选项
 */
export interface ImageCompressOptions {
  maxSize?: number // MB（如果存在且图片超出则压缩）
  maxWidth?: number // 像素（如果存在且图片超出则压缩）
  maxHeight?: number // 像素（如果存在且图片超出则压缩）
  quality?: number // 0-1，默认0.85
}

/**
 * 压缩图片文件
 * @param file 原始图片文件
 * @param options 压缩配置选项
 * @returns 压缩后的File对象，如果不需要压缩则返回原文件
 */
export const compressImage = async (
  file: File,
  options: ImageCompressOptions = {}
): Promise<File> => {
  // 判断文件是否为图片
  if (!file.type.startsWith('image')) {
    return file
  }

  const { maxSize, maxWidth, maxHeight, quality = 0.85 } = options

  // 如果没有配置任何限制，直接返回原文件
  if (!maxSize && !maxWidth && !maxHeight) {
    return file
  }

  try {
    // 读取图片尺寸和文件大小
    const imageUrl = URL.createObjectURL(file)
    const { width, height } = await getImageSize(imageUrl)
    URL.revokeObjectURL(imageUrl)

    const fileSizeMB = file.size / (1024 * 1024)

    // 判断是否需要压缩
    const needResize = (maxWidth && width > maxWidth) || (maxHeight && height > maxHeight)
    const needCompress = maxSize && fileSizeMB > maxSize

    // 如果不需要压缩，返回原文件
    if (!needResize && !needCompress) {
      return file
    }

    // 创建图片对象
    const img = new Image()
    img.src = URL.createObjectURL(file)

    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })

    // 计算目标尺寸（如果需要缩放）
    let targetWidth = width
    let targetHeight = height

    if (needResize) {
      let scale = 1
      if (maxWidth && width > maxWidth) {
        scale = Math.min(scale, maxWidth / width)
      }
      if (maxHeight && height > maxHeight) {
        scale = Math.min(scale, maxHeight / height)
      }
      targetWidth = Math.round(width * scale)
      targetHeight = Math.round(height * scale)
    }

    // 创建Canvas进行压缩
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('无法创建Canvas上下文')
    }

    // 绘制图片到Canvas
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
    URL.revokeObjectURL(img.src)

    // 转换为Blob，使用用户指定的质量（不继续降低质量）
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => {
        resolve(b || new Blob())
      }, 'image/jpeg', quality)
    })

    // 如果体积仍超限，抛出错误（不再继续降低质量）
    if (maxSize) {
      const maxSizeBytes = maxSize * 1024 * 1024
      if (blob.size > maxSizeBytes) {
        throw new Error(`图片压缩后仍超出大小限制: ${(blob.size / (1024 * 1024)).toFixed(2)}MB > ${maxSize}MB`)
      }
    }

    // 将Blob转换为File对象
    const fileName = file.name.replace(/\.[^.]+$/, '.jpg')
    const compressedFile = new File([blob], fileName, {
      type: 'image/jpeg',
      lastModified: Date.now()
    })

    return compressedFile
  } catch (error) {
    console.error('图片压缩失败:', error)
    // 压缩失败时返回原文件
    return file
  }
}

/**
 * 从URL加载并压缩图片
 * @param url 图片URL
 * @param options 压缩配置选项
 * @returns 压缩后的File对象，如果不需要压缩则返回原URL字符串
 */
export const compressImageFromUrl = async (
  url: string,
  options: ImageCompressOptions = {}
): Promise<File | string> => {
  const { maxSize, maxWidth, maxHeight } = options

  // 如果没有配置任何限制，直接返回URL
  if (!maxSize && !maxWidth && !maxHeight) {
    return url
  }

  try {
    // 先检查图片尺寸和大小，判断是否需要压缩
    const { width, height } = await getImageSize(url)

    // 尝试获取文件大小（可能因为跨域等原因失败）
    let fileSizeMB = 0
    try {
      const fileSizeBytes = await getImageFileSize(url)
      fileSizeMB = fileSizeBytes / (1024 * 1024)
    } catch (error) {
      // 如果无法获取文件大小，假设需要检查（保守策略）
      console.warn('无法获取图片文件大小，将进行压缩检查:', error)
    }

    // 判断是否需要压缩
    const needResize = (maxWidth && width > maxWidth) || (maxHeight && height > maxHeight)
    const needCompress = maxSize && fileSizeMB > maxSize

    // 如果不需要压缩，直接返回URL
    if (!needResize && !needCompress) {
      return url
    }

    // 需要压缩，下载图片
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`无法下载图片: ${response.statusText}`)
    }

    const blob = await response.blob()
    const file = new File([blob], 'image.jpg', { type: blob.type })

    // 使用compressImage进行压缩
    return await compressImage(file, options)
  } catch (error) {
    console.error('从URL压缩图片失败:', error)
    // 如果压缩失败，返回原URL（避免阻塞流程）
    return url
  }
}

/**
 * 检查图片并压缩（如果需要）
 * @param file 原始图片文件
 * @param options 压缩配置选项
 * @returns 压缩后的File对象，如果不需要压缩则返回原文件
 * @throws 如果压缩后仍超出限制，抛出错误
 */
export const checkAndCompressImage = async (
  file: File,
  options: ImageCompressOptions = {}
): Promise<File> => {
  // 判断文件是否为图片
  if (!file.type.startsWith('image')) {
    return file
  }

  const { maxSize, maxWidth, maxHeight } = options

  // 如果没有配置任何限制，直接返回原文件
  if (!maxSize && !maxWidth && !maxHeight) {
    return file
  }

  // 读取图片尺寸和文件大小
  const imageUrl = URL.createObjectURL(file)
  const { width, height } = await getImageSize(imageUrl)
  URL.revokeObjectURL(imageUrl)

  const fileSizeMB = file.size / (1024 * 1024)

  // 判断是否需要压缩
  const needResize = (maxWidth && width > maxWidth) || (maxHeight && height > maxHeight)
  const needCompress = maxSize && fileSizeMB > maxSize

  // 如果不需要压缩，直接返回原文件
  if (!needResize && !needCompress) {
    return file
  }

  // 需要压缩，调用 compressImage（可能抛出错误）
  return await compressImage(file, options)
}

/**
 * 从URL检查图片并压缩（如果需要）
 * @param url 图片URL
 * @param options 压缩配置选项
 * @returns 如果不需要压缩则返回原URL字符串，如果需要压缩则返回压缩后的File对象
 * @throws 如果压缩后仍超出限制，抛出错误
 */
export const checkAndCompressImageFromUrl = async (
  url: string,
  options: ImageCompressOptions = {}
): Promise<File | string> => {
  const { maxSize, maxWidth, maxHeight } = options

  // 如果没有配置任何限制，直接返回URL
  if (!maxSize && !maxWidth && !maxHeight) {
    return url
  }

  // 先检查图片尺寸和大小，判断是否需要压缩
  const { width, height } = await getImageSize(url)

  // 尝试获取文件大小（可能因为跨域等原因失败）
  let fileSizeMB = 0
  try {
    const fileSizeBytes = await getImageFileSize(url)
    fileSizeMB = fileSizeBytes / (1024 * 1024)
  } catch (error) {
    // 如果无法获取文件大小，假设需要检查（保守策略）
    console.warn('无法获取图片文件大小，将进行压缩检查:', error)
  }

  // 判断是否需要压缩
  const needResize = (maxWidth && width > maxWidth) || (maxHeight && height > maxHeight)
  const needCompress = maxSize && fileSizeMB > maxSize

  // 如果不需要压缩，直接返回URL（避免重复上传）
  if (!needResize && !needCompress) {
    return url
  }

  // 需要压缩，下载图片
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`无法下载图片: ${response.statusText}`)
  }

  const blob = await response.blob()
  const file = new File([blob], 'image.jpg', { type: blob.type })

  // 使用 compressImage 进行压缩（可能抛出错误）
  return await compressImage(file, options)
}
