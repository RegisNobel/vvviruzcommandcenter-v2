import fs from "node:fs";
import path from "node:path";
import {PrismaClient} from "@prisma/client";
import {privilegedDataApiHeaders, requireModernSecretKey} from "./lib/supabase-data-api-auth.mjs";

function loadEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const hasMatchingQuotes =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"));
    const value = hasMatchingQuotes
      ? rawValue.slice(1, -1)
      : rawValue;

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const profileSlug = process.argv[2]?.trim();

if (!profileSlug) {
  throw new Error(
    "Pass the local artist profile slug, for example: node scripts/promote-local-artist-profile.mjs yonko"
  );
}

const productionEnvFile = path.resolve(
  process.cwd(),
  process.env.PRODUCTION_ENV_FILE || ".env.production.local"
);
loadEnvFile(productionEnvFile);

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
)
  .trim()
  .replace(/\/+$/, "");
const secretKey = requireModernSecretKey();

if (!supabaseUrl) {
  throw new Error(
    "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is required."
  );
}

const prisma = new PrismaClient();

async function restRequest(table, query = "", init = {}) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}${query}`,
    {
      ...init,
      headers: {
        ...privilegedDataApiHeaders(secretKey),
        ...(init.headers || {})
      }
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Supabase ${init.method || "GET"} ${table} failed (${response.status}): ${body}`
    );
  }

  if (response.status === 204) {
    return null;
  }

  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function findProductionRow(table, id) {
  const rows = await restRequest(
    table,
    `?id=eq.${encodeURIComponent(id)}&select=id&limit=1`
  );
  return rows?.[0] || null;
}

async function upsertRows(table, rows) {
  if (!rows.length) {
    return;
  }

  await restRequest(table, "?on_conflict=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });
}

async function patchRow(table, id, values) {
  await restRequest(table, `?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(values)
  });
}

try {
  const profile = await prisma.artistProfile.findUnique({
    where: {slug: profileSlug}
  });

  if (!profile) {
    throw new Error(`Local artist profile "${profileSlug}" was not found.`);
  }

  if (await findProductionRow("ArtistProfile", profile.id)) {
    throw new Error(
      `Production already contains artist profile "${profile.id}". This command will not overwrite it.`
    );
  }

  const [
    versions,
    approvals,
    links,
    media,
    featuredItems,
    releaseCredits,
    appearsOnCredits
  ] = await Promise.all([
    prisma.artistProfileVersion.findMany({
      where: {artistProfileId: profile.id},
      orderBy: {version: "asc"}
    }),
    prisma.artistProfileApproval.findMany({
      where: {artistProfileId: profile.id},
      orderBy: {createdAt: "asc"}
    }),
    prisma.artistLink.findMany({
      where: {artistProfileId: profile.id},
      orderBy: {sortOrder: "asc"}
    }),
    prisma.artistProfileMedia.findMany({
      where: {artistProfileId: profile.id},
      orderBy: {sortOrder: "asc"}
    }),
    prisma.artistFeaturedItem.findMany({
      where: {artistProfileId: profile.id},
      orderBy: {sortOrder: "asc"}
    }),
    prisma.releaseArtistCredit.findMany({
      where: {artistProfileId: profile.id},
      orderBy: {displayOrder: "asc"}
    }),
    prisma.appearsOnArtistCredit.findMany({
      where: {artistProfileId: profile.id},
      orderBy: {displayOrder: "asc"}
    })
  ]);

  const referencedReleaseIds = [
    ...new Set(
      [
        ...featuredItems.map((item) => item.releaseId),
        ...releaseCredits.map((credit) => credit.releaseId)
      ].filter(Boolean)
    )
  ];
  const missingReleaseIds = [];

  for (const releaseId of referencedReleaseIds) {
    if (!(await findProductionRow("Release", releaseId))) {
      missingReleaseIds.push(releaseId);
    }
  }

  const releases = await prisma.release.findMany({
    where: {id: {in: missingReleaseIds}}
  });
  const unsafeMissingReleases = releases.filter(
    (release) =>
      release.catalogScope !== "ARTIST" ||
      release.primaryArtistProfileId !== profile.id
  );

  if (
    releases.length !== missingReleaseIds.length ||
    unsafeMissingReleases.length
  ) {
    throw new Error(
      "A referenced production release is missing and is not an artist-owned release from this profile."
    );
  }

  const missingReleaseWhere = {releaseId: {in: missingReleaseIds}};
  const [
    streamingLinks,
    releaseTasks,
    categoryAssignments,
    annotations,
    annotationSources
  ] = await Promise.all([
    prisma.releaseStreamingLink.findMany({where: missingReleaseWhere}),
    prisma.releaseTask.findMany({where: missingReleaseWhere}),
    prisma.releaseCategoryAssignment.findMany({where: missingReleaseWhere}),
    prisma.releaseAnnotation.findMany({where: missingReleaseWhere}),
    prisma.releaseAnnotationSource.findMany({
      where: {annotation: missingReleaseWhere}
    })
  ]);

  const publishedVersionId = profile.publishedVersionId;

  await upsertRows("ArtistProfile", [
    {...profile, publishedVersionId: null}
  ]);
  await upsertRows("Release", releases);
  await upsertRows("ArtistProfileVersion", versions);
  await upsertRows("ArtistLink", links);
  await upsertRows("ArtistProfileMedia", media);
  await upsertRows("ReleaseStreamingLink", streamingLinks);
  await upsertRows("ReleaseTask", releaseTasks);
  await upsertRows("ReleaseCategoryAssignment", categoryAssignments);
  await upsertRows("ReleaseAnnotation", annotations);
  await upsertRows("ReleaseAnnotationSource", annotationSources);
  await upsertRows("ArtistFeaturedItem", featuredItems);
  await upsertRows("ArtistProfileApproval", approvals);
  await upsertRows("ReleaseArtistCredit", releaseCredits);
  await upsertRows("AppearsOnArtistCredit", appearsOnCredits);

  if (publishedVersionId) {
    await patchRow("ArtistProfile", profile.id, {publishedVersionId});
  }

  console.log(
    JSON.stringify(
      {
        message: "Artist profile bundle promoted to production.",
        profile: {
          id: profile.id,
          slug: profile.slug,
          displayName: profile.displayName,
          workflowStatus: profile.workflowStatus
        },
        counts: {
          versions: versions.length,
          approvals: approvals.length,
          links: links.length,
          media: media.length,
          featuredItems: featuredItems.length,
          releases: releases.length,
          streamingLinks: streamingLinks.length,
          releaseCredits: releaseCredits.length,
          appearsOnCredits: appearsOnCredits.length
        }
      },
      null,
      2
    )
  );
} finally {
  await prisma.$disconnect();
}
