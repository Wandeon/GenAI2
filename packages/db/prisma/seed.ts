/**
 * Topic Seed Script
 *
 * Seeds the database with initial AI taxonomy topics.
 * Uses upsert to make the script idempotent - can be re-run safely.
 *
 * Run with: pnpm db:seed
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface TopicData {
  slug: string;
  name: string;
  nameHr: string;
  parentSlug: string | null;
  color: string;
  icon: string;
  description?: string;
}

const INITIAL_TOPICS: TopicData[] = [
  // Top-level categories
  {
    slug: "models",
    name: "AI Models",
    nameHr: "AI Modeli",
    parentSlug: null,
    color: "#3B82F6",
    icon: "brain",
  },
  {
    slug: "products",
    name: "Products & Launches",
    nameHr: "Proizvodi i lansiranja",
    parentSlug: null,
    color: "#10B981",
    icon: "rocket",
  },
  {
    slug: "research",
    name: "Research",
    nameHr: "Istraživanje",
    parentSlug: null,
    color: "#8B5CF6",
    icon: "microscope",
  },
  {
    slug: "policy",
    name: "Policy & Regulation",
    nameHr: "Politike i regulativa",
    parentSlug: null,
    color: "#F59E0B",
    icon: "scale",
  },
  {
    slug: "business",
    name: "Business & Industry",
    nameHr: "Posao i industrija",
    parentSlug: null,
    color: "#EF4444",
    icon: "briefcase",
  },
  {
    slug: "safety",
    name: "AI Safety",
    nameHr: "AI sigurnost",
    parentSlug: null,
    color: "#EC4899",
    icon: "shield",
  },

  // Models subcategories
  {
    slug: "llm",
    name: "Large Language Models",
    nameHr: "Veliki jezični modeli",
    parentSlug: "models",
    color: "#3B82F6",
    icon: "message-square",
  },
  {
    slug: "vision",
    name: "Vision Models",
    nameHr: "Vizijski modeli",
    parentSlug: "models",
    color: "#3B82F6",
    icon: "eye",
  },
  {
    slug: "multimodal",
    name: "Multimodal",
    nameHr: "Multimodalni",
    parentSlug: "models",
    color: "#3B82F6",
    icon: "layers",
  },
  {
    slug: "audio",
    name: "Audio & Speech",
    nameHr: "Audio i govor",
    parentSlug: "models",
    color: "#3B82F6",
    icon: "mic",
  },

  // Research subcategories
  {
    slug: "papers",
    name: "Papers",
    nameHr: "Radovi",
    parentSlug: "research",
    color: "#8B5CF6",
    icon: "file-text",
  },
  {
    slug: "benchmarks",
    name: "Benchmarks",
    nameHr: "Mjerila",
    parentSlug: "research",
    color: "#8B5CF6",
    icon: "bar-chart",
  },
  {
    slug: "datasets",
    name: "Datasets",
    nameHr: "Skupovi podataka",
    parentSlug: "research",
    color: "#8B5CF6",
    icon: "database",
  },

  // Business subcategories
  {
    slug: "funding",
    name: "Funding & Investments",
    nameHr: "Financiranje i ulaganja",
    parentSlug: "business",
    color: "#EF4444",
    icon: "dollar-sign",
  },
  {
    slug: "acquisitions",
    name: "Acquisitions",
    nameHr: "Akvizicije",
    parentSlug: "business",
    color: "#EF4444",
    icon: "handshake",
  },
  {
    slug: "partnerships",
    name: "Partnerships",
    nameHr: "Partnerstva",
    parentSlug: "business",
    color: "#EF4444",
    icon: "users",
  },
];

// Aliases for topics (alternative names for matching)
const TOPIC_ALIASES: Record<string, string[]> = {
  llm: ["LLM", "language model", "text model"],
  vision: ["computer vision", "image model", "visual AI"],
  multimodal: ["multi-modal", "foundation model"],
  funding: ["investment", "funding round", "series"],
};

async function seedTopics(): Promise<void> {
  console.log("Seeding topics...");

  // First pass: create all parent topics (those with parentSlug: null)
  const parentTopics = INITIAL_TOPICS.filter((t) => t.parentSlug === null);
  for (let i = 0; i < parentTopics.length; i++) {
    const topic = parentTopics[i];
    if (!topic) continue;

    await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: {
        name: topic.name,
        nameHr: topic.nameHr,
        color: topic.color,
        icon: topic.icon,
        sortOrder: i,
      },
      create: {
        slug: topic.slug,
        name: topic.name,
        nameHr: topic.nameHr,
        color: topic.color,
        icon: topic.icon,
        sortOrder: i,
        description: topic.description,
      },
    });
    console.log(`  Created/updated parent topic: ${topic.name}`);
  }

  // Second pass: create child topics (those with parentSlug set)
  const childTopics = INITIAL_TOPICS.filter((t) => t.parentSlug !== null);
  for (let i = 0; i < childTopics.length; i++) {
    const topic = childTopics[i];
    if (!topic) continue;

    const parentSlug = topic.parentSlug;
    if (!parentSlug) continue;

    const parent = await prisma.topic.findUnique({
      where: { slug: parentSlug },
    });

    if (!parent) {
      console.error(`  Parent topic not found: ${parentSlug}`);
      continue;
    }

    await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: {
        name: topic.name,
        nameHr: topic.nameHr,
        color: topic.color,
        icon: topic.icon,
        parentId: parent.id,
        sortOrder: i,
      },
      create: {
        slug: topic.slug,
        name: topic.name,
        nameHr: topic.nameHr,
        color: topic.color,
        icon: topic.icon,
        parentId: parent.id,
        sortOrder: i,
        description: topic.description,
      },
    });
    console.log(`  Created/updated child topic: ${topic.name} (parent: ${parentSlug})`);
  }

  console.log(`Seeded ${INITIAL_TOPICS.length} topics.`);
}

async function seedTopicAliases(): Promise<void> {
  console.log("Seeding topic aliases...");

  let aliasCount = 0;

  for (const [topicSlug, aliases] of Object.entries(TOPIC_ALIASES)) {
    const topic = await prisma.topic.findUnique({
      where: { slug: topicSlug },
    });

    if (!topic) {
      console.error(`  Topic not found for alias: ${topicSlug}`);
      continue;
    }

    for (const alias of aliases) {
      // Check if alias already exists (unique constraint on alias)
      const existing = await prisma.topicAlias.findUnique({
        where: { alias },
      });

      if (existing) {
        // Update if it exists but points to different topic
        if (existing.topicId !== topic.id) {
          await prisma.topicAlias.update({
            where: { alias },
            data: { topicId: topic.id },
          });
          console.log(`  Updated alias: "${alias}" -> ${topicSlug}`);
        }
      } else {
        await prisma.topicAlias.create({
          data: {
            topicId: topic.id,
            alias,
          },
        });
        console.log(`  Created alias: "${alias}" -> ${topicSlug}`);
      }
      aliasCount++;
    }
  }

  console.log(`Seeded ${aliasCount} topic aliases.`);
}

async function main(): Promise<void> {
  console.log("Starting database seed...\n");

  try {
    await seedTopics();
    console.log("");
    await seedTopicAliases();
    console.log("\nSeed completed successfully.");
  } catch (error) {
    console.error("Seed failed:", error);
    throw error;
  }
}

main()
  .then(() => {
    return prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    throw e;
  });
