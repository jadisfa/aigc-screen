// write-modal.tsx (增强版)
import React, { useState, useCallback, useEffect } from "react";
import { Modal, Spin, Empty } from "antd";
import type { attrItem } from "@/utils/commonType";
import "@/assets/css/scss/write-modal.scss";

interface WriteModalProps {
  writeVisible: boolean;
  data: attrItem[];
  loading?: boolean;
  title?: string;
  onVisibleChange: (visible: boolean) => void;
  onSelectCopyWrite: (item: attrItem) => void;
}

const ComponentWriteModal: React.FC<WriteModalProps> = ({
  writeVisible,
  data = [],
  loading = false,
  title = "平台选择",
  onVisibleChange,
  onSelectCopyWrite,
}) => {
  const [internalLoading, setInternalLoading] = useState<boolean>(false);

  // 处理模态框取消
  const handleModalCancel = useCallback(() => {
    onVisibleChange(false);
  }, [onVisibleChange]);

  // 选择平台
  const handleSelectWorkflow = useCallback(
    (item: attrItem) => {
      onVisibleChange(false);
      onSelectCopyWrite(item);
    },
    [onVisibleChange, onSelectCopyWrite],
  );

  // 关闭时重置加载状态
  useEffect(() => {
    if (!writeVisible) {
      setInternalLoading(false);
    }
  }, [writeVisible]);

  // 同步外部 loading 状态
  useEffect(() => {
    setInternalLoading(loading);
  }, [loading]);

  return (
    <Modal
      open={writeVisible}
      title={title}
      footer={null}
      width={386}
      centered
      onCancel={handleModalCancel}
    >
      <div className="write-modal-content">
        <Spin
          spinning={internalLoading}
          style={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
        >
          <div className="write-content-wrapper">
            {data.length > 0 ? (
              <div className="write-workflow-grid">
                {data.map((item, index) => (
                  <div
                    key={item.value || index}
                    className="write-workflow-item"
                    onClick={() => handleSelectWorkflow(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectWorkflow(item);
                      }
                    }}
                  >
                    {item?.src && (
                      <img
                        className="write-workflow-img"
                        src={item.src}
                        alt={item.title || "平台图标"}
                      />
                    )}
                    <div className="write-workflow-title color666">
                      {item.title}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                description="暂无数据"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                }}
              />
            )}
          </div>
        </Spin>
      </div>
    </Modal>
  );
};

export default ComponentWriteModal;
