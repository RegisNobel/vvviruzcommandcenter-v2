ALTER TABLE "ArtistProfileVersion"
  ADD COLUMN "previewExpiresAt" TIMESTAMP(3),
  ADD COLUMN "previewRevokedAt" TIMESTAMP(3),
  ADD COLUMN "previewSupersededAt" TIMESTAMP(3);

ALTER TABLE "ArtistProfile"
  ADD COLUMN "publishedSlug" TEXT NOT NULL DEFAULT '';
UPDATE "ArtistProfile"
SET "publishedSlug" = "slug"
WHERE "publishedVersionId" IS NOT NULL;

ALTER TABLE "ArtistIntake"
  ADD COLUMN "uploadedAssetPaths" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "convertedAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "submissionNotificationStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
  ADD COLUMN "submissionNotificationError" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "submissionNotificationAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "linkedArtistProfileId" TEXT;

ALTER TABLE "ArtistIntake"
  ADD CONSTRAINT "ArtistIntake_linkedArtistProfileId_fkey"
  FOREIGN KEY ("linkedArtistProfileId")
  REFERENCES "ArtistProfile"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "ArtistIntake_linkedArtistProfileId_idx"
ON "ArtistIntake"("linkedArtistProfileId");

CREATE INDEX "ArtistProfile_publishedSlug_idx"
ON "ArtistProfile"("publishedSlug");
