import {createHash, createHmac, randomUUID} from "node:crypto";

import {expect, test, type BrowserContext} from "@playwright/test";

const TEST_DATABASE_URL = "file:c:/Users/regis/Desktop/Codex/vvviruzcommandcenter/storage/vvviruz-command-center.db";
const TEST_AUTH_SECRET = process.env.AUTH_SECRET || "stage10-playwright-auth-secret-stage10-playwright-auth-secret";
const run = randomUUID();
const artistId = "artist-profile-vvviruz";
const importIds = [`stage8-e2e-audience-${run}`, `stage8-e2e-track-${run}`, `stage8-e2e-no-campaign-track-${run}`];
const releaseIds = {
  complete: `stage8-e2e-complete-${run}`,
  open: `stage8-e2e-open-${run}`,
  overlap: `stage8-e2e-overlap-${run}`,
  other: `stage8-e2e-other-${run}`,
  missing: `stage8-e2e-missing-${run}`,
  noCampaign: `stage8-e2e-no-campaign-${run}`
};
const campaignIds = {
  complete: `stage8-e2e-campaign-complete-${run}`,
  open: `stage8-e2e-campaign-open-${run}`,
  overlap: `stage8-e2e-campaign-overlap-${run}`,
  missing: `stage8-e2e-campaign-missing-${run}`
};
let sessionId = "";
let cookieValue = "";
let prisma: import("@prisma/client").PrismaClient;

function day(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateRange(start: string, end: string) {
  const dates: string[] = [];
  for (let current = day(start); current <= day(end); current = new Date(current.getTime() + 86_400_000)) {
    dates.push(current.toISOString().slice(0, 10));
  }
  return dates;
}

function makeCookie(secret: string, id: string, expiresAt: Date) {
  const payload = Buffer.from(JSON.stringify({sid: id, stage: "authenticated", exp: expiresAt.getTime(), v: 1}), "utf8").toString("base64url");
  const key = createHash("sha256").update(`${secret}:session-cookie`, "utf8").digest();
  return `${payload}.${createHmac("sha256", key).update(payload, "utf8").digest("base64url")}`;
}

async function authenticate(context: BrowserContext) {
  await context.addCookies([{name: "vvv_admin_session", value: cookieValue, url: "http://localhost:3009", expires: Math.floor(Date.now() / 1000) + 3600, httpOnly: true, sameSite: "Lax"}]);
}

async function createRelease(id: string, title: string, releaseDate: string) {
  await prisma.release.create({data: {id, title, slug: `${id}-slug`, catalogScope: "VVVIRUZ", primaryArtistProfileId: artistId, releaseDate: day(releaseDate), createdOn: new Date(), updatedOn: new Date()}});
}

async function createCampaign(id: string, releaseId: string, name: string, start: string, end: string | null) {
  const now = new Date();
  await prisma.promotionCampaign.create({data: {id, artistProfileId: artistId, releaseId, platform: "META", name, objective: "STREAMS", status: end ? "ENDED" : "ACTIVE", createdAt: now, updatedAt: now, activeIntervals: {create: {id: `${id}-interval`, activeStartDate: day(start), activeEndDate: end ? day(end) : null, timezone: "America/New_York", sourceType: "MANUAL", confirmationStatus: "CONFIRMED", confirmedAt: now, createdAt: now, updatedAt: now}}}});
}

async function cleanup() {
  const campaigns = Object.values(campaignIds);
  const releases = Object.values(releaseIds);
  await prisma.campaignAuditEvent.deleteMany({where: {campaignId: {in: campaigns}}});
  await prisma.campaignTimelineEvent.deleteMany({where: {OR: [{campaignId: {in: campaigns}}, {releaseId: {in: releases}}]}});
  await prisma.campaignActiveInterval.deleteMany({where: {campaignId: {in: campaigns}}});
  await prisma.campaignEvidence.deleteMany({where: {campaignId: {in: campaigns}}});
  await prisma.promotionCampaign.deleteMany({where: {id: {in: campaigns}}});
  await prisma.trackMetricObservation.deleteMany({where: {importId: {in: importIds}}});
  await prisma.artistMetricObservation.deleteMany({where: {importId: {in: importIds}}});
  await prisma.analyticsImport.deleteMany({where: {id: {in: importIds}}});
  await prisma.release.deleteMany({where: {id: {in: releases}}});
  if (sessionId) await prisma.authSession.deleteMany({where: {id: sessionId}});
}

test.beforeAll(async () => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const client = await import("@prisma/client");
  prisma = new client.PrismaClient();
  const admin = await prisma.adminUser.findFirst();
  if (!admin) throw new Error("The local Playwright database needs an admin user.");
  await cleanup();
  const expiresAt = new Date(Date.now() + 3_600_000);
  sessionId = `stage8-e2e-session-${run}`;
  await prisma.authSession.create({data: {id: sessionId, userId: admin.id, username: admin.username, stage: "authenticated", factorMethod: "totp", pendingTotpSecret: null, createdAt: new Date(), updatedAt: new Date(), expiresAt}});
  cookieValue = makeCookie(TEST_AUTH_SECRET, sessionId, expiresAt);
  await Promise.all([
    createRelease(releaseIds.complete, "Stage 8 Browser Complete", "2000-01-01"),
    createRelease(releaseIds.open, "Stage 8 Browser Open", "2000-04-01"),
    createRelease(releaseIds.overlap, "Stage 8 Browser Overlap", "2000-05-01"),
    createRelease(releaseIds.other, "Stage 8 Browser Other Release", "2000-06-10"),
    createRelease(releaseIds.missing, "Stage 8 Browser Missing", "2000-07-01"),
    createRelease(releaseIds.noCampaign, "Mahoraga browser regression", "2026-06-10")
  ]);
  await Promise.all([
    createCampaign(campaignIds.complete, releaseIds.complete, "Browser complete campaign", "2000-01-10", "2000-01-20"),
    createCampaign(campaignIds.open, releaseIds.open, "Browser open campaign", "2000-04-10", null),
    createCampaign(campaignIds.overlap, releaseIds.overlap, "Browser overlap campaign", "2000-05-10", "2000-05-20"),
    createCampaign(campaignIds.missing, releaseIds.missing, "Browser missing campaign", "2000-07-10", "2000-07-20")
  ]);
  const acceptedAt = new Date();
  await prisma.analyticsImport.createMany({data: [
    {id: importIds[0], importType: "ARTIST_AUDIENCE_TIMELINE", originalFilename: "stage8-audience.csv", fileHash: createHash("sha256").update(importIds[0]).digest("hex"), artistProfileId: artistId, uploadedAt: acceptedAt, status: "IMPORTED", reportingTimezone: "UTC", validationSummary: JSON.stringify({parserVersion: "spotify-sfa-v1", reconciliation: {entries: []}}), normalizationVersion: 1, rawFileStorageDriver: "local", rawFileStorageKey: `private/${importIds[0]}.csv`, rawFileExpiresAt: new Date(Date.now() + 2_592_000_000), acceptedAt, createdAt: acceptedAt, updatedAt: acceptedAt},
    {id: importIds[1], importType: "TRACK_STREAM_TIMELINE", originalFilename: "stage8-track.csv", fileHash: createHash("sha256").update(importIds[1]).digest("hex"), artistProfileId: artistId, uploadedAt: acceptedAt, status: "IMPORTED", reportingTimezone: "UTC", validationSummary: JSON.stringify({parserVersion: "spotify-sfa-v1", reconciliation: {entries: []}}), normalizationVersion: 1, acceptedAt, createdAt: acceptedAt, updatedAt: acceptedAt},
    {id: importIds[2], importType: "TRACK_STREAM_TIMELINE", originalFilename: "mahoraga-regression.csv", fileHash: createHash("sha256").update(importIds[2]).digest("hex"), artistProfileId: artistId, uploadedAt: acceptedAt, status: "IMPORTED", reportingTimezone: "UTC", validationSummary: JSON.stringify({parserVersion: "spotify-sfa-v1", reconciliation: {entries: []}}), normalizationVersion: 1, acceptedAt, createdAt: acceptedAt, updatedAt: acceptedAt}
  ]});
  const audienceDates = dateRange("1999-12-01", "2001-12-31").filter((date) => date !== "2000-07-12");
  await prisma.artistMetricObservation.createMany({data: audienceDates.map((date, index) => ({id: `stage8-e2e-audience-${run}-${index}`, importId: importIds[0], artistProfileId: artistId, metricDate: day(date), listeners: 1000 + Math.round(Math.sin(index / 8) * 40) + (date >= "2000-01-10" && date <= "2000-01-20" ? 400 : 0), monthlyListeners: 18000 + index, monthlyActiveListeners: 7200 + Math.floor(index / 2), streams: 2400 + index, playlistAdds: 30 + (index % 5), saves: 60 + (index % 7), followers: 5000 + index, createdAt: acceptedAt}))});
  const trackDates = dateRange("2000-01-01", "2000-03-31");
  await prisma.trackMetricObservation.createMany({data: trackDates.map((date, index) => ({id: `stage8-e2e-track-${run}-${index}`, importId: importIds[1], releaseId: releaseIds.complete, spotifyTrackId: "stage8-e2e-track", metricDate: day(date), streams: Math.max(100, 2000 - index * 10), createdAt: acceptedAt}))});
  const noCampaignDates = dateRange("2026-06-10", "2026-08-01");
  await prisma.trackMetricObservation.createMany({data: noCampaignDates.map((date, index) => {
    let streams = 200;
    if (date >= "2026-06-10" && date <= "2026-06-16") streams = date === "2026-06-16" ? 140 : 138;
    if (date >= "2026-06-24" && date <= "2026-07-08") streams = date === "2026-07-08" ? 328 : 317;
    if (date >= "2026-07-26" && date <= "2026-08-01") streams = date === "2026-08-01" ? 341 : 340;
    if (date === "2026-07-17") streams = 582;
    return {id: `stage8-e2e-no-campaign-track-${run}-${index}`, importId: importIds[2], releaseId: releaseIds.noCampaign, spotifyTrackId: null, metricDate: day(date), streams, createdAt: acceptedAt};
  })});
  await prisma.campaignTimelineEvent.create({data: {id: `stage8-e2e-creative-${run}`, campaignId: campaignIds.complete, releaseId: releaseIds.complete, eventType: "CREATIVE_CHANGED", eventDate: day("2000-01-15"), timezone: "America/New_York", title: "Creative changed", source: "USER_ENTERED", confirmationStatus: "CONFIRMED", createdAt: acceptedAt, updatedAt: acceptedAt}});
});

test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test.beforeEach(async ({context}) => authenticate(context));

test("Journey 1: complete analysis, confidence, modes, keyboard, provenance, and release detail", async ({page}) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`/admin/retention-lab?releaseId=${releaseIds.complete}&campaignId=${campaignIds.complete}&range=1000`);
  await expect(page.getByRole("heading", {name: "Audience Retention Lab"})).toBeVisible();
  await expect(page.getByRole("heading", {name: /Stage 8 Browser Complete/})).toBeVisible();
  await expect(page.getByLabel("Analysis confidence dimensions")).toContainText("Data confidence");
  await expect(page.locator('[data-metric-id="primary-baseline"]')).not.toContainText("Unavailable");
  await page.getByRole("button", {name: "Engagement"}).click();
  await expect(page.getByText(/not unique-user conversion rates/i)).toBeVisible();
  await page.getByRole("button", {name: "Track performance"}).click();
  await expect(page.getByText(/does not measure unique listener retention/i).first()).toBeVisible();
  const inspector = page.getByRole("slider", {name: "Inspect timeline date"});
  await inspector.focus();
  const before = await inspector.inputValue();
  await inspector.press("ArrowLeft");
  expect(Number(await inspector.inputValue())).toBe(Number(before) - 1);
  await page.getByText("Metric provenance and formula").first().click();
  await expect(page.getByText("Formula").first()).toBeVisible();
  const releaseLink = page.getByRole("link", {name: "Open release workspace"});
  await expect(releaseLink).toHaveAttribute("href", new RegExp(`/admin/releases/${releaseIds.complete}`));
  await releaseLink.click();
  await expect(page.getByRole("heading", {name: "Audience Retention", exact: true})).toBeVisible();
  expect(errors.filter((message) => /hydration|did not match|uncaught/i.test(message))).toEqual([]);
});

test("Journey 2: open campaign keeps current metrics and no fake floor", async ({page}) => {
  await page.goto(`/admin/retention-lab?releaseId=${releaseIds.open}&campaignId=${campaignIds.open}&range=1000`);
  await expect(page.getByText(/campaign is still open/i).first()).toBeVisible();
  await expect(page.locator('[data-metric-id="campaign-average"]')).not.toContainText("Unavailable");
  await expect(page.locator('[data-metric-id="post-floor"]')).toContainText("Unavailable");
  await expect(page.locator('[data-metric-id="lift-retained"]')).not.toContainText("0%");
});

test("Journey 3: overlapping release shows raw context and excluded interpretation", async ({page}) => {
  await page.goto(`/admin/retention-lab?releaseId=${releaseIds.overlap}&campaignId=${campaignIds.overlap}&range=1000`);
  await expect(page.getByText(/floor is excluded/i).first()).toBeVisible();
  await expect(page.locator('[data-metric-id="post-floor"]')).toContainText("EXCLUDED");
  await expect(page.getByText(/Stage 8 Browser Other Release published/i).first()).toBeVisible();
  await expect(page.locator(".recharts-reference-line")).not.toHaveCount(0);
});

test("Journey 4: missing data stays a visible gap and lowers data confidence", async ({page}) => {
  await page.goto(`/admin/retention-lab?releaseId=${releaseIds.missing}&campaignId=${campaignIds.missing}&range=1000`);
  const gapDisclosure = page.locator("details").filter({has: page.getByText(/^Missing dates \(\d+\)$/)}).first();
  await gapDisclosure.locator("summary").click();
  await expect(gapDisclosure).toHaveAttribute("open", "");
  await expect(gapDisclosure).toContainText("2000-07-12");
  await expect(page.getByLabel("Analysis confidence dimensions").getByText("Data confidence", {exact: true}).locator("..")).toContainText("MODERATE");
  const listenerPath = await page.locator(".recharts-line-curve").first().getAttribute("d");
  expect((listenerPath?.match(/M/g) ?? []).length).toBeGreaterThan(1);
});

test("Journey 5: track persistence uses stream terminology and resolved windows", async ({page}) => {
  await page.goto(`/admin/retention-lab?releaseId=${releaseIds.complete}&campaignId=${campaignIds.complete}&range=1000`);
  await expect(page.getByRole("heading", {name: "Track-stream persistence"})).toBeVisible();
  await expect(page.locator('[data-metric-id="track-launch"]')).not.toContainText("Unavailable");
  await expect(page.locator('[data-metric-id="track-days-14-28"]')).not.toContainText("Unavailable");
  await expect(page.locator('[data-metric-id="track-peak"]')).not.toContainText("Unavailable");
  await expect(page.getByText(/continued streaming activity/i).first()).toBeVisible();
  await expect(page.getByRole("heading", {name: "Track-stream persistence"})).not.toContainText(/listener retention/i);
});

test("Journey 5b: track persistence renders without a campaign while audience remains no campaign", async ({page}) => {
  await page.goto(`/admin/retention-lab?releaseId=${releaseIds.noCampaign}`);
  await expect(page.locator('[role="status"]').filter({hasText: "NO CAMPAIGN"}).first()).toBeVisible();
  await expect(page.locator('[data-track-persistence-state="AVAILABLE"]')).toBeVisible();
  await expect(page.locator('[data-metric-id="track-launch"]')).toContainText("138.29");
  await expect(page.locator('[data-metric-id="track-days-14-28"]')).toContainText("317.73");
  await expect(page.locator('[data-metric-id="track-latest"]')).toContainText("340.14");
  await expect(page.locator('[data-metric-id="track-peak"]')).toContainText("582");
  await expect(page.locator('[data-metric-id="track-persistence"]')).toContainText("229.77%");
  await expect(page.locator('[data-metric-id="track-latest-launch"]')).toContainText("245.97%");
  await expect(page.getByText(/does not measure unique listener retention/i).first()).toBeVisible();
  await page.goto(`/admin/releases/${releaseIds.noCampaign}#audience-retention`);
  await expect(page.getByRole("heading", {name: "Audience Retention", exact: true})).toBeVisible();
  await expect(page.locator('[role="status"]').filter({hasText: "NO CAMPAIGN"}).first()).toBeVisible();
  await expect(page.locator('[data-track-persistence-state="AVAILABLE"]')).toBeVisible();
});

test("Journey 6: missing accepted audience data shows import guidance", async ({page}) => {
  await prisma.analyticsImport.update({where: {id: importIds[0]}, data: {status: "WITHDRAWN", withdrawnAt: new Date()}});
  try {
    await page.goto(`/admin/retention-lab?releaseId=${releaseIds.complete}&campaignId=${campaignIds.complete}`);
    await expect(page.getByText("NO AUDIENCE IMPORT")).toBeVisible();
    await expect(page.getByRole("link", {name: "Import Spotify data"})).toBeVisible();
    await expect(page.locator('[data-testid="retention-analysis-view"]')).toHaveCount(0);
  } finally {
    await prisma.analyticsImport.update({where: {id: importIds[0]}, data: {status: "IMPORTED", withdrawnAt: null}});
  }
});

for (const points of [180, 365, 1000]) {
  test(`${points}-day production range renders within smoke budget`, async ({page}) => {
    const startedAt = Date.now();
    await page.goto(`/admin/retention-lab?releaseId=${releaseIds.complete}&campaignId=${campaignIds.complete}&range=${points}`);
    await expect(page.locator(".recharts-wrapper").first()).toBeVisible();
    const elapsed = Date.now() - startedAt;
    console.info(`Stage 8 ${points}-day dashboard render: ${elapsed} ms`);
    expect(elapsed).toBeLessThan(7000);
    await expect(page.getByText(new RegExp(`Inspect ${points} timeline rows`))).toBeAttached();
  });
}

test("responsive widths, reduced motion, print, and private payload remain safe", async ({page}) => {
  await page.emulateMedia({reducedMotion: "reduce"});
  for (const width of [375, 390, 768, 1280, 1600]) {
    await page.setViewportSize({width, height: 900});
    await page.goto(`/admin/retention-lab?releaseId=${releaseIds.complete}&campaignId=${campaignIds.complete}&range=180`);
    await expect(page.getByTestId("retention-timeline-chart")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole("button", {name: "Audience"})).toBeVisible();
  }
  await expect(page.locator("body")).not.toContainText(new RegExp(`private/${importIds[0]}`));
  await expect(page.locator("body")).not.toContainText(/rawFileStorageKey|originalValues|previewToken/i);
  await page.emulateMedia({media: "print", reducedMotion: "reduce"});
  await expect(page.getByRole("slider", {name: "Inspect timeline date"})).toBeHidden();
  await expect(page.locator(".recharts-wrapper").first()).toBeVisible();
});
