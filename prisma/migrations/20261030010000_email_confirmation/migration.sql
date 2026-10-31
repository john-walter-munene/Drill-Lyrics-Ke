-- Email confirmation: a verified-at flag on the account and single-use tokens.
-- Only the SHA-256 of each token is stored, for the same reason as password
-- reset tokens: a database leak must not hand out working links.

ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE "EmailConfirmationToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailConfirmationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailConfirmationToken_tokenHash_key" ON "EmailConfirmationToken"("tokenHash");
CREATE INDEX "EmailConfirmationToken_userId_createdAt_idx" ON "EmailConfirmationToken"("userId", "createdAt");
CREATE INDEX "EmailConfirmationToken_expiresAt_idx" ON "EmailConfirmationToken"("expiresAt");

ALTER TABLE "EmailConfirmationToken"
  ADD CONSTRAINT "EmailConfirmationToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Accounts that existed before this migration are treated as confirmed: they
-- were created when no confirmation step existed, and retroactively marking
-- every existing contributor unverified would be a lie about their account.
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
