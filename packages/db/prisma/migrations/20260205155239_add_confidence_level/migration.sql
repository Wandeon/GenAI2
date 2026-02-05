/*
  Warnings:

  - You are about to drop the column `search_vector` on the `entities` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `events` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "ArtifactType" ADD VALUE 'RELATIONSHIP_EXTRACT';

-- DropIndex
DROP INDEX "entities_search_idx";

-- DropIndex
DROP INDEX "events_search_idx";

-- AlterTable
ALTER TABLE "entities" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "events" DROP COLUMN "search_vector",
ADD COLUMN     "confidence" "ConfidenceLevel",
ADD COLUMN     "sourceCount" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleHr" TEXT,
    "summary" TEXT,
    "summaryHr" TEXT,
    "content" TEXT NOT NULL,
    "contentHr" TEXT,
    "coverImageUrl" TEXT,
    "sourceUrl" TEXT,
    "author" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "articles_status_idx" ON "articles"("status");

-- CreateIndex
CREATE INDEX "articles_publishedAt_idx" ON "articles"("publishedAt");
