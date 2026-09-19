-- CreateEnum
CREATE TYPE "LostFoundKind" AS ENUM ('LOST', 'FOUND');

-- CreateEnum
CREATE TYPE "LostFoundStatus" AS ENUM ('OPEN', 'CLAIMED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('CLOTHING', 'BOTTLE', 'BAG', 'ELECTRONICS', 'DOCUMENTS', 'EYEWEAR', 'JEWELLERY', 'KEYS', 'BOOK', 'OTHER');

-- CreateTable
CREATE TABLE "LostFoundItem" (
    "id" TEXT NOT NULL,
    "kind" "LostFoundKind" NOT NULL,
    "status" "LostFoundStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "category" "ItemCategory",
    "title" TEXT,
    "photoUrl" TEXT,
    "hubId" TEXT,
    "placeNote" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reportedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LostFoundItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSuggestion" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasoning" TEXT NOT NULL,
    "byAi" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LostFoundItem_kind_status_occurredAt_idx" ON "LostFoundItem"("kind", "status", "occurredAt");

-- CreateIndex
CREATE INDEX "MatchSuggestion_sourceId_score_idx" ON "MatchSuggestion"("sourceId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "MatchSuggestion_sourceId_targetId_key" ON "MatchSuggestion"("sourceId", "targetId");

-- AddForeignKey
ALTER TABLE "LostFoundItem" ADD CONSTRAINT "LostFoundItem_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostFoundItem" ADD CONSTRAINT "LostFoundItem_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSuggestion" ADD CONSTRAINT "MatchSuggestion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LostFoundItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSuggestion" ADD CONSTRAINT "MatchSuggestion_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "LostFoundItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
