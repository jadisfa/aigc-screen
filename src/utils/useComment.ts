import type { CommonRes } from '~/utils/httpUtils'
import { ResStatus, type User } from '~/composables/auth/authhooks.types'
import { useAuthIsLoginComputeRef } from '~/composables/auth/authhooks'

export interface IComment {
  _id?: string
  rootId?: string
  replyTo?: User | string // 回复的评论ID
  content: string // 评论内容
  author?: User // 评论者
  targetType: CommentTypeEnum // 评论对象的类型 (应用｜作品|AI模型|项目)
  targetId?: string // 评论对象的ID
  deleteFlag?: boolean // 删除标记
  created_at?: number // 创建时间
  likeCount?: number // 点赞数
  authorFlag?: boolean // 作者标记
  replies?: IComment[] // 回复评论
}

export enum CommentTypeEnum {
  app = 'app', // 应用（工作流）
  work = 'work', // 作品
  aiModel = 'aiModel', // AI模型
  project = 'project' // 项目
}

export default function useComment() {
  /**
   * 评论
   * @param comment
   */
  const createComment = async (
    comment: IComment
  ): Promise<IComment | undefined> => {
    if (!useAuthIsLoginComputeRef.value) {
      useCustomToast($t('draw.loginRequired'))
      useAuthShowLoginDialog().value = true
      return
    }
    const result = (await Client_POST(
      `/comment`,
      comment
    )) as CommonRes<IComment>
    if (result.status !== ResStatus.success) {
      useSnackbarStore().showErrorMessage(result.message)
    }
    useSnackbarStore().showSuccessMessage('评论成功')
    return result.data
  }

  /**
   * 删除评论
   * @param id
   */
  const deleteComment = async (id: string): Promise<IComment> => {
    const result = (await Client_DELETE(
      `/comment/${id}`
    )) as CommonRes<IComment>
    if (result.status !== ResStatus.success) {
      useSnackbarStore().showErrorMessage(result.message)
    }
    useSnackbarStore().showSuccessMessage('删除成功')
    return result.data
  }

  const replyId = useState<string>('commentReplyId', () => '')

  /**
   * 计算评论数量
   * @param comment
   */
  const calcCommentCount = (comment: IComment[]) => {
    if (!comment?.length) {
      return 0
    }
    return comment.reduce((pre: number, cur) => {
      return pre + 1 + (cur?.replies?.length || 0)
    }, 0)
  }

  return {
    createComment,
    replyId,
    deleteComment,
    calcCommentCount
  }
}
