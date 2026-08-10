import {createHash, createHmac, randomUUID} from "node:crypto";

import {expect, test, type BrowserContext, type Page} from "@playwright/test";

const TEST_DATABASE_URL = "file:c:/Users/regis/Desktop/Codex/vvviruzcommandcenter/storage/vvviruz-command-center.db";
const TEST_AUTH_SECRET = process.env.AUTH_SECRET || "stage10-playwright-auth-secret-stage10-playwright-auth-secret";
const lifecycleImportId = `e2e-retention-${Date.now()}`;
const mappingRowId = `${lifecycleImportId}-row`;
const aliasId = `${lifecycleImportId}-alias`;
let sessionId = "";
let cookieValue = "";
let artistId = "";
let adminUserId = "";
let releaseId = "";
let releaseTitle = "";
let prisma: import("@prisma/client").PrismaClient;

function makeCookie(secret: string, sid: string, expiresAt: Date) {
  const payload = Buffer.from(JSON.stringify({sid, stage: "authenticated", exp: expiresAt.getTime(), v: 1}), "utf8").toString("base64url");
  const key = createHash("sha256").update(`${secret}:session-cookie`, "utf8").digest();
  return `${payload}.${createHmac("sha256", key).update(payload, "utf8").digest("base64url")}`;
}

async function authenticate(context: BrowserContext) {
  await context.addCookies([{name: "vvv_admin_session", value: cookieValue, url: "http://localhost:3009", expires: Math.floor(Date.now() / 1000) + 3600, httpOnly: true, sameSite: "Lax"}]);
}

function preview(type: string, rows: Array<{number: number; title?: string; date?: string; warnings?: Array<{code: string; message: string}>}> = []) {
  const needsPeriod = type === "SONGS_PERIOD" || type === "PLAYLISTS_PERIOD";
  return {
    ok: true, code: "PREVIEW_READY", message: "Preview ready", previewToken: `opaque-${type}`, previewId: `preview-${type}`, expiresAt: new Date(Date.now() + 600_000).toISOString(),
    detectedType: type, performanceLabel: type === "TRACK_STREAM_TIMELINE" ? "Track stream performance — not listener retention" : "Spotify for Artists performance",
    fileHash: "1".repeat(64), duplicateFile: false, existingImport: null, parserVersion: "spotify-sfa-v1", normalizationVersion: 1,
    originalFilename: `${type.toLowerCase()}.csv`, safeDisplayFilename: `${type.toLowerCase()}.csv`, fileSizeBytes: 256,
    dateRange: needsPeriod ? null : {minimumDate: "2026-07-01", maximumDate: "2026-07-03", missingDates: []}, previewPeriod: null, requiresPeriodConfirmation: needsPeriod,
    counts: {total: rows.length || 3, structurallyValid: rows.length || 3, accepted: rows.length || 3, warnings: rows.filter((row) => row.warnings?.length).length, rejected: 0, unmatched: type === "SONGS_PERIOD" ? rows.length : 0},
    rowPreview: (rows.length ? rows : [{number: 2, title: "Daily metric"}]).map((row) => ({originalRowNumber: row.number, outcome: row.warnings?.length ? "WARNING" : "ACCEPTED", safeDisplayValues: {Song: row.title || "Metric", "Release date": row.date || "2026-07-01"}, normalizedValues: type === "SONGS_PERIOD" ? {exportedTitle: row.title || "Song", exportedReleaseDate: row.date || "2026-07-01"} : {metricDate: "2026-07-01", streams: 10}, errors: [], warnings: row.warnings || [], mappingSuggestion: type === "SONGS_PERIOD" ? {candidateRelease: null, matchMethod: "NO_MATCH", confidence: "NO_MATCH", competingCandidates: [], existingAliasId: null, manualConfirmationRequired: true, mayAutoApply: false} : undefined})),
    rowPreviewTruncated: false, blockingErrors: [], fileWarnings: [], requiredActions: [], overlaps: [], candidateArtist: null, candidateRelease: null, reconciliation: {entries: []}
  };
}

async function mockCommit(page: Page, importId: string, unmatched = 0) {
  await page.route("**/api/analytics/imports/commit", async (route) => route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, code: "IMPORT_COMMITTED", importId})}));
  await page.route(`**/api/analytics/imports/${importId}`, async (route) => route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, import: {id: importId, status: "IMPORTED", acceptedRowCount: 3, unmatchedRowCount: unmatched, warningCount: 0, rawFileExpiresAt: "2026-09-02T00:00:00.000Z"}})}));
}

async function upload(page: Page, type: string, payload: ReturnType<typeof preview>) {
  await page.route("**/api/analytics/imports/preview", async (route) => route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify(payload)}));
  await page.getByLabel(/Drop one Spotify CSV/i).setInputFiles({name: `${type}.csv`, mimeType: "text/csv", buffer: Buffer.from("Date,Streams\n2026-07-01,10")});
  await page.getByRole("button", {name: "Create private preview"}).click();
  await expect(page.getByText("Preview expires")).toBeVisible();
}

test.beforeAll(async () => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const client = await import("@prisma/client");
  prisma = new client.PrismaClient();
  const admin = await prisma.adminUser.findFirst();
  if (!admin) throw new Error("The local Playwright database needs an enrolled admin user.");
  const artist = await prisma.artistProfile.findFirst({orderBy: {displayName: "asc"}});
  if (!artist) throw new Error("The local Playwright database needs an artist profile.");
  const release = await prisma.release.findFirst({orderBy: {title: "asc"}});
  if (!release) throw new Error("The local Playwright database needs a release.");
  adminUserId = admin.id; artistId = artist.id; sessionId = `e2e-session-${randomUUID()}`;
  releaseId = release.id; releaseTitle = release.title;
  const now = new Date(); const expiresAt = new Date(now.getTime() + 3_600_000);
  await prisma.authSession.create({data: {id: sessionId, userId: admin.id, username: admin.username, stage: "authenticated", factorMethod: "totp", pendingTotpSecret: null, createdAt: now, updatedAt: now, expiresAt}});
  cookieValue = makeCookie(TEST_AUTH_SECRET, sessionId, expiresAt);
  await prisma.analyticsImport.create({data: {id: lifecycleImportId, importType: "ARTIST_AUDIENCE_TIMELINE", originalFilename: "lifecycle-audience.csv", fileHash: createHash("sha256").update(lifecycleImportId).digest("hex"), artistProfileId: artist.id, uploadedById: admin.id, uploadedByUsername: admin.username, uploadedAt: now, status: "IMPORTED", reportingTimezone: "UTC", detectedPeriodStart: new Date("2026-07-01T00:00:00.000Z"), detectedPeriodEnd: new Date("2026-07-03T00:00:00.000Z"), rowCount: 3, acceptedRowCount: 3, validationSummary: JSON.stringify({parserVersion: "spotify-sfa-v1", blockingErrors: [], fileWarnings: [], missingDates: [], reconciliation: {entries: []}}), metadata: "{}", normalizationVersion: 1, rawFileStorageDriver: "local", rawFileStorageKey: `e2e/${lifecycleImportId}.csv`, rawFileSizeBytes: 256, rawFileExpiresAt: new Date(Date.now() + 86_400_000), acceptedAt: now, createdAt: now, updatedAt: now}});
  await prisma.releaseImportAlias.create({data: {id: aliasId, source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", exportedTitle: "E2E unresolved song", normalizedTitle: "e2e unresolved song", exportedReleaseDate: null, artistProfileId: artist.id, releaseId: release.id, status: "ACTIVE", matchMethod: "MANUAL_CONFIRMATION", evidence: "{}", scopeKey: aliasId, activeScopeKey: aliasId, confirmedById: admin.id, confirmedByUsername: admin.username, confirmedAt: now, createdAt: now, updatedAt: now}});
  await prisma.analyticsImportRow.create({data: {id: mappingRowId, importId: lifecycleImportId, sourceRowNumber: 2, exportType: "SONGS_PERIOD", rowIdentityKey: `${mappingRowId}-identity`, originalValues: "{}", safeDisplayValues: JSON.stringify({Song: "E2E unresolved song", "Release date": ""}), normalizedValues: JSON.stringify({exportedTitle: "E2E unresolved song", exportedReleaseDate: null}), structuralOutcome: "ACCEPTED", mappingStatus: "SUGGESTED", mappingReason: "FUZZY_TITLE_SUGGESTION", suggestedReleaseId: release.id, mappingConfidence: "FUZZY_HIGH", mappingEvidence: "{}", createdAt: now, updatedAt: now}});
});

test.afterAll(async () => {
  await prisma.analyticsImportRow.deleteMany({where: {id: mappingRowId}});
  await prisma.releaseImportAlias.deleteMany({where: {id: aliasId}});
  await prisma.analyticsImport.deleteMany({where: {id: lifecycleImportId}});
  await prisma.authSession.deleteMany({where: {id: sessionId}});
  await prisma.$disconnect();
});

test.beforeEach(async ({context, page}) => { await authenticate(context); await page.goto("/admin/retention-lab/imports"); await expect(page.getByRole("heading", {name: "Spotify Import Center"})).toBeVisible(); });

test("Journey 1: artist timeline upload, review, commit, and detail link", async ({page}) => {
  await upload(page, "artist", preview("ARTIST_AUDIENCE_TIMELINE"));
  await expect(page.getByLabel("Artist profile")).toBeVisible();
  await page.getByLabel(/I confirm this context/i).check();
  await mockCommit(page, "import-artist");
  await page.getByRole("button", {name: "Commit import"}).click();
  await expect(page.getByText("Import committed")).toBeVisible();
  await expect(page.getByRole("link", {name: "Open import detail"})).toHaveAttribute("href", "/admin/retention-lab/imports/import-artist");
});

test("Journey 2: track timeline identity and retention wording", async ({page}) => {
  const trackRows = Array.from({length: 200}, (_, index) => ({number: index + 2, title: `Track day ${index + 1}`}));
  const trackPreview = {...preview("TRACK_STREAM_TIMELINE", trackRows), counts: {total: 944, structurallyValid: 944, accepted: 0, warnings: 0, rejected: 0, unmatched: 944}, rowPreviewTruncated: true};
  await upload(page, "track", trackPreview);
  await expect(page.getByText("Total rows").locator("..")).toContainText("944");
  await expect(page.getByText("Preview window").locator("..")).toContainText("Previewing first 200 rows");
  await expect(page.getByText(/stream performance, not listener retention/i)).toBeVisible();
  await page.getByRole("combobox", {name: "Select release for track timeline"}).click();
  const firstRelease = page.locator('button[role="option"]').nth(1);
  await expect(firstRelease).toBeVisible(); await firstRelease.click();
  await page.getByText("The filename is not authoritative track or release identity.").click();
  await page.getByText("Track streams measure stream performance, not listener retention.").click();
  await expect(page.getByText("Total source rows").locator("..")).toContainText("944");
  await expect(page.getByText("Structurally valid rows").locator("..")).toContainText("944");
  await expect(page.getByText("Accepted after confirmation").locator("..")).toContainText("944");
  await expect(page.getByText("Rejected rows").locator("..")).toContainText("0");
  await expect(page.getByText("Unmatched after confirmation").locator("..")).toContainText("0");
  await page.getByLabel(/I confirm this context/i).check();
  await mockCommit(page, "import-track");
  await page.getByRole("button", {name: "Commit import"}).click();
  await expect(page.getByText("Import committed")).toBeVisible();
});

test("Journey 3: songs period maps one row and leaves one valid row unmatched", async ({page}) => {
  const songs = preview("SONGS_PERIOD", [{number: 2, title: "Mapped song"}, {number: 3, title: "Unmatched song"}]);
  await upload(page, "songs", songs);
  await expect(page.getByText("Mapping review incomplete: 0 of 2 structurally valid rows")).toBeVisible();
  await expect(page.getByText("Accepted after confirmation").locator("..")).toContainText("Pending completed mapping review");
  await expect(page.getByRole("button", {name: "Commit import"})).toBeDisabled();
  await page.getByLabel("Report start date").fill("2026-07-01"); await page.getByLabel("Report end date").fill("2026-07-28");
  const pickers = page.getByRole("combobox", {name: /Select release for source row/});
  await pickers.first().click(); await page.locator('button[role="option"]').nth(1).click();
  await page.getByRole("article").filter({hasText: "Unmatched song"}).getByRole("button", {name: "Leave unmatched"}).click();
  await page.getByRole("article").filter({hasText: "Unmatched song"}).getByLabel("Unmatched reason").selectOption("USER_DEFERRED");
  await expect(page.getByText("Total source rows").locator("..")).toContainText("2");
  await expect(page.getByText("Structurally valid rows").locator("..")).toContainText("2");
  await expect(page.getByText("Accepted after confirmation").locator("..")).toContainText("1");
  await expect(page.getByText("Unmatched after confirmation").locator("..")).toContainText("1");
  await expect(page.getByText("Rejected rows").locator("..")).toContainText("0");
  await page.getByLabel(/I confirm this context/i).check();
  await mockCommit(page, "import-songs", 1);
  await page.getByRole("button", {name: "Commit import"}).click();
  await expect(page.getByRole("link", {name: "Open mapping queue"})).toHaveAttribute("href", "/admin/retention-lab/mappings?import_id=import-songs");
});

test("Journey 4: playlists period exposes null date warning separately", async ({page}) => {
  const playlistRows = Array.from({length: 8}, (_, index) => ({number: index + 2, title: `Playlist ${index + 1}`, warnings: [{code: index === 7 ? "FORMULA_PREFIX_ESCAPED" : "DATE_ADDED_UNAVAILABLE", message: index === 7 ? "Author was neutralized for safe spreadsheet display." : "Date added is unavailable and remains null."}]}));
  const playlists = {...preview("PLAYLISTS_PERIOD", playlistRows), counts: {total: 8, structurallyValid: 8, accepted: 0, warnings: 8, rejected: 0, unmatched: 0}};
  await upload(page, "playlists", playlists);
  await page.getByLabel("Report start date").fill("2026-07-01"); await page.getByLabel("Report end date").fill("2026-07-28");
  await expect(page.getByText(/Date added is unavailable and remains null/i).first()).toBeVisible();
  await expect(page.getByText(/Warning review incomplete/i)).toBeVisible();
  await expect(page.getByText("Accepted after confirmation").locator("..")).toContainText("Pending required warning acknowledgements");
  await expect(page.getByRole("button", {name: "Commit import"})).toBeDisabled();
  await page.getByText(/DATE_ADDED_UNAVAILABLE:/).click();
  await expect(page.getByText("Accepted after confirmation").locator("..")).toContainText("Pending required warning acknowledgements");
  await page.getByText(/FORMULA_PREFIX_ESCAPED:/).click();
  await expect(page.getByText("Total source rows").locator("..")).toContainText("8");
  await expect(page.getByText("Structurally valid rows").locator("..")).toContainText("8");
  await expect(page.getByText("Accepted after confirmation").locator("..")).toContainText("8");
  await expect(page.getByText("Rejected rows").locator("..")).toContainText("0");
  await expect(page.getByRole("button", {name: "Commit import"})).toBeDisabled();
  await page.getByLabel(/I confirm this context/i).check();
  await mockCommit(page, "import-playlists");
  await page.getByRole("button", {name: "Commit import"}).click();
  await expect(page.getByText("Import committed")).toBeVisible();
});

test("Journey 5 and accessibility: reprocess, focus-managed withdrawal, preserved-history copy", async ({page}) => {
  await page.route(`**/api/analytics/imports/${lifecycleImportId}/reprocess`, async (route) => route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify(preview("ARTIST_AUDIENCE_TIMELINE"))}));
  await page.route(`**/api/analytics/imports/${lifecycleImportId}/withdraw`, async (route) => route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, code: "IMPORT_WITHDRAWN", importId: lifecycleImportId})}));
  await page.route(`**/api/analytics/imports/${lifecycleImportId}`, async (route) => {
    if (route.request().method() === "GET") await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({import: {...(await prisma.analyticsImport.findUnique({where: {id: lifecycleImportId}})), id: lifecycleImportId, status: "WITHDRAWN", artistProfile: {id: artistId, displayName: "vvviruz", slug: "vvviruz"}, uploadedAt: new Date().toISOString(), acceptedAt: new Date().toISOString(), detectedPeriodStart: "2026-07-01", detectedPeriodEnd: "2026-07-03", validationSummary: {parserVersion: "spotify-sfa-v1", reconciliation: {entries: []}}, metadata: {}, rawFileAvailability: "AVAILABLE", dataProvenance: {parserVersion: "spotify-sfa-v1"}, _count: {artistMetricObservations: 0, trackMetricObservations: 0, songPeriodSnapshots: 0, playlistPeriodSnapshots: 0}}})});
  });
  await page.goto(`/admin/retention-lab/imports/${lifecycleImportId}`);
  await page.getByRole("button", {name: "Reprocess retained file"}).click();
  await expect(page.getByText(/new in-memory preview was created/i)).toBeVisible();
  const withdraw = page.getByRole("button", {name: "Withdraw import"}); await withdraw.focus(); await withdraw.press("Enter");
  const reason = page.getByLabel("Required withdrawal reason"); await expect(reason).toBeFocused();
  await expect(page.getByText(/Normalized records remain preserved/i)).toBeVisible();
  await reason.fill("Superseded local test import"); await page.getByRole("button", {name: "Confirm withdrawal"}).click();
  await expect(page.getByText(/excluded from current analytics/i).first()).toBeVisible();
});

test("file errors and status indicators are accessible without color", async ({page}) => {
  await page.getByLabel(/Drop one Spotify CSV/i).setInputFiles({name: "not-supported.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("x")});
  await expect(page.getByRole("alert").filter({hasText: "UNSUPPORTED FILE"})).toContainText("UNSUPPORTED FILE");
  await expect(page.getByLabel(/Drop one Spotify CSV/i)).toHaveAttribute("type", "file");
});

test("duplicate preview remains inspectable but cannot be committed", async ({page}) => {
  const duplicate = {...preview("ARTIST_AUDIENCE_TIMELINE"), code: "DUPLICATE_FILE", message: "These exact file bytes already exist.", previewToken: null, duplicateFile: true, existingImport: {id: lifecycleImportId, status: "IMPORTED"}};
  await page.route("**/api/analytics/imports/preview", async (route) => route.fulfill({status: 422, contentType: "application/json", body: JSON.stringify(duplicate)}));
  await page.getByLabel(/Drop one Spotify CSV/i).setInputFiles({name: "duplicate.csv", mimeType: "text/csv", buffer: Buffer.from("Date,Streams\n2026-07-01,10")});
  await page.getByRole("button", {name: "Create private preview"}).click();
  await expect(page.getByText("DUPLICATE FILE").first()).toBeVisible();
  await expect(page.getByRole("button", {name: "Commit import"})).toBeDisabled();
});

test("mapping confirmation, remap, and alias revocation are explicit audited actions", async ({page}) => {
  const queueItem = {id: mappingRowId, sourceRowNumber: 2, exportType: "SONGS_PERIOD", safeDisplayValues: {Song: "E2E unresolved song", "Release date": ""}, normalizedValues: {exportedTitle: "E2E unresolved song", exportedReleaseDate: null}, mappingStatus: "SUGGESTED", mappingReason: "FUZZY_TITLE_SUGGESTION", mappingConfidence: "FUZZY_HIGH", mappingEvidence: {}, suggestedRelease: {id: releaseId, title: releaseTitle, releaseDate: null}, confirmedRelease: null, alias: null, import: {id: lifecycleImportId, originalFilename: "lifecycle-audience.csv", importType: "SONGS_PERIOD", artistProfileId: artistId, uploadedAt: new Date().toISOString(), status: "IMPORTED"}, observationsAlreadyExist: true, availableActions: ["CONFIRM", "UNMATCH"]};
  const aliasItem = {id: aliasId, status: "ACTIVE", source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", exportedTitle: "E2E unresolved song", exportedReleaseDate: null, matchMethod: "MANUAL_CONFIRMATION", confirmedByUsername: "e2e-admin", confirmedAt: new Date().toISOString(), release: {id: releaseId, title: releaseTitle}, artistProfile: {id: artistId, displayName: "vvviruz"}};
  const detail = {...queueItem, structuralOutcome: "ACCEPTED", unmatchedReason: null, unmatchedNote: "", confirmedRelease: {id: releaseId, title: releaseTitle}, alias: {id: aliasId, status: "ACTIVE"}, immutableSnapshot: {id: "snapshot-e2e", releaseId, periodStart: "2026-07-01", periodEnd: "2026-07-28"}, suggestion: {candidateReleaseId: releaseId, matchMethod: "FUZZY_TITLE_SUGGESTION", confidence: "FUZZY_HIGH", competingCandidates: [], evidence: {score: 0.9}}, auditEvents: [{id: "audit-e2e", action: "SUGGESTION_CREATED", actorUsername: "system", reason: "", createdAt: new Date().toISOString()}]};
  let confirmed = false;
  await page.route("**/api/analytics/mappings/queue**", async (route) => route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({page: 1, pageSize: 25, total: 1, items: [{...queueItem, mappingStatus: confirmed ? "CONFIRMED" : "SUGGESTED", availableActions: confirmed ? ["REMAP", "UNMATCH"] : ["CONFIRM", "UNMATCH"]}]})}));
  await page.route(`**/api/analytics/mappings/${mappingRowId}`, async (route) => route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({row: {...detail, mappingStatus: confirmed ? "CONFIRMED" : "SUGGESTED"}})}));
  await page.route(`**/api/analytics/mappings/${mappingRowId}/confirm`, async (route) => { confirmed = true; await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true})}); });
  await page.route(`**/api/analytics/mappings/${mappingRowId}/remap`, async (route) => route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true})}));
  await page.route("**/api/analytics/aliases?**", async (route) => route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({page: 1, pageSize: 25, total: 1, items: [aliasItem]})}));
  await page.route(`**/api/analytics/aliases/${aliasId}/revoke`, async (route) => route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true})}));
  await page.goto(`/admin/retention-lab/mappings?import_id=${lifecycleImportId}`);
  await page.getByRole("button", {name: "Confirm"}).first().click();
  await expect(page.getByText(/fuzzy title suggestion/i).first()).toBeVisible();
  await page.getByText("Create or reuse a scoped alias for future imports.").click();
  await page.getByText(/title-only alias has no release-date boundary/i).click();
  await page.getByText("I confirm this audited mapping decision.").click();
  await page.getByRole("button", {name: "Save decision"}).click();
  await page.getByRole("button", {name: "Remap"}).first().click();
  await page.getByLabel("Required remap reason").fill("Correcting audited catalog resolution");
  await page.getByText("I confirm this audited mapping decision.").click();
  await page.getByRole("button", {name: "Save decision"}).click();
  await page.getByRole("button", {name: "Revoke alias"}).click();
  const revokeReason = page.getByLabel("Revocation reason"); await expect(revokeReason).toBeFocused(); await revokeReason.fill("Alias no longer safe for future imports");
  await page.getByRole("button", {name: "Confirm revocation"}).click();
});
