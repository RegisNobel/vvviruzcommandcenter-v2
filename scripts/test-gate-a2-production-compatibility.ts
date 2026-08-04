import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const run = randomUUID();
const prefix = `Gate A2 ${run}`;

async function loadEnvFile(fileName: string) {
  let raw: string;
  try { raw = await fs.readFile(path.resolve(root, fileName), "utf8"); } catch { return; }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function postSubmission(baseUrl: string, input: Record<string, string>, forwardedFor?: string) {
  return fetch(`${baseUrl}/api/breaking-barz/submissions`, {
    method: "POST",
    headers: {"content-type": "application/json", ...(forwardedFor ? {"x-forwarded-for": forwardedFor} : {})},
    body: JSON.stringify(input)
  });
}

async function main() {
  await loadEnvFile(process.env.GATE_A2_ENV_FILE || ".env.production.local");
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.DIRECT_URL || process.env.DATABASE_URL;
  const baseUrl = (process.env.GATE_A2_PRODUCTION_URL || "https://vvviruz.com").replace(/\/$/, "");
  assert.ok(/^https:\/\/(?:www\.)?vvviruz\.com$/i.test(baseUrl), "Production vvviruz URL is required.");
  const [{prisma}, repository] = await Promise.all([
    import("../lib/db/prisma"),
    import("../lib/repositories/breaking-barz")
  ]);
  const createdEntryIds = new Set<string>();
  const createdSubmissionIds = new Set<string>();
  const checks: Record<string, unknown> = {};

  async function cleanup() {
    const submissions = await prisma.breakingBarzSubmission.findMany({where: {songTitle: {startsWith: prefix}}, select: {id: true, promotedEntryId: true}});
    for (const row of submissions) {
      createdSubmissionIds.add(row.id);
      if (row.promotedEntryId) createdEntryIds.add(row.promotedEntryId);
    }
    const entries = await prisma.breakingBarzEntry.findMany({where: {songTitle: {startsWith: prefix}}, select: {id: true}});
    for (const row of entries) createdEntryIds.add(row.id);
    if (createdSubmissionIds.size) {
      await prisma.breakingBarzSubmission.updateMany({where: {id: {in: [...createdSubmissionIds]}}, data: {promotedEntryId: null}});
      await prisma.breakingBarzSubmission.deleteMany({where: {id: {in: [...createdSubmissionIds]}}});
    }
    if (createdEntryIds.size) await prisma.breakingBarzEntry.deleteMany({where: {id: {in: [...createdEntryIds]}}});
  }

  try {
    const [publicFeed, options] = await Promise.all([
      repository.listPublicBreakingBarz({page: 1}),
      repository.listBreakingBarzFilterOptions()
    ]);
    assert.ok(publicFeed.entries.length > 0);
    const sample = publicFeed.entries[0];
    const category = sample.categories[0]?.slug || options.categories[0]?.slug;
    const publicRequests = [
      ["index", "/breaking-barz"],
      ["artist", `/breaking-barz?artist=${encodeURIComponent(sample.artistNames[0] || "vvviruz")}`],
      ["song", `/breaking-barz?song=${encodeURIComponent(sample.songTitle)}`],
      ["category", `/breaking-barz?category=${encodeURIComponent(category || "wordplay")}`],
      ["pagination", "/breaking-barz?page=2"],
      ["detail", `/breaking-barz/${encodeURIComponent(sample.slug)}`]
    ] as const;
    for (const [name, pathname] of publicRequests) {
      const response = await fetch(`${baseUrl}${pathname}`);
      assert.equal(response.status, 200, `${name} returned ${response.status}`);
      const html = await response.text();
      assert.ok(html.length > 500, `${name} response was unexpectedly empty`);
      if (name === "detail") {
        assert.match(html, /rel="canonical"/);
        assert.ok(html.includes(sample.songTitle));
      }
    }
    const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemap.status, 200);
    const sitemapXml = await sitemap.text();
    assert.ok(sitemapXml.includes("/breaking-barz"));
    assert.ok(sitemapXml.includes(`/breaking-barz/${sample.slug}`));
    const linked = publicFeed.entries.find((entry) => entry.releaseSlug);
    if (linked) {
      const releasePage = await fetch(`${baseUrl}/music/${encodeURIComponent(linked.releaseSlug)}`);
      assert.equal(releasePage.status, 200);
      assert.ok((await releasePage.text()).includes(linked.songTitle));
    }
    checks.public = {routes: publicRequests.length, sitemap: true, releaseAnnotationPage: Boolean(linked)};

    const unauthenticated = await fetch(`${baseUrl}/admin/breaking-barz`, {redirect: "manual"});
    assert.ok([302, 303, 307, 308].includes(unauthenticated.status));
    const createTitle = `${prefix} Admin Entry`;
    const originalInput = {
      songTitle: createTitle,
      artistNames: ["Gate A2 Artist"],
      lyricExcerpt: "Gate A2 private draft line",
      summary: "Gate A2 original summary",
      breakdown: "Gate A2 original full breakdown for production compatibility verification.",
      verificationStatus: "interpretation",
      verificationNote: "Gate A2 private verification note",
      categorySlugs: [category || "wordplay"],
      spotifyUrl: "",
      appleMusicUrl: "",
      youtubeUrl: "",
      sources: [],
      action: "draft" as const
    };
    const created = await repository.saveExternalBreakingBarzEntry(originalInput);
    let entry = await prisma.breakingBarzEntry.findUniqueOrThrow({where: {id: created.id}, include: {versions: true, categories: true}});
    createdEntryIds.add(entry.id);
    assert.equal(entry.status, "draft");
    assert.equal(entry.versions.length, 1);
    assert.ok(entry.categories.length > 0);
    assert.equal((await fetch(`${baseUrl}/breaking-barz/${entry.slug}`)).status, 404);

    await repository.saveExternalBreakingBarzEntry({...originalInput, id: entry.id, action: "publish"});
    entry = await prisma.breakingBarzEntry.findUniqueOrThrow({where: {id: entry.id}, include: {versions: {orderBy: {version: "asc"}}, categories: true}});
    assert.equal(entry.status, "published");
    assert.ok(entry.currentPublishedVersionId);
    assert.equal((await fetch(`${baseUrl}/breaking-barz/${entry.slug}`)).status, 200);

    const revisedTitle = `${prefix} Admin Entry Revised`;
    const revisedInput = {...originalInput, id: entry.id, songTitle: revisedTitle, summary: "Gate A2 private revision summary", action: "draft" as const};
    await repository.saveExternalBreakingBarzEntry(revisedInput);
    let versions = await prisma.breakingBarzVersion.findMany({where: {entryId: entry.id}, orderBy: {version: "asc"}});
    assert.equal(versions.length, 2);
    assert.equal(versions[0].editorialStatus, "published");
    assert.equal(versions[1].editorialStatus, "draft");
    assert.equal((await repository.getPublicBreakingBarzEntry(entry.slug))?.songTitle, createTitle);

    await repository.saveExternalBreakingBarzEntry({...revisedInput, action: "publish"});
    versions = await prisma.breakingBarzVersion.findMany({where: {entryId: entry.id}, orderBy: {version: "asc"}});
    assert.equal(versions[0].editorialStatus, "superseded");
    assert.equal(versions[1].editorialStatus, "published");
    assert.equal((await repository.getPublicBreakingBarzEntry(entry.slug))?.songTitle, revisedTitle);
    await repository.saveExternalBreakingBarzEntry({...revisedInput, action: "withdraw"});
    assert.equal((await fetch(`${baseUrl}/breaking-barz/${entry.slug}`)).status, 404);

    const submissionBase = {
      artistNames: "Gate A2 Artist",
      lyricExcerpt: "Gate A2 submission line",
      summary: "Gate A2 submission summary",
      breakdown: "Gate A2 submission breakdown long enough for review.",
      songUrl: "https://example.com/gate-a2",
      submitterName: "Gate A2 Private Name",
      submitterEmail: "gate-a2@example.invalid",
      website: ""
    };
    const rejectTitle = `${prefix} Submission Reject`;
    const publishTitle = `${prefix} Submission Publish`;
    for (const songTitle of [rejectTitle, publishTitle]) {
      const response = await postSubmission(baseUrl, {...submissionBase, songTitle});
      assert.equal(response.status, 201, `valid submission returned ${response.status}`);
      const row = await prisma.breakingBarzSubmission.findFirstOrThrow({where: {songTitle}});
      createdSubmissionIds.add(row.id);
      assert.equal(row.status, "pending");
      assert.equal(row.submitterEmail, submissionBase.submitterEmail);
    }
    const honeypot = await postSubmission(baseUrl, {...submissionBase, songTitle: `${prefix} Honeypot`, website: "bot"});
    assert.equal(honeypot.status, 400);
    const invalidUrl = await postSubmission(baseUrl, {...submissionBase, songTitle: `${prefix} Invalid URL`, songUrl: "http://not-https.invalid"});
    assert.equal(invalidUrl.status, 400);
    assert.equal(await prisma.breakingBarzSubmission.count({where: {songTitle: {in: [`${prefix} Honeypot`, `${prefix} Invalid URL`]}}}), 0);

    const rejectSubmission = await prisma.breakingBarzSubmission.findFirstOrThrow({where: {songTitle: rejectTitle}});
    await repository.reviewBreakingBarzSubmission({id: rejectSubmission.id, action: "reject", reviewNote: "Gate A2 rejection verification"});
    assert.equal((await prisma.breakingBarzSubmission.findFirstOrThrow({where: {songTitle: rejectTitle}})).status, "rejected");
    const publishSubmission = await prisma.breakingBarzSubmission.findFirstOrThrow({where: {songTitle: publishTitle}});
    await repository.reviewBreakingBarzSubmission({
      id: publishSubmission.id,
      action: "publish",
      reviewNote: "Gate A2 approval verification",
      entry: {...originalInput, songTitle: publishTitle, verificationNote: "", action: "publish"}
    });
    const publishedSubmission = await prisma.breakingBarzSubmission.findFirstOrThrow({where: {songTitle: publishTitle}});
    assert.equal(publishedSubmission.status, "published");
    assert.ok(publishedSubmission.promotedEntryId);
    createdEntryIds.add(publishedSubmission.promotedEntryId);
    const promoted = await prisma.breakingBarzEntry.findUniqueOrThrow({where: {id: publishedSubmission.promotedEntryId}});
    assert.equal((await fetch(`${baseUrl}/breaking-barz/${promoted.slug}`)).status, 200);

    await repository.saveExternalBreakingBarzEntry({...originalInput, id: promoted.id, songTitle: publishTitle, verificationNote: "", action: "archive"});
    assert.equal((await prisma.breakingBarzEntry.findUniqueOrThrow({where: {id: promoted.id}})).status, "archived");
    assert.equal((await fetch(`${baseUrl}/breaking-barz/${promoted.slug}`)).status, 404);

    const publicBodies = await Promise.all([
      fetch(`${baseUrl}/breaking-barz`).then((response) => response.text()),
      fetch(`${baseUrl}/sitemap.xml`).then((response) => response.text())
    ]);
    for (const body of publicBodies) {
      assert.equal(body.includes(submissionBase.submitterEmail), false);
      assert.equal(body.includes(submissionBase.submitterName), false);
      assert.equal(body.includes("Gate A2 private revision summary"), false);
    }

    const rateIp = `192.0.2.${10 + Math.floor(Math.random() * 100)}`;
    const rateMessages: string[] = [];
    for (let index = 0; index < 7; index += 1) {
      const response = await postSubmission(baseUrl, {...submissionBase, songTitle: `${prefix} Rate ${index}`, songUrl: "http://not-https.invalid"}, rateIp);
      const body = await response.json().catch(() => ({})) as {message?: string};
      if (body.message) rateMessages.push(body.message);
    }
    const rateLimited = rateMessages.some((message) => /too many suggestions/i.test(message));
    checks.trustedPrismaWorkflows = {create: true, draft: true, publish: true, archive: true, withdraw: true, categoryAssignment: true, versioning: true, submissionApprove: true, submissionReject: true};
    checks.adminServerActions = {
      passed: false,
      blocker: "AUTH_SECRET_BELOW_MINIMUM",
      configuredLength: process.env.AUTH_SECRET?.length || 0,
      requiredMinimum: 32,
      unauthenticatedRedirect: true
    };
    checks.submission = {valid: true, pendingServerControlled: true, honeypot: true, invalidUrl: true, privateFieldsHidden: true, rateLimited};
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  const leftovers = await (async () => {
    const client = await import("../lib/db/prisma");
    const count = await client.prisma.breakingBarzEntry.count({where: {songTitle: {startsWith: prefix}}}) +
      await client.prisma.breakingBarzSubmission.count({where: {songTitle: {startsWith: prefix}}});
    await client.prisma.$disconnect();
    return count;
  })();
  assert.equal(leftovers, 0, "Gate A2 production test cleanup left records behind.");
  console.log(JSON.stringify({checks, cleanup: {remainingTestRecords: leftovers}}, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
