// pages/user-center/index.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Tabs, Card, Button, Avatar, Tag, Table, message, Modal } from "antd";
import type { ColumnsType } from "antd/es/table";
import { UserOutlined, CameraOutlined, PlusOutlined } from "@ant-design/icons";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import { getUser } from "@/shared/api/ums/iam";
import { uploadUserAvatar } from "@/modules/ums/api/user-avatar";
import { md5HexFromFile } from "@/shared/lib/md5";
import { CONSOLE_PERMISSION_NAMESPACE } from "@/shared/lib/permissions";
import FundLedgerPage from "@/modules/fund/pages/FundLedgerPage";
import ConsumptionBillPage from "@/modules/ops/pages/ConsumptionBillPage";
import UserDrawHistory from "@/modules/backendCenter/component/user-draw-history";
import "@/assets/css/scss/use-center.scss";

// 类型定义
interface UserInfo {
  id: string;
  username?: string;
  nickname?: string;
  avatar_url?: string;
  balance?: number;
  [key: string]: any;
}

interface PayOrder {
  _id: string;
  out_trade_no: string;
  product_id?: { name: string };
  amount?: { total: number };
  order_status: 0 | 1;
  order_create_time: string;
  order_pay_time: string;
  [key: string]: any;
}

const usePayGetRecords = async (): Promise<PayOrder[]> => {
  // TODO: 替换为实际的 API 调用
  return [];
};

const usePayDeleteOrder = async (id: string): Promise<boolean> => {
  // TODO: 替换为实际的 API 调用
  return true;
};

const selectFiles = (options: {
  accept: string;
  multiple: boolean;
}): Promise<File[]> => {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = options.accept;
    input.multiple = options.multiple;
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;
      if (files) {
        resolve(Array.from(files));
      } else {
        resolve([]);
      }
    };
    input.click();
  });
};

// 组件 Props
interface UserCenterProps {
  onTabChange?: (tab: string) => void;
}

const UserCenter: React.FC<UserCenterProps> = ({ onTabChange }) => {
  // State
  const [user, setUser] = useState<UserInfo | null>(null);
  const [activeTab, setActiveTab] = useState<string>("history");
  const [userDialogVisible, setUserDialogVisible] = useState<boolean>(false);
  const [avatarHover, setAvatarHover] = useState<boolean>(false);
  const [records, setRecords] = useState<PayOrder[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 15,
  });
  const { data: meInfo, refetch: refetchMePermissions } = useMePermissions({
    sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode,
  });

  // 获取用户信息
  const avatar = user?.avatarUrl || "";
  const fetchUserInfo = useCallback(async () => {
    if (meInfo?.userId) {
      try {
        const userData = await getUser({ id: meInfo.userId });
        setUser(userData);
      } catch (error) {
        console.error("获取用户信息失败:", error);
      }
    }
  }, [meInfo?.userId]);

  useEffect(() => {
    fetchUserInfo();
  }, [meInfo]);

  // 标签配置
  const tabs = [
    { value: "history", text: "绘画历史" },
    { value: "expense", text: "消费记录" },
  ];

  // 表格列配置
  const columns: ColumnsType<PayOrder> = [
    {
      title: "订单号",
      dataIndex: "out_trade_no",
      key: "out_trade_no",
      width: 150,
      align: "left",
      render: (text) => <span className="text-nowrap text-xs">{text}</span>,
    },
    {
      title: "商品或服务",
      dataIndex: "product_id",
      key: "product_id",
      width: 150,
      align: "left",
      render: (productId) => (
        <span className="text-nowrap text-xs">{productId?.name || "-"}</span>
      ),
    },
    {
      title: "订单金额",
      dataIndex: "amount",
      key: "amount",
      width: 120,
      align: "left",
      render: (amount) => (
        <span className="text-nowrap text-xs">{amount?.total / 100 || 0}</span>
      ),
    },
    {
      title: "订单状态",
      dataIndex: "order_status",
      key: "order_status",
      width: 120,
      align: "left",
      render: (status) => (
        <Tag color={status === 1 ? "success" : "error"} className="text-xs">
          {status === 1 ? "已支付" : "未支付"}
        </Tag>
      ),
    },
    {
      title: "订单创建时间",
      dataIndex: "order_create_time",
      key: "order_create_time",
      width: 180,
      align: "left",
      render: (time) => (
        <span className="text-nowrap text-xs">
          {time ? new Date(time).toLocaleString() : ""}
        </span>
      ),
    },
    {
      title: "订单支付时间",
      dataIndex: "order_pay_time",
      key: "order_pay_time",
      width: 180,
      align: "left",
      render: (time) => (
        <span className="text-nowrap text-xs">
          {time ? new Date(time).toLocaleString() : ""}
        </span>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 100,
      align: "left",
      render: (_, record) =>
        record.order_status === 0 && (
          <Button
            type="link"
            danger
            size="small"
            onClick={() => handleDeletePayOrder(record._id)}
          >
            删除
          </Button>
        ),
    },
  ];

  // 计算分页后的数据
  const paginatedRecords = useMemo(() => {
    const start = (pagination.current - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return records.slice(start, end);
  }, [records, pagination]);

  // 处理分页变化
  const handleTableChange = (page: number, pageSize: number) => {
    setPagination({
      current: page,
      pageSize: pageSize,
    });
  };

  // 获取交易记录
  const handleGetRecords = useCallback(async () => {
    try {
      const result = await usePayGetRecords();
      setRecords(result || []);

      const totalPages = Math.ceil((result || []).length / pagination.pageSize);
      if (pagination.current > totalPages && totalPages > 0) {
        setPagination((prev) => ({ ...prev, current: totalPages }));
      } else if (pagination.current > 1 && (result || []).length === 0) {
        setPagination((prev) => ({ ...prev, current: 1 }));
      }
    } catch (error) {
      console.error("获取交易记录失败:", error);
    }
  }, [pagination.current, pagination.pageSize]);

  // 删除订单
  const handleDeletePayOrder = useCallback(
    async (id: string) => {
      Modal.confirm({
        title: "确认删除",
        content: "确定要删除该订单吗？",
        okText: "确定",
        cancelText: "取消",
        onOk: async () => {
          const res = await usePayDeleteOrder(id);
          if (res) {
            message.success("删除成功");
            handleGetRecords();
          }
        },
      });
    },
    [handleGetRecords],
  );

  // 打开用户设置（剪贴板设置）
  const openUserDialog = useCallback(() => {
    // 使用剪贴板设置 store
    // 这里可以根据需要实现
    setUserDialogVisible(true);
  }, []);

  // 上传头像
  const handleUploadAvatar = useCallback(async () => {
    try {
      const fileList = await selectFiles({
        accept: "image/*",
        multiple: false,
      });
      if (!fileList || fileList.length === 0 || !fileList[0]) return;
      const fileHash = await md5HexFromFile(fileList[0]);
      const uploadedAvatarUrl = await uploadUserAvatar({
        userId: user.id,
        file: fileList[0],
        fileHash,
      });
      if (!uploadedAvatarUrl) {
        message.error("头像上传失败");
        return;
      }

      fetchUserInfo();
      message.success("头像更新成功");
    } catch (error) {
      console.error("更新头像失败:", error);
      message.error("更新头像失败，请稍后重试");
    }
  }, [user]);

  // 初始化加载
  useEffect(() => {
    handleGetRecords();
  }, [handleGetRecords]);

  // 标签切换
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  // 渲染头像
  const renderAvatar = () => {
    const avatarContent = avatar ? (
      <img
        src={avatar}
        alt="用户头像"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    ) : (
      <div className="bg-theme-surface p-6 rounded-full flex align-center justify-center">
        <CameraOutlined style={{ fontSize: "32px", color: "#999" }} />
      </div>
    );

    return (
      <div
        className="avatar-container"
        onMouseEnter={() => setAvatarHover(true)}
        onMouseLeave={() => setAvatarHover(false)}
        onClick={avatar ? openUserDialog : handleUploadAvatar}
        style={{
          position: "relative",
          display: "inline-block",
          cursor: "pointer",
        }}
      >
        <Avatar
          size={83}
          icon={!avatar ? <UserOutlined /> : undefined}
          src={avatar}
          style={{ width: "83px", height: "83px" }}
        >
          {!avatar && <UserOutlined />}
        </Avatar>
        {avatar && avatarHover && (
          <div
            className="avatar-overlay"
            onClick={(e) => {
              e.stopPropagation();
              handleUploadAvatar();
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <CameraOutlined style={{ fontSize: "32px", color: "white" }} />
          </div>
        )}
      </div>
    );
  };

  // 渲染标签内容
  const renderTabContent = () => {
    switch (activeTab) {
      case "history":
        return (
          <div className="tab-content">
            <UserDrawHistory />
          </div>
        );
      // case "tradingRecords":
      //   return (
      //     <div className="tab-content">
      //       <Table
      //         columns={columns}
      //         dataSource={paginatedRecords}
      //         rowKey="_id"
      //         scroll={{ x: 1400, y: "calc(100vh - 320px)" }}
      //         pagination={{
      //           current: pagination.current,
      //           pageSize: pagination.pageSize,
      //           total: records.length,
      //           showSizeChanger: true,
      //           pageSizeOptions: ["10", "15", "20", "30", "50", "100"],
      //           showTotal: (total) => `共 ${total} 条`,
      //           onChange: handleTableChange,
      //           onShowSizeChange: (current, size) => {
      //             setPagination({
      //               current: 1,
      //               pageSize: size,
      //             });
      //           },
      //         }}
      //         size="small"
      //         className="charge-record-table"
      //       />
      //     </div>
      //   );
      case "expense":
        return <div className="tab-content">{<FundLedgerPage custom={true} />}</div>;
      default:
        return null;
    }
  };

  return (
    <div className="user-center-container">
      {/* 头部 */}
      <div className="user-center-header">
        <div className="user-center-left">
          {renderAvatar()}
          <div className="user-center-info">
            <h3 className="user-name">
              {user?.nickname || user?.username || "用户"}
              <span className="auth-member-info">
                {/* AuthMemberInfo 组件 */}
              </span>
            </h3>
            <div className="user-info-bottom">
              <div className="user-balance">算力余额：{user?.balance || 0}</div>
              {/* <UseRedeemCode /> */}
            </div>
          </div>
        </div>
        <Button type="default" shape="round" onClick={openUserDialog} className="hover:!border-gray-200 hover:!text-[#7d33ff]">
          个人设置
        </Button>
      </div>

      {/* 内容卡片 */}
      <Card className="user-center-card overflow-hidden" variant="text">
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          className="user-center-tabs"
          items={tabs.map((tab) => ({
            key: tab.value,
            label: tab.text,
            children: renderTabContent(),
          }))}
        />
      </Card>
    </div>
  );
};

export default UserCenter;
