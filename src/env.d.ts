/// <reference types="vite/client" />

interface Uni {
  $track: {
    track(eventCode: string, properties?: Record<string, unknown>): void;
    flush(): Promise<void>;
  };
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module "qrcode" {
  export function toDataURL(
    text: string,
    options?: {
      width?: number;
      margin?: number;
      errorCorrectionLevel?: "L" | "M" | "Q" | "H";
      color?: { dark?: string; light?: string };
    },
  ): Promise<string>;
}
