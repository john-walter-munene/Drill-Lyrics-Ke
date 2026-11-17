-- Committee removal trail + the device binding on a vote.
--
-- Removing a committee member is a soft delete, so the row stays and the audit
-- trail can say who removed them and why. A vote records the hash of the device
-- token it was cast from, which is what the live "one device per account" rule
-- is enforced against; the raw token never leaves the browser.

-- AlterTable
ALTER TABLE "CompetitionCommitteeMember" ADD COLUMN "removedById" TEXT,
ADD COLUMN "removalReason" TEXT;

-- AlterTable
ALTER TABLE "CompetitionVote" ADD COLUMN "deviceHash" TEXT;

-- AlterTable
ALTER TABLE "CompetitionStage" ADD COLUMN "tiebreakEntryId" TEXT,
ADD COLUMN "tiebreakReason" TEXT,
ADD COLUMN "tiebreakById" TEXT;

-- CreateIndex
CREATE INDEX "CompetitionVote_competitionId_deviceHash_idx" ON "CompetitionVote"("competitionId", "deviceHash");
