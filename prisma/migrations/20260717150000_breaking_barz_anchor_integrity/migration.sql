ALTER TABLE "ReleaseAnnotation" ADD COLUMN "anchorVersion" INTEGER;
ALTER TABLE "ReleaseAnnotation" ADD COLUMN "sectionKey" TEXT;
ALTER TABLE "ReleaseAnnotation" ADD COLUMN "sectionOccurrence" INTEGER;
ALTER TABLE "ReleaseAnnotation" ADD COLUMN "startLineIndex" INTEGER;
ALTER TABLE "ReleaseAnnotation" ADD COLUMN "endLineIndex" INTEGER;
ALTER TABLE "ReleaseAnnotation" ADD COLUMN "excerptSnapshot" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReleaseAnnotation" ADD COLUMN "excerptHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReleaseAnnotation" ADD COLUMN "lyricDocumentHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReleaseAnnotation" ADD COLUMN "summary" TEXT NOT NULL DEFAULT '';

ALTER TABLE "AnalyticsEvent" ADD COLUMN "contentType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AnalyticsEvent" ADD COLUMN "contentId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AnalyticsEvent" ADD COLUMN "interactionSource" TEXT NOT NULL DEFAULT '';

-- Existing free-text annotations cannot be safely attached to a lyric range.
-- Preserve their content while requiring an explicit operator re-anchor.
UPDATE "ReleaseAnnotation"
SET "status" = 'needs_reanchoring', "isPublic" = false
WHERE "status" <> 'archived';
