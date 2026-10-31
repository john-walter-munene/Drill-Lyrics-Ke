CREATE TYPE "ArtistSuggestionStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArtistSuggestion" (
  "id" TEXT NOT NULL,
  "youtubeChannelId" TEXT NOT NULL,
  "channelTitle" TEXT NOT NULL,
  "channelDescription" TEXT,
  "suggestedName" TEXT,
  "sampleVideos" JSONB NOT NULL,
  "submitterId" TEXT,
  "status" "ArtistSuggestionStatus" NOT NULL DEFAULT 'pending',
  "reviewerId" TEXT,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "ArtistSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Session_userId_expiresAt_lastActivityAt_idx" ON "Session"("userId", "expiresAt", "lastActivityAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE UNIQUE INDEX "ArtistSuggestion_youtubeChannelId_key" ON "ArtistSuggestion"("youtubeChannelId");
CREATE INDEX "ArtistSuggestion_status_createdAt_idx" ON "ArtistSuggestion"("status", "createdAt");

ALTER TABLE "Artist" ADD COLUMN "youtubeSyncEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "YoutubeChannelSync"
  ADD COLUMN "lastSyncAt" TIMESTAMP(3),
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "lastScanned" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastCreated" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LyricsSubmission"
  ADD COLUMN "creditPublicly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "contributorName" TEXT,
  ADD COLUMN "publishedVersionId" TEXT;
ALTER TABLE "LyricsSubmission"
  ADD CONSTRAINT "LyricsSubmission_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "LyricsSubmission_publishedVersionId_key" ON "LyricsSubmission"("publishedVersionId");

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArtistSuggestion"
  ADD CONSTRAINT "ArtistSuggestion_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ArtistSuggestion_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LyricsSubmission"
  ADD CONSTRAINT "LyricsSubmission_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "LyricVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
