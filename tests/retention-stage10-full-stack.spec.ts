import {createCipheriv, createHash, createHmac, randomUUID} from "node:crypto";
import fs from "node:fs/promises";
import {readFileSync} from "node:fs";
import path from "node:path";

import {expect, test, type APIRequestContext, type Page} from "@playwright/test";

const run = randomUUID();
const artistId = "artist-profile-vvviruz";
const releaseId = `stage10-e2e-release-${run}`;
const adminId = "admin-owner";
const totpSecret = "JBSWY3DPEHPK3PXP";
const importedIds: string[] = [];
let campaignId = "";
let prisma: import("@prisma/client").PrismaClient;

function envFile(file: string) {
  try { return Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/).flatMap((line) => { const match = line.match(/^([^#=]+)=(.*)$/); return match ? [[match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, "")]] : []; })); }
  catch { return {}; }
}
function encryptTotpSecret(secret: string, authSecret: string) {
  const iv = Buffer.from("gate-c-totp!", "utf8");
  const key = createHash("sha256").update(`${authSecret}:totp-secret`, "utf8").digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `enc$${iv.toString("base64url")}$${cipher.getAuthTag().toString("base64url")}$${ciphertext.toString("base64url")}`;
}
function totpCode(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0; let value = 0; const bytes: number[] = [];
  for (const character of secret) {
    value = (value << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return (binary % 1_000_000).toString().padStart(6, "0");
}
function dates(start: string, end: string) {
  const result: string[] = [];
  for (let current = new Date(`${start}T00:00:00.000Z`); current <= new Date(`${end}T00:00:00.000Z`); current = new Date(current.getTime() + 86_400_000)) result.push(current.toISOString().slice(0, 10));
  return result;
}
function audienceCsv() {
  const offset = Date.now() % 997;
  return Buffer.from(["date,listeners,monthly listeners,monthly active listeners,super listeners,streams,playlist adds,saves,followers", ...dates("2026-05-01", "2026-07-25").map((date, index) => `${date},${1000 + offset + index + (date >= "2026-06-12" && date <= "2026-06-20" ? 300 : 0)},${18000 + index},${7000 + index},1,${2300 + index},20,40,${5000 + index}`)].join("\n"));
}
function trackCsv() {
  const offset = Date.now() % 991;
  return Buffer.from(["date,streams", ...dates("2026-06-10", "2026-07-25").map((date, index) => `${date},${2000 + offset - index}`)].join("\n"));
}

async function authenticate(page: Page) {
  const username = process.env.ADMIN_USERNAME || "gate-c-admin";
  const password = process.env.GATE_C_ADMIN_PASSWORD;
  if (!password) throw new Error("GATE_C_ADMIN_PASSWORD is required for real login verification.");
  await page.goto("/admin/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", {name: "Continue to verification"}).click();
  await expect(page).toHaveURL(/\/admin\/2fa/);
  await page.getByLabel("Authenticator code").fill(totpCode(totpSecret));
  await page.getByRole("button", {name: "Verify and enter admin"}).click();
  await expect(page).toHaveURL(/\/admin\/releases/);
}

async function importCsv(request: APIRequestContext, input: {name: string; bytes: Buffer; artist?: boolean; release?: boolean; period?: boolean; type: string; mappings?: "unmatched"}) {
  const multipart: Record<string, string | {name: string; mimeType: string; buffer: Buffer}> = {file: {name: input.name, mimeType: "text/csv", buffer: input.bytes}};
  if (input.artist !== false) multipart.artist_profile_id = artistId;
  if (input.release) multipart.release_id = releaseId;
  if (input.period) { multipart.period_start = "2026-06-01"; multipart.period_end = "2026-07-31"; }
  const previewResponse = await request.post("/api/analytics/imports/preview", {multipart});
  expect(previewResponse.status(), await previewResponse.text()).toBe(200);
  const preview = await previewResponse.json();
  expect(preview.detectedType).toBe(input.type);
  const songMappings = input.mappings === "unmatched" ? preview.rowPreview.map((row: {originalRowNumber: number}) => ({originalRowNumber: row.originalRowNumber, leaveUnmatched: true, unmatchedReason: "USER_DEFERRED", unmatchedNote: "Stage 10 mapping action follows commit"})) : undefined;
  const commitResponse = await request.post("/api/analytics/imports/commit", {data: {previewToken: preview.previewToken, clientIdempotencyKey: `stage10-${input.type.toLowerCase()}-${run}`, artistProfileId: artistId, releaseId: input.release ? releaseId : null, periodStart: input.period ? "2026-06-01" : null, periodEnd: input.period ? "2026-07-31" : null, acknowledgeWarnings: true, acknowledgeFilenameNotIdentity: input.release, acknowledgeTrackStreamsNotRetention: input.release, songMappings}});
  expect(commitResponse.status(), await commitResponse.text()).toBe(200);
  const committed = await commitResponse.json();
  importedIds.push(committed.importId);
  return committed.importId as string;
}

async function cleanup() {
  const stored = importedIds.length ? await prisma.analyticsImport.findMany({where: {id: {in: importedIds}}, select: {rawFileStorageKey: true}}) : [];
  if (campaignId) {
    await prisma.campaignAuditEvent.deleteMany({where: {campaignId}});
    await prisma.campaignTimelineEvent.updateMany({where: {campaignId}, data: {supersedesEventId: null}});
    await prisma.campaignTimelineEvent.deleteMany({where: {campaignId}});
    await prisma.campaignActiveInterval.updateMany({where: {campaignId}, data: {supersedesIntervalId: null}});
    await prisma.campaignActiveInterval.deleteMany({where: {campaignId}});
    await prisma.campaignEvidence.deleteMany({where: {campaignId}});
    await prisma.promotionCampaign.deleteMany({where: {id: campaignId}});
  }
  await prisma.mappingAuditEvent.deleteMany({where: {importId: {in: importedIds}}});
  await prisma.songPeriodSnapshot.deleteMany({where: {importId: {in: importedIds}}});
  await prisma.analyticsImportRow.deleteMany({where: {importId: {in: importedIds}}});
  await prisma.playlistPeriodSnapshot.deleteMany({where: {importId: {in: importedIds}}});
  await prisma.trackMetricObservation.deleteMany({where: {importId: {in: importedIds}}});
  await prisma.artistMetricObservation.deleteMany({where: {importId: {in: importedIds}}});
  await prisma.analyticsImport.updateMany({where: {id: {in: importedIds}}, data: {replacedByImportId: null}});
  await prisma.analyticsImport.deleteMany({where: {id: {in: importedIds}}});
  await prisma.releaseImportAlias.deleteMany({where: {releaseId}});
  await prisma.release.deleteMany({where: {id: releaseId}});
  await prisma.authSession.deleteMany({where: {userId: adminId}});
  for (const item of stored) {
    if (!item.rawFileStorageKey || /^https?:/i.test(item.rawFileStorageKey)) continue;
    const file = path.basename(item.rawFileStorageKey);
    await fs.rm(path.join(process.cwd(), "storage", "analytics-raw", file), {force: true});
  }
}

test.beforeAll(async () => {
  process.env.DATABASE_URL = process.env.GATE_C_DATABASE_URL || "file:c:/Users/regis/Desktop/Codex/vvviruzcommandcenter/storage/vvviruz-command-center.db";
  const client = await import("@prisma/client");
  prisma = new client.PrismaClient();
  const secret = process.env.AUTH_SECRET || envFile(".env.production.local").AUTH_SECRET || envFile(".env.local").AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required.");
  const username = process.env.ADMIN_USERNAME || "gate-c-admin";
  await prisma.adminUser.deleteMany({where: {username, id: {not: adminId}}});
  await prisma.adminUser.upsert({
    where: {id: adminId},
    create: {id: adminId, username, totpMethod: "totp", totpEncryptedSecret: encryptTotpSecret(totpSecret, secret), totpEnrolledAt: new Date(), createdAt: new Date(), updatedAt: new Date()},
    update: {username, totpMethod: "totp", totpEncryptedSecret: encryptTotpSecret(totpSecret, secret), totpEnrolledAt: new Date(), updatedAt: new Date()}
  });
  await prisma.release.create({data: {id: releaseId, title: "Mahoraga Stage 10", slug: `mahoraga-stage10-${run}`, catalogScope: "VVVIRUZ", primaryArtistProfileId: artistId, releaseDate: new Date("2026-06-10T00:00:00.000Z"), createdOn: new Date(), updatedOn: new Date()}});
});
test.afterAll(async () => {
  if (process.env.GATE_C_RETAIN_FIXTURES === "1") {
    const output = path.join(process.cwd(), ".codex-temp", "gate-c-rehearsal", "workflow.json");
    await fs.writeFile(output, JSON.stringify({run, artistId, releaseId, campaignId, importedIds}, null, 2));
  } else {
    await cleanup();
  }
  await prisma.$disconnect();
});

test("real-route import, mapping, campaign, retention, dashboard, withdrawal, reprocess, and cleanup journey", async ({context, page}) => {
  await authenticate(page);
  const request = context.request;
  const audienceId = await importCsv(request, {name: "artist-audience.csv", bytes: audienceCsv(), type: "ARTIST_AUDIENCE_TIMELINE"});
  const trackId = await importCsv(request, {name: "Mahoraga (Jujutsu Kaisen Rap)-timeline.csv", bytes: trackCsv(), type: "TRACK_STREAM_TIMELINE", release: true});
  const songSource = await fs.readFile(path.join(process.cwd(), "tests", "fixtures", "spotify-exports", "songs-period.csv"), "utf8");
  const songsId = await importCsv(request, {name: "songs.csv", bytes: Buffer.from(songSource.replace("10120", String(10120 + (Date.now() % 1000)))), type: "SONGS_PERIOD", period: true, mappings: "unmatched"});
  const playlistSource = await fs.readFile(path.join(process.cwd(), "tests", "fixtures", "spotify-exports", "playlists-period.csv"), "utf8");
  await importCsv(request, {name: "playlists.csv", bytes: Buffer.from(playlistSource.replace("3239", String(3239 + (Date.now() % 1000)))), type: "PLAYLISTS_PERIOD", period: true});

  const mappingRow = await prisma.analyticsImportRow.findFirstOrThrow({where: {importId: songsId}, orderBy: {sourceRowNumber: "asc"}});
  const mappingResponse = await request.post(`/api/analytics/mappings/${mappingRow.id}/confirm`, {data: {releaseId, createAlias: false, acknowledgeNoDateAlias: false, reason: "Stage 10 verified manual mapping"}});
  expect(mappingResponse.status(), await mappingResponse.text()).toBe(200);

  const campaignResponse = await request.post("/api/analytics/campaigns", {data: {artistProfileId: artistId, releaseId, platform: "META", name: `Stage 10 Campaign ${run}`, objective: "STREAMS"}});
  expect(campaignResponse.status(), await campaignResponse.text()).toBe(201);
  campaignId = (await campaignResponse.json()).campaignId;
  const intervalResponse = await request.post(`/api/analytics/campaigns/${campaignId}/intervals`, {data: {activeStartDate: "2026-06-12", activeEndDate: "2026-06-20", timezone: "America/New_York", sourceType: "MANUAL", confirmationStatus: "CONFIRMED"}});
  expect(intervalResponse.status(), await intervalResponse.text()).toBe(201);
  const analysisResponse = await request.get(`/api/analytics/retention/releases/${releaseId}?campaignId=${campaignId}`);
  expect(analysisResponse.status(), await analysisResponse.text()).toBe(200);

  await page.goto(`/admin/retention-lab?releaseId=${releaseId}&campaignId=${campaignId}&range=180`);
  await expect(page.getByRole("heading", {name: "Audience Retention Lab"})).toBeVisible();
  await expect(page.getByTestId("retention-timeline-chart")).toBeVisible();
  await expect(page.getByText(/Inspect 180 timeline rows/)).toBeAttached();

  const withdrawal = await request.post(`/api/analytics/imports/${audienceId}/withdraw`, {data: {reason: "Stage 10 current-resolution verification"}});
  expect(withdrawal.status(), await withdrawal.text()).toBe(200);
  const currentAudience = await prisma.analyticsImport.findUniqueOrThrow({where: {id: audienceId}});
  expect(currentAudience.status).toBe("WITHDRAWN");
  const reprocess = await request.post(`/api/analytics/imports/${audienceId}/reprocess`);
  expect(reprocess.status(), await reprocess.text()).toBe(200);
  expect((await reprocess.json()).code).toBe("PREVIEW_READY");

  await prisma.analyticsImport.update({where: {id: trackId}, data: {rawFileExpiresAt: new Date(Date.now() - 1000), rawFileDeletedAt: null}});
  const cronSecret = process.env.CRON_SECRET || "stage10-playwright-cron-secret";
  const dryRun = await request.get("/api/cron/analytics-maintenance?dryRun=1", {headers: {authorization: `Bearer ${cronSecret}`}});
  expect(dryRun.status(), await dryRun.text()).toBe(200);
  expect((await prisma.analyticsImport.findUniqueOrThrow({where: {id: trackId}})).rawFileDeletedAt).toBeNull();
  const applied = await request.get("/api/cron/analytics-maintenance", {headers: {authorization: `Bearer ${cronSecret}`}});
  expect([200, 207]).toContain(applied.status());
  expect((await prisma.analyticsImport.findUniqueOrThrow({where: {id: trackId}})).rawFileDeletedAt).not.toBeNull();
  expect(await prisma.trackMetricObservation.count({where: {importId: trackId}})).toBeGreaterThan(0);
});
