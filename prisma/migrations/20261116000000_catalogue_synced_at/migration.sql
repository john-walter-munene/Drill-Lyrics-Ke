-- Catalogue sorting: "what was synchronized most recently?".
--
-- `syncedVersionId` is a cuid, so ordering by it orders by creation batch, not
-- by time. `syncedAt` records when a song's live timed version was published,
-- and the catalogue's `sort=recently-synced` orders by it.
--
-- Backfill: songs already pointing at a timed version get `updatedAt`. That is
-- the closest honest answer — the exact publish time of an older version was
-- never written down — so seeding is approximate by design and by comment.
-- AlterTable
ALTER TABLE "Song" ADD COLUMN "syncedAt" TIMESTAMP(3);

UPDATE "Song" SET "syncedAt" = "updatedAt" WHERE "syncedVersionId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "Song_status_syncedAt_idx" ON "Song"("status", "syncedAt");

-- CreateIndex
CREATE INDEX "Song_status_syncedVersionId_idx" ON "Song"("status", "syncedVersionId");
