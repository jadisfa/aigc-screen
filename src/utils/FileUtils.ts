// @ts-ignore
import { nanoid } from 'nanoid'
import { useBase64, useFileDialog } from '@vueuse/core'
import { formatFileSize, type MyResponse } from '~/utils/common'
import type { StorageFileType } from '~/composables/store/appStore'

/**
 * 将一个路径URL图片转为带水印的base64
 * @param viewUrl
 * @constructor
 */
export const ImageViewToBase64WithMark = async (
  viewUrl: string
): Promise<any> => {
  const watermark_file = await ImageViewTofileWithMark(viewUrl)
  return await blobToBase64(watermark_file)
}

/**
 * 将一个路径URL图片转为带水印的file
 * @param viewUrl
 * @constructor
 */
export const ImageViewTofileWithMark = async (
  viewUrl: string
): Promise<File> => {
  // 1.view转为blod
  const orign_image_blob = await ImageUrlToBlob(viewUrl)
  // 2.blob转为图片元素
  const origin_image_element: unknown = await blobToImage(orign_image_blob)
  // 3.图片元素转cavans
  const watermark_canvas = await imgToCanvas(origin_image_element)
  // 4.添加水印
  const watermark_blob = await watermark(watermark_canvas, 'WATER MARK')
  // 5 blob转文件
  return await blobtoFile(watermark_blob, 'test001')
}

/**
 * 将一个文件下载到本地，延时5秒释放URL
 * @param blob
 * @param filename
 */
export const download = (blob: Blob, filename = 'file') => {
  if (!(blob instanceof Blob)) {
    throw new Error('Invalid Blob object')
  }

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename

  document.body.appendChild(link)
  link.click()

  setTimeout(() => {
    window.URL.revokeObjectURL(url)
    link.remove()
  }, 5000) // 增大延时
}

/**
 * 将URL转为base64
 * @param url
 * @constructor
 */
export const ImageUrlToBase64 = async (url: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then(r => r.blob())
      .then((blob) => {
        resolve(blobToBase64(blob))
      })
  })
}

/**
 * 将URL转为blob
 *
 * @param url
 * @constructor
 */
export const ImageUrlToBlob = async (url: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then(r => r.blob())
      .then((blob) => {
        resolve(blob)
      })
  })
}
/**
 * 传入一个blob或者file,转换为base64
 * @param blob
 */
export const blobToBase64 = async (blob: Blob | any): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()
      reader.readAsDataURL(blob)
      reader.onloadend = function (result) {
        // console.log("blobToBase64正常转换，结果是",reader.result)
        resolve(reader.result + '')
      }
    } catch (error) {
      console.error('blobToBase64过程异常')
      reject(error)
    }
  })
}

/**
 * 将blob转为file
 * @param blob
 * @param name
 */
export const blobtoFile = async (blob: any, name: string): Promise<File> => {
  return new Promise((resolve) => {
    const files = new window.File([blob], name, { type: blob.type })
    resolve(files)
  })
}

/**
 * 将 Blob 对象转换为 HTML Image 对象
 * 此函数读取 Blob 对象的数据，并将其转换为可以显示在网页上的图像对象
 *
 * @param blob 要转换的 Blob 对象，通常代表一个图像文件
 * @returns 返回一个 Promise，当图像加载完成时，该 Promise 解析为一个 Image 对象
 */
export const blobToImage = async (blob: any) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const img: any = new Image()
      img.src = reader.result
      img.addEventListener('load', () => resolve(img))
    })
    reader.readAsDataURL(blob)
  })
}

/**
 * 将 HTML Image 对象转换为 HTML Canvas 对象
 * 此函数将 HTML Image 对象转换为 HTML Canvas 对象，以便进一步处理图像数据
 *
 * @param img 要转换的 HTML Image 对象
 * @returns 返回一个 Promise，当图像加载完成时，该 Promise 解析为一个 HTML Canvas 对象
 */
export const imgToCanvas = (img: any): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx: any = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  return canvas as HTMLCanvasElement
}

/**
 * 为 HTML Canvas 对象添加水印
 * @param canvas
 * @param text
 */
export const watermark = async (
  canvas: HTMLCanvasElement,
  text: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const ctx = canvas.getContext('2d')
    // 设置填充字号和字体，样式
    // @ts-ignore
    ctx.font = '30px 宋体'
    // @ts-ignore
    ctx.fillStyle = '#FFFFFF'
    // 设置右对齐
    // @ts-ignore
    ctx.textAlign = 'right'
    // 在指定位置绘制文字，这里指定距离右下角20坐标的地方
    for (let i = 1; i < 10; i++) {
      // @ts-ignore
      ctx.fillText(text, canvas.width - 100, canvas.height - 100 * i)
    }

    // @ts-ignore
    canvas.toBlob(blob => resolve(blob))
    // const src=canvas.toDataURL('image/png')
    // resolve(src)
  })
}
const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'audio/wav': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/json': 'json',
  'text/plain': 'txt',
  'text/markdown': 'md'
}

const getExtensionFromMimeType = (mimeType?: string) => {
  const normalized = mimeType?.split(';')[0]?.trim().toLowerCase()
  if (!normalized) return ''

  const mappedExt = MIME_EXTENSION_MAP[normalized]
  if (mappedExt) return mappedExt

  const [, subtype] = normalized.split('/')
  return subtype ? subtype.replace(/[^a-z0-9]/gi, '').toLowerCase() : ''
}

const ensureFileNameWithExtension = (
  name: string,
  mimeType?: string,
  fallbackExtension = ''
) => {
  const trimmedName = name.trim()
  if (/\.[a-z0-9]+$/i.test(trimmedName)) return trimmedName

  const extension = getExtensionFromMimeType(mimeType) || fallbackExtension
  return extension ? `${trimmedName}.${extension}` : trimmedName
}

const resolveUploadFileName = (file: File | Blob, filename?: string) => {
  const explicitName = filename?.trim()
  if (explicitName) {
    return ensureFileNameWithExtension(explicitName, file.type)
  }

  const fileName = typeof (file as File).name === 'string' ? (file as File).name.trim() : ''
  const fallbackName = ensureFileNameWithExtension('upload', file.type, 'bin')
  const resolvedName = ensureFileNameWithExtension(
    fileName || fallbackName,
    file.type
  )

  return `${formatDateTimeString()}-${resolvedName}`
}

const fileTypeByExtension: Record<string, StorageFileType> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  bmp: 'image',
  exr: 'image',
  mp3: 'audio',
  wav: 'audio',
  wave: 'audio',
  m4a: 'audio',
  ogg: 'audio',
  flac: 'audio',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  avi: 'video',
  m3u8: 'video',
  txt: 'text',
  md: 'text',
  markdown: 'text',
  json: 'text',
  csv: 'text',
  glb: '3d',
  gltf: '3d',
  obj: '3d',
  fbx: '3d',
  stl: '3d'
}

const resolveStorageFileType = (
  file: File | Blob,
  filename?: string
): StorageFileType => {
  const mimeType = file.type?.split(';')[0]?.trim().toLowerCase()
  if (mimeType?.startsWith('image/')) return 'image'
  if (mimeType?.startsWith('audio/')) return 'audio'
  if (mimeType?.startsWith('video/')) return 'video'
  if (mimeType?.startsWith('text/') || mimeType?.includes('json')) return 'text'
  if (mimeType?.includes('gltf') || mimeType?.includes('model/')) return '3d'

  const extension = filename
    ?.split('?')[0]
    ?.split('#')[0]
    ?.match(/\.([a-z0-9]+)$/i)?.[1]
    ?.toLowerCase()

  return extension ? fileTypeByExtension[extension] || 'file' : 'file'
}

/**
 * 上传文件到OSS,返回上传成功的文件名
 *
 * @param file
 * @param filename
 * @param prefix
 */
export const useUtilsUploadFileToOSS = async (
  file: File | Blob,
  filename?: string,
  prefix = `${new Date().toISOString().slice(0, 10)}/${useAuthUserinfo().value._id}/upload/`
): Promise<string> => {
  filename = resolveUploadFileName(file, filename)
  filename = prefix + filename

  const headers = {
    'Content-Type': file.type
  }
  // 获取预上传URL
  const res = await getUploadUrl(filename, {
    ACL: 'public-read',
    headers: headers,
    fileType: resolveStorageFileType(file, filename)
  }).catch(() => {
    showMessage({
      type: 'error',
      message: '获取预上传URL失败，启用并检查OSS配置'
    })
    throw new Error('获取预上传URL失败，启用并检查OSS配置')
  })

  const { preSignedUrl, headers: _headers = {}, fileUrl } = res

  Object.assign(headers, _headers)

  // 直接上传
  const result = await fetch(preSignedUrl, {
    method: 'PUT',
    mode: 'cors',
    headers,
    body: file
  })
  if (result.status === 200) {
    return fileUrl
  }
  showMessage({
    type: 'error',
    message:
      `上传失败，请检查OSS参数和跨域配置，状态码：${result.status},错误信息：`
      + result.statusText
  })
  throw new Error('上传失败')
}
/**
 * 根据    type?: 'image' | 'audio' | 'video' | 'text',获取路径存储路径名称
 * @param type
 */
export const getFilePath = (
  type?: 'image' | 'audio' | 'video' | 'text'
): string => {
  const filename = nanoid(15)
  let _targetPath = `aidraw/others/temps/${filename}.png`
  switch (type) {
    case 'image':
      _targetPath = `image/upload/${filename}.png`
      break
    case 'audio':
      _targetPath = `audio/upload/${filename}.wav`
      break
    case 'video':
      _targetPath = `video/upload/${filename}.mp4`
      break
    default:
      _targetPath = `others/upload/${filename}.png`
      break
  }
  return _targetPath
}

export type DownloadFileExpectedType = 'image' | 'video' | 'audio' | 'file' | 'text' | 'json' | '3d'

type DownloadFileByUrlOptions = {
  expectedType?: DownloadFileExpectedType
  fallbackFileName?: string
  fallbackExtension?: string
}

const DOWNLOAD_TYPE_FALLBACK_EXTENSION: Partial<Record<DownloadFileExpectedType, string>> = {
  image: 'png',
  video: 'mp4',
  audio: 'mp3',
  text: 'txt',
  json: 'json',
  file: 'bin'
}

const DOWNLOAD_TYPE_EXTENSIONS: Partial<Record<DownloadFileExpectedType, Set<string>>> = {
  image: new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'avif', 'tif', 'tiff', 'ico']),
  video: new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv', 'avi', 'mkv', 'flv', 'wmv', 'm3u8', 'ts']),
  audio: new Set(['mp3', 'wav', 'aac', 'ogg', 'oga', 'flac', 'm4a', 'opus', 'weba']),
  text: new Set(['txt', 'md', 'markdown']),
  json: new Set(['json'])
}

const normalizeDownloadExtension = (extension?: string) =>
  (extension ?? '').replace(/^\./, '').trim().toLowerCase()

const getFileNameExtension = (fileName: string) => {
  const matched = fileName.match(/\.([a-z0-9]{1,12})$/i)
  return matched?.[1]?.toLowerCase() ?? ''
}

const sanitizeDownloadFileName = (value: string) => {
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    decoded = value
  }
  return decoded
    .split('?')[0]
    .split('#')[0]
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

const getDownloadFilenameFromContentDisposition = (value: string | null) => {
  if (!value) return ''
  const utf8Matched = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Matched?.[1]) return sanitizeDownloadFileName(utf8Matched[1])
  const plainMatched = value.match(/filename="?([^";]+)"?/i)
  if (plainMatched?.[1]) return sanitizeDownloadFileName(plainMatched[1])
  return ''
}

const extractDownloadFilenameFromUrl = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin)
    const queryName = parsed.searchParams.get('filename')
      || parsed.searchParams.get('file')
      || parsed.searchParams.get('name')
    if (queryName) return sanitizeDownloadFileName(queryName)
    const pathName = parsed.pathname.split('/').filter(Boolean).pop()
    return pathName ? sanitizeDownloadFileName(pathName) : ''
  } catch {
    const fallback = url.substring(url.lastIndexOf('/') + 1)
    return fallback ? sanitizeDownloadFileName(fallback) : ''
  }
}

const isExtensionCompatibleWithDownloadType = (
  extension: string,
  expectedType?: DownloadFileExpectedType
) => {
  const normalized = normalizeDownloadExtension(extension)
  if (!normalized || !expectedType || expectedType === 'file' || expectedType === '3d') return true
  return DOWNLOAD_TYPE_EXTENSIONS[expectedType]?.has(normalized) ?? true
}

const getDownloadExtensionFromMimeType = (
  mimeType?: string,
  expectedType?: DownloadFileExpectedType
) => {
  const normalizedMime = mimeType?.split(';')[0]?.trim().toLowerCase()
  if (!normalizedMime || normalizedMime === 'application/octet-stream') return ''
  const extension = normalizeDownloadExtension(getExtensionFromMimeType(normalizedMime))
  return isExtensionCompatibleWithDownloadType(extension, expectedType) ? extension : ''
}

const bytesToAscii = (bytes: Uint8Array, start = 0, end = bytes.length) =>
  String.fromCharCode(...bytes.slice(start, end))

export const inferDownloadExtensionFromBlob = async (
  blob: Blob,
  expectedType?: DownloadFileExpectedType
) => {
  const bytes = new Uint8Array(await blob.slice(0, 64).arrayBuffer())
  if (bytes.length < 4) return ''

  if (expectedType === 'image' || !expectedType) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png'
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
    if (bytesToAscii(bytes, 0, 3) === 'GIF') return 'gif'
    if (bytesToAscii(bytes, 0, 4) === 'RIFF' && bytesToAscii(bytes, 8, 12) === 'WEBP') return 'webp'
    if (bytesToAscii(bytes, 0, 2) === 'BM') return 'bmp'
    const maybeSvg = await blob.slice(0, 256).text().catch(() => '')
    if (/^\s*<svg[\s>]/i.test(maybeSvg)) return 'svg'
  }

  if (expectedType === 'video' || expectedType === 'audio' || !expectedType) {
    if (bytesToAscii(bytes, 4, 8) === 'ftyp') {
      const brand = bytesToAscii(bytes, 8, 12).trim().toLowerCase()
      if (brand === 'qt') return 'mov'
      return expectedType === 'audio' ? 'm4a' : 'mp4'
    }
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'webm'
    if (bytesToAscii(bytes, 0, 4) === 'OggS') return expectedType === 'audio' ? 'ogg' : 'ogv'
  }

  return ''
}

const replaceDownloadFileNameExtension = (fileName: string, extension: string) => {
  const baseName = getFileNameExtension(fileName)
    ? fileName.replace(/\.[a-z0-9]{1,12}$/i, '')
    : fileName
  return `${baseName || 'download'}.${extension}`
}

const ensureDownloadFileNameExtension = async (
  fileName: string,
  blob: Blob,
  mimeType: string | undefined,
  options: DownloadFileByUrlOptions
) => {
  const safeName = sanitizeDownloadFileName(fileName) || options.fallbackFileName || 'download'
  const existingExtension = getFileNameExtension(safeName)
  const inferredExtension = await inferDownloadExtensionFromBlob(blob, options.expectedType)
  if (
    existingExtension
    && inferredExtension
    && inferredExtension !== existingExtension
    && isExtensionCompatibleWithDownloadType(inferredExtension, options.expectedType)
  ) {
    return replaceDownloadFileNameExtension(safeName, inferredExtension)
  }
  if (existingExtension && isExtensionCompatibleWithDownloadType(existingExtension, options.expectedType)) {
    return safeName
  }

  const mimeExtension = getDownloadExtensionFromMimeType(mimeType || blob.type, options.expectedType)
  const fallbackExtension = normalizeDownloadExtension(options.fallbackExtension)
    || DOWNLOAD_TYPE_FALLBACK_EXTENSION[options.expectedType ?? 'file']
    || ''
  const extension = inferredExtension || mimeExtension || fallbackExtension
  if (!extension) return safeName

  return replaceDownloadFileNameExtension(safeName, extension)
}

export const downloadFileByUrl = (
  fileUrl: string,
  filename?: string,
  options: DownloadFileByUrlOptions = {}
) => {
  // 通过 fetch API 请求文件数据
  fetch(fileUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`下载失败，状态码：${response.status}`)
      }
      const blob = await response.blob()
      const contentDisposition = response.headers.get('content-disposition')
      const responseMimeType = response.headers.get('content-type') || blob.type
      // 创建一个 Blob URL
      const blobUrl = URL.createObjectURL(blob)

      // 创建一个 a 标签，用于触发下载
      const anchor = document.createElement('a')

      const rawFileName = filename?.trim()
        || getDownloadFilenameFromContentDisposition(contentDisposition)
        || extractDownloadFilenameFromUrl(fileUrl)
        || options.fallbackFileName
        || 'download'
      const fileName = await ensureDownloadFileNameExtension(
        rawFileName,
        blob,
        responseMimeType,
        options
      )

      // 设置 href 为 Blob URL
      anchor.href = blobUrl

      // 设置 download 属性以强制下载
      anchor.download = fileName

      // 隐藏 a 标签并将其添加到文档
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      // 触发下载
      anchor.click()
      // 下载完成后移除 a 标签，并释放 Blob URL
      document.body.removeChild(anchor)
      URL.revokeObjectURL(blobUrl)
    })
    .catch(error => console.error('下载文件时出错:', error))
}

/**
 * 检查图片大小是否超限
 * @param file
 * @param option
 */
export const useUtilsCheckImageLimit = async (
  file: File,
  option?: {
    maxSize?: number
    maxWidth?: number
    maxHeight?: number
  }
): Promise<boolean> => {
  // 判断文件是否为图片的函数
  if (!file.type.startsWith('image')) {
    return true
  }
  const drawUploadImageMaxSize = (option?.maxSize ?? 2) * 1024
  const drawUploadImageMaxWidth = option?.maxWidth ?? 2048
  const drawUploadImageMaxHeight = option?.maxHeight ?? 2048
  // 判断图片大小是否超限
  if (file.size > drawUploadImageMaxSize) {
    useCustomToast(
      $t('draw.uploadImageSizeLimit', [
        formatFileSize(drawUploadImageMaxSize),
        file.name,
        formatFileSize(file.size)
      ])
    )
    return false
  }

  // 获取图片文件的长宽
  const { width, height } = await getImageSize(URL.createObjectURL(file))
  if (width > drawUploadImageMaxWidth) {
    useCustomToast(
      $t('draw.uploadImageWidthLimit', [
        drawUploadImageMaxWidth,
        file.name,
        width
      ])
    )
    return false
  }
  if (height > drawUploadImageMaxHeight) {
    useCustomToast(
      $t('draw.uploadImageHeightLimit', [
        drawUploadImageMaxHeight,
        file.name,
        height
      ])
    )
    return false
  }

  return true
}

/**
 * 检查图片大小是否超限
 * @param url
 * @param option
 */
export const useUtilsCheckImageUrlLimit = async (
  url: string,
  option?: {
    maxSize?: number
    maxWidth?: number
    maxHeight?: number
    exceedSizeCallback?: (size: number) => void
    exceedWidthCallback?: (width: number) => void
    exceedHeightCallback?: (height: number) => void
  }
): Promise<boolean> => {
  const drawUploadImageMaxSize = (option?.maxSize ?? 2) * 1024
  const drawUploadImageMaxWidth = option?.maxWidth ?? 2048
  const drawUploadImageMaxHeight = option?.maxHeight ?? 2048

  // 获取图片大小
  const size = await getImageFileSize(url)
  // 判断图片大小是否超限
  if (size > drawUploadImageMaxSize) {
    option?.exceedSizeCallback?.(size)

    return false
  }

  // 获取图片文件的长宽
  const { width, height } = await getImageSize(url)
  if (width > drawUploadImageMaxWidth) {
    option?.exceedWidthCallback?.(width)

    return false
  }
  if (height > drawUploadImageMaxHeight) {
    option?.exceedHeightCallback?.(height)

    return false
  }
  return true
}

/**
 * 获取图片尺寸
 * @param url
 */
export const getImageSize = async (url: string) => {
  const img = new Image()
  img.src = url
  await new Promise((resolve) => {
    img.onload = resolve
  })
  const width = img?.naturalWidth
  const height = img?.naturalHeight
  img.remove()
  return {
    width,
    height
  }
}

/**
 * 获取文件大小
 * @param url
 */
export const getImageFileSize = async (url: string): Promise<number> => {
  try {
    const response = await fetch(url, {
      method: 'HEAD' // 使用 'HEAD' 请求来获取文件头部信息
    })

    const contentLength = response.headers.get('Content-Length')
    if (contentLength) {
      return parseInt(contentLength, 10) // 返回文件大小（字节数）
    } else {
      throw new Error('Content-Length header is not available')
    }
  } catch (error) {
    console.error(error)
    throw new Error('Failed to retrieve image size')
  }
}

/**
 * @description: 图片文件转字符串
 * @param {Blob|File} file 文件
 * @return {String}
 */
export const getImgStr = (file: File | Blob): Promise<FileReader['result']> => {
  return useBase64(file).promise.value
}

/**
 * @description: 字符串转图片文件
 * @param {String} base64Data 图片字符串
 * @return { {blob: Blob, fileType: string } }
 */
export const base64ToBlob = (base64Data: string) => {
  if (!base64Data) {
    throw new Error('base64Data is empty')
  }
  const dataArr = base64Data.split(',')
  const imageType = dataArr[0].match(/:(.*?);/)[1]
  const textData = window.atob(dataArr[1])
  const arrayBuffer = new ArrayBuffer(textData.length)
  const uint8Array = new Uint8Array(arrayBuffer)
  for (let i = 0; i < textData.length; i++) {
    uint8Array[i] = textData.charCodeAt(i)
  }
  return {
    blob: new Blob([arrayBuffer], { type: imageType }),
    fileType: imageType.slice(6)
  }
}

/**
 * @description 是否是base64
 * @param str
 */
export const isBase64 = (str: string) => {
  const base64Pattern = /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/
  return base64Pattern.test(str)
}
/** 根据 Base64 字符串获取 MIME 类型和文件扩展名 */
export const getMimeTypeAndExtension = (base64Str: string) => {
  // 匹配 Base64 数据的 MIME 类型和文件扩展名
  const regex = /^data:(.*?);base64,/

  // 从 Base64 字符串中提取 MIME 类型
  const match = base64Str.match(regex)

  if (match && match[1]) {
    const mimeType = match[1]

    // 根据 MIME 类型推断文件扩展名
    const mimeTypeToExtension = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
      'image/svg+xml': 'svg',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'application/pdf': 'pdf'
      // 你可以根据需要扩展此映射表
    }

    const fileExtension = mimeTypeToExtension[mimeType] || 'unknown' // 默认返回 unknown

    return {
      mimeType: mimeType,
      extension: fileExtension
    }
  } else {
    throw new Error('Invalid Base64 string')
  }
}

/**
 * @description: 选择文件
 * @param {Object} options accept = '', capture = '', multiple = false
 * @return {Promise}
 */
export const selectFiles = (options: {
  accept?: string
  capture?: string
  multiple?: boolean
}): Promise<FileList | null> => {
  return new Promise((resolve) => {
    const { onChange, open } = useFileDialog(options)
    onChange((files) => {
      resolve(files)
    })
    open()
  })
}

export const invertImageTransparency = (
  imageSource: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 创建 canvas
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    // 加载图片
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height

      // 绘制原图
      ctx.drawImage(img, 0, 0)

      // 获取图像数据
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      // 反转 alpha 通道
      for (let i = 0; i < data.length; i += 4) {
        // alpha 通道在第四个位置
        data[i + 3] = 255 - data[i + 3]
      }

      // 将修改后的数据放回 canvas
      ctx.putImageData(imageData, 0, 0)

      // 导出为新图片
      resolve(canvas.toDataURL('image/png'))
    }

    img.src = imageSource
  })
}

interface MediaInfo {
  isMedia: boolean
  fileName: string | null
  fileType: 'audio' | 'video' | 'image' | 'unknown' | '3d' | 'file'
  mimeType: string
}

/**
 * 从 URL 中提取文件扩展名（支持查询参数中的文件名）
 */
function extractExtensionFromUrl(url: string, pathname: string, searchParams: URLSearchParams): string | null {
  // 1. 优先从查询参数中获取文件名（如 ComfyUI 的 ?filename=xxx.png）
  const filenameFromQuery = searchParams.get('filename') || searchParams.get('file') || searchParams.get('name')
  if (filenameFromQuery) {
    const match = filenameFromQuery.match(/\.([a-z0-9]+)(?:[?#]|$)/i)
    if (match) {
      return `.${match[1].toLowerCase()}`
    }
  }

  // 2. 从路径中提取扩展名
  const pathMatch = pathname.match(/\.([a-z0-9]+)(?:[?#]|$)/i)
  if (pathMatch) {
    return `.${pathMatch[1].toLowerCase()}`
  }

  // 3. 从完整 URL 中提取（处理一些特殊情况）
  const urlMatch = url.match(/\.([a-z0-9]+)(?:[?#]|$)/i)
  if (urlMatch) {
    return `.${urlMatch[1].toLowerCase()}`
  }

  return null
}

/**
 * 从 data URL 中提取 MIME 类型
 */
function extractMimeTypeFromDataUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:([^;]+)/)
  return match ? match[1] : null
}

export function getMediaInfoFromUrl(url: string): MediaInfo {
  const defaultMimeType = 'application/octet-stream'
  const result: MediaInfo = {
    isMedia: false,
    fileName: null,
    fileType: 'unknown',
    mimeType: defaultMimeType
  }

  if (!url || typeof url !== 'string') {
    return result
  }

  // 处理 data URL
  if (url.startsWith('data:')) {
    const mimeType = extractMimeTypeFromDataUrl(url)
    if (mimeType) {
      result.mimeType = mimeType
      if (mimeType.startsWith('image/')) {
        result.isMedia = true
        result.fileType = 'image'
      } else if (mimeType.startsWith('video/')) {
        result.isMedia = true
        result.fileType = 'video'
      } else if (mimeType.startsWith('audio/')) {
        result.isMedia = true
        result.fileType = 'audio'
      }
    }
    // 尝试从 data URL 中提取文件名（如果有的话）
    const filenameMatch = url.match(/filename=([^;]+)/)
    if (filenameMatch) {
      result.fileName = filenameMatch[1]
    }
    return result
  }

  // 只处理 HTTP/HTTPS URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return result
  }

  // 扩展的音频格式
  const audioExtensions: { [ext: string]: string } = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.oga': 'audio/ogg',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.opus': 'audio/opus',
    '.weba': 'audio/webm',
    '.mid': 'audio/midi',
    '.midi': 'audio/midi',
    '.wma': 'audio/x-ms-wma',
    '.aiff': 'audio/aiff',
    '.au': 'audio/basic',
    '.ra': 'audio/x-realaudio',
    '.amr': 'audio/amr',
    '.3gp': 'audio/3gpp',
    '.ac3': 'audio/ac3',
    '.eac3': 'audio/eac3',
    '.mka': 'audio/x-matroska',
    '.ape': 'audio/x-monkeys-audio',
    '.tta': 'audio/x-tta'
  }

  // 扩展的视频格式
  const videoExtensions: { [ext: string]: string } = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogv': 'video/ogg',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.flv': 'video/x-flv',
    '.mkv': 'video/x-matroska',
    '.wmv': 'video/x-ms-wmv',
    '.m3u8': 'application/x-mpegURL',
    '.ts': 'video/MP2T',
    '.m2ts': 'video/MP2T',
    '.mts': 'video/MP2T',
    '.3gp': 'video/3gpp',
    '.3g2': 'video/3gpp2',
    '.asf': 'video/x-ms-asf',
    '.rm': 'application/vnd.rn-realmedia',
    '.rmvb': 'application/vnd.rn-realmedia-vbr',
    '.vob': 'video/dvd',
    '.m4v': 'video/x-m4v',
    '.f4v': 'video/x-f4v',
    '.swf': 'application/x-shockwave-flash',
    '.mpg': 'video/mpeg',
    '.mpeg': 'video/mpeg',
    '.m2v': 'video/mpeg',
    '.divx': 'video/divx',
    '.xvid': 'video/xvid'
  }

  // 扩展的图片格式
  const imageExtensions: { [ext: string]: string } = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.avif': 'image/avif',
    '.apng': 'image/apng',
    '.cur': 'image/x-icon',
    '.pcx': 'image/x-pcx',
    '.tga': 'image/x-tga',
    '.dds': 'image/vnd.ms-dds',
    '.xcf': 'image/x-xcf',
    '.raw': 'image/x-raw',
    '.cr2': 'image/x-canon-cr2',
    '.nef': 'image/x-nikon-nef',
    '.orf': 'image/x-olympus-orf',
    '.sr2': 'image/x-sony-sr2',
    '.raf': 'image/x-fuji-raf'
  }

  // 3D 格式
  const threeDExtensions: { [ext: string]: string } = {
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.obj': 'model/obj',
    '.fbx': 'model/fbx',
    '.3ds': 'model/3ds',
    '.dae': 'model/collada',
    '.stl': 'model/stl',
    '.ply': 'model/ply',
    '.x3d': 'model/x3d+xml',
    '.wrl': 'model/vrml',
    '.amf': 'application/amf+xml',
    '.3mf': 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
    '.iges': 'model/iges',
    '.step': 'model/step',
    '.stp': 'model/step',
    '.objz': 'model/obj',
    '.glb.bz2': 'model/gltf-binary',
    '.gltf.gz': 'model/gltf+json',
    '.blend': 'application/x-blender',
    '.max': 'application/x-3ds-max',
    '.ma': 'application/x-maya',
    '.mb': 'application/x-maya',
    '.c4d': 'application/x-cinema-4d',
    '.lwo': 'model/lwo',
    '.lws': 'model/lws',
    '.x': 'model/x',
    '.b3d': 'model/b3d',
    '.q3o': 'model/q3o',
    '.q3s': 'model/q3s',
    '.bvh': 'model/bvh',
    '.ac': 'model/ac',
    '.ac3d': 'model/ac3d',
    '.ase': 'model/ase',
    '.awd': 'model/awd',
    '.cob': 'model/cob',
    '.dxf': 'application/dxf',
    '.enigma': 'model/enigma',
    '.hmp': 'model/hmp',
    '.irrmesh': 'model/irrmesh',
    '.irr': 'model/irr',
    '.lml': 'model/lml',
    '.lxo': 'model/lxo',
    '.md2': 'model/md2',
    '.md3': 'model/md3',
    '.md5anim': 'model/md5anim',
    '.md5camera': 'model/md5camera',
    '.md5mesh': 'model/md5mesh',
    '.ms3d': 'model/ms3d',
    '.ndo': 'model/ndo',
    '.nff': 'model/nff',
    '.off': 'model/off',
    '.pk3': 'model/pk3',
    '.smd': 'model/smd',
    '.ter': 'model/ter',
    '.uc': 'model/uc',
    '.vta': 'model/vta'
    // 注意：.xml 已移至 fileExtensions，因为大多数 XML 文件是文档格式而非 3D 模型
    // 真正的 3D XML 格式使用 .x3d 扩展名
  }

  try {
    const parsedUrl = new URL(url)
    let pathname = parsedUrl.pathname.toLowerCase()
    const searchParams = parsedUrl.searchParams

    // 提取文件名
    const pathSegments = pathname.split('/').filter(segment => segment)
    let fileName: string | null = null

    // 优先从查询参数获取文件名
    if (pathname === '/view' || searchParams.has('filename')) {
      fileName = searchParams.get('filename') || searchParams.get('file') || searchParams.get('name')
      if (fileName) {
        result.fileName = fileName
        pathname = fileName.toLowerCase()
      }
    }

    // 如果还没有文件名，从路径中提取
    if (!fileName && pathSegments.length > 0) {
      fileName = pathSegments[pathSegments.length - 1]
      result.fileName = fileName
    }

    // 清理文件名（去除查询参数和锚点）
    if (result.fileName) {
      result.fileName = result.fileName.split('?')[0].split('#')[0]
    }

    // 提取文件扩展名（支持多种方式）
    const extension = extractExtensionFromUrl(url, pathname, searchParams)

    // 根据扩展名匹配文件类型
    const checkExtensions = (
      extensions: { [ext: string]: string },
      type: 'audio' | 'video' | 'image' | '3d' | 'file'
    ): boolean => {
      if (!extension) {
        return false
      }

      // 精确匹配扩展名
      if (extensions[extension]) {
        result.isMedia = true
        result.fileType = type
        result.mimeType = extensions[extension]
        return true
      }

      // 对于复合扩展名（如 .glb.bz2），尝试匹配基础扩展名
      const baseExtension = extension.split('.').slice(-2).join('.')
      if (baseExtension !== extension && extensions[baseExtension]) {
        result.isMedia = true
        result.fileType = type
        result.mimeType = extensions[baseExtension]
        return true
      }

      // 模糊匹配（处理大小写和变体）
      const extLower = extension.toLowerCase()
      for (const ext in extensions) {
        if (extLower === ext.toLowerCase() || pathname.endsWith(ext)) {
          result.isMedia = true
          result.fileType = type
          result.mimeType = extensions[ext]
          return true
        }
      }

      return false
    }

    // 按优先级检查文件类型
    if (checkExtensions(threeDExtensions, '3d')) {
      return result
    }
    if (checkExtensions(audioExtensions, 'audio')) {
      return result
    }
    if (checkExtensions(videoExtensions, 'video')) {
      return result
    }
    if (checkExtensions(imageExtensions, 'image')) {
      return result
    }

    // 如果通过扩展名无法识别，但文件名存在，尝试从 MIME 类型推断
    // 这通常发生在 URL 包含 Content-Type 信息时
    const contentType = searchParams.get('content-type') || searchParams.get('mime')
    if (contentType) {
      result.mimeType = contentType
      if (contentType.startsWith('image/')) {
        result.isMedia = true
        result.fileType = 'image'
        return result
      } else if (contentType.startsWith('video/')) {
        result.isMedia = true
        result.fileType = 'video'
        return result
      } else if (contentType.startsWith('audio/')) {
        result.isMedia = true
        result.fileType = 'audio'
        return result
      } else if (contentType.startsWith('model/')) {
        result.isMedia = true
        result.fileType = '3d'
        return result
      }
    }

    // 如果没有匹配到任何已知的媒体类型，但有文件名或扩展名，默认归类为 'file'
    if (extension || result.fileName) {
      result.isMedia = true
      result.fileType = 'file'
      // 如果有扩展名，尝试根据扩展名推断 MIME 类型（可选，保持默认 MIME 类型也可以）
      // 这里保持默认的 application/octet-stream，或者可以根据需要添加简单的 MIME 类型推断
    }
  } catch (error) {
    console.error('Invalid URL:', url, error)
    return {
      isMedia: false,
      fileName: null,
      fileType: 'unknown',
      mimeType: defaultMimeType
    }
  }

  return result
}

// const test = () => {
//   const testURL = 'https://u231197-8a2f-5fb4ecb2.westb.seetacloud.com:8443/view?filename=ComfyUI_02016_.png&type=output'
//   const { isMedia, mimeType, fileName } = getMediaInfoFromUrl(testURL)
//   console.log(isMedia, mimeType, fileName)
// }
// test()
export const getOutputTypeFromUrl = (
  outputUrl: string,
  userSettingType: OutputType
) => {
  try {
    const { fileType } = getMediaInfoFromUrl(outputUrl)
    if (fileType === 'unknown') return userSettingType
    return fileType
  } catch (e) {
    return userSettingType
  }
}
