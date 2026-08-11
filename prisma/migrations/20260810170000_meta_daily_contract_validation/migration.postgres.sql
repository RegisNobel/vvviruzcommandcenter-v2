-- Reviewed PostgreSQL companion for Gate E0.5 after `prisma db push` adds currency-origin columns.
ALTER TABLE "AdImportBatch"
  ADD CONSTRAINT "AdImportBatch_currencyOrigin_check" CHECK ("currencyOrigin" IN ('SOURCE_COLUMN','METRIC_HEADER','USER_CONFIRMED','UNKNOWN'));

ALTER TABLE "MetaDailySourceObservation"
  ADD CONSTRAINT "MetaDailySourceObservation_currencyOrigin_check" CHECK ("currencyOrigin" IN ('SOURCE_COLUMN','METRIC_HEADER','USER_CONFIRMED','UNKNOWN'));

ALTER TABLE "MetaDailyResolution"
  ADD CONSTRAINT "MetaDailyResolution_currencyOrigin_check" CHECK ("currencyOrigin" IN ('SOURCE_COLUMN','METRIC_HEADER','USER_CONFIRMED','UNKNOWN'));
