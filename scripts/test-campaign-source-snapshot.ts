import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

import {buildCampaignSourceSnapshot} from "../lib/analytics/campaign-source-snapshot";

const link = (overrides: Partial<{
  id: string;
  promotionCampaignId: string;
  scopeType: string;
  externalAdSetId: string;
  externalAdId: string;
  associationMode: string;
  monetaryAttribution: string;
  ambiguous: boolean;
}> = {}) => ({
  id: overrides.id ?? "link-1",
  promotionCampaignId: overrides.promotionCampaignId ?? "campaign-1",
  accountId: "account-1",
  scopeType: overrides.scopeType ?? "CAMPAIGN",
  externalCampaignId: "meta-campaign-1",
  externalAdSetId: overrides.externalAdSetId ?? "",
  externalAdId: overrides.externalAdId ?? "",
  scopeIdentityKey: overrides.id ?? "scope-1",
  currentDisplayName: "Stable Meta scope",
  status: "CONFIRMED",
  associationMode: overrides.associationMode ?? "EXCLUSIVE",
  monetaryAttribution: overrides.monetaryAttribution ?? "EXTERNAL_SCOPE_ONLY",
  ambiguous: overrides.ambiguous ?? false,
  evidence: "{}"
});

const resolution = (id: string, metricDate: string, spend: number, adSetId = "set-1", adId = "ad-1") => ({
  id,
  accountId: "account-1",
  campaignId: "meta-campaign-1",
  adSetId,
  adId,
  metricDate: new Date(`${metricDate}T00:00:00.000Z`),
  currency: "usd",
  currentObservation: {spend, sourceAsOf: new Date("2026-08-18T04:00:00.000Z")}
});

const sharedCampaignLink = link({
  id: "shared-parent",
  associationMode: "SHARED_EXTERNAL_CAMPAIGN",
  monetaryAttribution: "UNALLOCATED_SHARED",
  ambiguous: true
});
const specificLink = link({
  id: "specific-child",
  scopeType: "AD_SET",
  externalAdSetId: "set-1",
  associationMode: "SHARED_EXTERNAL_CAMPAIGN"
});

const snapshot = buildCampaignSourceSnapshot({
  releaseId: "release-1",
  campaigns: [
    {id: "campaign-1", confirmedIntervalCount: 1, links: [sharedCampaignLink, specificLink]},
    {id: "campaign-2", confirmedIntervalCount: 1, links: [{...sharedCampaignLink, id: "shared-second", promotionCampaignId: "campaign-2"}]},
    {id: "campaign-3", confirmedIntervalCount: 0, links: []}
  ],
  imports: [
    {importType: "ARTIST_AUDIENCE_TIMELINE"},
    {importType: "TRACK_STREAM_TIMELINE"},
    {importType: "SONGS_PERIOD"}
  ],
  artistMetricObservations: [
    {metricDate: new Date("2026-08-01T00:00:00.000Z")},
    {metricDate: new Date("2026-08-17T00:00:00.000Z")}
  ],
  trackMetricObservations: [
    {releaseId: "release-1", metricDate: new Date("2026-08-16T00:00:00.000Z")},
    {releaseId: "another-release", metricDate: new Date("2026-08-18T00:00:00.000Z")}
  ],
  metaResolutions: [
    resolution("fact-1", "2026-08-09", 3.84),
    resolution("fact-2", "2026-08-10", 0),
    resolution("fact-outside-child", "2026-08-11", 2.71, "set-2", "ad-2")
  ]
});

assert.deepEqual(snapshot.spotify, {
  audienceImportCount: 1,
  trackImportCount: 1,
  latestAudienceDate: "2026-08-17",
  latestTrackDate: "2026-08-16"
});

const first = snapshot.campaigns[0];
assert.equal(first.meta.state, "LINKED_SHARED_PARENT", "the distinct child link preserves cross-release parent context without treating its spend as exact-scope shared");
assert.equal(first.meta.scopeCount, 1);
assert.equal(first.meta.canonicalFactCount, 2, "only the confirmed child scope contributes evidence");
assert.equal(first.meta.positiveSpendFactCount, 1);
assert.deepEqual(first.meta.externalScopeSpend, [{currency: "USD", totalCents: 384}], "money is summed as integer cents");
assert.equal(first.meta.earliestMetricDate, "2026-08-09");
assert.equal(first.meta.latestMetricDate, "2026-08-10");

const second = snapshot.campaigns[1];
assert.equal(second.meta.state, "SHARED_UNALLOCATED");
assert.equal(second.meta.canonicalFactCount, 3);
assert.deepEqual(second.meta.externalScopeSpend, [{currency: "USD", totalCents: 655}]);
assert.equal(snapshot.campaigns[2].meta.state, "UNLINKED");

const serviceSource = readFileSync(resolve(process.cwd(), "lib/analytics/campaign-source-snapshot.ts"), "utf8");
assert.ok(serviceSource.includes("readCurrentAnalyticsDataset(artistProfileId)"), "Spotify values must use the current-import resolver");
assert.doesNotMatch(serviceSource, /prisma\.(artistMetricObservation|trackMetricObservation)\.findMany/, "the snapshot must not bypass replacement/withdrawal resolution");
assert.doesNotMatch(serviceSource, /\.(create|update|upsert|delete|createMany|updateMany|deleteMany)\(/, "the source snapshot is read-only");

const workspaceSource = readFileSync(resolve(process.cwd(), "components/admin-release-workspace.tsx"), "utf8");
assert.ok(workspaceSource.includes("readOptionalCampaignSourceSnapshot"));
assert.ok(workspaceSource.includes("Optional canonical source read failed"), "optional evidence failure must not take down the canonical workspace");

console.log("Campaign source snapshot deterministic, shared-scope, money, lifecycle-resolution, and failure-isolation checks passed.");
