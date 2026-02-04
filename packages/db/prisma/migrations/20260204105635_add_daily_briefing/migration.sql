-- CreateTable
CREATE TABLE "daily_briefings" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "runId" TEXT NOT NULL,

    CONSTRAINT "daily_briefings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_briefing_items" (
    "id" TEXT NOT NULL,
    "briefingId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "daily_briefing_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_briefings_date_key" ON "daily_briefings"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_briefing_items_briefingId_eventId_key" ON "daily_briefing_items"("briefingId", "eventId");

-- CreateIndex
CREATE INDEX "daily_briefing_items_briefingId_idx" ON "daily_briefing_items"("briefingId");

-- AddForeignKey
ALTER TABLE "daily_briefing_items" ADD CONSTRAINT "daily_briefing_items_briefingId_fkey" FOREIGN KEY ("briefingId") REFERENCES "daily_briefings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
