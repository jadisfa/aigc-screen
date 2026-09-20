import { screenRequest } from "@/lib/screen-http";

export type ScreenGenerationProduct = {
  productId?: string;
  productCode?: string;
  productName?: string;
  coverImageUrl?: string;
  retailPrice?: number | string | null;
  tagCodes?: string[];
};

export type ScreenGeneration = {
  id: string;
  experienceId?: string;
  resultImageUrl?: string;
  workMaterialId?: string;
  stockKind?: string;
  computeAmount?: number | string | null;
  generatedAt?: string;
  scene?: "outfit" | "keyword" | string;
  outfitImageUrl?: string;
  product?: ScreenGenerationProduct | null;
};

const admin = { requireAdmin: true as const };

export function fetchGenerations() {
  return screenRequest<ScreenGeneration[]>("/api/screen/generations", admin);
}
