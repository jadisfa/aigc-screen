// 声称内容弹框
import React,{ useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { WandSparkles } from 'lucide-react';
import type { DrawHistoryItem } from "./user-draw-history";
import { Modal, Popover, Button, Tooltip } from "antd";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import { getUser } from "@/shared/api/ums/iam";
import { CONSOLE_PERMISSION_NAMESPACE } from "@/shared/lib/permissions";
import { formatDateTime } from "@/shared/lib/datetime";
import { InfoCircleOutlined, ZoomOutOutlined, ZoomInOutlined, CloseOutlined } from "@ant-design/icons";
import MediaWithWatermark from "@/component/MediaWithWatermark";
import { useDrawSameStore } from "@/shared/hooks/use-draw-same";
import "@/assets/css/historyPreviewModal.css";

interface WorkPreviewProps {
    visible: boolean
    task?: DrawHistoryItem
    close: () => void
    itemIndex?: number | null
}

interface UserInfo {
  id: string;
  username?: string;
  nickname?: string;
  avatar_url?: string;
  balance?: number;
  [key: string]: any;
}

interface MediaLink {
  url: string
  type: 'image' | 'video' | 'audio'
  key: string
}

const IMAGE_ZOOM_MIN = 1
const IMAGE_ZOOM_MAX = 6
const IMAGE_ZOOM_BUTTON_STEP = 1.25
const IMAGE_ZOOM_WHEEL_STEP = 1.14
const IMAGE_ZOOM_EPSILON = 0.001

const WorkPreviewDialog:React.FC<WorkPreviewProps> = ({ task, visible=false, close, itemIndex  }) => {
    const [user, setUser] = useState<UserInfo | null>(null);
    const navigate = useNavigate();
    const [mediaIndex, setMediaIndex] = useState(itemIndex || 0);
    const imageViewportRef = useRef<HTMLDivElement | null>(null)
    const previewImageRef = useRef<HTMLImageElement | null>(null)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const [sidePreviewMedia, setSidePreviewMedia] = useState<MediaLink | null>(null)
    const { setDrawSameWork } = useDrawSameStore();

    const [imageZoom, setImageZoom] = useState(IMAGE_ZOOM_MIN)
    const [imagePan, setImagePan] = useState({ x: 0, y: 0 })
    const imageDragState = useRef<{
    pointerId: number
    startX: number
    startY: number
    startPanX: number
    startPanY: number
    } | null>(null)

    const clamp = (value: number, min: number, max: number) => {
        return Math.min(Math.max(value, min), max)
    }

    const imageZoomStyle = useMemo(() => {
        return {
            transform: `translate3d(${imagePan.x}px, ${imagePan.y}px, 0) scale(${imageZoom})`
        }
    }, [imageZoom, imagePan])
    const isImageZoomed = useMemo(() => {
        return imageZoom > IMAGE_ZOOM_MIN + IMAGE_ZOOM_EPSILON
    }, [imageZoom])
    const isImageDragging = useMemo(() => {
        return imageDragState.current !== null
    }, [])
    const isImagePreview = useMemo(() => {
        return task?.workType == 'image' || true
    }, [task])
    const canDragPreviewImage = useMemo(() => {
        return isImagePreview && !isImageZoomed
    }, [isImagePreview, isImageZoomed])
    const imageZoomPercent = useMemo(() => {
        return `${Math.round(imageZoom * 100)}%`
    }, [imageZoom])

    const { data: meInfo, refetch: refetchMePermissions } = useMePermissions({
        sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode,
    });

    // 当前媒体URL
    const currentMediaUrl = useMemo(() => {
        if (sidePreviewMedia?.url) return sidePreviewMedia.url
        return task?.output[mediaIndex] || ''
    }, [task, mediaIndex, sidePreviewMedia])

    useEffect(() => {
        const getUserInfo = async() => {
            const userData = await getUser({ id: meInfo.userId });
            setUser(userData);
        }
        if (meInfo?.userId && visible) {
            getUserInfo()
        }
    }, [visible, meInfo])

    const taskTypePositive = useCallback(() => {
        if (task) {
            // console.log(task, '预览信息')
            const workType = task?.workflow?.outputNodesJson;
            const type = workType ? JSON.parse(workType) : null;
            const drawOutput = !workType ? JSON.parse(task?.outputJson) : null;
            const drawOutputType = drawOutput?.items[0]?.kind;
            return workType ? (type?.outputType == 'video' ? '视频' : '图片') : (drawOutputType == 'video' ? '视频' : '图片')
        }
    }, [task])

    // 提取入参图片，视频链接
    const mediaLinks:MediaLink[] = useMemo(() => {
        if (task) {
            const params = task?.params; // 参数
            const type = task?.workType; // 应用类型
            const links: MediaLink[] = [];
            // 甲型
            if (params?.lora_name) {
                links.push({url: params?.lora_name, type: type} as MediaLink)
            }
            if (params?.lora_name1) {
                links.push({url: params?.lora_name1, type: type} as MediaLink)
            }
            // 传参
            if (params?.image_path){
                links.push({url: params?.image_path, type: type} as MediaLink)
            }
            if (params?.image){
                links.push({url: params?.image, type: type} as MediaLink)
            }
            if (params?.multi_source_image_path){
                links.push({url: params?.multi_source_image_path, type: type} as MediaLink)
            }
            if (params?.image_first_frame){
                links.push({url: params?.image_first_frame, type: type} as MediaLink)
            }
            if (params?.image_last_frame){
                links.push({url: params?.image_last_frame, type: type} as MediaLink)
            }
            // console.log(links, 'mediaLinks')

            return links;
        }
        return []
    }, [task])

    const excludedSummaryParamKeys = new Set([
        'model',
        'model_alias',
        'positive',
        'negative',
        'positive_template',
        'negative_prompt',
        'prompt',
        'content',
        'multi_prompt',
        'shots'
        ])
   // 其他短参数（长度<=10的，用|拼接）
    const shortParams = useMemo(() => {
        if (!task?.params) return []
        const newParams = {...task?.params, ...task.params?.info}
        const params = newParams as unknown as Record<
            string,
            string | number | boolean | null | undefined
        >
        const shortParamsList: string[] = []

        // console.log(params, 173)
        Object.keys(params).forEach((key) => {
            if (excludedSummaryParamKeys.has(key)) return
            const value = params[key]
            // 排除 null、undefined、空字符串、布尔值
            if (
            value !== undefined &&
            value !== '' &&
            value !== null &&
            typeof value !== 'boolean' &&
            typeof value !== 'object' && key != 'aspect_ratio' && key != 'time' &&
            key != 'lora_index' && key != 'workflow_name' && key != 'advance_select_single_chips_1'
            ) {
            const valueStr = String(value)
            // 排除字符串形式的 "null" 和 "undefined"
            if (valueStr.toLowerCase() !== 'null' && valueStr.toLowerCase() !== 'undefined') {
                // 只取长度<=10的参数，只显示值
                if (valueStr.length <= 20) {
                shortParamsList.push(valueStr)
                }
            }
            }
        })

        return shortParamsList
    }, [task])

    // 长参数（长度>10的，显示在更多里）
    const longParams = useMemo(() => {
        if (!task?.params) return {}
        const params = task.params as unknown as Record<
            string,
            string | number | boolean | null | undefined
        >
        const longParamsObj: Record<string, string | number> = {}

        Object.keys(params).forEach((key) => {
            if (excludedSummaryParamKeys.has(key)) return
            const value = params[key]
            // 排除 null、undefined、空字符串、布尔值
            if (
            value !== undefined &&
            value !== '' &&
            value !== null &&
            typeof value !== 'boolean' &&
            typeof value !== 'object' && 
            key != 'lora_index' && key != 'workflow_name' && key != 'advance_select_single_chips_1'
            ) {
            const valueStr = String(value)
            // 排除字符串形式的 "null" 和 "undefined"
            if (valueStr.toLowerCase() !== 'null' && valueStr.toLowerCase() !== 'undefined') {
                // 排除链接参数（以 http 开头的）
                if (valueStr.startsWith('http')) return
                // 只取长度>10的参数
                if (valueStr.length > 20) {
                longParamsObj[key] = value
                }
            }
            }
        })

        return longParamsObj
    }, [task])

    // 是否有更多参数
    const hasMoreParams = useMemo(() => {
        return Object.keys(longParams).length > 0
    },[longParams])

    // 入参切换
    const handleMediaLinkPreview = (link: MediaLink) => {
        if (link.type !== 'image' && link.type !== 'video') return
        setSidePreviewMedia(link)
    }

    // 多输出切换
    const switchMedia = (index: number) => {
        if (index >= 0 && index < task?.output?.length) {
            setSidePreviewMedia(null)
            setMediaIndex(index)
        }
    }
    // 重置100%
    const resetImageZoom = () => {
        setImageZoom(IMAGE_ZOOM_MIN)
        setImagePan({ x: 0, y: 0 })
        imageDragState.current = null
    }
    
    const applyImageZoom = (targetScale: number, anchor?: { clientX: number; clientY: number }) => {
        const oldScale = imageZoom
        const nextScale = clamp(targetScale, IMAGE_ZOOM_MIN, IMAGE_ZOOM_MAX)
        const baseSize = getImageBaseSize(oldScale)

        if (Math.abs(nextScale - oldScale) < IMAGE_ZOOM_EPSILON) return

        if (nextScale <= IMAGE_ZOOM_MIN + IMAGE_ZOOM_EPSILON) {
            resetImageZoom()
            return
        }

        let nextPan = { ...imagePan }
        const viewportEl = imageViewportRef.current
        if (anchor && viewportEl) {
            const viewportRect = viewportEl.getBoundingClientRect()
            const anchorX = anchor.clientX - viewportRect.left - viewportRect.width / 2
            const anchorY = anchor.clientY - viewportRect.top - viewportRect.height / 2
            const scaleRatio = nextScale / oldScale

            nextPan = {
            x: anchorX - scaleRatio * (anchorX - imagePan.x),
            y: anchorY - scaleRatio * (anchorY - imagePan.y)
            }
        }

        setImageZoom(nextScale)
        setImagePan(clampImagePan(nextScale, nextPan, baseSize))
    }

    // 放大
    const handleImageZoomIn = () => {
        applyImageZoom(imageZoom * IMAGE_ZOOM_BUTTON_STEP)
    }
    // 缩小
    const handleImageZoomOut = () => {
        applyImageZoom(imageZoom / IMAGE_ZOOM_BUTTON_STEP)
    }

    const getImageBaseSize = (scale = imageZoom) => {
        const imageEl = previewImageRef.current
        const viewportEl = imageViewportRef.current
        if (!imageEl || !viewportEl) {
            const viewportRect = viewportEl?.getBoundingClientRect()
            return {
            width: viewportRect?.width ?? 0,
            height: viewportRect?.height ?? 0
            }
        }

        const imageRect = imageEl.getBoundingClientRect()
        const safeScale = scale > 0 ? scale : 1
        return {
            width: imageRect.width / safeScale,
            height: imageRect.height / safeScale
        }
    }

    const clampImagePan = (
        scale: number,
        pan: { x: number; y: number },
        baseSize = getImageBaseSize()
        ) => {
        const viewportEl = imageViewportRef.current
        if (!viewportEl || scale <= IMAGE_ZOOM_MIN + IMAGE_ZOOM_EPSILON) {
            return { x: 0, y: 0 }
        }

        const viewportRect = viewportEl.getBoundingClientRect()
        const maxX = Math.max(0, (baseSize.width * scale - viewportRect.width) / 2)
        const maxY = Math.max(0, (baseSize.height * scale - viewportRect.height) / 2)

        return {
            x: clamp(pan.x, -maxX, maxX),
            y: clamp(pan.y, -maxY, maxY)
        }
    }
    // 做同款
    const handleSameWork = () => {
        close();
        setDrawSameWork(task);
        navigate('/backendCenter/draw-record')
    }


    return (
        <>
            <Modal open={visible} footer={null} destroyOnHidden={true} zIndex={11111} closable={false} className="history-preview-body">
                <div className="history-preview-content w-full h-full flex flex-row">
                    {/* 左侧 */}
                    <div className="media-sesction flex-1 h-full overflow-hidden flex flex-col gap-4 bg-[#0000004d] min-h-0">
                        <div className="media-desplay relative flex-1 overflow-visible min-h-0">
                            {/* 图片 */}
                            {task?.workType == 'image' && <div 
                            ref={imageViewportRef}
                            className={`image-zoom-viewport ${isImageZoomed ? 'image-zoom-viewport--zoome' : ''} ${isImageDragging ? 'image-zoom-viewport--dragging': ''}`} 
                            aria-label="图像缩放预览">
                                <MediaWithWatermark 
                                    className="preview-media-frame image-zoom-watermark-frame"
                                    showWatermark={false}
                                    watermarkText="AI生成"
                                >
                                    <img
                                        ref={previewImageRef}
                                        src={currentMediaUrl}
                                        alt=""
                                        className="media-image"
                                        style={imageZoomStyle}
                                        draggable={canDragPreviewImage}
                                    />
                                </MediaWithWatermark>
                            </div>}
                            {task?.workType == 'image' && <div className="media-item image-container">
                                {/* 缩放 */}
                                <div className="image-zoom-toolbar">
                                    <Tooltip title="缩小" zIndex={1}>
                                        <Button 
                                            className="image-zoom-btn border-0 hover:!border-0 !outline-0 hover:!text-white"
                                            disabled={imageZoom <= IMAGE_ZOOM_MIN + IMAGE_ZOOM_EPSILON}
                                            onClick={() => handleImageZoomOut()}
                                        >
                                            <ZoomOutOutlined />
                                        </Button>
                                    </Tooltip>
                                    <Tooltip title="恢复100%" zIndex={1}>
                                        <Button
                                            className="image-zoom-percent border-0 hover:!border-0 !outline-0  hover:!text-white"
                                            aria-label="$t('workPreview.resetZoom')"
                                            disabled={!isImageZoomed}
                                            onClick={() => resetImageZoom()}
                                        >
                                            { imageZoomPercent }
                                        </Button>
                                    </Tooltip>
                                    <Tooltip title="放大" zIndex={1}>
                                        <Button 
                                            className="image-zoom-btn border-0 hover:!border-0 !outline-0 hover:!text-white"
                                            disabled={imageZoom >= IMAGE_ZOOM_MAX - IMAGE_ZOOM_EPSILON}
                                            onClick={() => handleImageZoomIn()}
                                        >
                                            <ZoomInOutlined />
                                        </Button>
                                    </Tooltip>
                                </div>
                            </div>}
                            {/* 视频 */}
                            {task?.workType == 'video' && <div className="media-item video-container relative">
                                <MediaWithWatermark
                                    className="preview-media-frame"
                                    showWatermark={true}
                                    watermarkText=""
                                >
                                    <video
                                        ref={videoRef}
                                        src={currentMediaUrl}
                                        autoPlay={false}
                                        loop
                                        muted
                                        controls
                                        playsInline
                                        webkit-playsinline={true}
                                        className="media-video"
                                        />
                                </MediaWithWatermark>
                            </div>}
                            {/* 关闭按钮 */}
                            <Button 
                                className="close-btn !border-0 !outline-0 text-white bg-[rgba(0,0,0,0.5)] hover:!bg-[rgba(0,0,0,0.7)] hover:!text-white hover:!border-0"
                                onClick={() => close()}
                            >
                                <CloseOutlined />
                            </Button>
                        </div>
                        {/* 多输出切换 */}
                        {task?.output?.length > 1 && <div className="media-indicators flex flex-wrap gap-3 p-4 w-full bg-[#dddddd] justify-center h-[109px]">
                            {task?.output?.map((outputItem, outputIndex) => {
                                return (
                                    <Button className={`indicator-btn ${outputIndex == mediaIndex ? 'active' : ''} relative border gray-200 hover:!border-[#cccccc]
                                        flex flex-col gap-[4px] pointer p-[4px] w-[88px] h-[77px] rounded-lg overflow-visible outline-0 hover:!bg-[#dddddd]
                                        `}
                                        key={outputIndex}
                                        onClick={() => switchMedia(outputIndex)}
                                    >
                                        <div className="indicator-media w-[100%] h-[52px]">
                                            {task?.workType == 'video' && <video
                                                src={outputItem}
                                                muted
                                                webkit-playsinline
                                                preload="metadata"
                                                className="indicator-thumb"
                                            />}
                                            {task?.workType == 'image' && <img
                                                src={outputItem}
                                                className="indicator-thumb w-[100%] h-[100%] object-cover"
                                            /> }
                                            {/* <video
                                            v-if="getMediaTypeFromUrl(url) === 'video'"
                                            :src="url"
                                            muted
                                            playsinline
                                            webkit-playsinline
                                            preload="metadata"
                                            class="indicator-thumb"
                                            />
                                            <!-- 3D显示3D图标 -->
                                            <div v-else-if="getMediaTypeFromUrl(url) === '3d'" class="indicator-icon">
                                            <icon name="mdi:cube" size="24" />
                                            </div>
                                            <!-- 音频显示音频图标 -->
                                            <div v-else-if="getMediaTypeFromUrl(url) === 'audio'" class="indicator-icon">
                                            <icon name="mdi:music" size="24" />
                                            </div>
                                            <!-- 图片显示预览图 -->
                                            <img
                                            v-else
                                            :src="url"
                                            :alt="`${$t('workPreview.previewImage')} ${index + 1}`"
                                            class="indicator-thumb"
                                            /> */}
                                        </div>
                                        <div className="indicator-stage-label text-[11px] align-center text-white" style={{lineHeight: '14px'}}>{`图${outputIndex + 1}`}</div>
                                    </Button>
                                )
                            })}
                        </div>}
                    </div>
                    {/* 右侧 */}
                    <div className="info-section w-[400px] h-full p-[24px] bg-white flex flex-col gap-[20px]">
                        {/* 头像、昵称 */}
                        <div className="user-info flex flex-row gap-[12px] w-full h-[40px]">
                            <img src={user?.avatarUrl} className="w-[40px] h-[40px] rounded-full object-cover" />
                            <span className="text-[20px] leading-10">{user?.nickname}</span>
                        </div>
                        {/* 应用标题信息 */}
                        <div className="title-section pb-[16px] border-b-[1px] border-gray-200">
                            <h2 className="work-title text-[20px] font-bold mb-[8px]">{task?.workflow?.name}</h2>
                            <div className="work-meta text-gray-500">{formatDateTime(task?.created_at || task?.createdAt || task?.startedAt)}</div>
                        </div>
                        {/* 应用提示词，根据应用产出类型 */}
                        <div className="prompt-section pb-[16px] border-b-[1px] border-gray-200">
                            <div className="section-title h-[22px] mb-[12px] flex flex-row gap-2 text-[14px] font-semibold">
                                <span>{`${taskTypePositive()}提示词`}</span>
                            </div>
                            <div className="prompt-content mb-[12px] border border-gray-200 p-2 leading-6 rounded-lg text-gray-400">
                                {`${task?.params?.positiveCN || task?.params?.value  || '暂无提示词'}`}
                            </div>
                        </div>
                        {/* 上传图片信息,单图，多图，视频 */}
                        <div className="image-link-grid mt-[12px] grid grid-cols-4 gap-4">
                            {mediaLinks.map((mediaItem, mediaIndex) => {
                                return <div className="image-link-item w-[100%] h-[96px] flex items-center justify-center border border-gray-200 
                                rounded-lg cursor-pointer " key={mediaIndex}>
                                    {(mediaItem.type == 'image' || mediaItem.type == 'video') && <img
                                        src={mediaItem.url}
                                        alt="图片链接"
                                        className="image-link-thumb w-[100%] h-[100%] object-contain"
                                        onClick={() => handleMediaLinkPreview(mediaItem)}
                                    />}
                                </div>
                            })}
                        </div>
                        {/* 生成参数 */}
                        <div className="params-section pb-[16px] border-b-[1px] border-gray-200">
                            <div className="section-title text-[14px] font-semibold mb-[12px]">生成参数</div>
                            <div className="params-display flex flex-col gap-[8px]">
                                {/* 预留视频模型 */}
                                {shortParams.length > 0 && <span className="short-params flex flex-wrap break-word gap-[8px] leading-relaxed">
                                    <span>{ shortParams.join(' | ') }</span>
                                    {/* 更多参数 */}
                                    {hasMoreParams && <Popover placement="bottom" trigger='hover' content={
                                        <div className="all-params-content max-w-[200px] max-h-[500px] overflow-y pa-5">
                                            { Object.values(longParams).join(',') }
                                        </div>
                                    }>
                                        <Button type="link" size="small" className="text-gray-800 hover:!text-blue-400">
                                            <span >更多</span>
                                            <InfoCircleOutlined  />
                                        </Button>
                                    </Popover>  }
                                </span>}
                            </div>
                        </div>
                        {/* 按钮 */}
                        <div className="action-buttons pt-4 flex flex-column gap-3">
                            <Button 
                                className="w-full h-[44px] flex items-center justify-center text-white bg-[#4338ca] hover:!bg-[#6c5ed6] hover:!text-white"
                                onClick={() => handleSameWork()}
                            >
                                <WandSparkles size={18} />
                                <span>做同款</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    )
}

export default WorkPreviewDialog;

