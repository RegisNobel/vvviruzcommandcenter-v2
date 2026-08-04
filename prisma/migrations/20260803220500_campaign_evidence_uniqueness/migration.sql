-- Stage 6 idempotency guard for compact evidence references.
CREATE UNIQUE INDEX "CampaignEvidence_campaignId_sourceType_sourceRecordId_key"
ON "CampaignEvidence"("campaignId", "sourceType", "sourceRecordId");
