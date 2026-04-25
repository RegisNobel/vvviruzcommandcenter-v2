ALTER TABLE "Release" ADD COLUMN "slug" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Release" ADD COLUMN "coverArtPath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Release" ADD COLUMN "publicDescription" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Release" ADD COLUMN "publicLongDescription" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Release" ADD COLUMN "spotifyUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Release" ADD COLUMN "appleMusicUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Release" ADD COLUMN "youtubeUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Release" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Release" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Release" ADD COLUMN "featuredVideoUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Release" ADD COLUMN "publicLyricsEnabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Release"
SET
  "slug" = CASE
    WHEN trim("title") <> ''
      THEN lower(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(trim("title"), ' ', '-'),
                      '''',
                      ''
                    ),
                    ':',
                    ''
                  ),
                  '/',
                  '-'
                ),
                '&',
                '-and-'
              ),
              '—',
              '-'
            ),
            '–',
            '-'
          ),
          '--',
          '-'
        )
      ) || '-' || substr("id", 1, 8)
    ELSE 'release-' || substr("id", 1, 8)
  END,
  "coverArtPath" = COALESCE("coverArtUrl", ''),
  "publicDescription" = CASE
    WHEN trim("conceptDetails") <> '' THEN trim("conceptDetails")
    ELSE trim("title")
  END,
  "spotifyUrl" = COALESCE(
    (
      SELECT "url"
      FROM "ReleaseStreamingLink"
      WHERE "releaseId" = "Release"."id" AND "platform" = 'spotify'
      LIMIT 1
    ),
    ''
  ),
  "appleMusicUrl" = COALESCE(
    (
      SELECT "url"
      FROM "ReleaseStreamingLink"
      WHERE "releaseId" = "Release"."id" AND "platform" = 'apple_music'
      LIMIT 1
    ),
    ''
  ),
  "youtubeUrl" = COALESCE(
    (
      SELECT "url"
      FROM "ReleaseStreamingLink"
      WHERE "releaseId" = "Release"."id" AND "platform" = 'youtube'
      LIMIT 1
    ),
    ''
  ),
  "isPublished" = "published",
  "isFeatured" = "pinned",
  "publicLyricsEnabled" = CASE
    WHEN trim("lyrics") <> '' THEN true
    ELSE false
  END;

CREATE TABLE "SiteSettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "artistName" TEXT NOT NULL DEFAULT 'vvviruz',
  "tagline" TEXT NOT NULL DEFAULT '',
  "shortBio" TEXT NOT NULL DEFAULT '',
  "longBio" TEXT NOT NULL DEFAULT '',
  "contactEmail" TEXT NOT NULL DEFAULT '',
  "bookingEmail" TEXT NOT NULL DEFAULT '',
  "socialLinks" TEXT NOT NULL DEFAULT '[]',
  "heroText" TEXT NOT NULL DEFAULT '',
  "aboutContent" TEXT NOT NULL DEFAULT '',
  "linksPageItems" TEXT NOT NULL DEFAULT '[]',
  "createdOn" DATETIME NOT NULL,
  "updatedOn" DATETIME NOT NULL
);

INSERT INTO "SiteSettings" (
  "id",
  "artistName",
  "tagline",
  "shortBio",
  "longBio",
  "contactEmail",
  "bookingEmail",
  "socialLinks",
  "heroText",
  "aboutContent",
  "linksPageItems",
  "createdOn",
  "updatedOn"
)
VALUES (
  'site-settings',
  'vvviruz',
  'Nerdcore focus. Level-up energy. Zero filler.',
  'vvviruz is a high-energy artist building release-driven worlds around anime, ambition, and pressure-tested bars.',
  'vvviruz blends nerdcore storytelling, mainstream-ready energy, and focused release execution into a catalog built for replay. The sound pulls from anime, identity, ambition, and competitive drive while keeping the delivery sharp, direct, and built for impact.',
  '',
  '',
  '[]',
  'Built for replay. Engineered for impact.',
  'vvviruz is building a catalog where music, identity, and execution move together. The focus is sharp releases, strong world-building, and a direct connection between the song and the visual brand around it.',
  '[]',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Release_slug_key" ON "Release"("slug");
CREATE INDEX "Release_isPublished_releaseDate_idx" ON "Release"("isPublished", "releaseDate");
CREATE INDEX "Release_isFeatured_releaseDate_idx" ON "Release"("isFeatured", "releaseDate");
