// Shared entity type configuration for icons and colors
// Used by explore search, dossier page, related entities, and graph

export type EntityTypeKey =
  | "COMPANY"
  | "LAB"
  | "MODEL"
  | "PRODUCT"
  | "PERSON"
  | "REGULATION"
  | "DATASET"
  | "BENCHMARK";

interface TypeDisplayConfig {
  icon: string;
  bgColor: string;
  textColor: string;
}

export const ENTITY_TYPE_CONFIG: Record<EntityTypeKey, TypeDisplayConfig> = {
  COMPANY: { icon: "\u{1F3E2}", bgColor: "bg-blue-500", textColor: "text-blue-500" },
  LAB: { icon: "\u{1F52C}", bgColor: "bg-purple-500", textColor: "text-purple-500" },
  MODEL: { icon: "\u{1F916}", bgColor: "bg-green-500", textColor: "text-green-500" },
  PRODUCT: { icon: "\u{1F4E6}", bgColor: "bg-orange-500", textColor: "text-orange-500" },
  PERSON: { icon: "\u{1F464}", bgColor: "bg-pink-500", textColor: "text-pink-500" },
  REGULATION: { icon: "\u{1F4DC}", bgColor: "bg-red-500", textColor: "text-red-500" },
  DATASET: { icon: "\u{1F4CA}", bgColor: "bg-cyan-500", textColor: "text-cyan-500" },
  BENCHMARK: { icon: "\u{1F4C8}", bgColor: "bg-yellow-500", textColor: "text-yellow-500" },
};

export const ENTITY_TYPES = Object.keys(ENTITY_TYPE_CONFIG) as EntityTypeKey[];

export function getTypeConfig(type: string): TypeDisplayConfig {
  return ENTITY_TYPE_CONFIG[type as EntityTypeKey] ?? {
    icon: "\u{2753}",
    bgColor: "bg-gray-500",
    textColor: "text-gray-500",
  };
}
