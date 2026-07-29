CREATE TABLE "ArtistIntake" (
    "id" TEXT NOT NULL,
    "artistName" TEXT NOT NULL DEFAULT '',
    "inviteeEmail" TEXT NOT NULL DEFAULT '',
    "tokenHash" TEXT NOT NULL,
    "tokenHint" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "content" TEXT NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "lastOpenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistIntake_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArtistIntake_tokenHash_key" ON "ArtistIntake"("tokenHash");
CREATE INDEX "ArtistIntake_status_updatedAt_idx" ON "ArtistIntake"("status", "updatedAt");
CREATE INDEX "ArtistIntake_expiresAt_idx" ON "ArtistIntake"("expiresAt");
