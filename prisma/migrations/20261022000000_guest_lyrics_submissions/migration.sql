ALTER TABLE "LyricsSubmission" DROP CONSTRAINT "LyricsSubmission_userId_fkey";

ALTER TABLE "LyricsSubmission" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "LyricsSubmission"
  ADD CONSTRAINT "LyricsSubmission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "YoutubeChannelSync" (
  "id" TEXT NOT NULL,
  "artistId" TEXT NOT NULL,
  "uploadsPlaylistId" TEXT,
  "nextPageToken" TEXT,
  "initialImportComplete" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "YoutubeChannelSync_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "YoutubeChannelSync_artistId_key" ON "YoutubeChannelSync"("artistId");

ALTER TABLE "YoutubeChannelSync"
  ADD CONSTRAINT "YoutubeChannelSync_artistId_fkey"
  FOREIGN KEY ("artistId") REFERENCES "Artist"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Song"
  ADD COLUMN "youtubeImported" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "youtubeMetadataRefreshedAt" TIMESTAMP(3);
