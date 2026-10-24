import { useTheme } from "next-themes";
import type { ComponentProps } from "react";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

/**
 * 全局轻提示（右下角）。白底页面下使用高对比卡片，避免与背景融为一体。
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      expand={false}
      visibleToasts={3}
      closeButton
      richColors
      duration={2500}
      gap={10}
      offset={20}
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-xl !border !px-3.5 !py-3 !text-sm !shadow-[0_10px_30px_rgba(15,23,42,0.14)] !max-w-[360px] " +
            "group-[.toaster]:!bg-white group-[.toaster]:!text-slate-900 group-[.toaster]:!border-slate-300 " +
            "dark:group-[.toaster]:!bg-slate-950 dark:group-[.toaster]:!text-slate-50 dark:group-[.toaster]:!border-slate-700",
          title: "!text-sm !font-semibold !text-slate-900 dark:!text-slate-50",
          description: "!text-xs !text-slate-600 dark:!text-slate-300",
          success:
            "!bg-emerald-50 !text-emerald-950 !border-emerald-300 dark:!bg-emerald-950 dark:!text-emerald-50 dark:!border-emerald-700",
          error:
            "!bg-red-50 !text-red-950 !border-red-300 dark:!bg-red-950 dark:!text-red-50 dark:!border-red-700",
          warning:
            "!bg-amber-50 !text-amber-950 !border-amber-300 dark:!bg-amber-950 dark:!text-amber-50 dark:!border-amber-700",
          info: "!bg-sky-50 !text-sky-950 !border-sky-300 dark:!bg-sky-950 dark:!text-sky-50 dark:!border-sky-700",
          actionButton: "!bg-slate-900 !text-white dark:!bg-slate-100 dark:!text-slate-900",
          cancelButton: "!bg-slate-100 !text-slate-700 dark:!bg-slate-800 dark:!text-slate-200",
          closeButton:
            "!left-auto !right-0 !translate-x-[35%] !-translate-y-[35%] " +
            "!border-slate-300 !bg-white !text-slate-700 hover:!bg-slate-100 dark:!border-slate-600 dark:!bg-slate-900 dark:!text-slate-200",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
