-- Normalize legacy SQLite text datetimes to Prisma's integer millisecond storage.
-- Older imported release dates were stored as ISO text, which sorted ahead of integer dates.
UPDATE "Release"
SET "releaseDate" = CAST(strftime('%s', "releaseDate") AS INTEGER) * 1000
WHERE "releaseDate" IS NOT NULL
  AND typeof("releaseDate") = 'text'
  AND strftime('%s', "releaseDate") IS NOT NULL;