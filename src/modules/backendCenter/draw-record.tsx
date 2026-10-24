// draw-record.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as Select from "@radix-ui/react-select";
import { Select as AntSelect, Switch, Tabs, Modal as AntModal } from "antd";
import { PlusOutlined, FileImageOutlined } from "@ant-design/icons";
import { CommonUploadImage } from "@/component/commonUploadImage";
import type { WorkFlow, ComfyUIProperties, Param } from "@/utils/comfyuiApi";
import { useWorkflowForm, type workflowParams, type proportQuantity,} from "@/shared/hooks/useWorkflowCommon";
import { useClipboardUpload } from "@/shared/hooks/use-clipboard-upload";
import { listWorkflowCates } from "@/shared/api/workflow/workflow-cate";
import ComponentResusableButton from "@/component/resusableButton";
import ComponentMetrialModal from "@/modules/backendCenter/component/metrial-modal";
import DrawHistory from "@/component/draw-history";
import ComponentWriteModal from "@/component/write-modal";
import ComponentCustomClearnPositive from "@/component/custom-clean-positive";
import ComponentHistoryInfo from "@/modules/backendCenter/component/history-info";
import DrawRecordFilter from "@/modules/backendCenter/component/draw-record-filter";
import DrawRecordAction from "@/modules/backendCenter/component/draw-record-action";
import { listWorkflows, getWorkflowConfigById, type WorkflowCard } from "@/shared/api/workflow/workflow";
import { getSessionData, generateId32, assembleSubmitParams, useMessage } from "@/utils/common";
import { dispatch } from "@/shared/api/sys/scheduler";
import { fetchAllPagesConcurrent } from "@/utils/fetchAll";
import { Popover, Button, InputNumber, Tooltip } from "antd";
import { FilterCondition } from "@/modules/backendCenter/component/draw-record-filter";
import applicationUrl from "@/assets/img/application.png";
import btnParamsIcon from "@/assets/img/params.png";
import proportionIcon from "@/assets/img/proportion.png";
import transformUrl from "@/assets/img/transform.png";
import imgsIcon from "@/assets/img/imgs.png";
import { Plus, ChevronDown, FileImage, ChevronsDown } from "lucide-react";
import Modal from "@/component/modal";
import { useDrawSameStore } from "@/shared/hooks/use-draw-same";

import "@/assets/css/scss/workflow-common.scss";
import "@/assets/css/scss/draw-record.scss";
import "@/assets/css/creation.css";

// 类型定义
interface workflows {
  [key: string]: string;
}

const DrawRecord: React.FC = () => {
  const isInitialized = useRef(false);
  const isInit = useRef(false);
  const { messageError } = useMessage();
  const location = useLocation();
  const [activeKey, setActiveKey] = useState("NailArtDesign");
  const sessionArr = useRef([]);
  const [workFlowList, setWorkFlowList] = useState<WorkFlow[]>([]);
  const [categoryList, setCategoryList] = useState<any[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isBottom, setIsBottom] = useState(true);

  const { enabled, toggle, setEnabled } = useClipboardUpload();
  const bottomRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLElement | null>(null);

  const isLoadingMoreRef = useRef(false);
  const [isLoad, setIsLoad] = useState(false);
  const [params, setParams] = useState<FilterCondition>();
  const [reload, setReload] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const { drawSameWorkData, setDrawSameWork, clearDrawSameWork } = useDrawSameStore();

  const tabs = [
    { key: "NailArtDesign", label: "美甲设计" },
    { key: "SocialNediaBestseller", label: "社媒爆款" },
    { key: "NailTrialWear", label: "美甲试戴" },
    { key: "Copywriting", label: "文案创作" },
    { key: "VideoCreation", label: "视频创作" },
  ];

  const tabsObj: Record<string, string> = {
    美甲设计: "NailArtDesign",
    社媒爆款: "SocialNediaBestseller",
    美甲试戴: "NailTrialWear",
    文案创作: "Copywriting",
    视频创作: "VideoCreation",
  };

  const {
    file,
    setFile,
    file1,
    setFile1,
    workflowName,
    modalVisible,
    setModalVisible,
    metrialVisible,
    setMetrialVisible,
    writeVisible,
    setWriteVisible,
    metrialTitle,
    metrialType,
    workFlow,
    workflowId,
    workFlowsObj,
    setWorkFlowsObj,
    proportQuantityVisible,
    setProportQuantityVisible,
    proportQuantityVisibleSo,
    setProportQuantityVisibleSo,
    proportQualityVisible,
    setProportQualityVisible,
    proportTimeVisible,
    setProportTimeVisible,
    popconfirmVisible,
    setPopconfirmVisible,
    workflowStyles,
    workflowTypeNumbers,
    workflowParamObj,
    setWorkflowParamObj,
    selectWorkflowStyle,
    setSelectWorkflowStyle,
    selectWorkflowNum,
    setSelectWorkflowNum,
    selectWorkflowModal,
    setSelectWorkflowModal,
    selectWorkflowTitle,
    setSelectWorkflowTitle,
    proportionObj,
    proportNumberObj,
    setProportNumberObj,
    quantityObj,
    showPrompt,
    isIncludes,
    isNailImg,
    isInternetsense,
    positiveObj,
    positiveInfo,
    changePositive,
    positiveVisible,
    setPositiveVisible,
    handleClickPositive,
    Copywriting,
    copyWritingKey,
    setCopyWritingKey,
    platForm,
    qualityArr,
    timeArr,
    selectWorkflow,
    handleSelectStyle,
    handleSelectNum,
    handleSelectModal,
    getRatioStyle,
    changeProportion,
    handleTransform,
    selectMetrail,
    isDisabledStyle,
    isDisabledHandle,
    handleSelectWirte,
    selectCopyWrite,
    filterTrialWearData,
    filterCopywriting,
    filterVideoCreation,
    handleClearnPositive,
    isDisabled,
    isClipboardEnabled,
    handleChangeTabs,
    handleSelectClick,
    getpower,
    handleSelectMetrial,
    handleSelectWay,
    isUploadDisabled,
    isWorkflowParamEmpty,
    handleClickProportBtn,
    handleClickPorpotQualityBtn,
    buildSubmitParams,
    uploadName,
  } = useWorkflowForm({
    initialQuantity: "4",
    workFlowList,
    activeKey,
  });

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    const element = document.querySelector(".content-layout");
    if (!element) return;

    const { scrollTop, scrollHeight, clientHeight } = element;
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);

    // 如果已经在底部（距离小于 5px），不执行滚动
    if (distanceToBottom <= 5) {
      return;
    }

    // 执行滚动
    element.scrollTo({
      top: scrollHeight,
      behavior: "smooth",
    });
  }, []);

  // 滚动事件处理
  const onScroll = useCallback(() => {
    const element =
      layoutRef.current || document.getElementById("layout-content");
    if (element) {
      const { scrollTop, scrollHeight, clientHeight } = element;

      // console.log(scrollTop, 217);
      const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
      if (isInit.current) {
        setIsBottom(distanceToBottom <= 48);
        setIsCollapsed(distanceToBottom > 48);
      }
      if (
      isInit.current && 
      scrollTop <= 50 && 
      !isLoadingMoreRef.current &&
      !reload &&
      !hasMore
    ) {
      console.log('触发加载更多，scrollTop:', scrollTop);
      isLoadingMoreRef.current = true;
      setHasMore(true);
    }
    }
  }, [reload]);

  // 取消折叠
  const cancelCollapse = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  // 点击生成
  const handleSubmitWorkflow = async () => {
    const { properties, submitParams: lastParams } = await buildSubmitParams();
    // console.log(properties, lastParams, 257);
    const sessionId =
      sessionArr.current.length > 0
        ? sessionArr.current[0]?.sessionId
        : generateId32();
    const submitParamS = await assembleSubmitParams(lastParams, sessionId);
    dispatch({ ...submitParamS }).finally(async () => {
      const allSession = await getSessionData();
      sessionArr.current = allSession;
      setReload(true);
      setTimeout(() => {
        setReload(false);
      }, 10);
    });
    scrollToBottom();
    // 提交后清理标识
    sessionStorage.removeItem("shouldSubmitOnLoad");
  };

  // 做同款及创作页跳转恢复选中内容
  const customSameDraw = useCallback(
    (val: any, isScrollBottom?: boolean, initData?: any) => {
      let workflowParam = {} as workflowParams;
      let proportParam = {} as proportQuantity;
      const { workflow_id, _id, id, appId } = val;
      const params = initData ? initData : val.params;
      console.log(workFlowList, 260)
      const nowWorkFlow = workFlowList.find(
        (item: WorkFlow) =>
          item?._id == workflow_id || item?._id == _id || item?._id == appId,
      ) as WorkFlow;
      const nowWorkflowType = categoryList.find(
        (item) =>
          item?._id == nowWorkFlow?.categoryId ||
          item?.id == nowWorkFlow?.cateId,
      );
      const tabValue = tabsObj[nowWorkflowType?.name as keyof typeof tabsObj];
      handleChangeTabs(tabValue);
      setActiveKey(tabValue);
      // workFlow.value = nowWorkFlow;
      if (tabValue != "Copywriting") {
        selectWorkflow(nowWorkFlow);
      }
      setFile(
        params?.image_path || params?.image_first_frame
          ? [params?.image_path || params?.image_first_frame]
          : [],
      );
      if (params?.multi_source_image_path || params?.image_last_frame) {
        setFile1([params?.multi_source_image_path || params?.image_last_frame]);
      }
      if (tabValue == "VideoCreation") {
        proportParam.videoModal = params?.model_alias;
      }
      // 风格数据
      if (params?.advance_select_single_chips) {
        if (tabValue == "VideoCreation") {
          const advanceData = nowWorkFlow.params?.find(
            (item: Param) => item?.name == "advance_select_single_chips",
          );
          const styleIndex = Array.isArray(advanceData?.attributes)
            ? advanceData?.attributes?.findIndex(
                (item: any) => item.value == params.advance_select_single_chips,
              )
            : advanceData?.attributes?.selectItems?.findIndex(
                (item: any) => item.value == params.advance_select_single_chips,
              );
          proportParam = {
            ...proportParam,
            proport: {
              ...proportParam.proport,
              title: advanceData?.attributes[styleIndex]?.title,
              index: styleIndex,
              value: params.advance_select_single_chips,
            },
          };
        } else {
          const advanceData = nowWorkFlow.params?.find(
            (item: Param) => item?.name == "advance_select_single_chips",
          );
          const styleIndex = advanceData?.attributes?.findIndex(
            (item: any) => item.value == params.advance_select_single_chips,
          );
          workflowParam.style_title =
            advanceData?.attributes[styleIndex]?.title;
          workflowParam.style_value =
            advanceData?.attributes[styleIndex]?.value;
          workflowParam.active_style = styleIndex;
          setSelectWorkflowStyle(styleIndex);
        }
      }

      // 视频模块质量
      if (params?.advance_select_single_chips_1) {
        if (tabValue == "VideoCreation") {
          const qualityData = nowWorkFlow.params?.find(
            (item: Param) => item?.name == "advance_select_single_chips_1",
          );
          const qualityIndex = qualityData?.attributes?.findIndex(
            (item: any) => item.value == params.advance_select_single_chips_1,
          );
          proportParam = {
            ...proportParam,
            quality: {
              index: qualityIndex,
              title: qualityData?.attributes[qualityIndex]?.title,
              value: qualityData?.attributes[qualityIndex]?.value,
            },
          };
        } else {
          const PositiveIndex = positiveObj?.attributes?.findIndex(
            (item: any) => item.value == params.advance_select_single_chips_1,
          );
          // positiveInfo.name = positiveObj?.attributes[PositiveIndex]?.title;
          // positiveInfo.value = positiveObj?.attributes[PositiveIndex]?.value;
          // positiveInfo.index = PositiveIndex;
        }
      }

      // 视频时长
      if (params?.advance_select_single_chips_2) {
        const timeData = nowWorkFlow.params?.find(
          (item: Param) => item?.name == "advance_select_single_chips_2",
        );
        const timeIndex = timeData?.attributes?.findIndex(
          (item: any) => item.value == params.advance_select_single_chips_2,
        );
        proportParam = {
          ...proportParam,
          time: {
            index: timeIndex,
            title: timeData?.attributes[timeIndex]?.title,
            value: timeData?.attributes[timeIndex]?.value,
          },
        };
      }

      // 风格，甲型数据
      if (params?.lora_name || params?.lora_index) {
        const numberType =
          nowWorkFlow?.params?.filter((item: any) => {
            if (Array.isArray(item.params)) {
              return item.params.filter(
                (param: Param) => param.componentName === "ImageSelectPreview",
              );
            }
            return false;
          }) || [];
        // 这里需要更新 workflowTypeNumbers
        const loraIndex = params?.lora_index || 0;
        const param_lora_name = numberType[loraIndex]?.params[0]?.name;
        const param_lora_trigger_text = numberType[loraIndex]?.params[1]?.name;
        const loraTriggerIndex = params?.lora_index
          ? numberType[loraIndex]?.attributes.findIndex(
              (item: any) =>
                item?.valueExtra == params[param_lora_trigger_text] &&
                item.value == params[param_lora_name],
            )
          : numberType[loraIndex]?.attributes.findIndex(
              (item: any) =>
                item?.valueExtra == params?.lora_trigger_text &&
                item.value == params?.lora_name,
            );
        if (tabValue == "Copywriting") {
          filterCopywriting(workFlowList, nowWorkFlow?._id);
          setTimeout(() => {
            setCopyWritingKey(nowWorkFlow?._id);
            // console.log(Copywriting, 473);
            // handleSelectWirte(nowWorkFlow?._id);
          }, 100);
        }
        workflowParam.num_value = numberType[loraIndex]?.title;
        workflowParam.modal_title =
          numberType[loraIndex]?.attributes[loraTriggerIndex]?.title;
        workflowParam.modal_value =
          numberType[loraIndex]?.attributes[loraTriggerIndex]?.value;
        workflowParam.modal_attr =
          numberType[loraIndex]?.attributes[loraTriggerIndex]?.valueExtra;
        workflowParam.modal_src =
          numberType[loraIndex]?.attributes[loraTriggerIndex]?.src;
        workflowParam.active_modal = loraTriggerIndex;
        setSelectWorkflowNum(loraIndex);
        setSelectWorkflowModal(loraTriggerIndex);
        setSelectWorkflowTitle(
          numberType[loraIndex]?.attributes[loraTriggerIndex]?.title,
        );
      } else {
        if (tabValue == "Copywriting") {
          // filterCopywriting(workFlowList);
          // setTimeout(() => {
          //   setCopyWritingKey(nowWorkFlow?._id);
          //   handleSelectWirte(nowWorkFlow?._id);
          // }, 100);
        }
      }

      setProportNumberObj({
        ...proportNumberObj,
        quantity: params?.batch_size,
      });

      if (tabValue == "VideoCreation") {
        setProportNumberObj({ ...proportParam });
      }

      if (params?.positive) {
        workflowParam.positive = params?.positiveCN || params?.positive;
      }

      if (params.aspect_ratio) {
        const proportData =
          workFlow?.params?.filter(
            (paramItem: Param) => paramItem.name === "aspect_ratio",
          ) || [];
        // Object.assign(proportionObj, proportData[0] || {});
        if (proportData.length > 0) {
          const proportionIsArray = Array.isArray(proportionObj?.attributes);
          const proprotionIndex = proportionIsArray
            ? proportionObj?.attributes?.findIndex(
                (item: any) => item.value == params.aspect_ratio,
              )
            : proportionObj?.attributes?.selectItems?.findIndex(
                (item: any) => item.value == params.aspect_ratio,
              );
          setProportNumberObj({
            ...proportNumberObj,
            proport: {
              index: proprotionIndex || 0,
              title: proportionIsArray
                ? proportionObj?.attributes[proprotionIndex]?.title
                : proportionObj?.attributes?.selectItems[proprotionIndex]
                    ?.title,
              value: proportionIsArray
                ? proportionObj?.attributes[proprotionIndex]?.value
                : proportionObj?.attributes?.selectItems[proprotionIndex]
                    ?.value,
            },
          });
        }
      }
      setIsCollapsed(false);
      setWorkflowParamObj({ ...workflowParam });
      if (isScrollBottom) {
        setTimeout(() => {
          scrollToBottom();
        }, 300);
      }
    },
    [
      workFlowList,
      categoryList,
      workFlow,
      workflowParamObj,
      proportionObj,
      scrollToBottom,
    ],
  );

  // 初始化数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        const cates = await listWorkflowCates();
        setCategoryList(cates);
        const allWorkflow = await fetchAllPagesConcurrent(
          // (params) => listWorkflows({ ...params }),
          (params) => listWorkflows({ ...params, status: 'online' }),
          1,
          50, // 每页条数
          3, // 并发数
        );
        console.log(allWorkflow, 503)
        const newDatas = await Promise.all(
          allWorkflow
            .filter((item: WorkflowCard) => item?.cateId)
            .map(async (workFlowitem: WorkflowCard) => {
              const { workflow: newWorkflow, version: versionConfig } =
                await getWorkflowConfigById({ appId: workFlowitem?.id, currentVersionNo: workFlowitem.currentVersionNo });
              const components =
                JSON.parse(versionConfig?.uiSchema)?.components || [];
              const params = components.map((item: any) => {
                return {
                  title: item?.title,
                  componentName: item?.type,
                  type: item.type,
                  name:
                    item?.type == "ImageSelectPreview"
                      ? item?.type
                      : item?.basic?.params[0]?.name,
                  param:
                    item?.type == "ImageSelectPreview"
                      ? ""
                      : item?.basic?.params[0]?.defaultValue,
                  attributes: item?.ext?.options || item?.ext,
                  params:
                    item?.type == "ImageSelectPreview"
                      ? item?.basic?.params
                      : undefined,
                };
              });
              return {
                ...workFlowitem,
                _id: workFlowitem?.id,
                categoryId: workFlowitem?.cateId,
                power: workFlowitem?.computeCost,
                timeout_setting: workFlowitem?.timeoutSec,
                params: params,
              };
            }),
        );
        // console.log(newDatas, 627);
        setWorkFlowList(newDatas);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  // 监听 categoryList 变化
  useEffect(() => {
    if (categoryList && categoryList.length > 0) {
      if (!isInitialized.current) {
        isInitialized.current = true;
        const categoryObj = categoryList.reduce((acc: workflows, item: any) => {
          acc[item.name] = item.id;
          return acc;
        }, {});
        setWorkFlowsObj(categoryObj);
      }
      if (workFlowList.length > 0) {
        if (activeKey == "NailTrialWear") filterTrialWearData(workFlowList);
        if (activeKey == "Copywriting") filterCopywriting(workFlowList);
        if (activeKey == "VideoCreation") filterVideoCreation(workFlowList);
      }
    }
  }, [categoryList, activeKey, workFlowList]);

  // 滚动事件监听
  useEffect(() => {
    const element = document.getElementById("layout-content");
    scrollToBottom();
    if (element) {
      layoutRef.current = element as HTMLElement;
      element.addEventListener("scroll", onScroll);
      onScroll(); // 初始化
      setTimeout(() => {
        isInit.current = true;
      }, 200);
      return () => {
        element.removeEventListener("scroll", onScroll);
      };
    }
  }, [onScroll]);

  // 监听自定义事件
  useEffect(() => {
    const handleImageToText = (e: CustomEvent) => {
      const {value, url} = e.detail;
      const { params } = JSON.parse(value);
      // console.log(value, e.detail, 'value-', params, '监听自定义图转文')
      setActiveKey("Copywriting");
      handleChangeTabs("Copywriting");
      filterCopywriting(workFlowList);
      setFile([url]);
      setIsCollapsed(false);
    };

    const handleImageToVideo = (e: CustomEvent) => {
      const value = e.detail.value;
      const { output_content, activeIndex, output, outputJson } = JSON.parse(value);
      const items = JSON.parse(outputJson).items;
      // console.log(value, output,outputJson, activeIndex, '监听图转视频' )
      setActiveKey("VideoCreation");
      handleChangeTabs("VideoCreation");
      filterVideoCreation(workFlowList);
      setFile([output[activeIndex] || items[activeIndex]?.url]);
      setIsCollapsed(false);
    };

    // 监听再次生成
    const  handleRegenerateAgin = (e: CustomEvent) => {
      const value = e.detail.value;
      const { sessionId, params, app, appId, workflowVersionId } = JSON.parse(value);
      (async () => {
        getWorkflowConfigById({ appId: app?.id || appId }).then(async({ 
          workflow: newWorkflow, version: versionConfig
         }) => {
          const components = JSON.parse(versionConfig?.uiSchema)?.components || [];
        const workflowParams = components.map((item: any, index: number) => {
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
        
        const generateWorkflow = {
          ...newWorkflow,
          power: newWorkflow?.computeCost || newWorkflow?.price,
          params: workflowParams,
        };

        
        const submitParams = {
          properties: {
            ...params,
          },
          workflow_app: {
            workflow_id: app?.id,
            workflow_name: app?.title as string,
            workflow_title: app?.title || "",
            workflow_data: generateWorkflow,
          },
        };
        sessionStorage.setItem(
          "workflowSubmitParams",
          JSON.stringify(submitParams),
        );
        sessionStorage.setItem("workflowId", app?.id as string);
        sessionStorage.setItem("shouldSubmitOnLoad", "true");

        const submitParamS = await assembleSubmitParams(submitParams, sessionId);
        dispatch({ ...submitParamS }).finally(async () => {
          const allSession = await getSessionData();
          sessionArr.current = allSession;
          setReload(true);
          setTimeout(() => {
            setReload(false);
          }, 10);
        });
        scrollToBottom();
        // 提交后清理标识
        sessionStorage.removeItem("shouldSubmitOnLoad");
         }).catch((err) => {
          messageError( err?.message || "再次生成失败，请重试")
         });
        
    })();
    }

    const handleDeleteTask = () => {
      onFilterChange()
    }

    window.addEventListener(
      "imageToText-set",
      handleImageToText as EventListener,
    );
    window.addEventListener(
      "imageToVideo-set",
      handleImageToVideo as EventListener,
    );
    window.addEventListener("regenerate", handleRegenerateAgin as EventListener)
    window.addEventListener('deleteTask', handleDeleteTask)
    const getSessionArr = async () => {
      const allSession = await getSessionData();
      sessionArr.current = allSession;
    };

    getSessionArr();

    if (drawSameWorkData && workFlowList.length > 0) {
      console.log('🟢 收到画同款数据:', workFlowList, drawSameWorkData);
      customSameDraw(drawSameWorkData, true)
      // 处理数据
      clearDrawSameWork();
    }
    return () => {
      window.removeEventListener(
        "imageToText-set",
        handleImageToText as EventListener,
      );
      window.removeEventListener(
        "imageToVideo-set",
        handleImageToVideo as EventListener,
      );
      window.removeEventListener("regenerate", handleRegenerateAgin as EventListener)
      window.removeEventListener("deleteTask", handleDeleteTask)
    };
  }, [drawSameWorkData, workFlowList]);

  // 主初始化 useEffect - 替代 onMounted
  useEffect(() => {
    const workflowIdRoute = sessionStorage.getItem("workflowId");

    const initialize = async () => {
      // 添加页面可见性变化监听
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          // socketInit();
          // console.log("页面可见，重新连接");
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      // // 滚动到底部
      // setTimeout(() => {
      //   scrollToBottom();
      // }, 500);

      try {
        // 1. 获取工作流可用状态
        // const availableData = await fetch(`/draw/getAvailableStatus/${workflowIdRoute}`);
        // setIsWorkflowAvailable(availableData);

        // 2. 获取工作流详情
        // const wfData = await fetch(`/workflow/${workflowIdRoute}`);
        // setWorkflowApp(wfData);

        // 3. 初始化默认参数
        // await initDefaultParams();

        // 4. 如果没有 workflow_id，加载全部绘画历史
        if (!workflowIdRoute) {
          console.log("🟢 [drawRecord] 无 workflow_id，加载全部绘画历史");
          // await loadNextPageRemoteTasks();
        }

        // 5. 初始化 Socket 连接
        // await initSocketConnection();

        // 6. 检查是否需要提交任务
        const shouldSubmitOnLoad =
          sessionStorage.getItem("shouldSubmitOnLoad") === "true";
        const lastParamsStr = sessionStorage.getItem("workflowSubmitParams");
        const lastParams = lastParamsStr ? JSON.parse(lastParamsStr) : null;
        // console.log(lastParams, 791);
        const init = sessionStorage.getItem("initData");

        // 7. 如果有 initData，执行画同款
        if (init) {
          customSameDraw(
            lastParams?.workflow_app?.workflow_data,
            true,
            lastParams?.properties,
          );
          sessionStorage.removeItem("initData");
        }

        // 8. 如果需要提交任务
        if (
          shouldSubmitOnLoad &&
          lastParams &&
          Object.keys(lastParams).length > 0
        ) {
          const sessionId =
            sessionArr.current.length > 0
              ? sessionArr.current[0]?.sessionId
              : generateId32();
          const submitParamS = await assembleSubmitParams(
            lastParams,
            sessionId,
          );
          dispatch({ ...submitParamS }).finally(async () => {
            const allSession = await getSessionData();
            sessionArr.current = allSession;
            setReload(true);
            setTimeout(() => {
              setReload(false);
            }, 10);
          });
          // setBindParams(lastParams.properties);

          sessionStorage.removeItem("shouldSubmitOnLoad");
        } 
      } catch (error) {
        console.error("Failed to load workflow:", error);
      }

      // 清理 sessionStorage
      if (!sessionStorage.getItem("workflowSubmitParams")) {
        sessionStorage.removeItem("workflowSubmitParams");
      }

      // // 再次滚动到底部
      setTimeout(() => {
        scrollToBottom();
      }, 500);

      // // 获取 Tabs DOM 引用
      // if (tabsRef.current) {
      //   const domElement = tabsRef.current;
      //   if (domElement instanceof HTMLElement) {
      //     tabsDomRef.current = domElement;
      //   }
      // }

      // // 初始化滚动状态
      // onScroll();

      // 添加全局点击监听
      // document.addEventListener('click', globalClickListener);

      // 返回清理函数
      return () => {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
        // document.removeEventListener('click', globalClickListener);
        // 清除 sessionStorage
        // clearLastSubmitParams();
      };
    };
    if (Object.keys(workFlowsObj).length > 0 && workFlowList.length > 0)
      initialize();
  }, [workFlowsObj, workFlowList]); // 需要依赖工作流已加载，只在组件挂载时执行一次

  // 监听数据筛选, 来源有两个：操作区，筛选框
  const onFilterChange = (condition?: FilterCondition) => {
    if (condition) {
      setIsLoad(true);
      setParams(condition);
    } else {
      setParams(undefined);
      setReload(true);
    }
    setTimeout(() => {
      setIsLoad(false);
      setReload(false);

    }, 10);
    setTimeout(() => {
      scrollToBottom();
    }, 500)
  };

  // 操作区设置
  const onActionChange = (condition: FilterCondition) => {
    console.log(condition, 901)
    if (condition?.type == "refreshStatus") {
      setParams(undefined);
      setReload(true);
    } else {
      const newParams = { ...params, ...condition };
      setParams(newParams);
      setIsLoad(true)
    }
    setTimeout(() => {
      setIsLoad(false);
      setReload(false);
    }, 10);
  }

  useEffect(() => {
  if (reload) {
    isLoadingMoreRef.current = false;
    setHasMore(false);
  }
}, [reload]);

  const handleUpdateSts = useCallback(() => {
  // console.log('DrawHistory 加载完成，重置状态');
  // ✅ 延迟重置 hasMore，避免在 DrawHistory 的 finally 之前被重置
  isLoadingMoreRef.current = false;
  // 延迟重置，确保 DrawHistory 状态已更新
  setHasMore(false);
}, []);

  return (
    <div ref={targetRef} className="draw-record-content">
      {/* 固定头部 - 暂不处理 */}
      <div className="draw-record-fix-header">
        <DrawRecordAction onFilterChange={onActionChange} />
        <DrawRecordFilter onFilterChange={onFilterChange} />
        <ComponentHistoryInfo />
      </div>

      {/* AI 绘画记录 */}
      <div className="scrollable-content" style={{ marginBottom: "300px" }}>
        <DrawHistory
          params={params}
          load={isLoad}
          reload={reload}
          reverse={true}
          loadMore={hasMore}
          sessionId={sessionArr?.current[0]?.sessionId}
          updateSts={handleUpdateSts}
        />
      </div>
      {/* Tab 容器 */}
      <div className="tabs-container mx-auto max-w-[910px]">
        {/* 折叠区域 */}
        <div
          className={`tabs-container-collapsed ${isCollapsed ? "tabs-container-collapsed-visible collapsed" : ""}`}
          onClick={cancelCollapse}
        >
          {activeKey == "NailArtDesign" && (
            <div className="collapsed-tabs">
              <CommonUploadImage
                key={`collapsed-file-${activeKey}`}
                files={file}
                onFilesChange={setFile}
                maxSize={10}
                limit={1}
                listType="picture-card"
                className="collapsed-upload"
              >
                <div className="flex flex-col justify-center items-center">
                  <PlusOutlined style={{ fontSize: "10px" }} />
                  <div style={{ marginTop: "2px" }} className="collapsed-text">
                    {uploadName()}
                  </div>
                </div>
              </CommonUploadImage>
              <div className="tabs-footer-right collapsed">
                <ComponentResusableButton
                  power={getpower}
                  disabled={isDisabled}
                  className="collapsed-btn"
                  onClick={cancelCollapse}
                />
              </div>
            </div>
          )}
          {activeKey == "SocialNediaBestseller" && (
            <div className="collapsed-tabs">
              <CommonUploadImage
                key={`collapsed-file-${activeKey}`}
                files={file}
                onFilesChange={setFile}
                maxSize={10}
                limit={1}
                listType="picture-card"
                className="collapsed-upload"
              >
                <div className="flex flex-col justify-center items-center">
                  <PlusOutlined style={{ fontSize: "10px" }} />
                  <div style={{ marginTop: "2px" }} className="collapsed-text">
                    {uploadName()}
                  </div>
                </div>
              </CommonUploadImage>
              {isNailImg && (
                <CommonUploadImage
                  key={`file1-${activeKey}`}
                  files={file1}
                  onFilesChange={setFile1}
                  maxSize={10}
                  limit={1}
                  listType="picture-card"
                  className="collapsed-upload"
                  style={{ marginLeft: "8px" }}
                >
                  <div className="flex flex-col justify-center items-center">
                    <PlusOutlined style={{ fontSize: "10px" }} />
                    <div
                      className="collapsed-text"
                      style={{ marginTop: "-2px" }}
                    >
                      {uploadName(1)}
                    </div>
                  </div>
                </CommonUploadImage>
              )}
              {showPrompt && (
                <div
                  style={{
                    height: "54px",
                    width: "600px",
                    marginLeft: "10px",
                    cursor: "pointer",
                  }}
                  onClickCapture={cancelCollapse}
                >
                  <textarea
                    value={workflowParamObj.positive}
                    onChange={(e) =>
                      setWorkflowParamObj({
                        ...workflowParamObj,
                        positive: e.target.value,
                      })
                    }
                    className="custom-text"
                  />
                  <ComponentCustomClearnPositive
                    data={workflowParamObj.positive}
                    className="collapsed-clearn-social"
                    onClearnPosition={handleClearnPositive}
                  />
                </div>
              )}
              <div className="tabs-footer-right collapsed">
                <ComponentResusableButton
                  power={getpower}
                  disabled={isDisabled}
                  className="collapsed-btn"
                  onClick={cancelCollapse}
                />
              </div>
            </div>
          )}
          {activeKey == "NailTrialWear" && (
            <div className="collapsed-tabs">
              <CommonUploadImage
                key={`collapsed-file-${activeKey}`}
                files={file}
                onFilesChange={setFile}
                maxSize={10}
                limit={1}
                listType="picture-card"
                className="collapsed-upload"
              >
                <div className="flex flex-col justify-center items-center">
                  <PlusOutlined style={{ fontSize: "10px" }} />
                  <div className="collapsed-text" style={{ marginTop: "-2px" }}>
                    {uploadName()}
                  </div>
                </div>
              </CommonUploadImage>
              <CommonUploadImage
                key={`collapsed-file1-${activeKey}`}
                files={file1}
                onFilesChange={setFile1}
                maxSize={10}
                limit={1}
                listType="picture-card"
                className="collapsed-upload"
                style={{ marginLeft: "10px" }}
              >
                <div className="flex flex-col justify-center items-center">
                  <PlusOutlined style={{ fontSize: "10px" }} />
                  <div className="collapsed-text" style={{ marginTop: "-2px" }}>
                    {uploadName(1)}
                  </div>
                </div>
              </CommonUploadImage>
              <div className="tabs-footer-right collapsed">
                <ComponentResusableButton
                  power={getpower}
                  disabled={isDisabled}
                  className="collapsed-btn"
                  onClick={cancelCollapse}
                />
              </div>
            </div>
          )}
          {activeKey == "Copywriting" && (
            <div className="collapsed-tabs">
              <CommonUploadImage
                key={`collapsed-file-${activeKey}`}
                files={file}
                onFilesChange={setFile}
                maxSize={10}
                limit={1}
                listType="picture-card"
                className="collapsed-upload"
              >
                <div className="flex flex-col justify-center items-center">
                  <PlusOutlined style={{ fontSize: "10px" }} />
                  <div style={{ marginTop: "2px" }} className="collapsed-text">
                    {uploadName()}
                  </div>
                </div>
              </CommonUploadImage>
              <div className="tabs-footer-right collapsed">
                <ComponentResusableButton
                  power={getpower}
                  disabled={isDisabled}
                  className="collapsed-btn"
                  onClick={cancelCollapse}
                />
              </div>
            </div>
          )}
          {activeKey == "VideoCreation" && (
            <div className="collapsed-tabs">
              <CommonUploadImage
                key={`collapsed-file-${activeKey}`}
                files={file}
                onFilesChange={setFile}
                maxSize={10}
                limit={1}
                listType="picture-card"
                className="collapsed-upload"
              >
                <div className="flex flex-col justify-center items-center">
                  <PlusOutlined style={{ fontSize: "10px" }} />
                  <div className="collapsed-text" style={{ marginTop: "4px" }}>
                    首帧
                  </div>
                </div>
              </CommonUploadImage>
              <img
                src={transformUrl}
                style={{
                  width: "18px",
                  height: "18px",
                  margin: "0 4px",
                  cursor: "pointer",
                }}
                onClick={handleTransform}
              />
              <CommonUploadImage
                key={`collapsed-file1-${activeKey}`}
                files={file1}
                onFilesChange={setFile1}
                maxSize={10}
                limit={1}
                listType="picture-card"
                className="collapsed-upload"
              >
                <div className="flex flex-col justify-center items-center">
                  <PlusOutlined style={{ fontSize: "10px" }} />
                  <div className="collapsed-text" style={{ marginTop: "4px" }}>
                    尾帧
                  </div>
                </div>
              </CommonUploadImage>
              <textarea
                value={workflowParamObj.positive}
                onChange={(e) =>
                  setWorkflowParamObj({
                    ...workflowParamObj,
                    positive: e.target.value,
                  })
                }
                className="custom-text video-creation"
                placeholder="输入图片生成的提示词，例如:浩瀚的银河中一艘宇宙飞船驶过"
              />
              <ComponentCustomClearnPositive
                data={workflowParamObj.positive}
                className="collapsed-clearn-video"
                onClearnPosition={handleClearnPositive}
              />
              <div className="tabs-footer-right collapsed">
                <ComponentResusableButton
                  power={getpower}
                  disabled={isDisabled}
                  className="collapsed-btn"
                  onClick={cancelCollapse}
                />
              </div>
            </div>
          )}
        </div>

        {/* 主 Tabs - 使用 antd Tabs */}
        <div
          className={`drawRecord-tabs ${isCollapsed ? "drawRecord-tabs-hidden" : ""}`}
        >
          <div className="tabs-header">
            <div className="tabs-list">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`tabs-tab ${activeKey === tab.key ? "active" : ""}`}
                  onClick={() => {
                    // getTabWorkflowList(tab.key);
                    handleChangeTabs(tab.key);
                    setActiveKey(tab.key);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Right Extra 内容 */}
            {activeKey !== "NailTrialWear" && activeKey !== "VideoCreation" && (
              <div className="right-extra-body">
                <div className="right-extra-left">
                  <FileImage className="w-4 h-4" />
                  <span>上传图片</span>
                </div>
                <Tooltip title={`点击${enabled ? "禁用" : "启用"}剪粘板监听`}>
                  <Switch
                    checked={enabled}
                    onChange={toggle}
                    size="small"
                    className="clipboard-switch"
                    style={{ marginTop: "3px" }}
                  />
                </Tooltip>
              </div>
            )}
          </div>

          <div className="tabs-content">
            {/* 美甲设计 */}
            {activeKey === "NailArtDesign" && (
              <div className="tabs-content-container">
                <div className="creation-upload socialNedia-header">
                  <CommonUploadImage
                    files={file}
                    onFilesChange={setFile}
                    maxSize={10}
                    limit={1}
                    enableClipboard={enabled}
                    className="socialnedia-upload"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <Plus className="h-8 w-8 text-gray-400" />
                      <div className="mt-2 text-sm text-gray-500">
                        {uploadName()}
                      </div>
                    </div>
                  </CommonUploadImage>
                </div>
                <div className="tabs-footer">
                  <div className="tabs-footer-left">
                    {/* 应用选择 */}
                    <Select.Root open={false} value={""}>
                      <Select.Trigger
                        className="creation-select"
                        onClick={() => handleSelectClick("美甲设计")}
                      >
                        <Select.Value
                          placeholder={
                            <div className="custom-placeholder">
                              <img
                                src={applicationUrl}
                                style={{
                                  width: "13px",
                                  height: "13px",
                                  marginRight: "4px",
                                }}
                              />
                              <span style={{ color: "#333" }}>
                                {workflowName || "应用选择"}
                              </span>
                              <ChevronDown className="w-4 h-4" />
                            </div>
                          }
                        />
                      </Select.Trigger>

                      {/* 这里放一个空的下拉内容，隐藏默认选项 */}
                      <Select.Portal>
                        <Select.Content position="popper" sideOffset={5}>
                          <Select.Viewport />
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                    {/* 参数选择 */}
                    <Popover
                      open={popconfirmVisible}
                      title={null}
                      placement="bottom"
                      trigger="click"
                      onOpenChange={(open) => {
                        if (!workflowName) return;
                        setPopconfirmVisible(open);
                      }}
                      content={
                        <>
                          <div className="params-body">
                            {/* 风格 */}
                            {workflowStyles.length > 0 && (
                              <div className="params-style">
                                <span className="params-title">选择风格</span>
                                <div className="params-style-list">
                                  {workflowStyles[0]?.attributes?.map(
                                    (paramsStyle, paramsIndex) => {
                                      return (
                                        <div
                                          className={`params-style-item ${selectWorkflowStyle == paramsIndex ? "params-select" : ""}`}
                                          key={paramsIndex}
                                          onClick={() =>
                                            handleSelectStyle(paramsIndex)
                                          }
                                        >
                                          {paramsStyle?.title}
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            )}
                            {/* 甲量 */}
                            {workflowTypeNumbers.length > 0 && (
                              <div className="params-nums">
                                <span className="params-title">甲片数量</span>
                                <div className="params-style-list">
                                  {workflowTypeNumbers?.map(
                                    (paramsNums, paramsNumsIndex) => {
                                      return (
                                        <div
                                          key={paramsNumsIndex}
                                          className={`params-style-item ${selectWorkflowNum == paramsNumsIndex ? "params-select" : ""}`}
                                          onClick={() =>
                                            handleSelectNum(paramsNumsIndex)
                                          }
                                        >
                                          {paramsNums?.title}
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            )}
                            {/* 甲型 */}
                            {workflowTypeNumbers.length > 0 && (
                              <div className="params-model">
                                <span className="params-title">{`选择甲型：${selectWorkflowTitle || ""}`}</span>
                                <div className="params-style-list modal">
                                  {workflowTypeNumbers[
                                    selectWorkflowNum
                                  ]?.attributes?.map(
                                    (paramsModal, paramsModalIndex) => {
                                      return (
                                        <div
                                          className={`params-style-item modal-img ${selectWorkflowModal == paramsModalIndex ? "params-select" : ""}`}
                                          key={paramsModalIndex}
                                          onClick={() =>
                                            handleSelectModal(
                                              paramsModalIndex,
                                              paramsModal,
                                            )
                                          }
                                        >
                                          <img
                                            src={paramsModal?.src}
                                            style={{
                                              width: "100%",
                                              height: "100%",
                                              borderRadius: "10px",
                                            }}
                                          />
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      }
                    >
                      <Button type="default" className="params-btn">
                        {isWorkflowParamEmpty && (
                          <div
                            className="btn-params-default"
                            onClick={() => handleClickProportBtn(1)}
                          >
                            <img src={btnParamsIcon} />
                            <span style={{ color: "#333", marginLeft: "6px" }}>
                              参数选择
                            </span>
                          </div>
                        )}
                        {!isWorkflowParamEmpty && (
                          <div className="btn-params-data">
                            {workflowParamObj?.style_title && (
                              <span>{`${workflowParamObj?.style_title || ""}`}</span>
                            )}
                            {workflowParamObj?.num_value && (
                              <span>
                                {workflowParamObj?.style_title ? " |  " : ""}
                                {`${workflowParamObj?.num_value || ""}`}
                              </span>
                            )}
                            {workflowParamObj?.modal_title && (
                              <span>{` |  ${workflowParamObj?.modal_title || ""}`}</span>
                            )}
                          </div>
                        )}
                      </Button>
                    </Popover>
                    {/* 比例、数量 */}
                    <Popover
                      open={proportQuantityVisible}
                      title={null}
                      placement="bottom"
                      trigger="click"
                      onOpenChange={(open) => {
                        if (!workflowName) return;
                        setProportQuantityVisible(open);
                      }}
                      content={
                        <>
                          <div className="proportional-quantity-body">
                            <div className="proportional-item">
                              <span className="params-title">选择比例</span>
                              <div className="proportional-list">
                                {Array.isArray(proportionObj?.attributes) &&
                                  proportionObj?.attributes?.map(
                                    (protItem, protIndex) => (
                                      <div
                                        className={`proportional-item-data ${proportNumberObj?.proport?.index == protIndex ? "select" : ""}`}
                                        key={protIndex}
                                        onClick={() =>
                                          changeProportion(protItem, protIndex)
                                        }
                                      >
                                        <div className="proport-body">
                                          <div
                                            className="proportional-item-body"
                                            style={getRatioStyle(
                                              protItem.value,
                                            )}
                                          />
                                        </div>
                                        <span className="params-title proport">
                                          {protItem.value}
                                        </span>
                                      </div>
                                    ),
                                  )}
                              </div>
                            </div>
                            <div className="proportional-quantity-number">
                              <span className="params-title">生成款式数量</span>
                              <InputNumber
                                id="inputNumber"
                                value={proportNumberObj.quantity}
                                decimalSeparator="0"
                                style={{ width: "50px" }}
                                onStep={(value, info) => {
                                  //  上下调整更新字段
                                  const proportNumInfo = {
                                    ...proportNumberObj,
                                    quantity: value,
                                  };
                                  setProportNumberObj(proportNumInfo);
                                }}
                                precision={0}
                                min={quantityObj?.attributes?.min || 1}
                                max={quantityObj?.attributes?.max || 10}
                                step={quantityObj?.attributes?.step || 1}
                              />
                            </div>
                          </div>
                        </>
                      }
                    >
                      <Button
                        type="default"
                        className="params-btn no-margin"
                        onClick={() => handleClickProportBtn()}
                      >
                        <div className="btn-params-data proportional-quantity">
                          <div className="img-proport">
                            <img
                              src={proportionIcon}
                              style={{
                                width: "14px",
                                height: "14px",
                                marginRight: "6px",
                              }}
                            />
                            <span>{proportNumberObj.proport.value}</span>
                          </div>
                          <div className="proport-quantity-driver" />
                          <div className="img-quantity">
                            <img
                              src={imgsIcon}
                              style={{
                                width: "19px",
                                height: "19px",
                                marginRight: "6px",
                              }}
                            />
                            <span>{proportNumberObj.quantity || 4}</span>
                          </div>
                        </div>
                      </Button>
                    </Popover>
                  </div>
                  <div className="tabs-footer-right">
                    <ComponentResusableButton
                      disabled={isDisabled}
                      power={getpower}
                      onClick={handleSubmitWorkflow}
                    />
                  </div>
                </div>
              </div>
            )}
            {/* 社媒爆款 */}
            {activeKey === "SocialNediaBestseller" && (
              <div className="tabs-content-container">
                <div className="NailTrialWear-header">
                  <CommonUploadImage
                    key={`file-${activeKey}`}
                    files={file}
                    onFilesChange={setFile}
                    maxSize={5}
                    limit={1}
                    enableClipboard={enabled}
                    className="socialnedia-upload"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <Plus className="h-8 w-8 text-gray-400" />
                      <div className="mt-2 text-sm text-gray-500">
                        {uploadName()}
                      </div>
                    </div>
                  </CommonUploadImage>
                  {isNailImg && (
                    <CommonUploadImage
                      key={`file1-${activeKey}`}
                      files={file1}
                      onFilesChange={setFile1}
                      maxSize={5}
                      limit={1}
                      enableClipboard={enabled}
                      className="socialnedia-upload"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Plus className="h-8 w-8 text-gray-400" />
                        <div className="mt-2 text-sm text-gray-500">
                          {uploadName("1")}
                        </div>
                      </div>
                    </CommonUploadImage>
                  )}
                  {showPrompt && (
                    <>
                      <textarea
                        v-if="showPrompt"
                        value={workflowParamObj.positive}
                        className="custom-text"
                        style={{ marginLeft: "8px" }}
                        placeholder="请输入提示词"
                      />
                      <ComponentCustomClearnPositive
                        data={workflowParamObj.positive}
                        onClearnPosition={handleClearnPositive}
                      />
                    </>
                  )}
                </div>
                {/* 社媒爆款底部信息 */}
                <div className="tabs-footer">
                  <div className="tabs-footer-left">
                    <Select.Root open={false} value={""}>
                      <Select.Trigger
                        className="creation-select"
                        onClick={() => handleSelectClick("社媒爆款")}
                      >
                        <Select.Value
                          placeholder={
                            <div className="custom-placeholder">
                              <img
                                src={applicationUrl}
                                style={{
                                  width: "13px",
                                  height: "13px",
                                  marginRight: "4px",
                                }}
                              />
                              <span style={{ color: "#333" }}>
                                {workflowName || "应用选择"}
                              </span>
                              <ChevronDown className="w-4 h-4" />
                            </div>
                          }
                        />
                      </Select.Trigger>

                      {/* 这里放一个空的下拉内容，隐藏默认选项 */}
                      <Select.Portal>
                        <Select.Content position="popper" sideOffset={5}>
                          <Select.Viewport />
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                    {/* 网感自拍应用-提示词选择 */}
                    {isInternetsense && (
                      <Popover
                        open={positiveVisible}
                        title={null}
                        placement="bottom"
                        trigger="click"
                        onOpenChange={(open) => {
                          if (!workflowName) return;
                          setPositiveVisible(open);
                        }}
                        content={
                          <>
                            <div className="proportional-quantity-body">
                              <div className="proportional-item">
                                <span className="params-title">提示词选择</span>
                                <div className="params-style-list">
                                  {Array.isArray(positiveObj?.attributes) &&
                                    positiveObj?.attributes.map(
                                      (protItem, protIndex) => (
                                        <div
                                          className={`params-style-item ${positiveInfo?.index == protIndex ? "params-select" : ""}`}
                                          key={protIndex}
                                          onClick={() =>
                                            changePositive(protItem, protIndex)
                                          }
                                        >
                                          {protItem?.title}
                                        </div>
                                      ),
                                    )}
                                </div>
                              </div>
                            </div>
                          </>
                        }
                      >
                        <Button
                          type="default"
                          className="params-btn margin-left"
                          onClick={() => handleClickPositive()}
                        >
                          <div className="btn-params-data proportional-quantity">
                            <div className="img-proport">
                              <span>{positiveInfo?.name || "提示词选择"}</span>
                            </div>
                          </div>
                        </Button>
                      </Popover>
                    )}

                    {/* 比例、数量 */}
                    <Popover
                      open={proportQuantityVisible}
                      title={null}
                      placement="bottom"
                      trigger="click"
                      onOpenChange={(open) => {
                        if (!workflowName) return;
                        setProportQuantityVisible(open);
                      }}
                      content={
                        <>
                          <div className="proportional-quantity-body">
                            <div className="proportional-item">
                              <span className="params-title">选择比例</span>
                              <div className="proportional-list">
                                {Array.isArray(proportionObj?.attributes) &&
                                  proportionObj?.attributes?.map(
                                    (protItem, protIndex) => (
                                      <div
                                        className={`proportional-item-data ${proportNumberObj?.proport?.index == protIndex ? "select" : ""}`}
                                        key={protIndex}
                                        onClick={() =>
                                          changeProportion(protItem, protIndex)
                                        }
                                      >
                                        <div className="proport-body">
                                          <div
                                            className="proportional-item-body"
                                            style={getRatioStyle(
                                              protItem.value,
                                            )}
                                          />
                                        </div>
                                        <span className="params-title proport">
                                          {protItem.value}
                                        </span>
                                      </div>
                                    ),
                                  )}
                              </div>
                            </div>
                            {isIncludes && (
                              <div className="proportional-quantity-number">
                                <span className="params-title">
                                  生成款式数量
                                </span>
                                <InputNumber
                                  id="inputNumber"
                                  value={proportNumberObj.quantity}
                                  decimalSeparator="0"
                                  style={{ width: "50px" }}
                                  onStep={(value, info) => {
                                    //  上下调整更新字段
                                    const proportNumInfo = {
                                      ...proportNumberObj,
                                      quantity: value,
                                    };
                                    setProportNumberObj(proportNumInfo);
                                  }}
                                  precision={0}
                                  min={quantityObj?.attributes?.min || 1}
                                  max={quantityObj?.attributes?.max || 10}
                                  step={quantityObj?.attributes?.step || 1}
                                />
                              </div>
                            )}
                          </div>
                        </>
                      }
                    >
                      <Button
                        type="default"
                        className="params-btn margin-left"
                        onClick={() => handleClickProportBtn()}
                      >
                        <div className="btn-params-data proportional-quantity">
                          <div className="img-proport">
                            <img
                              src={proportionIcon}
                              style={{
                                width: "14px",
                                height: "14px",
                                marginRight: "6px",
                              }}
                            />
                            <span>{proportNumberObj.proport.value}</span>
                          </div>
                          {isIncludes && (
                            <>
                              <div className="proport-quantity-driver" />
                              <div className="img-quantity">
                                <img
                                  src={imgsIcon}
                                  style={{
                                    width: "19px",
                                    height: "19px",
                                    marginRight: "6px",
                                  }}
                                />
                                <span>{proportNumberObj.quantity || 4}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </Button>
                    </Popover>
                  </div>
                  <div className="tabs-footer-right">
                    <ComponentResusableButton
                      disabled={isDisabled}
                      power={getpower}
                      onClick={handleSubmitWorkflow}
                    />
                  </div>
                </div>
              </div>
            )}
            {/* 美甲试戴 */}
            {activeKey === "NailTrialWear" && (
              <div className="tabs-content-container">
                <div className="NailTrialWear-header">
                  <CommonUploadImage
                    key={`file-${activeKey}`}
                    files={file}
                    onFilesChange={setFile}
                    maxSize={5}
                    limit={1}
                    enableClipboard={false}
                    className="socialnedia-upload"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <Plus className="h-8 w-8 text-gray-400" />
                      <div className="mt-2 text-sm text-gray-500">
                        {uploadName()}
                      </div>
                    </div>
                  </CommonUploadImage>
                  <CommonUploadImage
                    key={`file1-${activeKey}`}
                    files={file1}
                    onFilesChange={setFile1}
                    maxSize={5}
                    limit={1}
                    enableClipboard={false}
                    className="socialnedia-upload"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <Plus className="h-8 w-8 text-gray-400" />
                      <div className="mt-2 text-sm text-gray-500">
                        {uploadName("1")}
                      </div>
                    </div>
                  </CommonUploadImage>
                </div>
                <div className="tabs-footer">
                  <div className="tabs-footer-left">
                    <Select.Root open={false} value={""}>
                      <Select.Trigger
                        className={`creation-select ${isDisabledStyle ? "disabled" : ""}`}
                        onClick={() => {
                          if (isDisabledStyle) return;
                          handleSelectMetrial(1);
                        }}
                      >
                        <Select.Value
                          placeholder={
                            <div className="custom-placeholder NailTrialWear">
                              <img
                                src={applicationUrl}
                                style={{
                                  width: "13px",
                                  height: "13px",
                                  marginRight: "4px",
                                }}
                              />
                              <span style={{ color: "#333" }}>{"款式库"}</span>
                              <ChevronDown className="w-4 h-4" />
                            </div>
                          }
                        />
                      </Select.Trigger>

                      {/* 这里放一个空的下拉内容，隐藏默认选项 */}
                      <Select.Portal>
                        <Select.Content position="popper" sideOffset={5}>
                          <Select.Viewport />
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                    <Select.Root open={false} value={""}>
                      <Select.Trigger
                        className={`creation-select ${isDisabledHandle ? "disabled" : ""}`}
                        onClick={() => {
                          if (isDisabledHandle) return;
                          handleSelectMetrial(2);
                        }}
                      >
                        <Select.Value
                          placeholder={
                            <div className="custom-placeholder NailTrialWear">
                              <img
                                src={applicationUrl}
                                style={{
                                  width: "13px",
                                  height: "13px",
                                  marginRight: "4px",
                                }}
                              />
                              <span style={{ color: "#333" }}>{"手模库"}</span>
                              <ChevronDown className="w-4 h-4" />
                            </div>
                          }
                        />
                      </Select.Trigger>

                      {/* 这里放一个空的下拉内容，隐藏默认选项 */}
                      <Select.Portal>
                        <Select.Content position="popper" sideOffset={5}>
                          <Select.Viewport />
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                  </div>
                  <div className="tabs-footer-right">
                    <ComponentResusableButton
                      disabled={isDisabled}
                      power={getpower}
                      onClick={handleSubmitWorkflow}
                    />
                  </div>
                </div>
              </div>
            )}
            {/* 文案创作 */}
            {activeKey === "Copywriting" && (
              <div className="tabs-content-container">
                <div className="creation-upload NailTrialWear-header">
                  <CommonUploadImage
                    files={file}
                    onFilesChange={setFile}
                    maxSize={10}
                    limit={1}
                    enableClipboard={enabled}
                    className="socialnedia-upload"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <Plus className="h-8 w-8 text-gray-400" />
                      <div className="mt-2 text-sm text-gray-500">
                        {uploadName()}
                      </div>
                    </div>
                  </CommonUploadImage>
                </div>
                <div className="tabs-footer">
                  <div className="tabs-footer-left">
                    <AntSelect
                      className="creation-select"
                      value={copyWritingKey}
                      onChange={(val, option) => {
                        handleSelectWirte(val);
                      }}
                      placeholder={
                        <div className="custom-placeholder">
                          <img
                            src={applicationUrl}
                            style={{
                              width: "13px",
                              height: "13px",
                              marginRight: "4px",
                            }}
                          />
                          <div style={{ color: "#333", whiteSpace: "nowrap" }}>
                            {"应用选择"}
                          </div>
                        </div>
                      }
                      labelRender={(props) => {
                        const { value, label } = props;
                        // 从 Copywriting 中查找完整数据
                        const item = Copywriting.find((w) => w._id === value);
                        return (
                          <div
                            className="custom-placeholder"
                            style={{ display: "flex", alignItems: "center" }}
                          >
                            <img
                              src={applicationUrl}
                              style={{
                                width: "13px",
                                height: "13px",
                                marginRight: "4px",
                              }}
                            />
                            <span style={{ color: "#333" }}>
                              {item?.title || label || "应用选择"}
                            </span>
                          </div>
                        );
                      }}
                      options={Copywriting.map((writeItem) => ({
                        value: writeItem?._id,
                        label: writeItem?.title,
                        // 可以添加自定义数据
                        data: writeItem,
                        ...writeItem,
                      }))}
                      optionRender={(option) => (
                        <div className="select-option-item">
                          <img
                            src={applicationUrl}
                            style={{
                              width: "13px",
                              height: "13px",
                              marginRight: "4px",
                              display: "inline-flex",
                            }}
                          />
                          <span>{option.data.label}</span>
                        </div>
                      )}
                    />
                    {/* 平台信息 */}
                    {platForm.length > 0 && (
                      <Select.Root open={false} value={""}>
                        <Select.Trigger
                          className="creation-select"
                          onClick={() => handleSelectWay()}
                        >
                          <Select.Value
                            placeholder={
                              <div className="custom-placeholder justify-between">
                                {workflowParamObj?.modal_src && (
                                  <img
                                    src={workflowParamObj?.modal_src}
                                    style={{
                                      width: "18px",
                                      height: "18px",
                                      borderRadius: "50%",
                                      marginRight: "4px",
                                    }}
                                  />
                                )}
                                <div
                                  style={{
                                    color: "#333",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {workflowParamObj.modal_title || "平台选择"}
                                </div>
                                <ChevronDown className="w-4 h-4" />
                              </div>
                            }
                          />
                        </Select.Trigger>

                        {/* 这里放一个空的下拉内容，隐藏默认选项 */}
                        <Select.Portal>
                          <Select.Content position="popper" sideOffset={5}>
                            <Select.Viewport />
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
                    )}
                  </div>
                  <div className="tabs-footer-right">
                    <ComponentResusableButton
                      disabled={isDisabled}
                      power={getpower}
                      onClick={handleSubmitWorkflow}
                    />
                  </div>
                </div>
              </div>
            )}
            {/* 视频创作 */}
            {activeKey === "VideoCreation" && (
              <div className="tabs-content-container">
                <div className="videoCreation-header">
                  <div className="videoCreation-left">
                    <CommonUploadImage
                      files={file}
                      onFilesChange={setFile}
                      maxSize={10}
                      limit={1}
                      enableClipboard={false}
                      className="socialnedia-upload"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Plus className="h-8 w-8 text-gray-400" />
                        <div className="mt-2 text-sm text-gray-500">
                          {"首帧"}
                        </div>
                      </div>
                    </CommonUploadImage>
                    <img
                      src={transformUrl}
                      style={{
                        width: "24px",
                        height: "24px",
                        margin: " 0 4px",
                        cursor: "pointer",
                      }}
                      onClick={handleTransform}
                    />
                    <CommonUploadImage
                      files={file1}
                      onFilesChange={setFile1}
                      maxSize={10}
                      limit={1}
                      enableClipboard={false}
                      className="socialnedia-upload"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Plus className="h-8 w-8 text-gray-400" />
                        <div className="mt-2 text-sm text-gray-500">
                          {"尾帧"}
                        </div>
                      </div>
                    </CommonUploadImage>
                  </div>
                  <textarea
                    value={workflowParamObj.positive}
                    onChange={(val) =>
                      setWorkflowParamObj({
                        ...workflowParamObj,
                        positive: val.target.value,
                      })
                    }
                    className="custom-text video-creation"
                    placeholder="输入图片生成的提示词，例如:浩瀚的银河中一艘宇宙飞船驶过"
                  />
                  <ComponentCustomClearnPositive
                    data={workflowParamObj.positive}
                    onClearnPosition={handleClearnPositive}
                  />
                </div>
                <div className="tabs-footer">
                  <div className="tabs-footer-left">
                    {/* 比例质量 */}
                    <Popover
                      open={proportQualityVisible}
                      title={null}
                      placement="bottom"
                      trigger="click"
                      onOpenChange={(open) => {
                        if (!workFlow) return;
                        setProportQualityVisible(open);
                      }}
                      content={
                        <>
                          <div className="proportional-quantity-body">
                            <div className="proportional-item">
                              <span className="params-title">选择比例</span>
                              <div className="proportional-list">
                                {Array.isArray(proportionObj?.attributes) &&
                                  proportionObj?.attributes?.map(
                                    (protItem, protIndex) => (
                                      <div
                                        className={`proportional-item-data ${proportNumberObj?.proport?.index == protIndex ? "select" : ""}`}
                                        key={protIndex}
                                        onClick={() =>
                                          changeProportion(protItem, protIndex)
                                        }
                                      >
                                        <div className="proport-body">
                                          <div
                                            className="proportional-item-body"
                                            style={getRatioStyle(
                                              protItem.value,
                                            )}
                                          />
                                        </div>
                                        <span className="params-title proport">
                                          {protItem.value}
                                        </span>
                                      </div>
                                    ),
                                  )}
                              </div>
                            </div>
                            <div className="proportional-quantity-number time">
                              <span className="params-title">视频质量</span>
                              <div className="params-style-list">
                                {qualityArr.map((paramsStyle, paramsIndex) => (
                                  <div
                                    className={`params-style-item ${proportNumberObj?.quality?.index == paramsIndex ? "params-select" : ""}`}
                                    key={paramsIndex}
                                    onClick={() =>
                                      handleSelectStyle(
                                        paramsIndex,
                                        paramsStyle,
                                        "quality",
                                      )
                                    }
                                  >
                                    {paramsStyle?.title}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </>
                      }
                    >
                      <Button
                        type="default"
                        className="params-btn no-margin"
                        onClick={() => handleClickPorpotQualityBtn(1)}
                      >
                        <div className="btn-params-data proportional-quantity">
                          <div className="img-proport">
                            <img
                              src={proportionIcon}
                              style={{
                                width: "14px",
                                height: "14px",
                                marginRight: "6px",
                              }}
                            />
                            <span>{proportNumberObj.proport.value}</span>
                          </div>
                          <div className="proport-quantity-driver" />
                          <div className="img-quantity">
                            <span>{proportNumberObj.quality?.title}</span>
                          </div>
                        </div>
                      </Button>
                    </Popover>
                    {/*  视频时长 */}
                    <Popover
                      open={proportTimeVisible}
                      title={null}
                      placement="bottom"
                      trigger="click"
                      onOpenChange={(open) => {
                        if (!workFlow) return;
                        setProportTimeVisible(open);
                      }}
                      content={
                        <>
                          <div className="proportional-quantity-body">
                            <div className="proportional-item">
                              <span className="params-title">选择时长</span>
                              <div className="params-style-list">
                                {timeArr.map((paramsStyle, paramsIndex) => (
                                  <div
                                    className={`params-style-item ${proportNumberObj?.time?.index == paramsIndex ? "params-select" : ""}`}
                                    key={paramsIndex}
                                    onClick={() =>
                                      handleSelectStyle(
                                        paramsIndex,
                                        paramsStyle,
                                        "time",
                                      )
                                    }
                                  >
                                    {paramsStyle?.title}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </>
                      }
                    >
                      <Button
                        type="default"
                        className="params-btn time"
                        onClick={() => handleClickPorpotQualityBtn(2)}
                      >
                        <div className="btn-params-data proportional-quantity">
                          <div className="img-proport">
                            <img
                              src={proportionIcon}
                              style={{
                                width: "14px",
                                height: "14px",
                                marginRight: "6px",
                              }}
                            />
                            <span>{proportNumberObj.time?.title}</span>
                          </div>
                        </div>
                      </Button>
                    </Popover>
                  </div>
                  <div className="tabs-footer-right">
                    <ComponentResusableButton
                      disabled={isDisabled}
                      power={getpower}
                      onClick={handleSubmitWorkflow}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部锚点 */}
      <div ref={bottomRef} />

      {/* Modal 组件 */}
      <Modal
        open={modalVisible}
        onOpenChange={setModalVisible}
        workflowId={workflowId || ""}
        onSelectWorkflow={(item) => selectWorkflow(item)}
      />

      {/* 素材选择 Modal */}
      <ComponentMetrialModal
        visible={metrialVisible}
        title={metrialTitle}
        type={metrialType}
        onVisibleChange={setMetrialVisible}
        onSelectMetrail={selectMetrail}
      />

      {/* 平台选择 Modal */}
      <ComponentWriteModal
        writeVisible={writeVisible}
        data={platForm || []}
        onVisibleChange={setWriteVisible}
        onSelectCopyWrite={selectCopyWrite}
      />

      {/* 回到底部按钮 */}
      {!isBottom && (
        <div
          className="gotoBottom tabs items-center justify-center"
          onClick={scrollToBottom}
        >
          <span>回到底部</span>
          <ChevronsDown className="h-4" />
        </div>
      )}
    </div>
  );
};

export default DrawRecord;
