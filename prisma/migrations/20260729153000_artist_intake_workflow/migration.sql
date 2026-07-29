CREATE TABLE "ArtistIntake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artistName" TEXT NOT NULL DEFAULT '',
    "inviteeEmail" TEXT NOT NULL DEFAULT '',
    "tokenHash" TEXT NOT NULL,
    "tokenHint" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "content" TEXT NOT NULL DEFAULT '{}',
    "expiresAt" DATETIME NOT NULL,
    "submittedAt" DATETIME,
    "lastOpenedAt" DATETIME,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "ArtistIntake_tokenHash_key" ON "ArtistIntake"("tokenHash");
CREATE INDEX "ArtistIntake_status_updatedAt_idx" ON "ArtistIntake"("status", "updatedAt");
CREATE INDEX "ArtistIntake_expiresAt_idx" ON "ArtistIntake"("expiresAt");
