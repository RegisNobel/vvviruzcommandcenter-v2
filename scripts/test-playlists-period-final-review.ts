import assert from "node:assert/strict";

import {resolveFinalReviewCounts} from "../lib/analytics/import-center-ui";
import {parseSpotifyExport} from "../lib/analytics/spotify-export-parser";

const encoder = new TextEncoder();
const productionShapedCsv = `title,author,listeners,streams,date_added
Editorial One,Spotify,10,20,n/a
Editorial Two,Spotify,11,21,n/a
Editorial Three,Spotify,12,22,-
Editorial Four,Spotify,13,23,
Editorial Five,Spotify,14,24,n/a
Editorial Six,Spotify,15,25,-
Editorial Seven,Spotify,16,26,
Editorial Eight,=owner,17,27,2026-07-11`;

const parsed = parseSpotifyExport({
  fileName: "playlists-production-shaped.csv",
  bytes: encoder.encode(productionShapedCsv),
  mimeType: "text/csv",
  previewPeriod: {periodStart: "2026-07-05", periodEnd: "2026-08-01"}
});

assert.equal(parsed.detectedType, "PLAYLISTS_PERIOD");
assert.equal(parsed.rowCount, 8);
assert.equal(parsed.rejectedCount, 0);
assert.equal(parsed.rows.filter((row) => row.normalizedValues && "dateAdded" in row.normalizedValues && row.normalizedValues.dateAdded === null).length, 7);
assert.equal(parsed.rows[7].originalValues.author, "=owner", "formula-like source evidence must remain unchanged");
assert.equal(parsed.rows[7].safeDisplayValues.author, "'=owner", "formula-like display evidence must be escaped");
assert.ok(parsed.rows[7].warnings.some(({code}) => code === "FORMULA_PREFIX_ESCAPED"));

const counts = {
  total: parsed.rowCount,
  structurallyValid: parsed.rowCount - parsed.rejectedCount,
  accepted: parsed.acceptedCount,
  warnings: parsed.warningCount,
  rejected: parsed.rejectedCount,
  unmatched: parsed.unmatchedCount
};
const incomplete = resolveFinalReviewCounts("PLAYLISTS_PERIOD", counts, {
  warningAcknowledgementRequired: true,
  warningsAcknowledged: false
});
assert.deepEqual(incomplete, {total: 8, structurallyValid: 8, accepted: 0, rejected: 0, unmatched: 0, reviewState: "INCOMPLETE", reviewed: 0});

const complete = resolveFinalReviewCounts("PLAYLISTS_PERIOD", counts, {
  warningAcknowledgementRequired: true,
  warningsAcknowledged: true
});
assert.deepEqual(complete, {total: 8, structurallyValid: 8, accepted: 8, rejected: 0, unmatched: 0, reviewState: "COMPLETE", reviewed: 8});
assert.equal(complete.accepted + complete.rejected, complete.total);

const clean = resolveFinalReviewCounts("PLAYLISTS_PERIOD", {...counts, accepted: 8, warnings: 0}, {
  warningAcknowledgementRequired: false,
  warningsAcknowledged: true
});
assert.equal(clean.reviewState, "COMPLETE");
assert.equal(clean.accepted, 8);

const oneRejected = resolveFinalReviewCounts("PLAYLISTS_PERIOD", {...counts, structurallyValid: 7, rejected: 1}, {
  warningAcknowledgementRequired: true,
  warningsAcknowledged: true
});
assert.equal(oneRejected.accepted, 7);
assert.equal(oneRejected.rejected, 1);
assert.equal(oneRejected.accepted + oneRejected.rejected, oneRejected.total);

const cappedPreviewCounts = {...counts, total: 250, structurallyValid: 250, warnings: 250};
assert.equal(resolveFinalReviewCounts("PLAYLISTS_PERIOD", cappedPreviewCounts, {
  warningAcknowledgementRequired: true,
  warningsAcknowledged: true
}).accepted, 250, "full-file counts must not be limited by the preview window");

console.log("Playlists Period final-review count checks passed.");
