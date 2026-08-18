import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";

const root = process.cwd();
const tempRoot = path.join(root, ".codex-temp", "ad-evidence-postgres");
const runtimeRoot = path.join(root, ".codex-temp", "gate-c-runtime");
const baselineSchema = path.join(tempRoot, "baseline.postgres.prisma");
const dataDir = path.join(tempRoot, `postgres-data-${crypto.randomUUID()}`);
const storageRoot = path.join(tempRoot, `storage-${crypto.randomUUID()}`);
const runtimeRequire = createRequire(path.join(runtimeRoot, "package.json"));
const EmbeddedPostgres = (runtimeRequire("embedded-postgres").default ?? runtimeRequire("embedded-postgres"));
const {Client} = runtimeRequire("pg");

function run(label, command, args, env = process.env) {
  const result = spawnSync(command, args, {cwd: root, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: false});
  if (result.status !== 0) throw new Error(`${label} failed\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function freePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close((error) => error ? reject(error) : resolve(address.port)); }); server.on("error", reject); }); }
function url(port, password, database) { return `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}?schema=public`; }
async function connect(port, password, database) { const db = new Client({connectionString: url(port, password, database)}); db.on("error", () => {}); await db.connect(); return db; }

await fs.mkdir(storageRoot, {recursive: true});
const baseline = run("read baseline schema", "git", ["show", "HEAD:prisma/schema.postgres.prisma"]);
await fs.writeFile(baselineSchema, baseline);
const port = await freePort(); const password = crypto.randomBytes(24).toString("base64url"); const database = "ad_evidence_rehearsal";
const embedded = new EmbeddedPostgres({databaseDir: dataDir, user: "postgres", password, port, persistent: false, onLog: () => {}, onError: () => {}});
let started = false;
try {
  await embedded.initialise(); await embedded.start(); started = true; await embedded.createDatabase(database);
  const env = {...process.env, DATABASE_URL: url(port, password, database), DIRECT_URL: url(port, password, database), AUTH_SECRET: "ad-evidence-rehearsal-auth-secret-at-least-32-chars", PRIVATE_STORAGE_DRIVER: "local", STORAGE_ROOT: storageRoot, ADS_PREVIEW_RETENTION_MINUTES: "15"};
  run("push baseline", process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", baselineSchema, "--skip-generate"], env);
  let db = await connect(port, password, database);
  await db.query(`
    DO $roles$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $roles$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anon,authenticated,service_role;
    INSERT INTO "AdminUser" (id,username,"createdAt","updatedAt") VALUES ('test-admin','test-admin',now(),now());
    INSERT INTO "ArtistProfile" (id,slug,"displayName","draftUpdatedAt","createdAt","updatedAt") VALUES ('artist-test','artist-test','Artist Test',now(),now(),now());
    INSERT INTO "Release" (id,title,slug,"primaryArtistProfileId","createdOn","updatedOn") VALUES ('release-test','Test Release','test-release','artist-test',now(),now());
    INSERT INTO "CopyEntry" (id,"releaseId",hook,caption,"createdOn","updatedOn") VALUES ('copy-a','release-test','Hook','Caption',now(),now()),('copy-b','release-test','Hook 2','Caption 2',now(),now());
  `);
  const legacyReportIds = [];
  for (let batch = 0; batch < 17; batch += 1) {
    const reportingEnd = new Date(Date.UTC(2026, 0, 28 + batch * 7)); const reportingStart = new Date(reportingEnd); reportingStart.setUTCDate(reportingStart.getUTCDate() - 27); const exportedAt = new Date(reportingEnd); exportedAt.setUTCDate(exportedAt.getUTCDate() + 1);
    await db.query(`INSERT INTO "AdImportBatch" (id,name,"releaseId","reportingStart","reportingEnd","exportedAt","createdAt","updatedAt") VALUES ($1,$2,'release-test',$3,$4,$5,now(),now())`, [`legacy-${batch}`, `Mahoraga Snapshot ${batch}`, reportingStart, reportingEnd, exportedAt]);
    const reportCount = batch < 5 || batch >= 15 ? 10 : 8;
    for (let item = 0; item < reportCount; item += 1) { const id = `legacy-report-${batch}-${item}`; legacyReportIds.push(id); await db.query(`INSERT INTO "AdCreativeReport" (id,"importBatchId","releaseId","adName",spend,"createdAt","updatedAt") VALUES ($1,$2,'release-test',$3,$4,now(),now())`, [id, `legacy-${batch}`, `Creative ${item % 32}`, item]); }
  }
  for (let item = 0; item < 109; item += 1) await db.query(`INSERT INTO "AdCreativeCopyLink" (id,"adCreativeReportId","copyEntryId","createdAt") VALUES ($1,$2,$3,now())`, [`legacy-copy-${item}`, legacyReportIds[item], item % 2 ? "copy-a" : "copy-b"]);
  const before = (await db.query(`SELECT (SELECT count(*)::int FROM "AdImportBatch") batches,(SELECT count(*)::int FROM "AdCreativeReport") reports,(SELECT count(*)::int FROM "AdCreativeCopyLink") copy_links`)).rows[0];
  assert.deepEqual(before, {batches: 17, reports: 150, copy_links: 109}); await db.end();

  run("push evidence schema", process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.postgres.prisma", "--skip-generate", "--accept-data-loss"], env);
  db = await connect(port, password, database);
  await db.query(await fs.readFile(path.join(root, "docs/operations/manifests/ad-lab-gate-e1-postgres-companion.sql"), "utf8"));
  const legacy = (await db.query(`SELECT count(*)::int count FROM "AdImportBatch" WHERE "sourceGranularity"='AGGREGATE_SNAPSHOT' AND NOT "campaignIntervalEligible" AND "eligibilityReason"='LEGACY_AGGREGATE_SNAPSHOT'`)).rows[0].count;
  assert.equal(legacy, 17);
  assert.deepEqual((await db.query(`SELECT (SELECT count(*)::int FROM "AdCreativeReport") reports,(SELECT count(*)::int FROM "AdCreativeCopyLink") copy_links`)).rows[0], {reports: 150, copy_links: 109});
  for (const role of ["anon", "authenticated", "service_role"]) for (const table of ["MetaDailyResolution", "MetaAccountTimezoneResolution"]) {
    await db.query("BEGIN"); try { await db.query(`SET LOCAL ROLE ${role}`); await assert.rejects(db.query(`SELECT * FROM "${table}"`), (error) => error.code === "42501"); } finally { await db.query("ROLLBACK"); }
  }
  await db.end();

  run("generate postgres client", process.execPath, ["scripts/run-prisma.mjs", "generate", "--schema", "prisma/schema.postgres.prisma"], env);
  run("campaign timeline regression", process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/test-campaign-timeline.ts"], env);
  Object.assign(process.env, env);
  const {createMetaImportPreview, commitMetaImport, withdrawMetaImport} = await import("../lib/ads/meta-import-service.ts");
  const {createMetaPromotionLink, transitionMetaPromotionLink} = await import("../lib/ads/meta-promotion-links.ts");
  const {confirmMetaAccountTimezone, readCurrentMetaAccountTimezone} = await import("../lib/ads/meta-account-timezones.ts");
  const {addCampaignInterval, generateMetaIntervalSuggestions, reconcileMetaCampaignSuggestions} = await import("../lib/analytics/campaign-timeline-service.ts");
  const {prisma} = await import("../lib/db/prisma.ts");
  const actor = {userId: "test-admin", username: "test-admin"};
  const makeFile = (spend, sourceAsOf, campaignName = "Mahoraga") => ({fileName: `daily-${spend}.csv`, bytes: new TextEncoder().encode(`Account ID,Account name,Account timezone,Currency,Campaign ID,Campaign name,Ad set ID,Ad set name,Ad ID,Ad name,Reporting starts,Reporting ends,Amount spent,Impressions,Results,Result indicator,Delivery,Attribution setting\nact-1,VVV,America/New_York,USD,cmp-1,${campaignName},set-1,Broad,ad-1,Creative,2026-08-01,2026-08-01,${spend},100,2,Link clicks,Active,7-day click`), sourceAsOf});
  async function importDaily(spend, asOf, key) {
    const file = makeFile(spend, asOf); const preview = await createMetaImportPreview({actor, files: [{fileName: file.fileName, bytes: file.bytes}], context: {attributionSetting: "7-day click", sourceAsOf: asOf, expectedGranularity: "DAILY", releaseId: "release-test", name: `Daily ${spend}`}});
    assert.equal(preview.canCommit, true); const committed = await commitMetaImport({actor, previewToken: preview.previewToken, clientIdempotencyKey: key, confirmFinalReview: true, acknowledgeWarnings: true}); return {...committed, previewToken: preview.previewToken};
  }
  const first = await importDaily(10, "2026-08-02T12:00:00.000Z", "daily-first-0000000001");
  assert.equal((await commitMetaImport({actor, previewToken: first.previewToken, clientIdempotencyKey: "daily-first-0000000001", confirmFinalReview: true, acknowledgeWarnings: true})).code, "IMPORT_COMMIT_REPLAYED");
  const exactFile = makeFile(10, "2026-08-02T12:00:00.000Z");
  const duplicatePreview = await createMetaImportPreview({actor, files: [{fileName: exactFile.fileName, bytes: exactFile.bytes}], context: {attributionSetting: "7-day click", sourceAsOf: "2026-08-02T12:00:00.000Z", expectedGranularity: "DAILY", releaseId: "release-test", name: "Duplicate"}});
  assert.equal(duplicatePreview.code, "DUPLICATE_BUNDLE");
  const secondAdBytes = new TextEncoder().encode(new TextDecoder().decode(exactFile.bytes).replace("ad-1,Creative", "ad-2,Creative Two"));
  const partialPreview = await createMetaImportPreview({actor, files: [{fileName: exactFile.fileName, bytes: exactFile.bytes}, {fileName: "second-ad.csv", bytes: secondAdBytes}], context: {attributionSetting: "7-day click", sourceAsOf: "2026-08-02T12:00:00.000Z", expectedGranularity: "DAILY", releaseId: "release-test", name: "Partial"}});
  assert.equal(partialPreview.code, "PARTIAL_DUPLICATE_BUNDLE");
  const corrected = await importDaily(12, "2026-08-03T12:00:00.000Z", "daily-second-000000001");
  assert.equal(await prisma.metaDailySourceObservation.count(), 4);
  assert.equal((await prisma.metaDailyResolution.findFirst({where: {metricFamily: "SPEND"}, include: {currentObservation: true}})).currentObservation.spend, 12);
  assert.equal(await prisma.metaDailyResolutionEvent.count(), 4);
  const expiryStartedAt = new Date();
  const expiryFiles = Array.from({length: 4}, (_, index) => {
    const file = makeFile(20 + index, "2026-08-04T12:00:00.000Z", "Expiry Contract");
    return {fileName: `expiry-${index}.csv`, bytes: new TextEncoder().encode(new TextDecoder().decode(file.bytes).replace("cmp-1,Mahoraga,set-1,Broad,ad-1,Creative", `cmp-expiry,Expiry Contract,set-expiry,Broad,ad-expiry-${index},Creative ${index}`))};
  });
  const beforeExpiry = {batches: await prisma.adImportBatch.count(), observations: await prisma.metaDailySourceObservation.count()};
  const expiryPreview = await createMetaImportPreview({actor, files: expiryFiles, context: {attributionSetting: "7-day click", sourceAsOf: "2026-08-04T12:00:00.000Z", expectedGranularity: "DAILY", releaseId: "release-test", name: "Expiry rehearsal"}, now: expiryStartedAt});
  assert.equal(expiryPreview.canCommit, true);
  await assert.rejects(commitMetaImport({actor, previewToken: expiryPreview.previewToken, clientIdempotencyKey: "expired-preview-000001", confirmFinalReview: true, acknowledgeWarnings: true, now: new Date(expiryStartedAt.getTime() + 16 * 60_000)}), (error) => error.code === "EXPIRED_PREVIEW");
  assert.deepEqual({batches: await prisma.adImportBatch.count(), observations: await prisma.metaDailySourceObservation.count()}, beforeExpiry);
  const storage = await import("../lib/server/asset-storage.ts");
  const previewArtifactsBeforeExpiryCleanup = (await storage.listStoredAssetReferences("ads-preview")).length;
  assert.ok(previewArtifactsBeforeExpiryCleanup >= 4);
  const {runRetentionCleanup} = await import("../lib/analytics/retention-cleanup.ts");
  const expiredPreviewCleanup = await runRetentionCleanup({dryRun: false}, {list: storage.listStoredAssetReferences, metaList: storage.listStoredAssetReferences, remove: storage.deleteStoredAssetStrict, now: () => new Date(expiryStartedAt.getTime() + 16 * 60_000)});
  assert.equal(expiredPreviewCleanup.expiredMetaPreviews.deleted, previewArtifactsBeforeExpiryCleanup);
  assert.equal((await storage.listStoredAssetReferences("ads-preview")).length, 0);
  const registryNow = new Date("2026-08-05T12:00:00.000Z");
  await confirmMetaAccountTimezone({accountId: "act-registry", timezone: "America/New_York", sourceOrigin: "USER_CONFIRMED", actor, now: registryNow});
  await assert.rejects(confirmMetaAccountTimezone({accountId: "act-registry", timezone: "America/Chicago", sourceOrigin: "USER_CONFIRMED", actor, now: new Date(registryNow.getTime() + 1000)}), (error) => error.code === "TIMEZONE_CONFLICT_REVIEW_REQUIRED");
  await confirmMetaAccountTimezone({accountId: "act-registry", timezone: "America/Chicago", sourceOrigin: "USER_CONFIRMED", replaceCurrent: true, reason: "Reviewed account setting change", actor, now: new Date(registryNow.getTime() + 2000)});
  assert.equal((await readCurrentMetaAccountTimezone("act-registry")).ianaTimezone, "America/Chicago");
  assert.equal(await prisma.metaAccountTimezoneResolution.count({where: {accountId: "act-registry", resolutionState: "SUPERSEDED"}}), 1);
  const registrySource = new TextDecoder().decode(makeFile(33, null, "Registry Campaign").bytes).replace("act-1,VVV,America/New_York", "act-registry,VVV,").replace("cmp-1,Registry Campaign,set-1", "cmp-registry,Registry Campaign,set-registry").replace("ad-1,Creative", "ad-registry,Creative");
  const registryPreview = await createMetaImportPreview({actor, files: [{fileName: "registry-no-timezone.csv", bytes: new TextEncoder().encode(registrySource)}], context: {attributionSetting: "7-day click", expectedGranularity: "DAILY", releaseId: "release-test", name: "Registry reuse"}, now: registryNow});
  assert.equal(registryPreview.bundle.coreTimingEligible, true); assert.equal(registryPreview.bundle.normalizedTimezone, "America/Chicago"); assert.equal(registryPreview.bundle.timezoneSource, "USER_CONFIRMED");
  const conflictingSource = registrySource.replace("act-registry,VVV,", "act-registry,VVV,America/New_York");
  await assert.rejects(createMetaImportPreview({actor, files: [{fileName: "registry-source-conflict.csv", bytes: new TextEncoder().encode(conflictingSource)}], context: {attributionSetting: "7-day click", expectedGranularity: "DAILY", releaseId: "release-test", name: "Registry conflict"}}), (error) => error.code === "TIMEZONE_CONFLICT_REVIEW_REQUIRED");
  const registryCleanup = await runRetentionCleanup({dryRun: false}, {list: storage.listStoredAssetReferences, metaList: storage.listStoredAssetReferences, remove: storage.deleteStoredAssetStrict, now: () => new Date(Date.now() + 16 * 60_000)});
  assert.equal(registryCleanup.expiredMetaPreviews.deleted, 1);
  const fallbackBase = makeFile(3, null, "Fallback Campaign");
  const fallbackFile = {fileName: "fallback.csv", bytes: fallbackBase.bytes};
  const fallbackPreview = await createMetaImportPreview({actor, files: [fallbackFile], context: {attributionSetting: "7-day click", sourceAsOf: null, expectedGranularity: "DAILY", releaseId: "release-test", name: "Fallback provenance"}});
  const fallbackCommitted = await commitMetaImport({actor, previewToken: fallbackPreview.previewToken, clientIdempotencyKey: "fallback-source-asof-01", confirmFinalReview: true, acknowledgeWarnings: true});
  const fallbackBatch = await prisma.adImportBatch.findUniqueOrThrow({where: {id: fallbackCommitted.importId}});
  assert.equal(fallbackBatch.sourceAsOfOrigin, "IMPORT_ACCEPTED_FALLBACK");
  assert.equal(fallbackBatch.sourceAsOf.toISOString(), fallbackBatch.acceptedAt.toISOString());
  await prisma.promotionCampaign.create({data: {id: "campaign-test", artistProfileId: "artist-test", releaseId: "release-test", platform: "META", name: "Disposable Test", objective: "STREAMS", status: "DRAFT", createdAt: new Date(), updatedAt: new Date()}});
  await prisma.promotionCampaign.create({data: {id: "campaign-other", artistProfileId: "artist-test", releaseId: "release-test", platform: "META", name: "Disposable Other", objective: "STREAMS", status: "DRAFT", createdAt: new Date(), updatedAt: new Date()}});
  const suggested = await createMetaPromotionLink({promotionCampaignId: "campaign-test", accountId: "act-1", scopeType: "CAMPAIGN", externalCampaignId: "cmp-1", currentDisplayName: "Renamed Campaign", actor});
  await assert.rejects(transitionMetaPromotionLink({promotionCampaignId: "campaign-other", linkId: suggested.id, status: "CONFIRMED", reason: "Cross-campaign mutation must fail", actor}), (error) => error.code === "NOT_FOUND");
  assert.equal((await generateMetaIntervalSuggestions("campaign-test", actor)).code, "META_LINK_CONFIRMATION_REQUIRED");
  await transitionMetaPromotionLink({promotionCampaignId: "campaign-test", linkId: suggested.id, status: "CONFIRMED", reason: "Disposable rehearsal confirmation", actor});
  const generated = await generateMetaIntervalSuggestions("campaign-test", actor); assert.equal(generated.created, 1);
  const correctedWithdrawal = await withdrawMetaImport({actor, importId: corrected.importId, reason: "Disposable corrected-export withdrawal"});
  assert.equal(correctedWithdrawal.campaignEvidenceSync.status, "SYNCED");
  assert.equal(correctedWithdrawal.campaignEvidenceSync.suggestionsCreated, 1, "withdrawal automatically regenerates linked campaign evidence");
  assert.equal((await prisma.metaDailyResolution.findFirst({where: {campaignId: "cmp-1", metricFamily: "SPEND"}, include: {currentObservation: true}})).currentObservation.spend, 10, "an import-time fallback cannot outrank an authoritative source timestamp");
  assert.equal(await prisma.metaDailySourceObservation.count(), 6);
  assert.equal(await prisma.campaignEvidence.count({where: {campaignId: "campaign-test", suggestionState: "CURRENT"}}), 1);
  assert.equal(await prisma.campaignEvidence.count({where: {campaignId: "campaign-test", suggestionState: "SUPERSEDED"}}), 1);

  const shiftHeader = `Account ID,Account name,Account timezone,Currency,Campaign ID,Campaign name,Ad set ID,Ad set name,Ad ID,Ad name,Reporting starts,Reporting ends,Amount spent,Impressions,Results,Result indicator,Delivery,Attribution setting`;
  const shiftFile = (name, june12Spend, june13Spend) => ({fileName: name, bytes: new TextEncoder().encode(`${shiftHeader}\nact-1,VVV,America/New_York,USD,cmp-shift,Shift Campaign,set-shift,Broad,ad-shift,Creative,2026-06-12,2026-06-12,${june12Spend},100,,,Active,7-day click\nact-1,VVV,America/New_York,USD,cmp-shift,Shift Campaign,set-shift,Broad,ad-shift,Creative,2026-06-13,2026-06-13,${june13Spend},100,,,Active,7-day click`)});
  async function importShift(file, asOf, key) { const preview = await createMetaImportPreview({actor, files: [file], context: {attributionSetting: "7-day click", sourceAsOf: asOf, expectedGranularity: "DAILY", releaseId: "release-test", name: key}}); return commitMetaImport({actor, previewToken: preview.previewToken, clientIdempotencyKey: key, confirmFinalReview: true, acknowledgeWarnings: true}); }
  const shiftInitial = await importShift(shiftFile("shift-initial.csv", 10, 0), "2026-06-14T12:00:00.000Z", "shift-initial-000001");
  await prisma.promotionCampaign.create({data: {id: "campaign-shift", artistProfileId: "artist-test", releaseId: "release-test", platform: "META", name: "Disposable Shift", objective: "STREAMS", status: "DRAFT", createdAt: new Date(), updatedAt: new Date()}});
  const shiftSuggested = await createMetaPromotionLink({promotionCampaignId: "campaign-shift", accountId: "act-1", scopeType: "CAMPAIGN", externalCampaignId: "cmp-shift", actor});
  await transitionMetaPromotionLink({promotionCampaignId: "campaign-shift", linkId: shiftSuggested.id, status: "CONFIRMED", reason: "Disposable shift link", actor});
  await addCampaignInterval("campaign-shift", {actor, activeStartDate: "2026-06-01", activeEndDate: "2026-06-05", timezone: "America/New_York", confirmationStatus: "CONFIRMED"});
  assert.equal((await generateMetaIntervalSuggestions("campaign-shift", actor)).created, 1);
  let shiftCurrent = await prisma.campaignEvidence.findFirstOrThrow({where: {campaignId: "campaign-shift", suggestionState: "CURRENT"}});
  assert.equal(shiftCurrent.suggestedStartDate.toISOString().slice(0, 10), "2026-06-12");
  const shiftCorrection = await importShift(shiftFile("shift-corrected.csv", 0, 10), "2026-06-15T12:00:00.000Z", "shift-corrected-0001");
  assert.equal(shiftCorrection.campaignEvidenceSync.status, "SYNCED");
  assert.equal(shiftCorrection.campaignEvidenceSync.suggestionsCreated, 1, "accepted imports automatically supersede stale suggestions");
  const shiftReplay = await commitMetaImport({actor, previewToken: "unused-after-idempotency-match", clientIdempotencyKey: "shift-corrected-0001", confirmFinalReview: true, acknowledgeWarnings: true});
  assert.equal(shiftReplay.code, "IMPORT_COMMIT_REPLAYED");
  assert.equal(shiftReplay.campaignEvidenceSync.status, "SYNCED");
  assert.equal(shiftReplay.campaignEvidenceSync.suggestionsCreated, 0, "idempotent commit replay retries reconciliation without duplicating evidence");
  shiftCurrent = await prisma.campaignEvidence.findFirstOrThrow({where: {campaignId: "campaign-shift", suggestionState: "CURRENT"}});
  assert.equal(shiftCurrent.suggestedStartDate.toISOString().slice(0, 10), "2026-06-13");
  assert.equal(await prisma.campaignEvidence.count({where: {campaignId: "campaign-shift", suggestionState: "SUPERSEDED"}}), 1);
  assert.equal(await prisma.campaignActiveInterval.count({where: {campaignId: "campaign-shift", confirmationStatus: "CONFIRMED", activeStartDate: new Date("2026-06-01T00:00:00.000Z")}}), 1, "confirmed intervals are never rewritten");
  const shiftWithdrawal = await withdrawMetaImport({actor, importId: shiftCorrection.importId, reason: "Restore earlier shift evidence"});
  assert.equal(shiftWithdrawal.campaignEvidenceSync.status, "SYNCED");
  assert.equal(shiftWithdrawal.campaignEvidenceSync.suggestionsCreated, 1);
  shiftCurrent = await prisma.campaignEvidence.findFirstOrThrow({where: {campaignId: "campaign-shift", suggestionState: "CURRENT"}});
  assert.equal(shiftCurrent.suggestedStartDate.toISOString().slice(0, 10), "2026-06-12");
  assert.equal(await prisma.campaignEvidence.count({where: {campaignId: "campaign-shift", suggestionState: "SUPERSEDED"}}), 2);

  const euroShift = shiftFile("shift-eur.csv", 8, 0); euroShift.bytes = new TextEncoder().encode(new TextDecoder().decode(euroShift.bytes).replace(/USD/g, "EUR"));
  const euroCommitted = await importShift(euroShift, "2026-06-16T12:00:00.000Z", "shift-eur-0000000001");
  assert.equal(euroCommitted.campaignEvidenceSync.status, "SYNCED");
  assert.equal(await prisma.metaDailyResolution.count({where: {campaignId: "cmp-shift", metricFamily: "SPEND"}}), 4, "currencies resolve as separate spend identities");
  shiftCurrent = await prisma.campaignEvidence.findFirstOrThrow({where: {campaignId: "campaign-shift", suggestionState: "CURRENT"}});
  assert.equal(JSON.parse(shiftCurrent.metadata).currencyStatus, "MULTIPLE_CURRENCIES_NO_MONETARY_AGGREGATE");

  await prisma.promotionCampaign.create({data: {id: "campaign-shared", artistProfileId: "artist-test", releaseId: "release-test", platform: "META", name: "Disposable Shared", objective: "STREAMS", status: "DRAFT", createdAt: new Date(), updatedAt: new Date()}});
  const sharedSuggestion = await createMetaPromotionLink({promotionCampaignId: "campaign-shared", accountId: "act-1", scopeType: "CAMPAIGN", externalCampaignId: "cmp-shift", actor});
  await assert.rejects(transitionMetaPromotionLink({promotionCampaignId: "campaign-shared", linkId: sharedSuggestion.id, status: "CONFIRMED", reason: "Missing explicit shared confirmation", actor}), (error) => error.code === "SHARED_SCOPE_CONFIRMATION_REQUIRED");
  await transitionMetaPromotionLink({promotionCampaignId: "campaign-shared", linkId: sharedSuggestion.id, status: "CONFIRMED", reason: "Explicit shared campaign confirmation", confirmSharedScope: true, actor});
  const sharedCurrent = await prisma.metaPromotionLink.findMany({where: {accountId: "act-1", externalCampaignId: "cmp-shift", status: "CONFIRMED", supersededBy: null}});
  assert.equal(sharedCurrent.length, 2);
  assert.ok(sharedCurrent.every(({associationMode}) => associationMode === "SHARED_EXTERNAL_CAMPAIGN"));
  const extraSuggestion = await createMetaPromotionLink({promotionCampaignId: "campaign-shift", accountId: "act-1", scopeType: "CAMPAIGN", externalCampaignId: "cmp-extra", actor});
  await transitionMetaPromotionLink({promotionCampaignId: "campaign-shift", linkId: extraSuggestion.id, status: "CONFIRMED", reason: "Second external campaign supports one internal campaign", actor});
  assert.equal(await prisma.metaPromotionLink.count({where: {promotionCampaignId: "campaign-shift", status: "CONFIRMED", supersededBy: null}}), 2);
  const sharedScopeCalls = [];
  const sharedScopeSync = await reconcileMetaCampaignSuggestions([{accountId: "act-1", externalCampaignId: "cmp-shift"}], actor, new Date(), async (campaignId) => { sharedScopeCalls.push(campaignId); return {created: 0}; });
  assert.equal(sharedScopeSync.status, "SYNCED");
  assert.deepEqual(sharedScopeCalls, ["campaign-shared", "campaign-shift"], "stable parent scope synchronization includes every explicitly shared internal campaign");
  await addCampaignInterval("campaign-shared", {actor, activeStartDate: "2026-06-03", activeEndDate: "2026-06-04", timezone: "America/New_York", confirmationStatus: "CONFIRMED"});
  await addCampaignInterval("campaign-shared", {actor, activeStartDate: "2026-07-01", activeEndDate: "2026-07-02", timezone: "America/New_York", confirmationStatus: "CONFIRMED"});
  assert.equal(await prisma.campaignActiveInterval.count({where: {campaignId: "campaign-shared", confirmationStatus: "CONFIRMED"}}), 2, "shared links do not rewrite independent overlapping or non-overlapping Stage 7 intervals");

  const replacementFile = (name, spend, includeRemovedIdentity = false) => ({fileName: name, bytes: new TextEncoder().encode([shiftHeader, `act-1,VVV,America/New_York,USD,cmp-replace,Replacement Campaign,set-replace,Broad,ad-replace,Creative,2026-06-20,2026-06-20,${spend},100,,,Active,7-day click`, ...(includeRemovedIdentity ? [`act-1,VVV,America/New_York,USD,cmp-replace,Replacement Campaign,set-replace,Broad,ad-removed,Removed Creative,2026-06-20,2026-06-20,3,50,,,Active,7-day click`] : [])].join("\n"))});
  async function importReplacement(file, asOf, key, replacementTargetBatchId = null) {
    const preview = await createMetaImportPreview({actor, files: [file], context: {attributionSetting: "7-day click", sourceAsOf: asOf, expectedGranularity: "DAILY", releaseId: "release-test", name: key}});
    const committed = await commitMetaImport({actor, previewToken: preview.previewToken, clientIdempotencyKey: key, confirmFinalReview: true, acknowledgeWarnings: true, replacementTargetBatchId});
    return {...committed, previewToken: preview.previewToken};
  }
  const replacementInitial = await importReplacement(replacementFile("replace-initial.csv", 5, true), "2026-06-21T12:00:00.000Z", "replace-initial-0001");
  await prisma.promotionCampaign.create({data: {id: "campaign-replace", artistProfileId: "artist-test", releaseId: "release-test", platform: "META", name: "Disposable Replacement", objective: "STREAMS", status: "DRAFT", createdAt: new Date(), updatedAt: new Date()}});
  const replacementSuggested = await createMetaPromotionLink({promotionCampaignId: "campaign-replace", accountId: "act-1", scopeType: "CAMPAIGN", externalCampaignId: "cmp-replace", actor});
  const replacementLink = await transitionMetaPromotionLink({promotionCampaignId: "campaign-replace", linkId: replacementSuggested.id, status: "CONFIRMED", reason: "Disposable replacement link", actor});
  await addCampaignInterval("campaign-replace", {actor, activeStartDate: "2026-06-01", activeEndDate: "2026-06-05", timezone: "America/New_York", confirmationStatus: "CONFIRMED"});
  assert.equal((await generateMetaIntervalSuggestions("campaign-replace", actor)).created, 1);
  const replacementAccepted = await importReplacement(replacementFile("replace-corrected.csv", 7), "2026-06-22T12:00:00.000Z", "replace-corrected-0001", replacementInitial.importId);
  assert.equal(replacementAccepted.campaignEvidenceSync.status, "SYNCED");
  assert.equal(replacementAccepted.campaignEvidenceSync.suggestionsCreated, 1, "replacement automatically refreshes current evidence");
  assert.equal((await prisma.adImportBatch.findUniqueOrThrow({where: {id: replacementInitial.importId}})).importState, "REPLACED");
  assert.equal(await prisma.metaDailyResolution.count({where: {campaignId: "cmp-replace", metricFamily: "SPEND"}}), 1, "replacement recalculates and removes canonical identities omitted from the new bundle");
  const replacementWithdrawal = await withdrawMetaImport({actor, importId: replacementAccepted.importId, reason: "Disposable replacement withdrawal"});
  assert.equal(replacementWithdrawal.campaignEvidenceSync.status, "SYNCED");
  assert.equal(await prisma.campaignEvidence.count({where: {campaignId: "campaign-replace", suggestionState: "CURRENT"}}), 0, "withdrawal invalidates evidence when no accepted winner remains");
  assert.equal(await prisma.campaignActiveInterval.count({where: {campaignId: "campaign-replace", confirmationStatus: "CONFIRMED"}}), 1, "automatic synchronization never rewrites confirmed intervals");

  const duplicateLinkId = "campaign-replace-duplicate";
  await prisma.metaPromotionLink.create({data: {id: duplicateLinkId, promotionCampaignId: replacementLink.promotionCampaignId, accountId: replacementLink.accountId, scopeType: replacementLink.scopeType, externalCampaignId: replacementLink.externalCampaignId, externalAdSetId: replacementLink.externalAdSetId, externalAdId: replacementLink.externalAdId, scopeIdentityKey: replacementLink.scopeIdentityKey, currentDisplayName: replacementLink.currentDisplayName, status: "CONFIRMED", associationMode: replacementLink.associationMode, monetaryAttribution: replacementLink.monetaryAttribution, ambiguous: replacementLink.ambiguous, evidence: replacementLink.evidence, actorId: actor.userId, actorUsername: actor.username, createdAt: new Date(), updatedAt: new Date()}});
  const retryRequired = await importReplacement(replacementFile("replace-retry.csv", 9), "2026-06-23T12:00:00.000Z", "replace-retry-0000001");
  assert.equal(retryRequired.campaignEvidenceSync.status, "RETRY_REQUIRED");
  assert.equal(retryRequired.campaignEvidenceSync.failedCampaigns, 1);
  assert.equal((await prisma.adImportBatch.findUniqueOrThrow({where: {id: retryRequired.importId}})).importState, "ACCEPTED", "evidence synchronization failure cannot roll back an accepted import");
  assert.equal(await prisma.campaignActiveInterval.count({where: {campaignId: "campaign-replace", confirmationStatus: "CONFIRMED"}}), 1);
  await prisma.metaPromotionLink.delete({where: {id: duplicateLinkId}});
  const retryReplay = await commitMetaImport({actor, previewToken: retryRequired.previewToken, clientIdempotencyKey: "replace-retry-0000001", confirmFinalReview: true, acknowledgeWarnings: true});
  assert.equal(retryReplay.code, "IMPORT_COMMIT_REPLAYED");
  assert.equal(retryReplay.campaignEvidenceSync.status, "SYNCED");
  assert.equal(retryReplay.campaignEvidenceSync.suggestionsCreated, 1, "idempotent replay is the safe reconciliation retry path");

  assert.deepEqual({
    files: await prisma.metaImportFile.count(), observations: await prisma.metaDailySourceObservation.count(),
    resolutions: await prisma.metaDailyResolution.count(), links: await prisma.metaPromotionLink.count()
  }, {files: 9, observations: 16, resolutions: 7, links: 11});
  const snapshotPath = path.join(tempRoot, "snapshot.json");
  run("export snapshot", process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/export-db-snapshot.ts"], {...env, DB_SNAPSHOT_PATH: snapshotPath});
  const restoreDb = "ad_evidence_restore"; await embedded.createDatabase(restoreDb);
  const restoreEnv = {...env, DATABASE_URL: url(port, password, restoreDb), DIRECT_URL: url(port, password, restoreDb)};
  run("push restore schema", process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.postgres.prisma", "--skip-generate"], restoreEnv);
  const restoreClient = await connect(port, password, restoreDb); await restoreClient.query(await fs.readFile(path.join(root, "docs/operations/manifests/ad-lab-gate-e1-postgres-companion.sql"), "utf8")); await restoreClient.end();
  run("restore snapshot", process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/import-db-snapshot.ts"], {...restoreEnv, DB_SNAPSHOT_PATH: snapshotPath, IMPORT_AUTH: "1"});
  const restored = await connect(port, password, restoreDb);
  assert.deepEqual((await restored.query(`SELECT (SELECT count(*)::int FROM "MetaImportFile") files,(SELECT count(*)::int FROM "MetaDailySourceObservation") observations,(SELECT count(*)::int FROM "MetaDailyResolution") resolutions,(SELECT count(*)::int FROM "MetaPromotionLink") links,(SELECT count(*)::int FROM "MetaAccountTimezoneResolution") timezones`)).rows[0], {files: 9, observations: 16, resolutions: 7, links: 11, timezones: 2});
  await restored.end();
  await prisma.metaImportFile.updateMany({data: {rawExpiresAt: new Date(Date.now() - 60_000)}});
  const cleanup = await runRetentionCleanup({dryRun: false});
  assert.equal(cleanup.expiredMetaRawFiles.deleted, 9);
  assert.equal(await prisma.metaImportFile.count({where: {rawDeletedAt: {not: null}}}), 9);
  assert.equal(await prisma.metaDailySourceObservation.count(), 16);
  await prisma.$disconnect();
  console.log(JSON.stringify({suite: "ad-lab-evidence-postgres", postgres: true, legacy, sourceObservations: 16, canonicalResolutions: 7, sourceAsOfFallback: true, accountTimezoneRegistry: "confirmation-conflict-supersession-reuse", evidenceSupersession: "automatic-commit-replacement-withdrawal-and-retry", sharedExternalCampaigns: true, currencyConflict: "segmented", externalLinkRows: 11, expiredPreviewFilesCleaned: previewArtifactsBeforeExpiryCleanup + 1, roleDenials: 6, backupRestore: "equivalent", privateRawCleanup: 9}, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  throw error;
} finally {
  if (started) await embedded.stop().catch(() => undefined);
}
