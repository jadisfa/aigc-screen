// 创作页
import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as Select from "@radix-ui/react-select";
import { Select as AntSelect, Switch } from "antd";
import { CommonUploadImage } from "@/component/commonUploadImage";
import type { WorkFlow } from "@/utils/comfyuiApi";
import { useWorkflowForm } from "@/shared/hooks/useWorkflowCommon";
import { useClipboardUpload } from "@/shared/hooks/use-clipboard-upload";
import { listWorkflowCates } from "@/shared/api/workflow/workflow-cate";
import CommonLogo from "@/component/commonLog";
import ComponentResusableButton from "@/component/resusableButton";
import ComponentMetrialModal from "@/modules/backendCenter/component/metrial-modal";
import ComponentInspirationCenter from "@/modules/backendCenter/component/inspiration-center";
import ComponentWriteModal from "@/component/write-modal";
import ComponentCustomClearnPositive from "@/component/custom-clean-positive";
import { fetchWorkflowList, getWorkFlowVersion, getWorkFlowDetail } from "@/component/modal";
import { Popover, Button, InputNumber, Tooltip } from "antd";
import creationIcon from "@/assets/img/creation_icon.png";
import applicationUrl from "@/assets/img/application.png";
import btnParamsIcon from "@/assets/img/params.png";
import proportionIcon from "@/assets/img/proportion.png";
import transformUrl from "@/assets/img/transform.png";
import imgsIcon from "@/assets/img/imgs.png";
import { Plus, ChevronDown, FileImage } from "lucide-react";
import Modal from "@/component/modal";

import "@/assets/css/scss/workflow-common.scss";
import "@/assets/css/creation.css";

const Creation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [workFlowList, setWorkFlowList] = useState<WorkFlow[]>([]);
  const [categoryList, setCategoryList] = useState<any[]>([]);

  const { enabled, toggle, setEnabled } = useClipboardUpload();

  // 从 URL 查询参数中获取 tab 值
  const getInitialTab = () => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    // 有效的 tab 值列表
    const validTabs = [
      "NailArtDesign",
      "SocialNediaBestseller",
      "NailTrialWear",
      "Copywriting",
      "VideoCreation",
    ];
    // 如果 tab 参数有效则使用，否则使用默认值
    return tabParam && validTabs.includes(tabParam)
      ? tabParam
      : "NailArtDesign";
  };

  const [activeKey, setactiveKey] = useState(getInitialTab);
  const tabs = [
    { key: "NailArtDesign", label: "美甲设计" },
    { key: "SocialNediaBestseller", label: "社媒爆款" },
    { key: "NailTrialWear", label: "美甲试戴" },
    { key: "Copywriting", label: "文案创作" },
    { key: "VideoCreation", label: "视频创作" },
  ];
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
    selectWorkflowNum,
    selectWorkflowModal,
    selectWorkflowTitle,
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
    // isTextDisabled,
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

  // 点击生成
  const handleSubmitWorkflow = async () => {
    await buildSubmitParams();
    sessionStorage.setItem("initData", "true");
    navigate(`/backendCenter/draw-record`);
  };

  // 监听 URL 变化，更新 activeKey
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const tabParam = params.get("tab");
    const validTabs = [
      "NailArtDesign",
      "SocialNediaBestseller",
      "NailTrialWear",
      "Copywriting",
      "VideoCreation",
    ];
    if (tabParam && validTabs.includes(tabParam)) {
      setactiveKey(tabParam);
    }
  }, [location.search]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cates = await listWorkflowCates();
        setCategoryList(cates);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (categoryList && categoryList.length > 0) {
      const categoryObj = categoryList.reduce((acc: workflows, item: any) => {
        // 使用 id 或 name 作为 key，整个对象作为 value
        acc[item.name] = item.id;
        return acc;
      }, {});
      setWorkFlowsObj(categoryObj);
      if (
        (activeKey == "Copywriting" ||
        activeKey == "NailTrialWear" ||
        activeKey == "VideoCreation")
      ) {
        getTabWorkflowList(activeKey, categoryObj).then((workflowData) => {
            if (activeKey == "NailTrialWear") filterTrialWearData(workflowData, categoryObj);
            if (activeKey == "Copywriting") filterCopywriting(workflowData, null, categoryObj);
            if (activeKey == "VideoCreation") filterVideoCreation(workflowData, categoryObj);
        });
      }
    }
  }, [categoryList, activeKey]);

  const getTabWorkflowList = async (key: string, cateGoryObj) => {
    let workflowType = "";
    switch (key) {
      case "NailTrialWear":
        workflowType = "美甲试戴";
        break;
      case "Copywriting":
        workflowType = "文案创作";
        break;
      case "VideoCreation":
        workflowType = "视频创作";
        break;
      default:
        workflowType = "美甲设计";
        break;
    }
    // 读取该分类下的所有工作流
    const data = await fetchWorkflowList(cateGoryObj[workflowType]);
    // console.log(data, cateGoryObj, key, 239);
    // 遍历所有工作流，根据工作流di读取版本，读取第一个版本的详细配置，并赋值workflowList
    const newDatas = await Promise.all(
      data.map(async (workFlowitem) => {
        const workFlowVersions = await getWorkFlowVersion(workFlowitem?.id);
        const workFlowDetails = await getWorkFlowDetail(
          workFlowVersions?.items[0]?.id,
        );
        const components =
          JSON.parse(workFlowDetails?.uiSchema)?.components || [];
        const params = components.map((item, index) => {
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
    setWorkFlowList(newDatas);
    return newDatas;
  };

  // 全局粘贴事件处理（对应 Vue 中的 handleGlobalPaste）
  const handleGlobalPaste = useCallback(
    (e: ClipboardEvent) => {
      // console.log(enabled, 281);
      if (!enabled) return;

      // 通过自定义事件转发给活跃的上传组件
      const activeEvent = new CustomEvent("global-paste-forward", {
        detail: { originalEvent: e },
      });
      window.dispatchEvent(activeEvent);
    },
    [enabled],
  );

  // 注册和移除粘贴事件监听
  useEffect(() => {
    window.addEventListener("paste", handleGlobalPaste, true);
    return () => {
      window.removeEventListener("paste", handleGlobalPaste, true);
    };
  }, [handleGlobalPaste]);

  const handleUpdateWorkflow = (
    work: WorkFlow,
    tabKey: string,
    src: string,
  ) => {
    // const params = JSON.parse(work?.taskExecution?.inputParams)?.params;
    setactiveKey(tabKey);
    setFile([src])
        // console.log("更新工作流:", work, tabKey, src, 309);
        selectWorkflow(work)
    // 处理逻辑：切换到对应的 tab，选中工作流，设置图片
    // 参考 Vue 中的 updateWorkflow 函数
  };

  return (
    <div className="creation-container">
      <div className="creation-content noData">
        <div className="main-header items-center">
          <CommonLogo creation={true} className="creation-logo" />
          <div className="creation-info">
            <img src={creationIcon} className="creation-cion" />
            <span className="text20">百变风格 超多模型供你选择</span>
          </div>
        </div>
        {/* 创作tabs */}
        <div className="creation-tabs">
          <div className="tabs-header">
            <div className="tabs-list">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`tabs-tab ${activeKey === tab.key ? "active" : ""}`}
                  onClick={() => {
                    // getTabWorkflowList(tab.key, workFlowsObj);
                    handleChangeTabs(tab.key);
                    setactiveKey(tab.key);
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
                      onClick={() => handleSubmitWorkflow()}
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
                        onChange={(val) =>
                          setWorkflowParamObj({
                            ...workflowParamObj,
                            positive: val.target.value,
                          })
                        }
                        className="custom-text !ml-0"
                        style={{ marginLeft: "0 !important" }}
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
                        className={`params-btn ${isInternetsense ? 'no-margin' : 'margin-left'}`}
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
                      onClick={() => handleSubmitWorkflow()}
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
                      onClick={() => handleSubmitWorkflow()}
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
                      onClick={() => handleSubmitWorkflow()}
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
                      onClick={() => handleSubmitWorkflow()}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* 应用推荐 */}
        <ComponentInspirationCenter
          onUpdateWorkflow={(work, key, src) =>{handleUpdateWorkflow(work, key , src)} }
        />
      </div>
      {/* Modal 组件 - 对应 Vue 中的 ComponentModal */}
      <Modal
        open={modalVisible}
        onOpenChange={(val) => setModalVisible(val)}
        workflowId={workflowId || ""}
        onSelectWorkflow={(item) => selectWorkflow(item)}
      />
      {/* 款式/手模库 */}
      <ComponentMetrialModal
        visible={metrialVisible}
        title={metrialTitle}
        type={metrialType}
        onSelectMetrail={selectMetrail}
        onVisibleChange={(val) => setMetrialVisible(val)}
      />
      {/* 平台选择 */}
      <ComponentWriteModal
        writeVisible={writeVisible}
        data={platForm || []}
        onVisibleChange={(val) => setWriteVisible(val)}
        onSelectCopyWrite={selectCopyWrite}
      />
    </div>
  );
};

export default Creation;
