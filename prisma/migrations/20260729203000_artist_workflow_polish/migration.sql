ALTER TABLE "ArtistProfileVersion" ADD COLUMN "previewExpiresAt" DATETIME;
ALTER TABLE "ArtistProfileVersion" ADD COLUMN "previewRevokedAt" DATETIME;
ALTER TABLE "ArtistProfileVersion" ADD COLUMN "previewSupersededAt" DATETIME;
ALTER TABLE "ArtistProfile" ADD COLUMN "publishedSlug" TEXT NOT NULL DEFAULT '';
UPDATE "ArtistProfile"
SET "publishedSlug" = "slug"
WHERE "publishedVersionId" IS NOT NULL;

ALTER TABLE "ArtistIntake" ADD COLUMN "uploadedAssetPaths" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ArtistIntake" ADD COLUMN "reviewedAt" DATETIME;
ALTER TABLE "ArtistIntake" ADD COLUMN "convertedAt" DATETIME;
ALTER TABLE "ArtistIntake" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "ArtistIntake" ADD COLUMN "submissionNotificationStatus" TEXT NOT NULL DEFAULT 'NOT_SENT';
ALTER TABLE "ArtistIntake" ADD COLUMN "submissionNotificationError" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ArtistIntake" ADD COLUMN "submissionNotificationAttemptedAt" DATETIME;
ALTER TABLE "ArtistIntake" ADD COLUMN "linkedArtistProfileId" TEXT;

CREATE INDEX "ArtistIntake_linkedArtistProfileId_idx"
ON "ArtistIntake"("linkedArtistProfileId");

CREATE INDEX "ArtistProfile_publishedSlug_idx"
ON "ArtistProfile"("publishedSlug");
