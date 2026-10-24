// hooks/useClipboardUpload.ts
import { useState, useCallback, useEffect } from "react";

interface ClipboardUploadState {
  enabled: boolean;
  openUserSetting: boolean;
}

export const useClipboardUpload = () => {
  // 从 localStorage 读取初始值
  const getInitialState = (): ClipboardUploadState => {
    try {
      const stored = localStorage.getItem("clipboardUpload");
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          enabled: parsed.enabled ?? false,
          openUserSetting: parsed.openUserSetting ?? false,
        };
      }
    } catch (error) {
      console.error("Failed to parse clipboard upload state:", error);
    }
    return {
      enabled: false,
      openUserSetting: false,
    };
  };

  const [state, setState] = useState<ClipboardUploadState>(getInitialState);

  // 持久化到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        "clipboardUpload",
        JSON.stringify({
          enabled: state.enabled,
        }),
      );
    } catch (error) {
      console.error("Failed to save clipboard upload state:", error);
    }
  }, [state.enabled]);

  const setEnabled = useCallback((val: boolean) => {
    setState((prev) => ({ ...prev, enabled: val }));
  }, []);

  const setOpenUserSetting = useCallback((val: boolean) => {
    setState((prev) => ({ ...prev, openUserSetting: val }));
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const toggleOpenUserSetting = useCallback(() => {
    setState((prev) => ({ ...prev, openUserSetting: !prev.openUserSetting }));
  }, []);

  return {
    enabled: state.enabled,
    openUserSetting: state.openUserSetting,
    setEnabled,
    setOpenUserSetting,
    toggle,
    toggleOpenUserSetting,
  };
};
