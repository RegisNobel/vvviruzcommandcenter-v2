ALTER TABLE "ArtistProfile" ADD COLUMN "catalogEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ArtistProfile" ADD COLUMN "catalogTitle" TEXT NOT NULL DEFAULT 'Releases';
ALTER TABLE "ArtistProfile" ADD COLUMN "catalogIntro" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ArtistProfile" ADD COLUMN "catalogCtaLabel" TEXT NOT NULL DEFAULT 'View all releases';
ALTER TABLE "ArtistProfile" ADD COLUMN "catalogReleaseIds" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ArtistProfile" ADD COLUMN "editorialReleaseIds" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ArtistProfile" ADD COLUMN "featuredStoriesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ArtistProfile" ADD COLUMN "featuredStoriesLabel" TEXT NOT NULL DEFAULT 'Featured stories';
ALTER TABLE "ArtistProfile" ADD COLUMN "featuredStoriesHeading" TEXT NOT NULL DEFAULT 'Go deeper';

ALTER TABLE "ArtistFeaturedItem" ADD COLUMN "placement" TEXT NOT NULL DEFAULT 'HOME';

CREATE INDEX "ArtistFeaturedItem_artistProfileId_placement_sortOrder_idx"
ON "ArtistFeaturedItem"("artistProfileId", "placement", "sortOrder");
