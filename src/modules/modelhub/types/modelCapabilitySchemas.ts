import type {
  ModelCapabilityBucket,
  ModelCapabilityCategory,
  ModelCapabilityCode,
  CapabilitySchemaLevel,
} from "./modelCapabilityMetadata";

export type CapabilityCatalogItem = {
  code: ModelCapabilityCode;
  label: string;
  bucket: ModelCapabilityBucket;
  category: ModelCapabilityCategory;
  schemaLevel: CapabilitySchemaLevel;
  description: string;
  keywords: RegExp[];
};
