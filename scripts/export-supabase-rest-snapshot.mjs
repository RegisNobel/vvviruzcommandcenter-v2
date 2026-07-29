import fs from "node:fs/promises";
import path from "node:path";

const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const snapshotPath =
  process.env.DB_SNAPSHOT_PATH ||
  path.join(
    process.cwd(),
    "storage",
    "production-backups",
    `supabase-rest-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
  );
}

const tables = [
  "AdminUser",
  "AuthSession",
  "Release",
  "ReleaseCategory",
  "ReleaseCategoryAssignment",
  "ReleaseTask",
  "ReleaseStreamingLink",
  "CopyEntry",
  "SiteSettings",
  "Subscriber",
  "EmailCampaign",
  "EmailSendLog",
  "AnalyticsEvent",
  "PublicRateLimit",
  "BackupRun",
  "AdImportBatch",
  "AdCreativeReport",
  "AdCreativeCopyLink",
  "AdCampaignLearning",
  "AppearsOn",
  "CommissionRequest",
  "short_links",
  "LinkHub",
  "Playlist",
  "PlaylistRelease",
  "OperationalHealthIssue",
  "ReleaseAnnotation",
  "ReleaseAnnotationSource",
  "FanUpdate",
  "VaultItem",
  "ArtistProfile",
  "ArtistIntake",
  "ArtistProfileVersion",
  "ArtistProfileApproval",
  "ArtistLink",
  "ArtistProfileMedia",
  "ArtistFeaturedItem",
  "ReleaseArtistCredit",
  "AppearsOnArtistCredit"
];

async function exportTable(table) {
  const rows = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?select=*`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Range: `${offset}-${offset + pageSize - 1}`,
          "Range-Unit": "items"
        }
      }
    );

    if (response.status === 404) {
      return {available: false, rows: []};
    }
    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `${table} export failed (${response.status}): ${message.slice(0, 500)}`
      );
    }

    const page = await response.json();
    if (!Array.isArray(page)) {
      throw new Error(`${table} export returned an unexpected response.`);
    }
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return {available: true, rows};
}

const exported = {};
const unavailableTables = [];

for (const table of tables) {
  const result = await exportTable(table);
  if (!result.available) unavailableTables.push(table);
  exported[table] = result.rows;
}

const snapshot = {
  exportedAt: new Date().toISOString(),
  source: "supabase-rest-service-role",
  unavailableTables,
  tables: exported
};

await fs.mkdir(path.dirname(snapshotPath), {recursive: true});
await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));

console.log(
  JSON.stringify(
    {
      message: "Supabase REST snapshot exported.",
      snapshotPath,
      unavailableTables,
      counts: Object.fromEntries(
        Object.entries(exported).map(([table, rows]) => [table, rows.length])
      )
    },
    null,
    2
  )
);
