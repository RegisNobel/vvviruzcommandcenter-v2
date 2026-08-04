import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "prisma", "deployment", "retention-lab");
const checks = [
  "AnalyticsImport_status_check","AnalyticsImport_fileHash_check","AnalyticsImport_counts_check","AnalyticsImport_normalizationVersion_check","AnalyticsImport_rawFileSizeBytes_check","AnalyticsImport_detectedPeriod_check","AnalyticsImport_confirmedPeriod_check",
  "ArtistMetricObservation_metrics_check","TrackMetricObservation_metrics_check","SongPeriodSnapshot_period_check","SongPeriodSnapshot_metrics_check","PlaylistPeriodSnapshot_period_check","PlaylistPeriodSnapshot_metrics_check",
  "PromotionCampaign_platform_check","PromotionCampaign_objective_check","PromotionCampaign_status_check","PromotionCampaign_name_check",
  "CampaignEvidence_sourceType_check","CampaignEvidence_confidence_check","CampaignEvidence_imported_dates_check","CampaignEvidence_spend_dates_check","CampaignEvidence_suggested_dates_check",
  "CampaignActiveInterval_sourceType_check","CampaignActiveInterval_confirmationStatus_check","CampaignActiveInterval_dates_check","CampaignActiveInterval_timezone_check",
  "CampaignTimelineEvent_eventType_check","CampaignTimelineEvent_source_check","CampaignTimelineEvent_confirmationStatus_check","CampaignTimelineEvent_timezone_check"
];
const tables = ["AnalyticsImport","ArtistMetricObservation","TrackMetricObservation","SongPeriodSnapshot","PlaylistPeriodSnapshot","ReleaseImportAlias","AnalyticsImportRow","MappingAuditEvent","PromotionCampaign","CampaignEvidence","CampaignActiveInterval","CampaignTimelineEvent","CampaignAuditEvent"];

async function main() {
  const diff = await fs.readFile(path.join(root, "02-prisma-db-push-preview.sql"), "utf8");
  const drops = diff.split(/\r?\n/).filter((line) => /\bDROP\b/.test(line) && !line.trim().startsWith("--"));
  assert.deepEqual(drops, [
    'ALTER TABLE "AppearsOnArtistCredit" DROP CONSTRAINT "AppearsOnArtistCredit_artistLinkId_fkey";',
    'ALTER TABLE "AppearsOnArtistCredit" DROP COLUMN "artistLinkId";'
  ]);
  assert.equal((diff.match(/CREATE TABLE/g) ?? []).length, 13);
  assert.equal((diff.match(/DROP TABLE/g) ?? []).length, 0);
  const companion = await fs.readFile(path.join(root, "03-post-push-constraints-and-access.sql"), "utf8");
  const verify = await fs.readFile(path.join(root, "05-verify.sql"), "utf8");
  for (const name of checks) {
    assert.ok(companion.includes(name), `${name} needs idempotent remediation`);
    assert.ok(verify.includes(name), `${name} needs verification`);
  }
  for (const table of tables) {
    assert.ok(companion.includes(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`));
    assert.ok(verify.includes(table));
  }
  assert.match(companion, /REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(verify, /grantee IN \('PUBLIC','anon','authenticated','service_role'\)/);
  const seed = await fs.readFile(path.join(root, "04-canonical-artist.sql"), "utf8");
  assert.match(seed, /Ambiguous vvviruz artist identity/);
  assert.match(seed, /publishedVersionId/);
  assert.match(seed, /workflowStatus[\s\S]*DRAFT/);
  const stage1 = await fs.readFile(path.join(process.cwd(), "prisma", "migrations", "20260803181504_analytics_data_foundation", "migration.postgres.sql"), "utf8");
  assert.doesNotMatch(stage1, /ON CONFLICT DO NOTHING/);
  console.log(`Deployment diff classification, ${checks.length} CHECK remediations, server-only RLS/grants, verification SQL, and ambiguity-safe canonical seed passed.`);
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
