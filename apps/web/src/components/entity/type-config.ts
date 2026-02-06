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
  badgeClass: string;
}

export const ENTITY_TYPE_CONFIG: Record<EntityTypeKey, TypeDisplayConfig> = {
  COMPANY: { icon: "\u{1F3E2}", bgColor: "bg-blue-500", textColor: "text-blue-700", badgeClass: "bg-blue-50 text-blue-700" },
  LAB: { icon: "\u{1F52C}", bgColor: "bg-purple-500", textColor: "text-purple-700", badgeClass: "bg-purple-50 text-purple-700" },
  MODEL: { icon: "\u{1F916}", bgColor: "bg-green-500", textColor: "text-green-700", badgeClass: "bg-green-50 text-green-700" },
  PRODUCT: { icon: "\u{1F4E6}", bgColor: "bg-orange-500", textColor: "text-orange-700", badgeClass: "bg-orange-50 text-orange-700" },
  PERSON: { icon: "\u{1F464}", bgColor: "bg-pink-500", textColor: "text-pink-700", badgeClass: "bg-pink-50 text-pink-700" },
  REGULATION: { icon: "\u{1F4DC}", bgColor: "bg-red-500", textColor: "text-red-700", badgeClass: "bg-red-50 text-red-700" },
  DATASET: { icon: "\u{1F4CA}", bgColor: "bg-cyan-500", textColor: "text-cyan-700", badgeClass: "bg-cyan-50 text-cyan-700" },
  BENCHMARK: { icon: "\u{1F4C8}", bgColor: "bg-yellow-500", textColor: "text-yellow-700", badgeClass: "bg-yellow-50 text-yellow-700" },
};

export const ENTITY_TYPES = Object.keys(ENTITY_TYPE_CONFIG) as EntityTypeKey[];

export function getTypeConfig(type: string): TypeDisplayConfig {
  return ENTITY_TYPE_CONFIG[type as EntityTypeKey] ?? {
    icon: "\u{2753}",
    bgColor: "bg-gray-500",
    textColor: "text-gray-700",
    badgeClass: "bg-gray-50 text-gray-700",
  };
}
