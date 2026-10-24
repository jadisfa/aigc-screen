/// <reference types="vite/client" />
declare module '*.scss' {
  // 对于纯样式导入，不需要任何导出
  const content: any;
  export default content;
}

/** 生产构建号，由 vite appVersionPlugin 注入；开发环境可能为空 */
declare const __APP_BUILD_ID__: string;




