-- AddCountryCode
ALTER TABLE "ArtistProfile" ADD COLUMN "locationCountryCode" TEXT NOT NULL DEFAULT '';

-- Backfill the first pilot collaborator so the enhanced location badge is ready immediately.
UPDATE "ArtistProfile"
SET "locationCountryCode" = 'EG'
WHERE lower(trim("location")) = 'egypt';
