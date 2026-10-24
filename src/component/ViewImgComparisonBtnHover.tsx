import React, { useState, ReactNode } from 'react';
import { Modal, Button } from 'antd';
import { SwapOutlined, CloseOutlined } from '@ant-design/icons';
import MyImgComparisonSlider from '@/component/MyImgComparisonSlider';
import compareIcon from "@/assets/svg/compare.svg";
import compareShowIcon from "@/assets/svg/compare-show.svg";
import "@/assets/css/scss/workflow-common.scss";
interface ViewImgComparisonBtnHoverProps {
  input: string;
  output: string;
  children?: ReactNode;
}

// 图片对比
const CommonViewImgComparisonBtnHover: React.FC<ViewImgComparisonBtnHoverProps> = ({
  input,
  output,
  children,
}) => {
  const [comparisonDialog, setComparisonDialog] = useState(false);

  const handleOpenDialog = () => {
    setComparisonDialog(true);
  };

  const handleCloseDialog = () => {
    setComparisonDialog(false);
  };

  return (
    <div>
      {/* 悬浮按钮 */}
      <div
        className="bg-[#7d33ff] p-2 rounded-md cursor-pointer flex items-center text-white hover:bg-[#7d33ff] transition-colors"
        onClick={handleOpenDialog}
      >
        {/* <SwapOutlined className="mr-1" /> */}
        <img src={compareIcon} className='w-[16px] h-[16px]' />
        {children}
      </div>

      {/* 弹框组件 */}
      <Modal
        open={comparisonDialog}
        onCancel={handleCloseDialog}
        footer={null}
        width="60%"
        centered
        closeIcon={<CloseOutlined className='outline-none' />}
        className='ndmy-custom-modal relative'
        title={
          <div className="flex items-center justify-start py-1">
            <img src={compareShowIcon} className='w-[16px] h-[16px] mr-2' />
            <span>图片对比</span>
          </div>
        }
        styles={{
          body: {
            padding: '0 24px 24px 24px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            border: 'none'
          },
        }}
        // 响应式：小屏幕使用 90% 宽度
        {...(window.innerWidth <= 640 ? { width: '90%' } : {})}
      >
        <MyImgComparisonSlider inputImg={input} outputImg={output} />
      </Modal>
    </div>
  );
};

export default CommonViewImgComparisonBtnHover;