// hooks/useWorkflowCommon.ts
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { WorkFlow, Param, ComfyUIProperties } from "@/utils/comfyuiApi";
import { useMessage } from "@/utils/common";

export interface attrItem {
  title?: string;
  value?: string;
  src?: string;
  valueExtra?: string;
  weight?: number;
}

export interface workflows {
  [key: string]: string;
}

export interface workflowParams {
  style_title?: string | null;
  style_value?: string | null;
  active_style?: number | null;
  modal_title?: string | null;
  modal_src?: string | null;
  modal_value?: string | null;
  modal_attr?: string | null;
  num_value?: string | null;
  active_num?: number;
  active_modal?: number;
  positive?: string;
}

export interface proportQuantity {
  quantity: string;
  proport: {
    index: number;
    value: string;
    title: string;
  };
  quality?: {
    index: number;
    title: string;
    value: string;
  };
  time?: {
    index: number;
    title: string;
    value: string;
  };
  videoModal?: string;
}

export interface PositiveItem {
  index: number | null;
  name: string;
  value?: string;
}

export interface SubmitParamsResult {
  properties: ComfyUIProperties;
  submitParams: {
    properties: ComfyUIProperties;
    workflow_app: {
      workflow_id: string;
      workflow_name: string;
      workflow_title: string;
      workflow_data: WorkFlow;
    };
  };
}

export const creatSeed = (length: number): number => {
  return Math.floor(Math.random() * 1000000);
};

// 模拟上传函数 - 实际使用时替换为真实的上传函数
const useUtilsUploadFileToOSS = async (
  file: File,
  name: string,
): Promise<string> => {
  // 这里替换为真实的上传逻辑
  return URL.createObjectURL(file);
};

// 模拟 snackbar
const useSnackbarStore = () => ({
  showWarningMessage: (msg: string) => console.warn(msg),
});

interface UseWorkflowFormOptions {
  initialQuantity?: string;
  workFlowList?: WorkFlow[];
  categoryList?: any[];
  activeKey?: string;
  queryParams?: Record<string, any>;
}

// 应用选择信息：风格、甲量、甲型；社煤-提示词选择，文案-平台选择；视频-质量、时长
let paramsCN = {} as workflows;

export const useWorkflowForm = (opts?: UseWorkflowFormOptions) => {
  const {
    initialQuantity = "4",
    workFlowList = [],
    activeKey: initialActiveKey = "NailArtDesign",
  } = opts || {};
  const { messageWarning } = useMessage();

  // 文件状态
  const [file, setFile] = useState<(string | File)[]>([]);
  const [file1, setFile1] = useState<(string | File)[]>([]);
  const [workflowName, setWorkflowName] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [metrialVisible, setMetrialVisible] = useState(false);
  const [writeVisible, setWriteVisible] = useState(false);
  const [metrialTitle, setMetrialTitle] = useState("");
  const [metrialType, setMetrialType] = useState(1);
  const [workFlow, setWorkFlow] = useState<WorkFlow>({} as WorkFlow);
  const [workflowId, setWorkflowId] = useState<string | undefined>("");
  const [workFlowsObj, setWorkFlowsObj] = useState<workflows>({});
  const [popconfirmVisible, setPopconfirmVisible] = useState(false);
  const [proportQuantityVisible, setProportQuantityVisible] = useState(false);
  const [proportQuantityVisibleSo, setProportQuantityVisibleSo] =
    useState(false);
  const [proportQualityVisible, setProportQualityVisible] = useState(false);
  const [proportTimeVisible, setProportTimeVisible] = useState(false);
  const [workflowStyles, setWorkflowStyles] = useState<Param[]>([]);
  const [workflowTypeNumbers, setWorkflowTypeNumbers] = useState<Param[]>([]);
  const [workflowParamObj, setWorkflowParamObj] = useState<workflowParams>({});
  const [selectWorkflowStyle, setSelectWorkflowStyle] = useState<number | null>(
    null,
  );
  const [selectWorkflowNum, setSelectWorkflowNum] = useState(0);
  const [selectWorkflowModal, setSelectWorkflowModal] = useState<number | null>(
    null,
  );
  const [selectWorkflowTitle, setSelectWorkflowTitle] = useState<string | null>(
    "",
  );
  const [showPrompt, setShowPrompt] = useState(false);
  const [requirePrompt, setRequirePrompt] = useState(false);
  const [isIncludes, setIsIncludes] = useState(false);
  const [isNailImg, setIsNailImg] = useState(false);
  const [isInternetsense, setIsInternetsense] = useState(false);
  const [positiveObj, setPositiveObj] = useState<any>({});
  const [isRequirePositive, setIsRequirePositive] = useState(false);
  const [positiveInfo, setPositiveInfo] = useState<PositiveItem>({
    index: null,
    name: "",
    value: "",
  });
  const [positiveVisible, setPositiveVisible] = useState(false);
  const [proportionObj, setProportionObj] = useState<any>({});
  const [quantityObj, setQuantityObj] = useState<any>({});
  const [proportNumberObj, setProportNumberObj] = useState<proportQuantity>({
    quantity: initialQuantity,
    proport: { index: 0, value: "1:1", title: "1:1" },
  });
  const [Copywriting, setCopywriting] = useState<WorkFlow[]>([]);
  const [copyWritingKey, setCopyWritingKey] = useState<string | undefined>(
    undefined,
  );
  const [platForm, setPlatForm] = useState<attrItem[]>([]);
  const [qualityArr, setQualityArr] = useState<any[]>([]);
  const [timeArr, setTimeArr] = useState<any[]>([]);
  const [timesObj, setTimesObj] = useState<any>({});
  const [transformKey, setTransformKey] = useState(0);
  const [qualityObj, setQualityObj] = useState<any>({});
  const [activeKey, setActiveKey] = useState(initialActiveKey);

  // 引用
  const snackbar = useSnackbarStore();

  // 选择工作流
  const selectWorkflow = useCallback(
    async (workflow: WorkFlow) => {
      try {
        // setFile([]);
        // setFile1([]);
        console.log(workflow, 176)
        setWorkflowParamObj((prev) => ({ ...prev, positive: "" }));

        const newWorkflow = { ...workflow };
        setWorkFlow(newWorkflow);

        const styles =
          newWorkflow?.params?.filter(
            (p: Param) => p.name === "advance_select_single_chips",
          ) || [];
        setWorkflowStyles(styles);

        setWorkflowName(newWorkflow?.title || newWorkflow?.name || null);

        // 甲型通用初始化
        const numberType =
          (newWorkflow?.params || []).filter(
            (item: Param) => item.componentName === "ImageSelectPreview",
          ) || [];
        setWorkflowTypeNumbers(numberType);

        // 比例
        const proportData = (newWorkflow?.params || []).filter(
          (p: Param) => p.name === "aspect_ratio",
        );
        const batchSize = (newWorkflow?.params || []).filter(
          (p: Param) => p.name === "batch_size",
        );

        const stashProportionObj = proportData[0];
        setProportionObj(proportData[0] || {});
        setQuantityObj(batchSize[0] || {});

        if (batchSize[0]) {
          setIsIncludes(true);
        } else {
          setIsIncludes(false);
        }

        setProportNumberObj((prev) => ({
          ...prev,
          quantity: String(batchSize[0]?.param || 1 || prev.quantity),
        }));

        // 设置 propor 默认 index
        if (
          Array.isArray(stashProportionObj?.attributes) &&
          stashProportionObj.attributes.length > 0
        ) {
          const idx =
            stashProportionObj.attributes.findIndex(
              (it: any) => it.value == stashProportionObj.param,
            ) || 0;
          setProportNumberObj((prev) => ({
            ...prev,
            proport: {
              index: idx,
              title: stashProportionObj.attributes[idx]?.title,
              value: stashProportionObj.attributes[idx]?.value,
            },
          }));
        }

        // 提示词是否显示
        const workflowPositive = newWorkflow?.params?.find(
          (p: Param) => p.name === "positive",
        );
        if (workflowPositive) {
          setShowPrompt(true);
          setRequirePrompt(workflowPositive?.required || false);
        } else {
          setShowPrompt(false);
          setRequirePrompt(false);
        }

        // 社媒爆款-戴美甲的手
        const SocialImg = newWorkflow?.params?.find(
          (p: Param) => p.name === "multi_source_image_path",
        );
        setIsNailImg(!!SocialImg);

        // 网感自拍应用筛选
        const isInternet = newWorkflow?.name?.includes("网感自拍");
        setIsInternetsense(isInternet);

        if (isInternet) {
          const positiveData = (newWorkflow?.params || []).filter(
            (p: Param) => p.name === "advance_select_single_chips_1",
          );
          setPositiveObj(positiveData[0] || {});
          setIsRequirePositive(positiveData[0]?.required || false);

          if (!positiveInfo.value) {
            setPositiveInfo({
              index: 0,
              name: positiveData[0]?.attributes[0]?.title || "",
              value: positiveData[0]?.attributes[0]?.value || "",
            });
          }
        } else {
          setPositiveObj({});
          setIsRequirePositive(false);
          setPositiveInfo({ index: null, name: "", value: "" });
        }

        setWorkflowParamObj((prev) => ({
          ...prev,
          style_title: null,
          style_value: null,
          active_style: null,
          modal_title: null,
          modal_src: null,
          num_value: null,
        }));

        setSelectWorkflowModal(null);
        setSelectWorkflowTitle(null);
        setSelectWorkflowStyle(null);
        setSelectWorkflowNum(0);

        if (proportData.length > 0) {
          setProportNumberObj((prev) => ({
            ...prev,
            proport: {
              value:
                stashProportionObj.attributes[0]?.value ||
                stashProportionObj.attributes?.selectItems[0]?.value,
              title:
                stashProportionObj.attributes[0]?.label ||
                stashProportionObj.attributes[0]?.title ||
                stashProportionObj.attributes?.selectItems[0]?.title,
              index: 0,
            },
          }));
        }
      } catch (error) {
        messageWarning(error);
      }
    },
    [proportionObj],
  );

  // 应用风格选择
  const handleSelectStyle = useCallback(
    (index: number, item?: any, type?: "quality" | "time") => {
      if (!item) {
        setSelectWorkflowStyle(index);
        setWorkflowParamObj((prev) => ({
          ...prev,
          style_value: workflowStyles[0]?.attributes[index ?? 0]?.value,
          style_title: workflowStyles[0]?.attributes[index ?? 0]?.title,
          active_style: index,
        }));
      } else {
        if (type === "quality") {
          setProportNumberObj((prev) => ({
            ...prev,
            quality: { index, title: item.title, value: item.value },
          }));
        } else {
          setProportNumberObj((prev) => ({
            ...prev,
            time: { index, title: item.title, value: item.value },
          }));
        }
      }
    },
    [workflowStyles, selectWorkflowStyle],
  );

  // 甲片数量选择
  const handleSelectNum = useCallback(
    (index: number) => {
      setWorkflowParamObj((prev) => ({
        ...prev,
        num_value: workflowTypeNumbers[index]?.title,
        active_num: index,
        modal_title: null,
        modal_attr: null,
      }));
      setSelectWorkflowNum(index);
      setSelectWorkflowTitle("");
      setSelectWorkflowModal(null);
    },
    [workflowTypeNumbers],
  );

  // 甲型选择
  const handleSelectModal = useCallback(
    (index: number, modeItem: any) => {
      setSelectWorkflowModal(index);
      setSelectWorkflowTitle(modeItem?.title);
      setWorkflowParamObj((prev) => ({
        ...prev,
        num_value: workflowTypeNumbers[selectWorkflowNum]?.title,
        active_num: selectWorkflowNum,
        modal_title:
          workflowTypeNumbers[selectWorkflowNum]?.attributes[index]?.title,
        modal_value:
          workflowTypeNumbers[selectWorkflowNum]?.attributes[index]?.value,
        active_modal: index,
        modal_attr:
          workflowTypeNumbers[selectWorkflowNum]?.attributes[index]
            ?.valueExtra || "",
      }));
    },
    [workflowTypeNumbers, selectWorkflowNum],
  );

  // 比例数据
  const getRatioStyle = useCallback((ratio: string) => {
    // const ratios: any = {
    //   "1:1": { width: "16px", height: "16px" },
    //   "3:4": { width: "12px", height: "16px" },
    //   "4:3": { width: "16px", height: "12px" },
    //   "16:9": { width: "16px", height: "9px" },
    //   "9:16": { width: "9px", height: "16px" },
    // };
    // return ratios[ratio] || { width: "16px", height: "16px" };
    const parts = ratio.split(":").map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) {
      return { width: "16px", height: "16px" };
    }

    const [width, height] = parts;
    const maxSize = 16;

    // 计算缩放比例：使最大边不超过16
    const maxDimension = Math.max(width, height);
    const scale = maxSize / maxDimension;

    return {
      width: `${Math.round(width * scale)}px`,
      height: `${Math.round(height * scale)}px`,
    };
  }, []);

  // 选择比例
  const changeProportion = useCallback((propot: any, index: number) => {
    setProportNumberObj((prev) => ({
      ...prev,
      proport: {
        index,
        title: propot.title || propot?.label,
        value: propot.value,
      },
    }));
  }, []);

  // 选择提示词
  const changePositive = useCallback((param: any, index: number) => {
    setPositiveInfo({
      index,
      name: param.title,
      value: param.value,
    });
    setPositiveVisible(false);
  }, []);

  const handleClickPositive = useCallback(() => {
    if (!workflowName) {
      messageWarning("请选择应用");
      // message.warning("请选择应用");
      return;
    }
    setPositiveVisible(true);
  }, [workflowName]);

  // 视频首尾帧转换
  const handleTransform = useCallback(() => {
    if (file?.length && file1?.length) {
      const t = [...file];
      setFile([...file1]);
      setFile1(t);
      setTransformKey((prev) => prev + 1);
    } else {
      snackbar.showWarningMessage("未上传相关图片");
    }
  }, [file, file1]);

  // 素材选择
  const selectMetrail = useCallback(
    (item: any) => {
      console.log(item, 463);
      if (metrialType === 1) {
        setFile([item.url || item.src || item.path || item?.assetUrl]);
      } else {
        setFile1([item.url || item.src || item.path || item?.assetUrl]);
      }
    },
    [metrialType],
  );

  // 计算禁用状态
  const isDisabledStyle = useMemo(() => {
    return !!(file && (file[0] as any));
  }, [file]);

  const isDisabledHandle = useMemo(() => {
    return !!(file1 && (file1[0] as any));
  }, [file1]);

  // 预览属性
  const prepareProperties = useCallback(
    async (opts?: {
      uploadFn?: (file: File, name: string) => Promise<string>;
    }) => {
      const _properties: any = {};
      _properties.aspect_ratio = proportNumberObj.proport.value;
      _properties.batch_size = Number(proportNumberObj.quantity);

      if (workflowStyles.length > 0) {
        _properties.advance_select_single_chips = workflowParamObj.style_value;
      }

      _properties.lora_name = workflowParamObj.modal_value;
      _properties.lora_trigger_text = workflowParamObj.modal_attr;
      _properties.seed = Math.floor(Math.random() * 1000000);

      if (file && file.length) {
        const f = file[0];
        if (!(f as any).name) {
          _properties.image_path = f as string;
        } else if (opts?.uploadFn) {
          _properties.image_path = await opts.uploadFn(
            f as File,
            (f as File).name,
          );
        }
      }

      if (file1 && file1.length) {
        const f = file1[0];
        if (!(f as any).name) {
          _properties.multi_source_image_path = f as string;
        } else if (opts?.uploadFn) {
          _properties.multi_source_image_path = await opts.uploadFn(
            f as File,
            (f as File).name,
          );
        }
      }

      return _properties;
    },
    [proportNumberObj, workflowStyles, workflowParamObj, file, file1],
  );

  // 筛选美甲试戴, 匹配应用名称
  const filterTrialWearData = useCallback(
    (datas: WorkFlow[], workObj?: workflows) => {
      if (!datas || activeKey !== "NailTrialWear") return;
      const trialWearId = workObj ? workObj["美甲试戴"] : workFlowsObj["美甲试戴"];
      const trialWearData =
        datas.filter(
          (item: WorkFlow) =>
            item?.categoryId == trialWearId && item?.name == "B_2manicure",
        ) || [];
      if (Array.isArray(trialWearData) && trialWearData.length > 0) {
        setWorkflowId(trialWearData[0]?._id);
        setWorkFlow(trialWearData[0]);
        setProportNumberObj((prev) => ({ ...prev, quantity: "1" }));
      }
    },
    [workFlowList, activeKey, workFlowsObj],
  );

  // 筛选文案创作
  const filterCopywriting = useCallback(
    (datas: WorkFlow[], id?: string, workObj?: workflows) => {
      // console.log(datas, activeKey, id, workObj, 551);
      if (!datas) return;
      setCopyWritingKey(undefined);
      const copyId = workObj ? workObj["文案创作"] : workFlowsObj["文案创作"];
      const list =
        datas.filter((item: WorkFlow) => item?.categoryId == copyId) || [];
      // console.log(list,copyId, 555);
      if (Array.isArray(list) && list.length > 0) {
        setCopywriting(list);
        if (id) handleSelectWirte(id, list);
        setProportNumberObj((prev) => ({ ...prev, quantity: "1" }));
      }
    },
    [workFlowList, activeKey, workFlowsObj],
  );

  // 筛选视频创作
  const filterVideoCreation = useCallback(
    (datas: WorkFlow[], workObj?: workflows) => {
      if (!datas || activeKey !== "VideoCreation") return;
      const initData = sessionStorage.getItem("initData") === "true";
      const videoId = workObj ? workObj["视频创作"] : workFlowsObj["视频创作"];
      const list =
        datas.filter((item: WorkFlow) => item?.categoryId == videoId) || [];
      if (!Array.isArray(list) || list.length === 0) return;
      console.log(list, 574)
      const wf = list[0];
      // console.log(datas, wf, 575, "筛选视频创作应用");
      setWorkflowId(wf._id);
      setWorkFlow(wf);

      const proportData =
        wf?.params?.filter(
          (p: Param) => p.name === "advance_select_single_chips",
        ) || [];
      const qualityData =
        wf?.params?.filter(
          (p: Param) => p.name === "advance_select_single_chips_1",
        ) || [];
      const timeData =
        wf?.params?.filter(
          (p: Param) => p.name === "advance_select_single_chips_2",
        ) || [];

      setProportionObj(proportData[0] || {});
      setQualityObj(qualityData[0] || {});
      setTimesObj(timeData[0] || {});
      const stashPropor = proportData[0] || {};
      const stashQuality = qualityData[0] || {};
      const stashTimes = timeData[0] || {};
      const proportionAttributes = Array.isArray(stashPropor?.attributes)
        ? stashPropor.attributes
        : stashPropor?.attributes?.selectItems || [];
      const proportionIndex =
        proportionAttributes && proportionAttributes.length > 0
          ? proportionAttributes.findIndex(
              (it: any) => it.value == stashPropor?.param,
            ) || 0
          : -1;

      if (proportionIndex >= 0 && !initData) {
        setProportNumberObj((prev) => ({
          ...prev,
          proport: {
            index: proportionIndex,
            title: proportionAttributes[proportionIndex]?.title,
            value: proportionAttributes[proportionIndex]?.value,
          },
        }));
      }

      const qualityAttributes = Array.isArray(stashQuality?.attributes)
        ? stashQuality.attributes
        : stashQuality?.attributes?.selectItems || [];
      const qualityIndex =
        qualityAttributes && qualityAttributes.length > 0
          ? qualityAttributes.findIndex(
              (it: any) => it.value == stashQuality?.param,
            ) || 0
          : -1;

      if (qualityIndex >= 0 && !initData) {
        setProportNumberObj((prev) => ({
          ...prev,
          quality: {
            index: qualityIndex,
            title: qualityAttributes[qualityIndex]?.title,
            value: qualityAttributes[qualityIndex]?.value,
          },
        }));
      }
      setQualityArr(qualityAttributes);

      const timeAttributes = Array.isArray(stashTimes?.attributes)
        ? stashTimes.attributes
        : stashTimes?.attributes?.selectItems || [];
      const timeIndex =
        timeAttributes && timeAttributes.length > 0
          ? timeAttributes.findIndex(
              (it: any) => it.value == stashTimes?.param,
            ) || 0
          : -1;

      if (timeIndex >= 0 && !initData) {
        setProportNumberObj((prev) => ({
          ...prev,
          time: {
            index: timeIndex,
            title: timeAttributes[timeIndex]?.title,
            value: timeAttributes[timeIndex]?.value,
          },
        }));
      }
      setTimeArr(timeAttributes);

      // 视频模型
      const videoModals =
        wf?.params?.filter((p: Param) => p.name === "model_alias") || [];
      if (Array.isArray(videoModals) && videoModals.length > 0) {
        setProportNumberObj((prev) => ({
          ...prev,
          videoModal:
            videoModals[0]?.param ??
            videoModals[0]?.attributes?.modelList?.[0] ??
            undefined,
        }));
      }

      setProportNumberObj((prev) => ({ ...prev, quantity: "1" }));
      sessionStorage.removeItem("initData");
    },
    [
      workFlowList,
      activeKey,
      workFlowsObj,
      proportionObj,
      qualityObj,
      timesObj,
    ],
  );

  // 文案创作-选择应用, 兼容普通选择、创作页跳转
  const handleSelectWirte = useCallback(
    (value: string, list?: WorkFlow[]) => {
      console.log(value, workFlowList, Copywriting, '文案应用选择', 693);
      const copywritingData = list ? list : Copywriting;
      const CopyWritingIndex = copywritingData.findIndex(
        (it: WorkFlow) => it._id == value,
      );
      const selected = copywritingData[CopyWritingIndex];
      setWorkflowId(selected?._id);
      setWorkFlow(selected);
      setWorkflowName(selected?.name);
      setCopyWritingKey(value);

      const writeType = (selected?.params || []).filter(
        (item: any) =>
          Array.isArray(item.params) &&
          item.params.some((p: Param) => p.name === "lora_name"),
      );
      const filterPlatform = writeType[0]?.attributes || [];
      setPlatForm(filterPlatform);
      setWorkflowParamObj((prev) => ({
        ...prev,
        modal_value: null,
        modal_title: null,
        modal_src: null,
      }));
    },
    [Copywriting],
  );

  // 文案创作-选择平台
  const handleSelectWay = useCallback(() => {
    if (copyWritingKey) {
      setWriteVisible(true);
    } else {
      snackbar.showWarningMessage("请选择应用");
    }
  }, [copyWritingKey]);

  // 文案创作-选择平台
  const selectCopyWrite = useCallback((item: attrItem) => {
    console.log(item, '选择文案平台', 725);
    setWorkflowParamObj((prev) => ({
      ...prev,
      modal_title: item.title as string,
      modal_value: item.value as string,
      modal_attr: item.valueExtra as string,
      modal_src: item.src as string,
    }));
  }, []);

  // 清空提示词
  const handleClearnPositive = useCallback(() => {
    setWorkflowParamObj((prev) => ({ ...prev, positive: "" }));
  }, []);

  // 是否为剪贴板启用
  const isClipboardEnabled = useMemo(() => {
    if (activeKey === "NailTrialWear" || activeKey === "VideoCreation") {
      return false;
    }
    return true;
  }, [activeKey]);

  // 检查社媒爆款参数是否完整
  const checkSocial = useCallback(() => {
    let defaultDisabled = true;
    const hasFileOrPositive = workflowParamObj.positive;
    if (!isNailImg && !showPrompt) {
      defaultDisabled = !(workflowName && file && file.length > 0);
    } else {
      defaultDisabled = requirePrompt
        ? !(
            workflowName &&
            file &&
            file.length > 0 &&
            file1 &&
            file1.length > 0 &&
            hasFileOrPositive
          )
        : !(
            workflowName &&
            file &&
            file.length > 0 &&
            file1 &&
            file1.length > 0
          );
    }
    return defaultDisabled;
  }, [
    workflowName,
    file,
    file1,
    workflowParamObj.positive,
    isNailImg,
    showPrompt,
    requirePrompt,
  ]);

  // 生成按钮禁用状态
  const isDisabled = useMemo(() => {
    const key = activeKey;
    switch (key) {
      case "NailArtDesign":
        return workflowStyles.length > 0
          ? !(
              file &&
              file.length > 0 &&
              workflowName &&
              workflowParamObj?.num_value &&
              workflowParamObj?.modal_attr &&
              workflowParamObj?.style_value
            )
          : !(
              file &&
              file.length > 0 &&
              workflowName &&
              workflowParamObj?.num_value &&
              workflowParamObj?.modal_attr
            );
      case "SocialNediaBestseller":
        return checkSocial();
      case "NailTrialWear":
        return !(
          file &&
          file.length > 0 &&
          workflowId &&
          file1 &&
          file1.length > 0
        );
      case "Copywriting":
        return platForm.length > 0
          ? !(
              file &&
              file.length > 0 &&
              workflowId &&
              workflowParamObj.modal_value &&
              copyWritingKey
            )
          : !(file && file.length > 0 && workflowId && copyWritingKey);
      case "VideoCreation":
        return !(
          file &&
          file.length > 0 &&
          workflowId &&
          workflowParamObj.positive
        );
      default:
        return !(file && file.length > 0 && workflowName);
    }
  }, [
    activeKey,
    workflowStyles,
    file,
    file1,
    workflowName,
    workflowParamObj,
    workflowId,
    copyWritingKey,
    platForm,
    checkSocial,
  ]);

  // 文本输入框禁用状态
  const isTextDisabled = useMemo(() => {
    if (!file || file.length === 0) {
      return false;
    }
    return true;
  }, [file]);

  // 切换 Tab
  const handleChangeTabs = useCallback((key: string) => {
    setActiveKey(key);
    setShowPrompt(false);
    setIsInternetsense(false);
    setWorkflowName(null);
    setWorkFlow({} as WorkFlow);
    setFile([]);
    setFile1([]);
    setSelectWorkflowNum(0);
    setCopyWritingKey(undefined);
    setCopywriting([]);
    setPlatForm([]);
    setWorkflowParamObj({
      style_title: null,
      style_value: null,
      modal_title: null,
      modal_src: null,
      num_value: null,
      positive: "",
    });
    setProportNumberObj((prev) => ({
      ...prev,
      proport: { ...prev.proport, value: "1:1" },
    }));
  }, []);

  // 应用选择
  const handleSelectClick = useCallback(
    (value: string) => {
      setModalVisible(true);
      setWorkflowId(workFlowsObj[value]);
    },
    [workFlowsObj],
  );

  // 计算算力消耗
  const getpower = useMemo(() => {
    return (workFlow?.power ?? 0) * Number(proportNumberObj?.quantity || 1);
  }, [workFlow?.power, proportNumberObj?.quantity]);

  // 美甲试戴 - 素材选择
  const handleSelectMetrial = useCallback((val: number) => {
    if (val === 1) {
      setMetrialTitle("请选择款式");
    } else {
      setMetrialTitle("请选择手模图");
    }
    setMetrialType(val);
    setMetrialVisible(true);
  }, []);

  // 社媒爆款-上传是否可用
  const isUploadDisabled = useMemo(() => {
    return !!workflowParamObj.positive;
  }, [workflowParamObj.positive]);

  // 参数是否为空
  const isWorkflowParamEmpty = useMemo(() => {
    return (
      !workflowParamObj.style_value &&
      !workflowParamObj.num_value &&
      !workflowParamObj.modal_title
    );
  }, [workflowParamObj]);

  // 点击比例数量按钮
  const handleClickProportBtn = useCallback(
    (type?: number, onConfirm?: () => void) => {
      if (!workflowName) {
        messageWarning("请选择应用");
        return;
      }

      if (type === 1) {
        setPopconfirmVisible(true);
        onConfirm?.();
      } else {
        if (activeKey === "NailArtDesign") {
          setProportQuantityVisible(true);
        } else if (activeKey === "SocialNediaBestseller") {
          setProportQuantityVisibleSo(true);
        }
      }
    },
    [workflowName, activeKey],
  );

  // 视频创作比例/质量/时长按钮
  const handleClickPorpotQualityBtn = useCallback(
    (index: number, onToggle?: () => void) => {
      if (!workflowId) {
        snackbar.showWarningMessage("请选择应用");
        return;
      }

      if (index === 1) {
        setProportQualityVisible(true);
      } else if (index === 2) {
        setProportTimeVisible(true);
      }
      onToggle?.();
    },
    [workflowId],
  );

  // 生成提交参数
  const buildSubmitParams =
    useCallback(async (): Promise<SubmitParamsResult> => {
      paramsCN = {};
      await new Promise((resolve) => setTimeout(resolve, 0));
      const _properties: any = {};
      _properties.aspect_ratio = proportNumberObj.proport.value;
      _properties.batch_size = Number(proportNumberObj.quantity);

      if (workflowStyles.length > 0) {
        _properties.advance_select_single_chips = workflowParamObj.style_value;
      }
      const lora_name =
        workflowTypeNumbers[selectWorkflowNum]?.params[0]?.name || "lora_name";
      const lara_text =
        workflowTypeNumbers[selectWorkflowNum]?.params[1]?.name ||
        "lora_trigger_text";
      _properties[lora_name] = workflowParamObj.modal_value;
      _properties[lara_text] = workflowParamObj.modal_attr;
      _properties["lora_index"] = selectWorkflowNum;

      if (selectWorkflowNum) {
        _properties.lora_index = selectWorkflowNum;
      }

      _properties.seed = creatSeed(9);

      // 文件上传处理
      if (file && file.length) {
        if (!file[0]?.name) {
          if (activeKey === "VideoCreation") {
            _properties.image_first_frame = file[0] as string;
          } else {
            _properties.image_path = file[0] as string;
          }
        } else {
          const resultImg = await useUtilsUploadFileToOSS(
            file[0] as File,
            file[0]?.name as string,
          );
          if (activeKey === "VideoCreation") {
            _properties.image_first_frame = resultImg;
          } else {
            _properties.image_path = resultImg;
          }
        }
      }

      if (file1 && file1.length) {
        if (!file1[0]?.name) {
          if (activeKey === "VideoCreation") {
            _properties.image_last_frame = file1[0] as string;
          } else {
            _properties.multi_source_image_path = file1[0] as string;
          }
        } else {
          const resultImg = await useUtilsUploadFileToOSS(
            file1[0] as File,
            file1[0]?.name as string,
          );
          if (activeKey === "VideoCreation") {
            _properties.image_last_frame = resultImg;
          } else {
            _properties.multi_source_image_path = resultImg;
          }
        }
      }

      // Tab 特殊处理
      if (
        activeKey === "SocialNediaBestseller" ||
        activeKey === "VideoCreation"
      ) {
        if (workflowParamObj?.positive) {
          _properties.positive = workflowParamObj.positive;
          _properties.positiveCN = workflowParamObj.positive;
        }
        delete _properties.lora_name;
        delete _properties.lora_trigger_text;
      }

      // 视频
      if (activeKey === "VideoCreation") {
        _properties.advance_select_single_chips_1 =
          proportNumberObj.quality?.value;
        _properties.advance_select_single_chips_2 =
          proportNumberObj.time?.value;
        _properties.advance_select_single_chips =
          proportNumberObj.proport.value;
      }

      // 美甲试戴
      if (activeKey === "NailTrialWear") {
        delete _properties.aspect_ratio;
        delete _properties.batch_size;
        delete _properties.lora_name;
        delete _properties.lora_trigger_text;
      }

      // 文案创作
      if (activeKey === "Copywriting") {
        delete _properties.aspect_ratio;
        delete _properties.batch_size;
      }

      // 社媒爆款
      if (activeKey === "SocialNediaBestseller") {
        if (positiveInfo.value && workFlow?.name?.includes("网感自拍")) {
          _properties.advance_select_single_chips_1 = positiveInfo.value;
        }
        const filterArr = ['自拍', 'KPOP', '应援', '网感', '美甲制作', '车内自拍']
        if (filterArr.includes(workFlow?.name)) delete _properties.batch_size;
      }

      // 美甲穿搭传递甲型
      if (activeKey === "NailArtDesign") {
        _properties.advance_select_single_chips_1 = String(
          (workflowParamObj.active_num || 0) + 1,
        );
      }
      _properties.workflow_name = workFlow?.name;
      if (workflowParamObj?.style_title) {
        paramsCN.style = workflowParamObj?.style_title;
      }
      if (workflowParamObj?.num_value) {
        paramsCN.nailNum = workflowParamObj?.num_value;
      }
      if(workflowParamObj?.modal_title) {
        paramsCN.modal_title = workflowParamObj?.modal_title;
      }
      if(positiveInfo?.name) {
        paramsCN.positive = positiveInfo?.name;
      }
      if (proportNumberObj.quality?.title) {
        paramsCN.quality = proportNumberObj.quality?.title;
      }
      if (proportNumberObj.time?.title) {
        paramsCN.time = proportNumberObj.time?.title;
      }
      
      _properties.info = {...paramsCN}

      // 构建提交参数
      const submitParams = {
        properties: _properties,
        workflow_app: {
          workflow_id: workFlow?._id,
          workflow_name: workFlow?.name as string,
          workflow_title: workFlow?.title || "",
          workflow_data: workFlow,
        },
      };

      sessionStorage.setItem(
        "workflowSubmitParams",
        JSON.stringify(submitParams),
      );
      sessionStorage.setItem("workflowId", workFlow?._id as string);
      sessionStorage.setItem("shouldSubmitOnLoad", "true");

      return {
        properties: _properties,
        submitParams,
      };
    }, [
      proportNumberObj,
      workflowStyles,
      workflowParamObj,
      workflowTypeNumbers,
      selectWorkflowNum,
      file,
      file1,
      activeKey,
      positiveInfo,
      workFlow,
    ]);

  // 上传名称
  const uploadName = useCallback(
    (type?: string) => {
      let name = "上传";
      const workflowNameVal = workFlow?.name;
      const workflowTitle = workFlow?.title;

      if (type) {
        if (
          workflowNameVal?.includes("美甲试戴") ||
          workflowTitle?.includes("美甲试戴") ||
          workflowNameVal?.includes("试戴") ||
          workflowTitle?.includes("试戴")
        ) {
          name = "手模图片";
        }
        if (
          workflowNameVal?.includes("美甲制作") ||
          workflowTitle?.includes("美甲制作")
        ) {
          name = "手部图片";
        }
        if (
          workflowNameVal?.includes("网感自拍") ||
          workflowTitle?.includes("网感自拍") ||
          workflowNameVal?.includes("网感") ||
          workflowTitle?.includes("网感")
        ) {
          name = "手上美甲图片";
        }
        if (
          workflowNameVal?.includes("车内自拍") ||
          workflowTitle?.includes("车内自拍") ||
          workflowNameVal?.includes("KPOP应援") ||
          workflowTitle?.includes("KPOP应援") ||
          workflowNameVal?.includes("应援") ||
          workflowTitle?.includes("应援") ||
          workflowNameVal?.includes("KPOP") ||
          workflowTitle?.includes("KPOP")
        ) {
          name = "美甲图片";
        }
      } else if (workFlow?.name) {
        if (
          workflowNameVal?.includes("美甲穿搭") ||
          workflowTitle?.includes("美甲穿搭") ||
          workflowNameVal?.includes("穿搭") ||
          workflowTitle?.includes("穿搭")
        ) {
          name = "穿搭图片";
        }
        if (
          workflowNameVal?.includes("联名系列") ||
          workflowTitle?.includes("联名系列") ||
          workflowNameVal?.includes("联名") ||
          workflowTitle?.includes("联名") ||
          workflowNameVal?.includes("系列") ||
          workflowTitle?.includes("系列")
        ) {
          name = "联名图片";
        }
        if (
          workflowNameVal?.includes("高定婚甲") ||
          workflowTitle?.includes("高定婚甲") ||
          workflowNameVal?.includes("婚甲") ||
          workflowTitle?.includes("婚甲")
        ) {
          name = "婚纱/秀禾图片";
        }
        if (
          workflowNameVal?.includes("复古Ins") ||
          workflowTitle?.includes("复古Ins") ||
          workflowNameVal?.includes("渐变海莉") ||
          workflowTitle?.includes("渐变海莉") ||
          workflowNameVal?.includes("冰透猫眼") ||
          workflowTitle?.includes("冰透猫眼") ||
          workflowNameVal?.includes("轻奢高级") ||
          workflowTitle?.includes("轻奢高级") ||
          workflowNameVal?.includes("清新日系") ||
          workflowTitle?.includes("清新日系") ||
          workflowNameVal?.includes("温柔韩系") ||
          workflowTitle?.includes("温柔韩系") ||
          workflowNameVal?.includes("美甲制作") ||
          workflowTitle?.includes("美甲制作") ||
          workflowNameVal?.includes("美甲试戴") ||
          workflowTitle?.includes("美甲试戴") ||
          workflowNameVal?.includes("提示词专家") ||
          workflowTitle?.includes("提示词专家") ||
          workflowNameVal?.includes("文案创作") ||
          workflowTitle?.includes("文案创作")
        ) {
          name = "美甲图片";
        }
        if (
          workflowNameVal?.includes("网感自拍") ||
          workflowTitle?.includes("网感自拍") ||
          workflowNameVal?.includes("车内自拍") ||
          workflowTitle?.includes("车内自拍") ||
          workflowNameVal?.includes("KPOP应援") ||
          workflowTitle?.includes("KPOP应援") ||
          workflowNameVal?.includes("自拍") ||
          workflowTitle?.includes("自拍") ||
          workflowNameVal?.includes("网感") ||
          workflowTitle?.includes("网感") ||
          workflowNameVal?.includes("应援") ||
          workflowTitle?.includes("应援") ||
          workflowNameVal?.includes("KPOP") ||
          workflowTitle?.includes("KPOP")
        ) {
          name = "人物图片";
        }
      } else {
        name = "上传";
      }
      return name;
    },
    [workFlow],
  );

  return {
    // state
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
    quantityObj,
    proportNumberObj,
    setProportNumberObj,
    showPrompt,
    isIncludes,
    isNailImg,
    isInternetsense,
    positiveInfo,
    positiveObj,
    isRequirePositive,
    positiveVisible,
    setPositiveVisible,
    timesObj,
    Copywriting,
    copyWritingKey,
    setCopyWritingKey,
    platForm,
    qualityArr,
    timeArr,
    transformKey,
    qualityObj,
    // methods
    selectWorkflow,
    handleSelectStyle,
    handleSelectNum,
    handleSelectModal,
    showParamsPopover: () => setPopconfirmVisible(true),
    handleCancel: () => setPopconfirmVisible(false),
    getRatioStyle,
    changeProportion,
    handleTransform,
    selectMetrail,
    isDisabledStyle,
    isDisabledHandle,
    prepareProperties,
    filterTrialWearData,
    filterCopywriting,
    filterVideoCreation,
    handleSelectWirte,
    handleSelectWay,
    selectCopyWrite,
    handleClearnPositive,
    isClipboardEnabled,
    isDisabled,
    isTextDisabled,
    handleChangeTabs,
    handleSelectClick,
    getpower,
    handleSelectMetrial,
    isUploadDisabled,
    isWorkflowParamEmpty,
    handleClickProportBtn,
    handleClickPorpotQualityBtn,
    buildSubmitParams,
    uploadName,
    changePositive,
    handleClickPositive,
    activeKey,
    setActiveKey,
  };
};
