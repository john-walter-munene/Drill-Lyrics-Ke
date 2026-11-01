-- YouTube catalogue acquisition.
--
-- An admin adds one channel and the whole upload catalogue is imported, so two
-- things were missing:
--   1. a video may only ever produce ONE song (re-imports used to create the
--      same video again, and an id reused across channels was a 500);
--   2. the importer's own judgement of an upload ("audio", "video", "unclear")
--      and the channel's paused-by-filter state need somewhere to live.

ALTER TABLE "Song"
  ADD COLUMN "youtubeImportKind" TEXT,
  ADD COLUMN "youtubeImportReason" TEXT;

ALTER TABLE "YoutubeChannelSync"
  ADD COLUMN "pausedByFilter" BOOLEAN NOT NULL DEFAULT false;

-- Deduplicate before the unique index exists. Keep the row that is most useful:
-- published over draft, then the one with a lyric version, then the oldest
-- (the one people have linked to). Everything else is moved rather than lost:
-- a lyric submission or DJ association attached to a duplicate is re-pointed at
-- the keeper, and only then is the duplicate deleted.
DO $$
DECLARE
  dup RECORD;
  keeper TEXT;
BEGIN
  FOR dup IN
    SELECT "youtubeVideoId" FROM "Song"
    GROUP BY "youtubeVideoId" HAVING COUNT(*) > 1
  LOOP
    SELECT s."id" INTO keeper
    FROM "Song" s
    LEFT JOIN (SELECT "songId", COUNT(*) AS n FROM "LyricVersion" GROUP BY "songId") v
      ON v."songId" = s."id"
    WHERE s."youtubeVideoId" = dup."youtubeVideoId"
    ORDER BY (s."status" = 'published') DESC, COALESCE(v.n, 0) DESC, s."createdAt" ASC
    LIMIT 1;

    UPDATE "LyricsSubmission" SET "songId" = keeper
      WHERE "songId" IN (SELECT "id" FROM "Song" WHERE "youtubeVideoId" = dup."youtubeVideoId" AND "id" <> keeper);
    UPDATE "PodcastEpisodeSong" SET "songId" = keeper
      WHERE "songId" IN (SELECT "id" FROM "Song" WHERE "youtubeVideoId" = dup."youtubeVideoId" AND "id" <> keeper)
        AND NOT EXISTS (SELECT 1 FROM "PodcastEpisodeSong" p WHERE p."songId" = keeper AND p."episodeId" = "PodcastEpisodeSong"."episodeId");
    UPDATE "DjTrack" SET "songId" = keeper
      WHERE "songId" IN (SELECT "id" FROM "Song" WHERE "youtubeVideoId" = dup."youtubeVideoId" AND "id" <> keeper)
        AND NOT EXISTS (SELECT 1 FROM "DjTrack" d WHERE d."songId" = keeper AND d."djId" = "DjTrack"."djId");
    DELETE FROM "PodcastEpisodeSong"
      WHERE "songId" IN (SELECT "id" FROM "Song" WHERE "youtubeVideoId" = dup."youtubeVideoId" AND "id" <> keeper);
    DELETE FROM "DjTrack"
      WHERE "songId" IN (SELECT "id" FROM "Song" WHERE "youtubeVideoId" = dup."youtubeVideoId" AND "id" <> keeper);
    DELETE FROM "Song"
      WHERE "youtubeVideoId" = dup."youtubeVideoId" AND "id" <> keeper;
  END LOOP;
END $$;

DROP INDEX "Song_youtubeVideoId_idx";
CREATE UNIQUE INDEX "Song_youtubeVideoId_key" ON "Song"("youtubeVideoId");
CREATE INDEX "Song_youtubeImported_status_idx" ON "Song"("youtubeImported", "status");
