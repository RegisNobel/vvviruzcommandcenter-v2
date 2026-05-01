-- Add Copy Lab strategy fields without removing the legacy type column.
ALTER TABLE "CopyEntry" ADD COLUMN "hookType" TEXT NOT NULL DEFAULT 'discovery-shock';
ALTER TABLE "CopyEntry" ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'amv-lyric-edit';
ALTER TABLE "CopyEntry" ADD COLUMN "songSection" TEXT NOT NULL DEFAULT 'hook';
ALTER TABLE "CopyEntry" ADD COLUMN "creativeNotes" TEXT NOT NULL DEFAULT '';

-- Safely map known legacy type values into the new Hook Type taxonomy.
UPDATE "CopyEntry"
SET "hookType" = CASE
  WHEN lower(trim("type")) IN (
    'discovery-shock',
    'discovery shock',
    'curiosity',
    'clickbait',
    'listicle-numbered',
    'mistake-regret',
    'before-after-result',
    'storytelling',
    'aspirational'
  ) THEN 'discovery-shock'
  WHEN lower(trim("type")) IN (
    'identity-callout',
    'identity callout',
    'relatable',
    'relatable-pain',
    'emotional',
    'negative',
    'ragebait',
    'contrarian-opinion',
    'neutral'
  ) THEN 'identity-callout'
  WHEN lower(trim("type")) IN (
    'proof-of-skill',
    'proof of skill',
    'direct-actionable'
  ) THEN 'proof-of-skill'
  ELSE "hookType"
END;

CREATE INDEX "CopyEntry_hookType_contentType_songSection_idx" ON "CopyEntry"("hookType", "contentType", "songSection");
