-- Playlist competitions with three-stage voting.
--
-- A competition runs quarterfinal → semifinal → final. Each round is a
-- `CompetitionStage` row with its own entrants and its own votes, so the
-- quarterfinal result stays readable after the final has been decided.
--
-- Integrity rules that live in the database, not only in the service:
--   * one vote per (stage, voterKey) — a second vote is a unique violation,
--     whatever the client does;
--   * one committee row per (competition, user);
--   * one entry slug per competition, and one stage per (competition, order).

-- CreateEnum
CREATE TYPE "CompetitionStatus" AS ENUM ('draft', 'published', 'voting_open', 'voting_closed', 'results_published');

-- CreateEnum
CREATE TYPE "CompetitionStageKind" AS ENUM ('quarterfinal', 'semifinal', 'final');

-- CreateEnum
CREATE TYPE "CompetitionStageStatus" AS ENUM ('pending', 'voting_open', 'voting_closed', 'completed');

-- CreateEnum
CREATE TYPE "CompetitionVoterScope" AS ENUM ('public', 'account', 'committee');

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "organizer" TEXT,
    "status" "CompetitionStatus" NOT NULL DEFAULT 'draft',
    "voterScope" "CompetitionVoterScope" NOT NULL DEFAULT 'public',
    "allowVoteChange" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionStage" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "kind" "CompetitionStageKind" NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CompetitionStageStatus" NOT NULL DEFAULT 'pending',
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "advancing" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionEntry" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "curator" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionStageEntrant" (
    "stageId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompetitionStageEntrant_pkey" PRIMARY KEY ("stageId","entryId")
);

-- CreateTable
CREATE TABLE "CompetitionCommitteeMember" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "addedById" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "CompetitionCommitteeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionVote" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "userId" TEXT,
    "voterKey" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'device',
    "invalidatedAt" TIMESTAMP(3),
    "invalidatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Competition_slug_key" ON "Competition"("slug");

-- CreateIndex
CREATE INDEX "Competition_status_createdAt_idx" ON "Competition"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionStage_competitionId_order_key" ON "CompetitionStage"("competitionId", "order");

-- CreateIndex
CREATE INDEX "CompetitionStage_competitionId_status_idx" ON "CompetitionStage"("competitionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionEntry_competitionId_slug_key" ON "CompetitionEntry"("competitionId", "slug");

-- CreateIndex
CREATE INDEX "CompetitionEntry_competitionId_idx" ON "CompetitionEntry"("competitionId");

-- CreateIndex
CREATE INDEX "CompetitionStageEntrant_entryId_idx" ON "CompetitionStageEntrant"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionCommitteeMember_competitionId_userId_key" ON "CompetitionCommitteeMember"("competitionId", "userId");

-- CreateIndex
CREATE INDEX "CompetitionCommitteeMember_competitionId_removedAt_idx" ON "CompetitionCommitteeMember"("competitionId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionVote_stageId_voterKey_key" ON "CompetitionVote"("stageId", "voterKey");

-- CreateIndex
CREATE INDEX "CompetitionVote_competitionId_createdAt_idx" ON "CompetitionVote"("competitionId", "createdAt");

-- CreateIndex
CREATE INDEX "CompetitionVote_entryId_idx" ON "CompetitionVote"("entryId");

-- AddForeignKey
ALTER TABLE "CompetitionStage" ADD CONSTRAINT "CompetitionStage_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionStageEntrant" ADD CONSTRAINT "CompetitionStageEntrant_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "CompetitionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionStageEntrant" ADD CONSTRAINT "CompetitionStageEntrant_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CompetitionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionCommitteeMember" ADD CONSTRAINT "CompetitionCommitteeMember_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionCommitteeMember" ADD CONSTRAINT "CompetitionCommitteeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionVote" ADD CONSTRAINT "CompetitionVote_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionVote" ADD CONSTRAINT "CompetitionVote_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "CompetitionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionVote" ADD CONSTRAINT "CompetitionVote_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CompetitionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionVote" ADD CONSTRAINT "CompetitionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
