import { screenRequest } from "@/lib/screen-http";

export type ScreenCatalogTag = {
  code: string;
  name: string;
  group?: string;
  groupName?: string;
  groupSortNo?: number;
};

export type ScreenCatalogAttr = {
  attrCode: string;
  attrName: string;
  inputType?: string;
  values?: string[];
  searchable?: boolean;
  allowsMultiple?: boolean;
};

export type ScreenCatalogProduct = {
  productId: string;
  productCode?: string;
  productName?: string;
  coverImageUrl?: string;
  galleryImageUrls?: string[];
  retailPrice?: number | string | null;
  tagCodes?: string[];
  status?: string | null;
  recommended?: boolean;
  attrs?: ScreenCatalogProductAttr[];
};

export type ScreenCatalogProductAttr = {
  attrCode: string;
  attrName: string;
  values?: string[];
};

const admin = { requireAdmin: true as const };

export function fetchCatalogTags() {
  return screenRequest<ScreenCatalogTag[]>("/api/screen/catalog/tags");
}

export function fetchCatalogAttrs(requireAdmin = true) {
  return screenRequest<ScreenCatalogAttr[]>("/api/screen/catalog/attrs?searchable=true", {
    requireAdmin,
  });
}

export function fetchCatalogProducts() {
  return screenRequest<ScreenCatalogProduct[]>("/api/screen/catalog/products?managed=true", admin);
}

/** C 端本店上架商品，设备票即可，不含下架。 */
export function fetchListedCatalogProducts() {
  return screenRequest<ScreenCatalogProduct[]>("/api/screen/catalog/products");
}

export function fetchCatalogProduct(id: string) {
  return screenRequest<ScreenCatalogProduct>(`/api/screen/catalog/products/${encodeURIComponent(id)}`);
}

export function patchStoreCatalogProduct(
  id: string,
  data: { status?: "up" | "down"; recommended?: boolean },
) {
  return screenRequest<ScreenCatalogProduct>(`/api/screen/catalog/products/${encodeURIComponent(id)}`, {
    ...admin,
    method: "PATCH",
    data,
  });
}

export function unhangStoreCatalogProduct(id: string) {
  return screenRequest<void>(`/api/screen/catalog/products/${encodeURIComponent(id)}`, {
    ...admin,
    method: "DELETE",
  });
}
