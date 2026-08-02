ALTER TABLE "BreakingBarzVersion" ADD COLUMN "songTitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BreakingBarzVersion" ADD COLUMN "artistNames" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "BreakingBarzVersion" ADD COLUMN "spotifyUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BreakingBarzVersion" ADD COLUMN "appleMusicUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BreakingBarzVersion" ADD COLUMN "youtubeUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BreakingBarzVersion" ADD COLUMN "categorySlugs" TEXT NOT NULL DEFAULT '[]';

UPDATE "BreakingBarzVersion"
SET
  "songTitle" = (SELECT "songTitle" FROM "BreakingBarzEntry" WHERE "BreakingBarzEntry"."id" = "BreakingBarzVersion"."entryId"),
  "artistNames" = (SELECT "artistNames" FROM "BreakingBarzEntry" WHERE "BreakingBarzEntry"."id" = "BreakingBarzVersion"."entryId"),
  "spotifyUrl" = (SELECT "spotifyUrl" FROM "BreakingBarzEntry" WHERE "BreakingBarzEntry"."id" = "BreakingBarzVersion"."entryId"),
  "appleMusicUrl" = (SELECT "appleMusicUrl" FROM "BreakingBarzEntry" WHERE "BreakingBarzEntry"."id" = "BreakingBarzVersion"."entryId"),
  "youtubeUrl" = (SELECT "youtubeUrl" FROM "BreakingBarzEntry" WHERE "BreakingBarzEntry"."id" = "BreakingBarzVersion"."entryId");

UPDATE "BreakingBarzVersion"
SET "categorySlugs" = COALESCE((
  SELECT '[' || group_concat('"' || "BreakingBarzCategory"."slug" || '"') || ']'
  FROM "BreakingBarzEntryCategory"
  JOIN "BreakingBarzCategory" ON "BreakingBarzCategory"."id" = "BreakingBarzEntryCategory"."categoryId"
  WHERE "BreakingBarzEntryCategory"."entryId" = "BreakingBarzVersion"."entryId"
), '[]');
