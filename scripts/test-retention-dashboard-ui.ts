import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import {resolve} from "node:path";

import {buildDashboardInterpretation} from "../lib/analytics/retention-dashboard";
import {calculateRetentionAnalysis} from "../lib/analytics/retention-engine";
import {datesInclusive} from "../lib/analytics/retention-calculations";
import type {RetentionAnalysisResult, RetentionCalculationInput, RetentionReasonCode, RetentionStatus} from "../lib/analytics/retention-types";

const dates = datesInclusive("2026-01-01", "2026-04-30");
const input: RetentionCalculationInput = {
  artistId: "artist",
  releaseId: "release",
  campaignId: "campaign",
  releaseDate: "2026-02-01",
  confirmedCampaignIntervals: [{id: "interval", startDate: "2026-02-10", endDate: "2026-02-20", timezone: "UTC", sourceType: "MANUAL"}],
  audienceObservations: dates.map((date, index) => ({date, listeners: 1000 + (date >= "2026-02-10" && date <= "2026-02-20" ? 300 : date >= "2026-03-06" && date <= "2026-03-20" ? 120 : 0), monthlyListeners: 18000 + index, monthlyActiveListeners: 7000 + index, streams: 2200 + index, playlistAdds: 20, saves: 40, followers: 5000 + index, importId: "import"})),
  trackObservations: [],
  overlaps: [],
  inputImports: [],
  mappingResolution: [],
  reconciliationWarnings: [],
  dataCutoffDate: "2026-04-30",
  calculatedAt: "2026-04-30T00:00:00.000Z",
  conflictingTrackTimelines: false,
  incompleteTrackIdentity: false,
  ambiguousReleaseMapping: false,
  reportPeriodUserEntered: false,
  timezoneUncertain: false
};
const base = calculateRetentionAnalysis(input);

function interpretation(status: RetentionStatus, reasons: RetentionReasonCode[]) {
  return buildDashboardInterpretation({...base, status, reasonCodes: reasons} as RetentionAnalysisResult);
}

assert.match(interpretation("VALID", ["NO_SOURCE_OF_STREAM_DATA"]).detail, /not proof/i);
assert.match(interpretation("WARNING", ["TIMEZONE_UNCERTAIN"]).detail, /warnings/i);
assert.match(interpretation("EXCLUDED", ["OVERLAPPING_RELEASE"]).detail, /shown for context/i);
assert.match(interpretation("INSUFFICIENT", ["OPEN_CAMPAIGN"]).headline, /still open/i);
assert.match(interpretation("INSUFFICIENT", ["FUTURE_WINDOW_INCOMPLETE"]).headline, /not available/i);
assert.match(interpretation("WARNING", ["OVERLAPPING_CAMPAIGN"]).notes.join(" "), /another campaign/i);
assert.match(interpretation("WARNING", ["DIFFERENT_RELEASE_CAMPAIGN_OVERLAP"]).notes.join(" "), /different release campaign/i);
assert.match(interpretation("WARNING", ["MISSING_CAMPAIGN_DAYS"]).notes.join(" "), /missing dates/i);
assert.match(interpretation("INSUFFICIENT", ["NON_POSITIVE_INCREMENTAL_LIFT"]).notes.join(" "), /did not create positive/i);
assert.match(interpretation("WARNING", ["LIFT_RETAINED_ABOVE_100"]).notes.join(" "), /above 100%/i);
assert.match(interpretation("WARNING", ["FLOOR_BELOW_BASELINE"]).notes.join(" "), /below the pre-release baseline/i);
assert.match(interpretation("INSUFFICIENT", ["CONFLICTING_TRACK_TIMELINES"]).notes.join(" "), /not merged/i);

const page = readFileSync(resolve(process.cwd(), "app/admin/(protected)/retention-lab/page.tsx"), "utf8");
const dashboard = readFileSync(resolve(process.cwd(), "components/retention-dashboard-view.tsx"), "utf8");
const analysis = readFileSync(resolve(process.cwd(), "components/retention-analysis-view.tsx"), "utf8");
const chart = readFileSync(resolve(process.cwd(), "components/retention-timeline-chart.tsx"), "utf8");
const loader = readFileSync(resolve(process.cwd(), "components/retention-timeline-chart-loader.tsx"), "utf8");
const releaseWorkspace = readFileSync(resolve(process.cwd(), "components/admin-release-workspace.tsx"), "utf8");
const nav = readFileSync(resolve(process.cwd(), "components/command-center-nav.tsx"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {dependencies: Record<string, string>};

assert.ok(page.includes("readRetentionDashboard") && !page.includes("redirect("), "Retention Lab root is the dashboard");
for (const text of ["Latest imported values", "Audience trend summary", "Release, campaign, and date range", "Release comparison"]) assert.ok(dashboard.includes(text), `dashboard includes ${text}`);
for (const text of ["Data confidence", "Attribution confidence", "Stage 7 overall", "Measured windows and lift", "Track-stream persistence", "Metric provenance and formula"]) assert.ok(analysis.includes(text), `analysis includes ${text}`);
for (const text of ["Audience", "Engagement", "Track performance", "Keyboard date inspector", "Complete event list", "Inspect "]) assert.ok(chart.includes(text), `chart includes ${text}`);
assert.ok(chart.includes("connectNulls={false}") && chart.includes("isAnimationActive={false}") && chart.includes("accessibilityLayer"));
assert.ok(loader.includes("ssr: false"), "Recharts is dynamically client-only");
assert.ok(releaseWorkspace.includes("ReleaseRetentionSection") && releaseWorkspace.includes("readReleaseRetentionDashboard"), "release workspace reuses dashboard adapter and components");
assert.ok(nav.includes('href: "/admin/retention-lab"') && nav.includes('label: "Overview"'));
assert.equal(packageJson.dependencies.recharts, "^3.10.1");
assert.equal(packageJson.dependencies["react-is"], "^19.1.0");
for (const library of ["@visx/xychart", "echarts", "echarts-for-react"]) assert.equal(packageJson.dependencies[library], undefined, `${library} was not added`);
assert.equal(existsSync(resolve(process.cwd(), "app/admin/(protected)/retention-lab/chart-poc/page.tsx")), false, "synthetic proof route is removed");
assert.ok(!/rawFileStorageKey|originalValues|previewToken|storageKey/i.test(`${chart}\n${loader}`), "client chart files contain no private fields");

console.log("Retention dashboard interpretation templates, components, release reuse, navigation, accessibility, proof cleanup, and dependency checks passed.");
