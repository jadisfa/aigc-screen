import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  listWorkflows,
  getWorkflowConfigById,
  getWorkflowConfigByVersionId,
} from "@/shared/api/workflow/workflow";
import {
  listWorkflowVersions,
  getWorkflowVersion,
} from "@/shared/api/workflow/workflow-version";
import { listWorkflowTags } from "@/shared/api/workflow/workflow-tag";
import { fetchAllPagesConcurrent } from "@/utils/fetchAll";
import "@/assets/css/modal.css";

interface WorkFlow {
  _id: string;
  title: string;
  name: string;
  description?: string;
  cover?: string;
  miniCover?: string;
  tags?: string[];
  categoryId?: string;
  power?: number;
  [key: string]: any;
}

interface tagInfo {
  [key: string]: string;
}

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  onSelectWorkflow: (item: WorkFlow) => void;
  // 移除 workFlowList prop，改为内部请求
}

// 查询当前分类下已上线应用
export const fetchWorkflowList = async (
  categoryId: string,
): Promise<WorkFlow[]> => {
  const response = await listWorkflows({
    pageNo: 1,
    pageSize: 50,
    cateId: categoryId,
    status: "online",
  });
  const data = response?.items ?? [];
  return data;
};

// 获取应用版本列表
export const getWorkFlowVersion = async (id: string) => {
  const result = await listWorkflowVersions({
    pageNo: 1,
    pageSize: 50,
    workflowId: id,
  });
  return result;
};
//  通过应用版本id获取应用配置
export const getWorkFlowDetail = async (id: string) => {
  const result = await getWorkflowVersion(id);
  return result;
};

const Modal: React.FC<ModalProps> = ({
  open,
  onOpenChange,
  workflowId,
  onSelectWorkflow,
}) => {
  const [loading, setLoading] = useState(false);
  const [workflowList, setWorkflowList] = useState<WorkFlow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tagObj, setTagObj] = useState<tagInfo>({});

  // 请求数据函数
  const loadWorkflowData = useCallback(async () => {
    if (!workflowId) {
      setWorkflowList([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 调用 API 获取数据
      const allTags = await fetchAllPagesConcurrent(
        (params) => listWorkflowTags({ ...params }),
        1,
        50, // 每页条数
        3, // 并发数
      );
      const tagInfos = allTags.reduce((acc: ang, item: any) => {
        // 使用 id 或 name 作为 key，整个对象作为 value
        acc[item.id] = item.name;
        return acc;
      }, {});
      setTagObj(tagInfos);
      const data = await fetchWorkflowList(workflowId);
      setWorkflowList(data);
    } catch (err) {
      setError("加载失败，请重试");
      setWorkflowList([]);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  // 监听 modal 打开状态，每次打开时重新请求数据
  useEffect(() => {
    if (open) {
      loadWorkflowData();
    }
  }, [open, loadWorkflowData]);

  // 使用 useMemo 缓存筛选结果（实际上已经通过 categoryId 筛选过了）
  const workflowArr = useMemo(() => {
    return workflowList;
  }, [workflowList]);

  /**
   * 选择应用
   * 需要先请求应用版本列表
   * 根据版本id获取应用详情
   * -----------
   * 直接通过应用id或版本id获取应用详情
   * */
  const handleSelectWorkflow = async (item: WorkFlow) => {
    onOpenChange(false);
    //
    // const workFlowVersions = await getWorkFlowVersion(item?.id);
    // const workFlowDetails = await getWorkFlowDetail(
    //   workFlowVersions?.items[0]?.id,
    // );

    // 测试 通过应用id、版本id查询应用详细配置
    const { workflow: newWorkflow, version: versionConfig } =
      await getWorkflowConfigById({ appId: item?.id, currentVersionNo: item?.currentVersionNo });
    // const { workflow: workflowVersion, version: versionConfig1 } =
    //   await getWorkflowConfigByVersionId({
    //     id: workFlowVersions?.items[0]?.id,
    //   });

    // easyAI params风格数据
    console.log(newWorkflow, versionConfig, 153)
    const components = JSON.parse(versionConfig?.uiSchema)?.components || [];
    const params = components.map((item, index) => {
      return {
        title: item?.title,
        componentName: item?.type,
        type: item.type,
        name:
          item?.type == "ImageSelectPreview"
            ? ""
            : item?.basic?.params[0]?.name,
        param:
          item?.type == "ImageSelectPreview"
            ? ""
            : item?.basic?.params[0]?.defaultValue,
        params:
          item?.type == "ImageSelectPreview" ? item?.basic?.params : undefined,
        attributes: item?.ext?.options || item?.ext,
      };
    });
    const workflow = {
      ...item,
      power: item?.computeCost || item?.price,
      params: params,
    };
    // console.log(workflow, 163);
    onSelectWorkflow(workflow);
  };

  // 重试函数
  const handleRetry = () => {
    loadWorkflowData();
  };
  const handleClose = () => {
    setWorkflowList([]);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Content className="modal-content">
          <div className="modal-container">
            <div className="modal-header flex justify-between">
              <Dialog.Title className="modal-title font-bold ping-medium ">
                选择模型
              </Dialog.Title>
              <Dialog.Close className="modal-close-btn outline-none">
                <X />
              </Dialog.Close>
            </div>
            {/* 模型列表 */}
            <div className="modal-body w-[100%] overflow-y-auto">
              {loading ? (
                <div className="modal-loading">
                  <div className="spinner"></div>
                  <span>加载中...</span>
                </div>
              ) : error ? (
                <div className="modal-error">
                  <span>{error}</span>
                  <button onClick={handleRetry} className="retry-btn">
                    重试
                  </button>
                </div>
              ) : (
                <div className="workflow-grid modal">
                  {workflowArr.length > 0 ? (
                    workflowArr.map((item) => (
                      <div
                        key={item.id}
                        className="workflow-item"
                        onClick={() => handleSelectWorkflow(item)}
                      >
                        {item.coverUrl && (
                          <img
                            className="workflow-img"
                            src={item.coverUrl}
                            alt={item.title}
                          />
                        )}
                        <div className="workflow-infos">
                          <div className="workflow-title PingFangMedium">
                            {item.title}
                          </div>
                          <div className="workflow-description PingFangRegular">
                            {item.description}
                          </div>
                          <div className="workflow-tags">
                            {item.tagIds?.map((tag, idx) => (
                              <span
                                key={idx}
                                className="workflow-tag PingFangRegular"
                              >
                                {tagObj[tag]}
                              </span>
                            ))}
                          </div>
                        </div>
                        {item.miniCover && (
                          <img
                            className="workflow-label"
                            src={item.miniCover}
                            alt="label"
                          />
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="workflow-item placeholder flex justify-center">
                      暂无数据
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default Modal;
