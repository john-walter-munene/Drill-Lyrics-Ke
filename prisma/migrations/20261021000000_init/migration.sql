-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('member', 'contributor', 'moderator', 'admin');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('sheng', 'swahili', 'english', 'mixed');

-- CreateEnum
CREATE TYPE "SongStatus" AS ENUM ('draft', 'pending', 'published', 'unpublished');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('draft', 'pending', 'changes_requested', 'approved', 'published', 'rejected', 'unpublished');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('unsynchronized', 'synchronized');

-- CreateEnum
CREATE TYPE "PodcastPlatform" AS ENUM ('youtube', 'spotify', 'anchor', 'other');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('song', 'lyric_version', 'annotation', 'artist', 'dj', 'podcast_episode', 'event', 'user');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "imageUrl" TEXT,
    "youtubeChannelId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistLink" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "ArtistLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dj" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "imageUrl" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dj_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DjLink" (
    "id" TEXT NOT NULL,
    "djId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "DjLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DjTrack" (
    "djId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DjTrack_pkey" PRIMARY KEY ("djId","songId")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'mixed',
    "releaseDate" DATE,
    "durationMs" INTEGER,
    "status" "SongStatus" NOT NULL DEFAULT 'draft',
    "syncedVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongArtist" (
    "songId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SongArtist_pkey" PRIMARY KEY ("songId","artistId")
);

-- CreateTable
CREATE TABLE "LyricVersion" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'unsynchronized',
    "source" TEXT NOT NULL DEFAULT 'community',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LyricVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LyricLine" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "startMs" INTEGER NOT NULL DEFAULT -1,
    "text" TEXT NOT NULL,

    CONSTRAINT "LyricLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "lineIndex" INTEGER,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LyricsSubmission" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'pending',
    "markdown" TEXT NOT NULL,
    "note" TEXT,
    "reviewerId" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LyricsSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Podcast" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "hostName" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Podcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodcastEpisode" (
    "id" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER,
    "externalUrl" TEXT NOT NULL,
    "platform" "PodcastPlatform" NOT NULL DEFAULT 'youtube',

    CONSTRAINT "PodcastEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodcastEpisodeSong" (
    "episodeId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,

    CONSTRAINT "PodcastEpisodeSong_pkey" PRIMARY KEY ("episodeId","songId")
);

-- CreateTable
CREATE TABLE "PodcastEpisodeArtist" (
    "episodeId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,

    CONSTRAINT "PodcastEpisodeArtist_pkey" PRIMARY KEY ("episodeId","artistId")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "venue" TEXT,
    "city" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "ticketUrl" TEXT,
    "ticketPrice" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventArtist" (
    "eventId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,

    CONSTRAINT "EventArtist_pkey" PRIMARY KEY ("eventId","artistId")
);

-- CreateTable
CREATE TABLE "EventDj" (
    "eventId" TEXT NOT NULL,
    "djId" TEXT NOT NULL,

    CONSTRAINT "EventDj_pkey" PRIMARY KEY ("eventId","djId")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_slug_key" ON "Artist"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_youtubeChannelId_key" ON "Artist"("youtubeChannelId");

-- CreateIndex
CREATE INDEX "Artist_name_idx" ON "Artist"("name");

-- CreateIndex
CREATE INDEX "ArtistLink_artistId_idx" ON "ArtistLink"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Dj_slug_key" ON "Dj"("slug");

-- CreateIndex
CREATE INDEX "Dj_name_idx" ON "Dj"("name");

-- CreateIndex
CREATE INDEX "Dj_city_idx" ON "Dj"("city");

-- CreateIndex
CREATE INDEX "DjLink_djId_idx" ON "DjLink"("djId");

-- CreateIndex
CREATE INDEX "DjTrack_songId_idx" ON "DjTrack"("songId");

-- CreateIndex
CREATE UNIQUE INDEX "Song_slug_key" ON "Song"("slug");

-- CreateIndex
CREATE INDEX "Song_status_releaseDate_idx" ON "Song"("status", "releaseDate");

-- CreateIndex
CREATE INDEX "Song_title_idx" ON "Song"("title");

-- CreateIndex
CREATE INDEX "Song_youtubeVideoId_idx" ON "Song"("youtubeVideoId");

-- CreateIndex
CREATE INDEX "SongArtist_artistId_idx" ON "SongArtist"("artistId");

-- CreateIndex
CREATE INDEX "LyricVersion_songId_published_idx" ON "LyricVersion"("songId", "published");

-- CreateIndex
CREATE UNIQUE INDEX "LyricVersion_songId_version_key" ON "LyricVersion"("songId", "version");

-- CreateIndex
CREATE INDEX "LyricLine_versionId_startMs_idx" ON "LyricLine"("versionId", "startMs");

-- CreateIndex
CREATE UNIQUE INDEX "LyricLine_versionId_index_key" ON "LyricLine"("versionId", "index");

-- CreateIndex
CREATE INDEX "Annotation_versionId_idx" ON "Annotation"("versionId");

-- CreateIndex
CREATE INDEX "LyricsSubmission_songId_status_idx" ON "LyricsSubmission"("songId", "status");

-- CreateIndex
CREATE INDEX "LyricsSubmission_status_createdAt_idx" ON "LyricsSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LyricsSubmission_userId_createdAt_idx" ON "LyricsSubmission"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Podcast_slug_key" ON "Podcast"("slug");

-- CreateIndex
CREATE INDEX "PodcastEpisode_publishedAt_idx" ON "PodcastEpisode"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PodcastEpisode_podcastId_number_key" ON "PodcastEpisode"("podcastId", "number");

-- CreateIndex
CREATE INDEX "PodcastEpisodeSong_songId_idx" ON "PodcastEpisodeSong"("songId");

-- CreateIndex
CREATE INDEX "PodcastEpisodeArtist_artistId_idx" ON "PodcastEpisodeArtist"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_startsAt_idx" ON "Event"("startsAt");

-- CreateIndex
CREATE INDEX "Event_city_startsAt_idx" ON "Event"("city", "startsAt");

-- CreateIndex
CREATE INDEX "EventArtist_artistId_idx" ON "EventArtist"("artistId");

-- CreateIndex
CREATE INDEX "EventDj_djId_idx" ON "EventDj"("djId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "ArtistLink" ADD CONSTRAINT "ArtistLink_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DjLink" ADD CONSTRAINT "DjLink_djId_fkey" FOREIGN KEY ("djId") REFERENCES "Dj"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DjTrack" ADD CONSTRAINT "DjTrack_djId_fkey" FOREIGN KEY ("djId") REFERENCES "Dj"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DjTrack" ADD CONSTRAINT "DjTrack_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongArtist" ADD CONSTRAINT "SongArtist_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongArtist" ADD CONSTRAINT "SongArtist_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LyricVersion" ADD CONSTRAINT "LyricVersion_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LyricLine" ADD CONSTRAINT "LyricLine_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "LyricVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "LyricVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LyricsSubmission" ADD CONSTRAINT "LyricsSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastEpisode" ADD CONSTRAINT "PodcastEpisode_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastEpisodeSong" ADD CONSTRAINT "PodcastEpisodeSong_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "PodcastEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastEpisodeSong" ADD CONSTRAINT "PodcastEpisodeSong_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastEpisodeArtist" ADD CONSTRAINT "PodcastEpisodeArtist_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "PodcastEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastEpisodeArtist" ADD CONSTRAINT "PodcastEpisodeArtist_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventArtist" ADD CONSTRAINT "EventArtist_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventArtist" ADD CONSTRAINT "EventArtist_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDj" ADD CONSTRAINT "EventDj_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDj" ADD CONSTRAINT "EventDj_djId_fkey" FOREIGN KEY ("djId") REFERENCES "Dj"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

