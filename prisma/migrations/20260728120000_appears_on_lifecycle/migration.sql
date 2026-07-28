ALTER TABLE "AppearsOn" ADD COLUMN "releaseDate" DATETIME;
ALTER TABLE "AppearsOn" ADD COLUMN "archivedAt" DATETIME;

CREATE INDEX "AppearsOn_archivedAt_releaseDate_idx"
ON "AppearsOn"("archivedAt", "releaseDate");
