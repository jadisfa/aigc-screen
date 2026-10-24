export interface pageFooter {
  texts: text[];
  icons: icon[];
}

export type text = {
  text: string;
  href?: boolean;
  path?: string;
  label?: string;
};
export type icon = {
  icon: string;
  path: string;
  href?: boolean;
  hover?: string;
  hoverSrc?: string;
};

export type ImageItem = {
  src: string;
  title: string;
  path: string;
  icon: string;
};
