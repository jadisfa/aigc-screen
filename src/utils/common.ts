import { useLocation, useNavigate } from "react-router-dom";
import { listSessions } from "@/shared/api/sys/scheduler";
import { fetchAllPagesConcurrent } from "@/utils/fetchAll";
import {
  listWorkflowVersions,
  getWorkflowVersion,
} from "@/shared/api/workflow/workflow-version";
import { SubmitParamsResult } from "@/shared/hooks/useWorkflowCommon";
import { message } from "antd";

import {
  clearAccessToken,
  clearRefreshToken,
  clearScopeContext,
} from "@/shared/api/auth/auth";

export const handleLogout = (
  navigate?: (path: string, options?: { replace?: boolean }) => void,
) => {
  clearAccessToken();
  clearRefreshToken();
  clearScopeContext();
  // navigate("/", { replace: true });
};

message.config({
  top: 40
})

export const useMessage = () => {
  const messageInfo = (msg: string) => {
    message.info(msg);
  };

  const messageSuccess = (msg: string) => {
    message.success(msg)
  };

  const messageError = (msg: string) => {
    message.error(msg)
  };

  const messageWarning = (msg: string) => {
    message.warning(msg)
  };
  return {
    messageInfo,
    messageSuccess,
    messageError,
    messageWarning,
  };
};

const metrialTypes = {
  1: "款式",
  2: "手模",
};

export const getMetrialTcategoryId = (materialTypes: any[], type: number) => {
  const metrialTypsObj = materialTypes?.reduce((acc: ang, item: any) => {
    // 使用 id 或 name 作为 key，整个对象作为 value
    acc[item.name] = item.id;
    return acc;
  }, {});
  return metrialTypsObj[metrialTypes[type]];
};

// 返回会话历史数据，兼容用户历史和task历史
export const returnWorkflowList = (datas: any[]) => {
  const newDatas = datas?.map((item: any) => {
    const outputInfo = item?.itemsJson
      ? JSON.parse(item?.itemsJson)
      : JSON.parse(item?.outputJson)?.items || [];
    const outputArr = outputInfo.map((item) => {
      return item?.url;
    });
    return {
      ...item,
      tags: [
        item?.workflowInfo?.workflow?.workflow?.title ||
          item?.workflowInfo?.workflow?.workflow?.name,
      ], // 工作流名称
      workflow: item?.workflowInfo?.workflow?.workflow, // 工作流基础信息
      workflow_id: item?.workflowInfo?.workflow?.workflow?.id,
      params: item?.taskExecution
        ? JSON.parse(item?.taskExecution?.inputParams)?.params
        : JSON.parse(item?.inputJson)?.params,
      output: outputArr,
      created_at: item?.createdAt,
    };
  });
  return newDatas;
};

export const getStartOfDayBefore = (day: number): number => {
  return new Date(new Date().setDate(new Date().getDate() - day)).getDate();
};

/**
 * 获取指定天数前的日期的开始和结束时间戳（秒级）
 * @param day 天数偏移：0=今天，1=昨天，7=7天前
 * @returns { start: 起始时间戳, end: 结束时间戳 }
 */
export const getDateRange = (day: number): { start: number; end: number } => {
  const now = new Date();
  
  // 计算目标日期（今天 - day 天）
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() - day);
  
  // 当天的 00:00:00（起始）
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);
  
  // 当天的 23:59:59（结束）
  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);
  
  return {
    start: Math.floor(start.getTime() / 1000), // 秒级时间戳
    end: Math.floor(end.getTime() / 1000),
  };
};

// 获取当前用户所有会话并返回自定义会话
export const getSessionData = async () => {
  const allSession = await fetchAllPagesConcurrent(
    (params) => listSessions({ ...params }),
    1,
    50, // 每页条数
    3, // 并发数
  );
  return allSession.filter((item) => item?.sessionName == "自定义会话");
};

// 生成sessionId
export function generateId32(): string {
  const chars = "abcdef0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// 组装提交应用生成参数
export const assembleSubmitParams = async (
  submitParams: SubmitParamsResult,
  sessionId: string,
) => {
  const workFlowVersions = await listWorkflowVersions({
    pageNo: 1,
    pageSize: 1,
    workflowId: submitParams.workflow_app?.workflow_data?.id,
  });
  if (workFlowVersions.items.length > 0) {
    return {
      sessionName: "自定义会话",
      taskName: "自定义会话",
      tenantId: "GLOBAL",
      mode: "running",
      sessionId,
      // ...submitParams,
      appId: submitParams.workflow_app?.workflow_data?.id,
      params: submitParams.properties,
      ...submitParams?.workflow_app,
      workflowVersionId: workFlowVersions?.items[0]?.id,
    };
  }
};


// 根据元素填充相同值返回数组
export const  createFilledArray = (n, value = 0) => {
    return new Array(n).fill(value);
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0s";
  if (ms < 1000) return `0s`; // changed from Math.round(ms)ms to 0s to look cleaner for end users
  const s = ms / 1000;
  if (s < 60) return `${Math.floor(s)}s`;
  const m = Math.floor(s / 60);
  const rs = Math.floor(s % 60);
  if (m < 60) return `${m}m${rs ? `${rs}s` : ""}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h${rm ? `${rm}m` : ""}`;
}


export const toggleItem = <T>(arr: T[], item: T): T[] => {
  if (arr.some((i) => i === item)) {
    return arr.filter((i) => i !== item);
  } else {
    return [...arr, item];
  }
}