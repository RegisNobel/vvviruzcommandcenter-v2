-- Add decision-focused Meta Ads metrics from the newer CSV export views.
ALTER TABLE "AdCreativeReport" ADD COLUMN "frequency" REAL;
ALTER TABLE "AdCreativeReport" ADD COLUMN "costPerThousandAccountsReached" REAL;
ALTER TABLE "AdCreativeReport" ADD COLUMN "cpm" REAL;
ALTER TABLE "AdCreativeReport" ADD COLUMN "resultIndicator" TEXT;
ALTER TABLE "AdCreativeReport" ADD COLUMN "clicksAll" INTEGER;
ALTER TABLE "AdCreativeReport" ADD COLUMN "ctrAll" REAL;
ALTER TABLE "AdCreativeReport" ADD COLUMN "cpcAll" REAL;
ALTER TABLE "AdCreativeReport" ADD COLUMN "landingPageViews" INTEGER;
ALTER TABLE "AdCreativeReport" ADD COLUMN "costPerLandingPageView" REAL;
ALTER TABLE "AdCreativeReport" ADD COLUMN "shopClicks" INTEGER;
ALTER TABLE "AdCreativeReport" ADD COLUMN "facebookLikes" INTEGER;
ALTER TABLE "AdCreativeReport" ADD COLUMN "twoSecondContinuousPlays" INTEGER;
ALTER TABLE "AdCreativeReport" ADD COLUMN "costPerTwoSecondContinuousPlay" REAL;
ALTER TABLE "AdCreativeReport" ADD COLUMN "costPerThreeSecondPlay" REAL;
