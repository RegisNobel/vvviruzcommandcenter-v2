ALTER TABLE "ReleaseCategory" ADD COLUMN "projectType" TEXT NOT NULL DEFAULT 'series';
ALTER TABLE "ReleaseCategory" ADD COLUMN "artworkPath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReleaseCategory" ADD COLUMN "artworkAltText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReleaseCategory" ADD COLUMN "projectReleaseDate" DATETIME;
ALTER TABLE "ReleaseCategory" ADD COLUMN "spotifyUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReleaseCategory" ADD COLUMN "appleMusicUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReleaseCategory" ADD COLUMN "youtubeUrl" TEXT NOT NULL DEFAULT '';

-- Carry the temporary Album metadata into its canonical Project record before
-- removing the duplicate tables. Massive Imitation uses the historical `mi` slug.
UPDATE "ReleaseCategory"
SET
  "projectType" = COALESCE((
    SELECT "type" FROM "Album"
    WHERE "Album"."slug" = "ReleaseCategory"."slug"
       OR ("Album"."slug" = 'massive-imitation' AND "ReleaseCategory"."slug" = 'mi')
    LIMIT 1
  ), "projectType"),
  "artworkPath" = COALESCE(NULLIF("artworkPath", ''), (
    SELECT "coverArtUrl" FROM "Album"
    WHERE "Album"."slug" = "ReleaseCategory"."slug"
       OR ("Album"."slug" = 'massive-imitation' AND "ReleaseCategory"."slug" = 'mi')
    LIMIT 1
  ), ''),
  "artworkAltText" = COALESCE(NULLIF("artworkAltText", ''), (
    SELECT "coverArtAltText" FROM "Album"
    WHERE "Album"."slug" = "ReleaseCategory"."slug"
       OR ("Album"."slug" = 'massive-imitation' AND "ReleaseCategory"."slug" = 'mi')
    LIMIT 1
  ), ''),
  "projectReleaseDate" = COALESCE("projectReleaseDate", (
    SELECT "releaseDate" FROM "Album"
    WHERE "Album"."slug" = "ReleaseCategory"."slug"
       OR ("Album"."slug" = 'massive-imitation' AND "ReleaseCategory"."slug" = 'mi')
    LIMIT 1
  )),
  "spotifyUrl" = COALESCE(NULLIF("spotifyUrl", ''), (
    SELECT "spotifyUrl" FROM "Album"
    WHERE "Album"."slug" = "ReleaseCategory"."slug"
       OR ("Album"."slug" = 'massive-imitation' AND "ReleaseCategory"."slug" = 'mi')
    LIMIT 1
  ), ''),
  "appleMusicUrl" = COALESCE(NULLIF("appleMusicUrl", ''), (
    SELECT "appleMusicUrl" FROM "Album"
    WHERE "Album"."slug" = "ReleaseCategory"."slug"
       OR ("Album"."slug" = 'massive-imitation' AND "ReleaseCategory"."slug" = 'mi')
    LIMIT 1
  ), ''),
  "youtubeUrl" = COALESCE(NULLIF("youtubeUrl", ''), (
    SELECT "youtubeUrl" FROM "Album"
    WHERE "Album"."slug" = "ReleaseCategory"."slug"
       OR ("Album"."slug" = 'massive-imitation' AND "ReleaseCategory"."slug" = 'mi')
    LIMIT 1
  ), '')
WHERE EXISTS (
  SELECT 1 FROM "Album"
  WHERE "Album"."slug" = "ReleaseCategory"."slug"
     OR ("Album"."slug" = 'massive-imitation' AND "ReleaseCategory"."slug" = 'mi')
);

UPDATE "ReleaseCategoryAssignment"
SET "sortOrder" = (
  SELECT "AlbumTrack"."position"
  FROM "AlbumTrack"
  JOIN "Album" ON "Album"."id" = "AlbumTrack"."albumId"
  JOIN "ReleaseCategory" ON "ReleaseCategory"."id" = "ReleaseCategoryAssignment"."categoryId"
  WHERE "AlbumTrack"."releaseId" = "ReleaseCategoryAssignment"."releaseId"
    AND (
      "Album"."slug" = "ReleaseCategory"."slug"
      OR ("Album"."slug" = 'massive-imitation' AND "ReleaseCategory"."slug" = 'mi')
    )
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM "AlbumTrack"
  JOIN "Album" ON "Album"."id" = "AlbumTrack"."albumId"
  JOIN "ReleaseCategory" ON "ReleaseCategory"."id" = "ReleaseCategoryAssignment"."categoryId"
  WHERE "AlbumTrack"."releaseId" = "ReleaseCategoryAssignment"."releaseId"
    AND (
      "Album"."slug" = "ReleaseCategory"."slug"
      OR ("Album"."slug" = 'massive-imitation' AND "ReleaseCategory"."slug" = 'mi')
    )
);

DROP TABLE "AlbumTrack";
DROP TABLE "Album";
